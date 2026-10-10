import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const json = (res: VercelResponse, status: number, body: Record<string, unknown>) => res.status(status).json(body)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  const authorization = req.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return json(res, 401, { error: 'กรุณาเข้าสู่ระบบก่อน' })
  const token = authorization.slice(7)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!url || !serviceKey) return json(res, 503, { error: 'ยังไม่ได้ตั้งค่า Supabase service role สำหรับ Telegram' })
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await db.auth.getUser(token)
  if (authError || !authData.user) return json(res, 401, { error: 'Session ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' })
  const userId = authData.user.id
  const body = typeof req.body === 'object' && req.body ? req.body as Record<string, unknown> : {}
  const action = String(body.action || '')

  if (action === 'subscribe') {
    const enabled = body.enabled === true
    const chatId = String(body.chatId || '').trim()
    if (enabled && !chatId) return json(res, 400, { error: 'กรุณากรอก Telegram Chat ID' })
    const { error } = await db.from('telegram_subscriptions').upsert({ user_id: userId, chat_id: chatId || null, enabled, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) return json(res, 500, { error: `บันทึกการสมัคร Telegram ไม่สำเร็จ: ${error.message}` })
    return json(res, 200, { ok: true, message: enabled ? 'สมัครรับแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนแล้ว' })
  }

  if (!botToken) return json(res, 503, { error: 'ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN บนเซิร์ฟเวอร์' })
  const sendMessage = async (chatId: string, text: string) => {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3500), disable_web_page_preview: true }),
    })
    if (!response.ok) throw new Error(`Telegram API returned ${response.status}`)
  }

  if (action === 'test') {
    const { data: subscription, error } = await db.from('telegram_subscriptions').select('chat_id,enabled').eq('user_id', userId).maybeSingle()
    if (error) return json(res, 500, { error: `อ่านการสมัคร Telegram ไม่สำเร็จ: ${error.message}` })
    if (!subscription?.enabled || !subscription.chat_id) return json(res, 400, { error: 'ยังไม่ได้เปิดรับแจ้งเตือน Telegram' })
    try { await sendMessage(subscription.chat_id, '🌸 Aevora: เชื่อมต่อ Telegram สำเร็จ! คุณสมัครเข้าร่วมทดลองระบบแจ้งเตือนแล้ว') }
    catch { return json(res, 502, { error: 'ส่งข้อความทดสอบไม่สำเร็จ ตรวจสอบ Chat ID และเริ่มแชตกับบอตก่อน' }) }
    return json(res, 200, { ok: true })
  }

  if (action === 'notify') {
    const roomId = String(body.roomId || '')
    const message = String(body.message || '').trim()
    const eventType = String(body.eventType || '')
    const allowedEvents = new Set(['member_joined', 'tasks_assigned', 'work_submitted', 'help_request', 'comment', 'submitted_for_review', 'review_approved'])
    if (!roomId || !message || !allowedEvents.has(eventType)) return json(res, 400, { error: 'ข้อมูลการแจ้งเตือนไม่ถูกต้อง' })
    const { data: room, error: roomError } = await db.from('group_rooms').select('id,owner_id,name').eq('id', roomId).maybeSingle()
    if (roomError || !room) return json(res, 404, { error: 'ไม่พบห้องงานกลุ่ม' })
    const { data: member } = await db.from('group_members').select('user_id').eq('room_id', roomId).eq('user_id', userId).maybeSingle()
    if (room.owner_id !== userId && !member) return json(res, 403, { error: 'คุณไม่ได้เป็นสมาชิกของห้องนี้' })
    const { data: members, error: membersError } = await db.from('group_members').select('user_id').eq('room_id', roomId)
    if (membersError) return json(res, 500, { error: 'อ่านสมาชิกห้องไม่สำเร็จ' })
    const recipientIds = [...new Set([room.owner_id, ...(members || []).map(item => item.user_id)])]
    const { data: subscriptions, error: subsError } = await db.from('telegram_subscriptions').select('user_id,chat_id').in('user_id', recipientIds).eq('enabled', true)
    if (subsError) return json(res, 500, { error: 'อ่านรายชื่อผู้สมัครรับแจ้งเตือนไม่สำเร็จ' })
    const recipients = (subscriptions || []).filter(item => item.chat_id)
    const results = await Promise.allSettled(recipients.map(item => sendMessage(String(item.chat_id), `🌸 Aevora · ${room.name}\n${message}`)))
    const failed = results.filter(item => item.status === 'rejected').length
    return json(res, 200, { ok: true, sent: results.length - failed, failed })
  }
  return json(res, 400, { error: 'ไม่รู้จัก action นี้' })
}
