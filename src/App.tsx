import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabase'

import './App.css'

type Subtask = {
  id: number
  title: string
  done: boolean
}

type TaskAttachment = {
  id: number
  name: string
  size: number
  dataUrl?: string
  addedAt: string
  storagePath?: string
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024
const ATTACHMENT_DB = 'aevora_attachment_store'
const ATTACHMENT_STORE = 'files'

const CHARACTER_OPTIONS = [
  { id: 'g1', gender: 'หญิง', name: 'เจ้าหญิงชมพู', file: '/images/characters/g1.png' },
  { id: 'g2', gender: 'หญิง', name: 'นักอ่านแห่งดวงดาว', file: '/images/characters/g2.png' },
  { id: 'g3', gender: 'หญิง', name: 'สาวน้อยโกธิก', file: '/images/characters/g3.png' },
  { id: 'g4', gender: 'หญิง', name: 'นักเดินทางหิมะ', file: '/images/characters/g4.png' },
  { id: 'g5', gender: 'หญิง', name: 'แม่มดม่วง', file: '/images/characters/g5.png' },
  { id: 'g6', gender: 'หญิง', name: 'ภูตแห่งสวนดอกไม้', file: '/images/characters/g6.png' },
  { id: 'g7', gender: 'หญิง', name: 'นักฝันสีชมพู', file: '/images/characters/g7.png' },
  { id: 'b1', gender: 'ชาย', name: 'เกมเมอร์รัตติกาล', file: '/images/characters/b1.png' },
  { id: 'b2', gender: 'ชาย', name: 'นักเดินทางป่า', file: '/images/characters/b2.png' },
  { id: 'b3', gender: 'ชาย', name: 'นักผจญภัยสีทอง', file: '/images/characters/b3.png' },
  { id: 'b4', gender: 'ชาย', name: 'นักสเกตเพลิง', file: '/images/characters/b4.png' },
  { id: 'b5', gender: 'ชาย', name: 'เกมเมอร์น้ำแข็ง', file: '/images/characters/b5.png' },
] as const

const PET_OPTIONS = [
  { id: 'pet1', name: 'กระต่ายหัวใจ', file: '/images/pets/Pet1.png' },
  { id: 'pet2', name: 'แมวดำเวทมนตร์', file: '/images/pets/Pet2.png' },
  { id: 'pet3', name: 'แมวหลับจันทร์', file: '/images/pets/Pet3.png' },
  { id: 'pet4', name: 'เมฆน้อยพ่อมด', file: '/images/pets/Pet4.png' },
  { id: 'pet5', name: 'ภูตใบไม้', file: '/images/pets/Pet5.png' },
  { id: 'pet6', name: 'จิ้งจอกดวงดาว', file: '/images/pets/Pet6.png' },
  { id: 'pet7', name: 'ก้อนเมฆปุย', file: '/images/pets/Pet7.png' },
  { id: 'pet8', name: 'ค้างคาวรัตติกาล', file: '/images/pets/Pet8.png' },
 ] as const

const ROOM_OPTIONS = [
  { icon: '🌙', name: 'ห้องอ่านหนังสือยามค่ำคืน', theme: '🌙 ห้องอ่านหนังสือยามค่ำคืน', file: '/images/room-backgrounds/bg-room-night.png', description: 'โต๊ะทำงานแสนอบอุ่นใต้ท้องฟ้าดวงดาว' },
  { icon: '🌸', name: 'ห้องพักสวนดอกไม้', theme: '🌸 ห้องพักสวนดอกไม้', file: '/images/room-backgrounds/bg-room-garden.png', description: 'มุมพักผ่อนท่ามกลางดอกไม้และแสงโคม' },
  { icon: '🌿', name: 'ห้องสวนเวทมนตร์', theme: '🌿 ห้องสวนเวทมนตร์', file: '/images/room-backgrounds/bg-room-greenhouse.png', description: 'ห้องกระจกที่เต็มไปด้วยต้นไม้และแสงอาทิตย์' },
  { icon: '✨', name: 'ห้องนอนใต้แสงจันทร์', theme: '✨ ห้องนอนใต้แสงจันทร์', file: '/images/room-backgrounds/bg-room-moonlight.png', description: 'ห้องนอนนุ่ม ๆ กับพระจันทร์เสี้ยว' },
] as const

function normalizeRoomTheme(value: string | null) {
  if (value && ROOM_OPTIONS.some(item => item.theme === value)) return value
  if (value?.includes('สวนดอกไม้')) return ROOM_OPTIONS[1].theme
  if (value?.includes('ป่ามหัศจรรย์') || value?.includes('สวนเวทมนตร์')) return ROOM_OPTIONS[2].theme
  if (value?.includes('นอน') || value?.includes('จันทร์')) return ROOM_OPTIONS[3].theme
  return ROOM_OPTIONS[0].theme
}

function normalizePetValue(value: string | undefined) {
  if (value && PET_OPTIONS.some(item => value.startsWith(item.id))) return value
  // Convert previously saved emoji-based pet choices to the closest matching image pet.
  if (value?.includes('จิ้งจอก')) return 'pet6 จิ้งจอกดวงดาว'
  if (value?.includes('แมว')) return 'pet2 แมวดำเวทมนตร์'
  if (value?.includes('กระต่าย')) return 'pet1 กระต่ายหัวใจ'
  return 'pet1 กระต่ายหัวใจ'
}

function characterLabel(id: string) {
  const item = CHARACTER_OPTIONS.find(character => character.id === id) || CHARACTER_OPTIONS[0]
  return `${item.id} · ${item.name}`
}


function openAttachmentDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ATTACHMENT_DB, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(ATTACHMENT_STORE)) request.result.createObjectStore(ATTACHMENT_STORE) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getAttachmentBlob(key: string): Promise<Blob | undefined> {
  const db = await openAttachmentDb()
  const result = await new Promise<Blob | undefined>((resolve, reject) => { const request = db.transaction(ATTACHMENT_STORE, 'readonly').objectStore(ATTACHMENT_STORE).get(key); request.onsuccess = () => resolve(request.result as Blob | undefined); request.onerror = () => reject(request.error) })
  db.close()
  return result
}

async function removeAttachmentBlob(key: string): Promise<void> {
  const db = await openAttachmentDb()
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(ATTACHMENT_STORE, 'readwrite'); tx.objectStore(ATTACHMENT_STORE).delete(key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) })
  db.close()
}

type TaskComment = { id: number; author: string; text: string; createdAt: string; privateNote: boolean }
type HelpRequest = { id: number; text: string; status: 'เปิดอยู่' | 'แก้ไขแล้ว'; createdAt: string }
type ActivityEntry = { id: number; text: string; createdAt: string }

type GroupRoom = {
  id: number
  dbId: string
  ownerId: string
  name: string
  code: string
  members: { userId: string; role: string }[]
}

type Task = {

  id: number

  title: string

  subject: string

  type: 'งานเดี่ยว' | 'งานกลุ่ม'

  due: string

  dueDate?: string
  description?: string
  subtasks?: Subtask[]
  groupRoomId?: number
  assignedTo?: string
  attachments?: TaskAttachment[]
  comments?: TaskComment[]
  helpRequests?: HelpRequest[]
  activity?: ActivityEntry[]
  completedAt?: string

  progress: number

  done: boolean

}

const initialTasks: Task[] = [

  { id: 1, title: 'ทำสไลด์นำเสนอ บทที่ 3', subject: 'วิชาการตลาดดิจิทัล', type: 'งานกลุ่ม', due: 'วันนี้ 14:00', progress: 80, done: false },

  { id: 2, title: 'เขียนรายงานผลการทดลอง', subject: 'วิชาวิทยาศาสตร์สิ่งแวดล้อม', type: 'งานเดี่ยว', due: 'วันนี้ 20:00', progress: 30, done: false },

  { id: 3, title: 'หาข้อมูลอ้างอิงเพิ่มเติม', subject: 'โปรเจกต์วิจัยกลุ่ม', type: 'งานกลุ่ม', due: 'พรุ่งนี้', progress: 0, done: false },

  { id: 4, title: 'ออกแบบโปสเตอร์กิจกรรม', subject: 'ชมรมการศึกษา', type: 'งานเดี่ยว', due: 'พรุ่งนี้', progress: 0, done: false },

  { id: 5, title: 'อ่านบททบทวนเตรียมสอบ', subject: 'วิชาจิตวิทยา', type: 'งานเดี่ยว', due: '12 ต.ค.', progress: 0, done: false },

]

const navItems = [

  ['⌂', 'หน้าหลัก'], ['▤', 'งานของฉัน'], ['♧', 'งานกลุ่ม'], ['▦', 'ปฏิทิน'],

  ['⌂', 'พื้นที่ส่วนตัว'], ['♙', 'ตัวละคร'], ['✉', 'เชิญเพื่อน'], ['✓', 'ภารกิจ'], ['♜', 'ความสำเร็จ'],

  ['⚙', 'ตั้งค่า'],

]

const rewardItems = [
  { id: 'moon-lamp', icon: '🌙', name: 'โคมจันทร์', goal: 1, description: 'รางวัลแรกของการเริ่มต้น' },
  { id: 'flower-vase', icon: '🌷', name: 'แจกันดอกไม้', goal: 3, description: 'รางวัลจากการทำงานสำเร็จ 3 งาน' },
  { id: 'star-sparkle', icon: '✨', name: 'ประกายดาว', goal: 5, description: 'รางวัลจากความพยายาม 5 งาน' },
  { id: 'tiny-plant', icon: '🪴', name: 'ต้นไม้จิ๋ว', goal: 10, description: 'รางวัลพิเศษเมื่อสำเร็จ 10 งาน' },
]

type RewardUnlock = { id: string; unlockedAt: string }

type Filter = 'ทั้งหมด' | 'กำลังทำ' | 'เสร็จแล้ว' | 'งานเดี่ยว' | 'งานกลุ่ม'

function getTaskProgress(task: Task) {
  if (task.done) return 100
  if (task.subtasks?.length) return Math.round(task.subtasks.filter(item => item.done).length / task.subtasks.length * 100)
  return task.progress || 0
}

function App() {
  const [authSession, setAuthSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setAuthLoading(false)
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) console.error('ตรวจสอบสถานะการเข้าสู่ระบบไม่สำเร็จ:', error.message)
      setAuthSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session)
      setAuthLoading(false)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])


  const [tasks, setTasks] = useState<Task[]>(() => {

    try {

      const saved = localStorage.getItem('aevora_tasks')

      return saved ? (JSON.parse(saved) as Task[]) : initialTasks

    } catch {

      return initialTasks

    }

  })

 const [activeNav, setActiveNav] = useState(() => {

  try {

    return localStorage.getItem('aevora_active_nav') || 'หน้าหลัก'

  } catch {

    return 'หน้าหลัก'

  }

})

  const [showForm, setShowForm] = useState(false)

  const [search, setSearch] = useState('')

  const [filter, setFilter] = useState<Filter>('ทั้งหมด')

  const [editingId, setEditingId] = useState<number | null>(null)

  const [title, setTitle] = useState('')

  const [subject, setSubject] = useState('')

  const [type, setType] = useState<'งานเดี่ยว' | 'งานกลุ่ม'>('งานเดี่ยว')

  const [due, setDue] = useState('')
  const [description, setDescription] = useState('')
  const [taskRoomId, setTaskRoomId] = useState<number | ''>('')
  const [assignedTo, setAssignedTo] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [groupRooms, setGroupRooms] = useState<GroupRoom[]>(() => {
    try { return JSON.parse(localStorage.getItem('aevora_group_rooms') || '[]') as GroupRoom[] }
    catch { return [] }
  })
  const [newRoomName, setNewRoomName] = useState('')
  const [joinRoomCode, setJoinRoomCode] = useState('')
  const [groupRoomBusy, setGroupRoomBusy] = useState(false)
  const [groupRoomMessage, setGroupRoomMessage] = useState('')
  const [selectedRoomId] = useState<number | null>(null)
  const [selectedInviteRoomId, setSelectedInviteRoomId] = useState<number | null>(null)
  const [inviteFormat, setInviteFormat] = useState<'link' | 'code' | 'message'>('message')
  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('join')
    if (inviteCode) { setJoinRoomCode(inviteCode.toUpperCase()); setActiveNav('งานกลุ่ม') }
  }, [])
  const [selectedCharacter, setSelectedCharacter] = useState(() => { const saved = localStorage.getItem('aevora_character'); return saved && CHARACTER_OPTIONS.some(item => item.id === saved) ? saved : 'g1' })
  const [selectedGender, setSelectedGender] = useState<'หญิง' | 'ชาย'>(() => localStorage.getItem('aevora_character_gender') === 'ชาย' ? 'ชาย' : 'หญิง')
  const [selectedPet, setSelectedPet] = useState(() => normalizePetValue(localStorage.getItem('aevora_pet') || undefined))
  const selectedPetOption = PET_OPTIONS.find(item => selectedPet.startsWith(item.id)) || PET_OPTIONS[0]
  const [selectedRoomTheme, setSelectedRoomTheme] = useState(() => normalizeRoomTheme(localStorage.getItem('aevora_room_theme')))
  const selectedRoomOption = ROOM_OPTIONS.find(item => item.theme === selectedRoomTheme) || ROOM_OPTIONS[0]
  const [profileName, setProfileName] = useState(() => localStorage.getItem('aevora_profile_name') || 'แบม')
  const [profileEmoji, setProfileEmoji] = useState(() => localStorage.getItem('aevora_profile_emoji') || '🌷')
  const [profileBio, setProfileBio] = useState(() => localStorage.getItem('aevora_profile_bio') || 'ค่อย ๆ เติบโตไปทีละก้าว ✨')
  const [backupMessage, setBackupMessage] = useState('')
  const [rewardUnlocks, setRewardUnlocks] = useState<RewardUnlock[]>(() => {
    try { return JSON.parse(localStorage.getItem('aevora_reward_unlocks') || '[]') as RewardUnlock[] }
    catch { return [] }
  })
  const [equippedDecorations, setEquippedDecorations] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('aevora_equipped_decorations') || '[]') as string[] }
    catch { return [] }
  })

  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('กำลังเชื่อมต่อข้อมูล...')
  const [sharedTasksReady, setSharedTasksReady] = useState(false)

  // Group rooms and membership are stored in their own shared Supabase tables.
  useEffect(() => {
    let cancelled = false
    async function loadGroupRooms() {
      if (!supabase || !authSession?.user?.id || !cloudReady) return
      const userId = authSession.user.id
      try {
        const { data: memberships, error: memberError } = await supabase
          .from('group_members')
          .select('room_id,user_id,role')
          .eq('user_id', userId)
        if (memberError) throw memberError
        const joinedRoomIds = (memberships || []).map(row => row.room_id as string)
        let roomQuery = supabase.from('group_rooms').select('id,owner_id,name,invite_code,created_at')
        if (joinedRoomIds.length) {
          roomQuery = roomQuery.or(`owner_id.eq.${userId},id.in.(${joinedRoomIds.join(',')})`)
        } else {
          roomQuery = roomQuery.eq('owner_id', userId)
        }
        const { data: rooms, error: roomError } = await roomQuery.order('created_at', { ascending: false })
        if (roomError) throw roomError
        const roomIds = (rooms || []).map(room => room.id as string)
        let allMemberships: { room_id: string; user_id: string; role: string }[] = []
        if (roomIds.length) {
          const { data, error } = await supabase.from('group_members').select('room_id,user_id,role').in('room_id', roomIds)
          if (error) throw error
          allMemberships = (data || []) as typeof allMemberships
        }
        if (cancelled) return
        setGroupRooms((rooms || []).map((room, index) => ({
          id: index + 1,
          dbId: room.id as string,
          ownerId: room.owner_id as string,
          name: room.name as string,
          code: room.invite_code as string,
          members: allMemberships.filter(member => member.room_id === room.id).map(member => ({ userId: member.user_id, role: member.role })),
        })))
      } catch (error) {
        if (cancelled) return
        console.error('โหลดห้องงานกลุ่มไม่สำเร็จ:', error)
        setGroupRoomMessage(error instanceof Error ? `โหลดห้องไม่สำเร็จ: ${error.message}` : 'โหลดห้องไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ตารางใน Supabase')
      }
    }
    void loadGroupRooms()
    return () => { cancelled = true }
  }, [authSession?.user?.id, cloudReady])

  // Load shared group tasks only after the signed-in user's rooms are available.
  useEffect(() => {
    let cancelled = false
    async function loadSharedTasks() {
      setSharedTasksReady(false)
      if (!supabase || !authSession?.user?.id || !cloudReady) return
      if (groupRooms.length === 0) {
        setSharedTasksReady(true)
        return
      }
      const roomIds = groupRooms.map(room => room.dbId).filter(Boolean)
      if (!roomIds.length) {
        setSharedTasksReady(true)
        return
      }
      try {
        const { data, error } = await supabase
          .from('group_tasks')
          .select('id,room_id,created_by,task_key,task_data,created_at,updated_at')
          .in('room_id', roomIds)
        if (error) throw error
        if (cancelled) return
        const remoteTasks: Task[] = (data || []).map(row => {
          const room = groupRooms.find(item => item.dbId === row.room_id)
          const raw = row.task_data && typeof row.task_data === 'object' ? row.task_data as Record<string, unknown> : {}
          return {
            ...(raw as unknown as Task),
            id: Number(row.task_key) || Number(raw.id) || Number(row.id),
            type: 'งานกลุ่ม',
            groupRoomId: room?.id,
          }
        })
        const remoteIds = new Set(remoteTasks.map(task => task.id))
        setTasks(current => [
          ...current.filter(task => task.type !== 'งานกลุ่ม' || !remoteIds.has(task.id)),
          ...remoteTasks,
        ])
        setSharedTasksReady(true)
      } catch (error) {
        if (cancelled) return
        console.error('โหลดงานกลุ่มออนไลน์ไม่สำเร็จ:', error)
        setGroupRoomMessage(error instanceof Error ? `โหลดงานกลุ่มไม่สำเร็จ: ${error.message}` : 'โหลดงานกลุ่มไม่สำเร็จ')
        // Don't write over remote data if its initial load failed.
      }
    }
    void loadSharedTasks()
    return () => { cancelled = true }
  }, [authSession?.user?.id, cloudReady, groupRooms])

  // Persist each shared task to its room's row. task_key must exist on group_tasks.
  useEffect(() => {
    if (!sharedTasksReady || !cloudReady || !supabase || !authSession?.user?.id) return
    let cancelled = false
    const shared = tasks.filter(task => task.type === 'งานกลุ่ม' && task.groupRoomId !== undefined)
    const timer = window.setTimeout(async () => {
      for (const task of shared) {
        const room = groupRooms.find(item => item.id === task.groupRoomId)
        if (!room?.dbId || cancelled) continue
        const { error } = await supabase!.from('group_tasks').upsert({
          room_id: room.dbId,
          created_by: authSession!.user.id,
          task_key: String(task.id),
          task_data: { ...task, groupRoomId: undefined },
        }, { onConflict: 'room_id,task_key' })
        if (error) {
          console.error('บันทึกงานกลุ่มไม่สำเร็จ:', error.message)
          setCloudStatus('บันทึกงานกลุ่มไม่สำเร็จ')
          return
        }
      }
    }, 500)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [sharedTasksReady, cloudReady, authSession?.user?.id, tasks, groupRooms])

  async function createGroupRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newRoomName.trim()
    if (!name || !supabase || !authSession?.user?.id) {
      setGroupRoomMessage('กรุณาเข้าสู่ระบบก่อนสร้างห้อง')
      return
    }
    setGroupRoomBusy(true)
    setGroupRoomMessage('')
    try {
      let code = ''
      for (let attempt = 0; attempt < 5; attempt++) {
        code = Math.random().toString(36).slice(2, 8).toUpperCase()
        const { data: existing, error: lookupError } = await supabase.from('group_rooms').select('id').eq('invite_code', code).maybeSingle()
        if (lookupError) throw lookupError
        if (!existing) break
        code = ''
      }
      if (!code) throw new Error('สร้างรหัสห้องไม่สำเร็จ กรุณาลองใหม่')
      const { data: room, error: createError } = await supabase.from('group_rooms')
        .insert({ owner_id: authSession.user.id, name, invite_code: code })
        .select('id,owner_id,name,invite_code,created_at').single()
      if (createError) throw createError
      const { error: memberError } = await supabase.from('group_members')
        .insert({ room_id: room.id, user_id: authSession.user.id, role: 'owner' })
      if (memberError) {
        await supabase.from('group_rooms').delete().eq('id', room.id).eq('owner_id', authSession.user.id)
        throw memberError
      }
      setNewRoomName('')
      setGroupRoomMessage('สร้างห้องสำเร็จแล้ว คัดลอกลิงก์เพื่อเชิญเพื่อนได้เลย')
      const { data: members } = await supabase.from('group_members').select('room_id,user_id,role').eq('room_id', room.id)
      setGroupRooms(current => [{ id: Date.now(), dbId: room.id, ownerId: room.owner_id, name: room.name, code: room.invite_code, members: (members || []).map(member => ({ userId: member.user_id, role: member.role })) }, ...current.filter(item => item.dbId !== room.id)])
    } catch (error) {
      console.error('สร้างห้องงานกลุ่มไม่สำเร็จ:', error)
      setGroupRoomMessage(error instanceof Error ? `สร้างห้องไม่สำเร็จ: ${error.message}` : 'สร้างห้องไม่สำเร็จ กรุณาตรวจสอบ RLS policies ใน Supabase')
    } finally {
      setGroupRoomBusy(false)
    }
  }

  async function joinGroupRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = joinRoomCode.trim().toUpperCase()
    if (!code || !supabase || !authSession?.user?.id) {
      setGroupRoomMessage('กรุณาเข้าสู่ระบบและกรอกรหัสห้อง')
      return
    }
    setGroupRoomBusy(true)
    setGroupRoomMessage('')
    try {
      // Use a SECURITY DEFINER RPC so RLS can protect room listings while still
      // allowing a signed-in user to join by a valid invite code.
      const { data: joinedRoomData, error: joinError } = await supabase.rpc('join_group_room_by_code', {
        p_invite_code: code,
      })
      if (joinError) throw joinError
      const room = Array.isArray(joinedRoomData) ? joinedRoomData[0] : joinedRoomData
      if (!room) throw new Error('ไม่พบรหัสห้องนี้ หรือไม่มีสิทธิ์เข้าร่วมห้อง ตรวจสอบรหัสแล้วลองอีกครั้ง')
      setJoinRoomCode('')
      setGroupRoomMessage(`เข้าร่วมห้อง “${room.name}” สำเร็จแล้ว`)
      // Avoid a second membership SELECT that may be blocked by a restrictive RLS policy.
      setGroupRooms(current => [{
        id: Date.now(),
        dbId: room.id,
        ownerId: room.owner_id,
        name: room.name,
        code: room.invite_code,
        members: [
          { userId: room.owner_id, role: 'owner' },
          { userId: authSession.user.id, role: 'member' },
        ],
      }, ...current.filter(item => item.dbId !== room.id)])
    } catch (error) {
      console.error('เข้าร่วมห้องงานกลุ่มไม่สำเร็จ:', error)
      setGroupRoomMessage(error instanceof Error ? `เข้าร่วมห้องไม่สำเร็จ: ${error.message}` : 'เข้าร่วมห้องไม่สำเร็จ กรุณาตรวจสอบ RLS policies ใน Supabase')
    } finally {
      setGroupRoomBusy(false)
    }
  }

  // Load this account's cloud snapshot before allowing writes, so one account
  // never uploads the previous account's in-memory/local browser data.
  useEffect(() => {
    let cancelled = false
    setCloudReady(false)
    if (!supabase || !authSession?.user?.id) {
      setCloudStatus('ยังไม่ได้เชื่อมต่อคลาวด์')
      return () => { cancelled = true }
    }
    ;(async () => {
      const { data, error } = await supabase!
        .from('user_settings')
        .select('app_data')
        .eq('user_id', authSession.user.id)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        console.error('โหลดข้อมูล Aevora ไม่สำเร็จ:', error.message)
        setCloudStatus('โหลดข้อมูลออนไลน์ไม่สำเร็จ — ยังไม่ซิงก์')
        return
      }
      const cloud = data?.app_data && typeof data.app_data === 'object' ? data.app_data as Record<string, unknown> : null
      if (cloud && Object.keys(cloud).length) {
        if (Array.isArray(cloud.tasks)) setTasks(cloud.tasks as Task[])
        if (Array.isArray(cloud.groupRooms)) setGroupRooms(cloud.groupRooms as GroupRoom[])
        const profile = cloud.profile && typeof cloud.profile === 'object' ? cloud.profile as Record<string, unknown> : {}
        if (typeof profile.name === 'string') setProfileName(profile.name)
        if (typeof profile.emoji === 'string') setProfileEmoji(profile.emoji)
        if (typeof profile.bio === 'string') setProfileBio(profile.bio)
        if (typeof cloud.character === 'string') setSelectedCharacter(CHARACTER_OPTIONS.some(item => item.id === cloud.character) ? cloud.character : 'g1')
        if (typeof cloud.pet === 'string') setSelectedPet(normalizePetValue(cloud.pet))
        if (typeof cloud.roomTheme === 'string') setSelectedRoomTheme(cloud.roomTheme)
        if (Array.isArray(cloud.rewardUnlocks)) setRewardUnlocks(cloud.rewardUnlocks as RewardUnlock[])
        if (Array.isArray(cloud.equippedDecorations)) setEquippedDecorations(cloud.equippedDecorations.filter((id): id is string => typeof id === 'string'))
      } else {
        // A new account starts with no sample tasks. Existing browser-only data remains local
        // and is not copied into this account automatically.
        setTasks([])
        setGroupRooms([])
        setProfileName('นักเดินทาง')
        setProfileEmoji('🌷')
        setProfileBio('ค่อย ๆ เติบโตไปทีละก้าว ✨')
        setSelectedCharacter('g1')
        setSelectedPet('pet1 กระต่ายหัวใจ')
        setSelectedRoomTheme('🌙 ห้องแสงจันทร์')
        setRewardUnlocks([])
        setEquippedDecorations([])
      }
      setCloudStatus('เชื่อมต่อข้อมูลออนไลน์แล้ว')
      setCloudReady(true)
    })()
    return () => { cancelled = true }
  }, [authSession?.user?.id])

  useEffect(() => {
    if (!cloudReady || !supabase || !authSession?.user?.id) return
    const snapshot = {
      version: 1, tasks, groupRooms,
      profile: { name: profileName, emoji: profileEmoji, bio: profileBio },
      character: selectedCharacter, pet: selectedPet, roomTheme: selectedRoomTheme,
      rewardUnlocks, equippedDecorations,
    }
    const timer = window.setTimeout(async () => {
      const { error } = await supabase!.from('user_settings')
        .upsert({ user_id: authSession.user.id, app_data: snapshot }, { onConflict: 'user_id' })
      if (error) {
        console.error('บันทึกข้อมูล Aevora ไม่สำเร็จ:', error.message)
        setCloudStatus('บันทึกออนไลน์ไม่สำเร็จ')
      } else setCloudStatus('บันทึกออนไลน์แล้ว')
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cloudReady, authSession?.user?.id, tasks, groupRooms, profileName, profileEmoji, profileBio, selectedCharacter, selectedPet, selectedRoomTheme, rewardUnlocks, equippedDecorations])

  useEffect(() => { localStorage.setItem('aevora_character', selectedCharacter) }, [selectedCharacter])
  useEffect(() => { localStorage.setItem('aevora_character_gender', selectedGender) }, [selectedGender])
  useEffect(() => { localStorage.setItem('aevora_pet', selectedPet) }, [selectedPet])
  useEffect(() => { localStorage.setItem('aevora_room_theme', selectedRoomTheme) }, [selectedRoomTheme])
  useEffect(() => { localStorage.setItem('aevora_profile_name', profileName) }, [profileName])
  useEffect(() => { localStorage.setItem('aevora_profile_emoji', profileEmoji) }, [profileEmoji])
  useEffect(() => { localStorage.setItem('aevora_profile_bio', profileBio) }, [profileBio])
  useEffect(() => {
    try { localStorage.setItem('aevora_equipped_decorations', JSON.stringify(equippedDecorations)) }
    catch (error) { console.error('ไม่สามารถบันทึกของตกแต่งที่เลือกได้:', error) }
  }, [equippedDecorations])

  function toggleDecoration(itemId: string) {
    if (!rewardUnlocks.some(item => item.id === itemId)) return
    setEquippedDecorations(current => current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId])
  }

  const todayKey = new Date().toLocaleDateString('en-CA')
  const soonKey = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
  const dueNotifications = tasks
    .filter(task => !task.done && task.dueDate && task.dueDate <= soonKey)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  const overdueCount = dueNotifications.filter(task => (task.dueDate || '') < todayKey).length

  // Shared group rooms are loaded from Supabase; do not save mock rooms to localStorage.

  useEffect(() => {

    try {

      localStorage.setItem('aevora_tasks', JSON.stringify(tasks))

    } catch (error) {

      console.error('ไม่สามารถบันทึกงานได้:', error)

    }

  }, [tasks])

  useEffect(() => {

  try {

    localStorage.setItem('aevora_active_nav', activeNav)

  } catch (error) {

    console.error('ไม่สามารถบันทึกหน้าปัจจุบันได้:', error)

  }

}, [activeNav])

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('aevora_selected_task')
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (selectedTaskId === null) localStorage.removeItem('aevora_selected_task')
      else localStorage.setItem('aevora_selected_task', String(selectedTaskId))
    } catch (error) {
      console.error('ไม่สามารถบันทึกงานที่เปิดอยู่ได้:', error)
    }
  }, [selectedTaskId])

  const selectedTask = tasks.find(task => task.id === selectedTaskId) ?? null

  const completed = tasks.filter(task => task.done).length
  const exp = completed * 100
  const level = Math.floor(exp / 500) + 1
  const expInLevel = exp % 500
  const todayCompleted = tasks.filter(task => task.done && task.completedAt && new Date(task.completedAt).toDateString() === new Date().toDateString()).length
  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekCompleted = tasks.filter(task => task.done && task.completedAt && new Date(task.completedAt) >= weekStart).length
  const completedDates = new Set(tasks.filter(task => task.done && task.completedAt).map(task => new Date(task.completedAt as string).toDateString()))
  let streak = 0
  const streakDate = new Date()
  if (!completedDates.has(streakDate.toDateString())) streakDate.setDate(streakDate.getDate() - 1)
  while (completedDates.has(streakDate.toDateString())) { streak += 1; streakDate.setDate(streakDate.getDate() - 1) }

  useEffect(() => {
    const existingIds = new Set(rewardUnlocks.map(item => item.id))
    const newlyUnlocked = rewardItems.filter(item => completed >= item.goal && !existingIds.has(item.id))
    if (newlyUnlocked.length) {
      setRewardUnlocks(current => {
        const currentIds = new Set(current.map(item => item.id))
        const additions = newlyUnlocked.filter(item => !currentIds.has(item.id)).map(item => ({ id: item.id, unlockedAt: new Date().toISOString() }))
        const next = [...current, ...additions]
        try { localStorage.setItem('aevora_reward_unlocks', JSON.stringify(next)) } catch (error) { console.error('ไม่สามารถบันทึกประวัติรางวัลได้:', error) }
        return next
      })
    }
  }, [completed, rewardUnlocks])

  useEffect(() => {
    try { localStorage.setItem('aevora_reward_unlocks', JSON.stringify(rewardUnlocks)) }
    catch (error) { console.error('ไม่สามารถบันทึกประวัติรางวัลได้:', error) }
  }, [rewardUnlocks])

  const filteredTasks = useMemo(() => tasks.filter(task => {

    const term = search.trim().toLocaleLowerCase()

    const matchesSearch = !term || `${task.title} ${task.subject}`.toLocaleLowerCase().includes(term)

    const matchesFilter = filter === 'ทั้งหมด' ||

      (filter === 'กำลังทำ' && !task.done) ||

      (filter === 'เสร็จแล้ว' && task.done) || task.type === filter

    const matchesNav = activeNav !== 'งานกลุ่ม' || task.type === 'งานกลุ่ม'

    return matchesSearch && matchesFilter && matchesNav

  }), [tasks, search, filter, activeNav])

  function resetForm() {

    setTitle(''); setSubject(''); setType('งานเดี่ยว'); setDue(''); setDescription(''); setTaskRoomId(''); setAssignedTo(''); setEditingId(null); setShowForm(false)

  }

  function saveTask(event: React.FormEvent<HTMLFormElement>) {

    event.preventDefault()

    if (!title.trim()) return

    const dueText = due ? new Date(`${due}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ยังไม่กำหนด'

    if (editingId !== null) {

      setTasks(current => current.map(task => task.id === editingId ? { ...task, title: title.trim(), subject: subject.trim() || 'งานทั่วไป', type, due: dueText, dueDate: due || undefined, description: description.trim(), groupRoomId: type === 'งานกลุ่ม' && taskRoomId !== '' ? taskRoomId : undefined, assignedTo: type === 'งานกลุ่ม' ? (assignedTo.trim() || undefined) : undefined } : task))

    } else {
      const newId = Date.now()
      setTasks(current => [...current, { id: newId, title: title.trim(), subject: subject.trim() || 'งานทั่วไป', type, due: dueText, dueDate: due || undefined, description: description.trim(), groupRoomId: type === 'งานกลุ่ม' && taskRoomId !== '' ? taskRoomId : undefined, assignedTo: type === 'งานกลุ่ม' ? (assignedTo.trim() || undefined) : undefined, subtasks: [], progress: 0, done: false }])
      setSelectedTaskId(newId)
    }

    resetForm()

  }

  function startEdit(task: Task) {

    setSelectedTaskId(task.id)
    setEditingId(task.id); setTitle(task.title); setSubject(task.subject); setType(task.type); setDescription(task.description || ''); setTaskRoomId(task.groupRoomId ?? ''); setAssignedTo(task.assignedTo || '')

    setDue(task.dueDate || '')

    setShowForm(true)

    window.scrollTo({ top: 0, behavior: 'smooth' })

  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`ต้องการลบงาน “${task.title}” ใช่ไหม?`)) return
    if (task.type === 'งานกลุ่ม' && task.groupRoomId !== undefined && supabase) {
      const room = groupRooms.find(item => item.id === task.groupRoomId)
      if (room?.dbId) {
        const { error } = await supabase.from('group_tasks').delete()
          .eq('room_id', room.dbId).eq('task_key', String(task.id))
        if (error) {
          console.error('ลบงานกลุ่มออนไลน์ไม่สำเร็จ:', error.message)
          setGroupRoomMessage(`ลบงานไม่สำเร็จ: ${error.message}`)
          return
        }
      }
    }
    setTasks(current => current.filter(item => item.id !== task.id))
    if (selectedTaskId === task.id) setSelectedTaskId(null)
  }

  function toggleTask(id: number) {
    setTasks(current => current.map(task => task.id === id ? { ...task, done: !task.done, completedAt: task.done ? undefined : new Date().toISOString(), progress: task.done ? (task.subtasks?.length ? Math.round(task.subtasks.filter(item => item.done).length / task.subtasks.length * 100) : Math.min(task.progress, 99)) : 100 } : task))
  }

  function updateSubtasks(taskId: number, subtasks: Subtask[]) {
    setTasks(current => current.map(task => {
      if (task.id !== taskId) return task
      const progress = subtasks.length ? Math.round(subtasks.filter(item => item.done).length / subtasks.length * 100) : task.progress
      return { ...task, subtasks, progress, done: subtasks.length > 0 && subtasks.every(item => item.done) }
    }))
  }

  function updateTaskExtras(taskId: number, patch: Partial<Pick<Task, 'attachments' | 'comments' | 'helpRequests' | 'activity'>>) {
    setTasks(current => current.map(task => {
      if (task.id !== taskId) return task
      const activity = patch.activity ?? [...(task.activity || []), { id: Date.now(), text: 'มีการอัปเดตข้อมูลของงาน', createdAt: new Date().toISOString() }]
      return { ...task, ...patch, activity }
    }))
  }

  function exportBackup() {
    const backup = {
      app: 'Aevora', version: 1, exportedAt: new Date().toISOString(),
      tasks, groupRooms, profile: { name: profileName, emoji: profileEmoji, bio: profileBio },
      character: selectedCharacter, pet: selectedPet, roomTheme: selectedRoomTheme,
      rewardUnlocks, equippedDecorations,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aevora-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setBackupMessage('ส่งออกข้อมูลสำเร็จแล้ว เก็บไฟล์ JSON ไว้ในที่ปลอดภัยนะ')
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>
      if (parsed.app !== 'Aevora' || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.groupRooms)) {
        setBackupMessage('ไฟล์นี้ไม่ใช่ไฟล์สำรอง Aevora ที่รองรับ')
        return
      }
      if (!window.confirm('นำเข้าข้อมูลสำรองหรือไม่? งานและห้องที่มีอยู่จะถูกแทนที่ด้วยข้อมูลในไฟล์นี้')) return
      setTasks(parsed.tasks as Task[])
      setGroupRooms(parsed.groupRooms as GroupRoom[])
      const profile = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile as Record<string, unknown> : {}
      if (typeof profile.name === 'string') setProfileName(profile.name.slice(0, 32))
      if (typeof profile.emoji === 'string') setProfileEmoji(profile.emoji)
      if (typeof profile.bio === 'string') setProfileBio(profile.bio.slice(0, 100))
      if (typeof parsed.character === 'string') setSelectedCharacter(CHARACTER_OPTIONS.some(item => item.id === parsed.character) ? parsed.character : 'g1')
      if (typeof parsed.pet === 'string') setSelectedPet(normalizePetValue(parsed.pet))
      if (typeof parsed.roomTheme === 'string') setSelectedRoomTheme(parsed.roomTheme)
      if (Array.isArray(parsed.rewardUnlocks)) setRewardUnlocks(parsed.rewardUnlocks as RewardUnlock[])
      if (Array.isArray(parsed.equippedDecorations)) setEquippedDecorations(parsed.equippedDecorations.filter((id): id is string => typeof id === 'string'))
      setSelectedTaskId(null)
      setShowForm(false)
      setEditingId(null)
      setActiveNav('หน้าหลัก')
      setBackupMessage('นำเข้าข้อมูลสำเร็จแล้ว ตรวจสอบงานและพื้นที่ส่วนตัวได้เลย')
    } catch {
      setBackupMessage('อ่านไฟล์ไม่สำเร็จ กรุณาเลือกไฟล์ JSON สำรองของ Aevora')
    }
  }

  if (authLoading) return <div className="aevora-auth-loading"><div className="aevora-auth-card"><span className="aevora-auth-logo">✦</span><h1>Aevora</h1><p>กำลังตรวจสอบบัญชีของคุณ...</p></div></div>
  if (!authSession) return <AuthScreen />
  if (supabase && !cloudReady) return <div className="aevora-auth-loading"><div className="aevora-auth-card"><span className="aevora-auth-logo">✦</span><h1>Aevora</h1><p>กำลังโหลดข้อมูลของบัญชีนี้จากคลาวด์...</p><p style={{fontSize:12, color:'#987fa5'}}>ข้อมูลจากบัญชีอื่นจะไม่แสดงระหว่างโหลด</p></div></div>

  const inviteRoom = groupRooms.find(room => room.id === selectedInviteRoomId) || groupRooms[0] || null
  const inviteLink = inviteRoom ? `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(inviteRoom.code)}` : ''
  const inviteContent = !inviteRoom ? '' : inviteFormat === 'link'
    ? inviteLink
    : inviteFormat === 'code'
      ? inviteRoom.code
      : `มาเข้าร่วมห้องงานกลุ่ม “${inviteRoom.name}” ใน Aevora กัน! ✨\n\nรหัสห้อง: ${inviteRoom.code}\nกดลิงก์เพื่อเข้าร่วม: ${inviteLink}\n\nถ้ายังไม่มีบัญชี ให้เข้าสู่ระบบ Aevora ก่อนนะ`

  return (

    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand"><div className="brand-stars">✦ · ✧</div><div className="brand-name">Aevora</div><div className="brand-tagline">Work · Grow · Together</div></div>

        <nav className="nav-list">

          {navItems.map(([icon, label]) => <button className={`nav-item ${activeNav === label ? 'active' : ''}`} key={label} onClick={() => setActiveNav(label)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}

        </nav>

        <div className="sidebar-bottom"><div className="pet-scene">🌙 ✦ 🪴</div><div className="pet-message"><strong>น้องภูผา</strong><p>วันนี้มาทำภารกิจด้วยกันไหม?</p><span>♥ ━━━━━━━ Lv. 5</span></div></div>

      </aside>

      <main className="main-content">

        <header className="topbar">

          <div className="welcome"><div className="avatar">{profileEmoji}</div><div className="welcome-copy"><div className="welcome-title-wrap"><span className="welcome-tree" aria-hidden="true">🪴</span><h1 className="welcome-title">สวัสดี {profileName || 'เพื่อน'} ✦</h1></div><p>{profileBio || 'วันนี้เรามาค่อย ๆ ทำให้สำเร็จกัน'}</p></div></div>

          <div className="topbar-right"><div className="quote">“ทุกงานเล็ก ๆ คือก้าวไปใกล้ความสำเร็จ”</div><button className="icon-button" aria-label="ค้นหา" onClick={() => { setActiveNav('งานของฉัน'); document.getElementById('task-search')?.focus() }}>⌕</button><div className="notification-wrap"><button type="button" className="icon-button notification-button" aria-label="การแจ้งเตือน" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(open => !open)}>♧{dueNotifications.length > 0 && <span className="notification-badge">{dueNotifications.length > 9 ? '9+' : dueNotifications.length}</span>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-popover-heading"><div><strong>การแจ้งเตือน</strong><small>งานที่ใกล้ถึงกำหนดใน 3 วัน</small></div><button type="button" onClick={() => setNotificationsOpen(false)} aria-label="ปิดการแจ้งเตือน">×</button></div>{dueNotifications.length === 0 ? <p className="notification-empty">ยังไม่มีงานใกล้ถึงกำหนด ✨</p> : <><p className="notification-summary">{overdueCount > 0 ? `มีงานเลยกำหนด ${overdueCount} งาน` : `มีงานใกล้ถึงกำหนด ${dueNotifications.length} งาน`}</p><div className="notification-list">{dueNotifications.map(task => <button type="button" className="notification-item" key={task.id} onClick={() => { setSelectedTaskId(task.id); setShowForm(false); setEditingId(null); setActiveNav('งานของฉัน'); setNotificationsOpen(false) }}><span className={`notification-dot ${(task.dueDate || '') < todayKey ? 'overdue' : ''}`}/><span className="notification-item-text"><strong>{task.title}</strong><small>{(task.dueDate || '') < todayKey ? 'เลยกำหนดส่ง' : (task.dueDate || '') === todayKey ? 'ครบกำหนดวันนี้' : `กำหนดส่ง ${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}</small></span><span className="notification-arrow">›</span></button>)}</div></>}</div>}</div><div className="level-pill"><span className="level-avatar">🌙</span><div><strong>Lv. {level}</strong><small>{exp} EXP</small></div></div><span className="aevora-cloud-status" title="สถานะการซิงก์">☁ {cloudStatus}</span><button type="button" className="aevora-logout-button" onClick={async () => { if (!supabase) return; const { error } = await supabase.auth.signOut(); if (error) window.alert(`ออกจากระบบไม่สำเร็จ: ${error.message}`) }}>ออกจากระบบ</button></div>

        </header>

        {activeNav === 'ภารกิจ' && <section className="panel gamification-page"><div className="panel-heading"><div><h2>✦ ภารกิจของวันนี้</h2><p className="muted">ทำงานจริงเพื่อเก็บ EXP และปลดล็อกรางวัล</p></div><span className="gamification-level">Lv. {level} · {exp} EXP</span></div><div className="quest-grid"><article className="quest-card"><span className="quest-icon">☀️</span><div className="quest-copy"><h3>ก้าวเล็กประจำวัน</h3><p>ทำงานให้เสร็จอย่างน้อย 1 งานวันนี้</p><div className="quest-track"><span style={{width:`${Math.min(todayCompleted,1)*100}%`}}/></div><small>{Math.min(todayCompleted,1)} / 1 งาน</small></div><strong className="quest-reward">+100 EXP</strong><span className={`quest-status ${todayCompleted >= 1 ? 'is-done' : ''}`}>{todayCompleted >= 1 ? 'สำเร็จแล้ว ✓' : 'กำลังทำ'}</span></article><article className="quest-card"><span className="quest-icon">🌙</span><div className="quest-copy"><h3>นักจัดการประจำสัปดาห์</h3><p>ทำงานให้เสร็จ 3 งานในช่วง 7 วันที่ผ่านมา</p><div className="quest-track"><span style={{width:`${Math.min(weekCompleted/3,1)*100}%`}}/></div><small>{Math.min(weekCompleted,3)} / 3 งาน</small></div><strong className="quest-reward">+300 EXP</strong><span className={`quest-status ${weekCompleted >= 3 ? 'is-done' : ''}`}>{weekCompleted >= 3 ? 'สำเร็จแล้ว ✓' : 'กำลังทำ'}</span></article><article className="quest-card"><span className="quest-icon">🔥</span><div className="quest-copy"><h3>รักษาไฟในการทำงาน</h3><p>ทำงานสำเร็จต่อเนื่องหลายวัน</p><div className="quest-track"><span style={{width:`${Math.min(streak/7,1)*100}%`}}/></div><small>Streak {streak} วัน</small></div><strong className="quest-reward">เป้าหมาย 7 วัน</strong><span className="quest-status">{streak >= 7 ? 'สำเร็จแล้ว ✓' : 'สะสมต่อไป'}</span></article></div><p className="gamification-note">EXP และภารกิจคำนวณจากงานที่ทำเครื่องหมายว่าเสร็จแล้วในเบราว์เซอร์นี้ การติ๊กงานเดิมซ้ำจะไม่เพิ่มจำนวนงานที่เสร็จโดยรวม</p></section>}
        {activeNav === 'ความสำเร็จ' && <section className="panel gamification-page"><div className="panel-heading"><div><h2>🏆 ความสำเร็จ</h2><p className="muted">ทุกก้าวเล็ก ๆ มีความหมาย</p></div><span className="gamification-level">ปลดล็อก {Number(completed >= 1)+Number(completed >= 5)+Number(completed >= 10)} / 3</span></div><div className="achievement-grid">{[{icon:'🌱',name:'เริ่มต้นได้ดี',desc:'ทำงานสำเร็จ 1 งาน',goal:1},{icon:'🌷',name:'เริ่มเป็นกิจวัตร',desc:'ทำงานสำเร็จ 5 งาน',goal:5},{icon:'🌟',name:'ดาวแห่งความพยายาม',desc:'ทำงานสำเร็จ 10 งาน',goal:10}].map(item => <article className={`achievement-card ${completed >= item.goal ? 'unlocked' : ''}`} key={item.name}><span className="achievement-icon">{item.icon}</span><h3>{item.name}</h3><p>{item.desc}</p><span className="achievement-status">{completed >= item.goal ? 'ปลดล็อกแล้ว ✓' : `อีก ${item.goal-completed} งาน`}</span></article>)}</div><div className="streak-summary"><span>🔥</span><div><strong>Streak ปัจจุบัน {streak} วัน</strong><p>วันที่ทำงานสำเร็จติดต่อกัน คำนวณจากวันที่ทำเครื่องหมายเสร็จในระบบ</p></div></div></section>}
        {activeNav === 'พื้นที่ส่วนตัว' && <section className="panel customization-page"><div className="panel-heading"><div><h2>🏡 พื้นที่ส่วนตัวของฉัน</h2><p className="muted">จัดห้องเล็ก ๆ ให้เป็นพื้นที่ที่ชอบ การเลือกจะถูกบันทึกในเบราว์เซอร์นี้</p></div><span className="gamification-level">Lv. {level}</span></div><div className="customization-preview" style={{ backgroundImage: `linear-gradient(180deg, rgba(38, 25, 61, .28), rgba(38, 25, 61, .72)), url(${selectedRoomOption.file})` }}><div className="preview-stars">✦　☾　✧</div><div className="preview-room-icon">{selectedRoomOption.icon}</div><div className="preview-character"><img src={(CHARACTER_OPTIONS.find(item => item.id === selectedCharacter) || CHARACTER_OPTIONS[0]).file} alt="ตัวละครที่เลือก" /></div><div className="preview-pet"><img src={selectedPetOption.file} alt={selectedPetOption.name} /></div><div className="preview-decorations" aria-label="ของตกแต่งที่ติดตั้ง">{rewardItems.filter(item => equippedDecorations.includes(item.id) && rewardUnlocks.some(unlock => unlock.id === item.id)).map(item => <span key={item.id} title={item.name}>{item.icon}</span>)}</div><h3>{selectedRoomTheme}</h3><p>{characterLabel(selectedCharacter)} · เพื่อนคู่ใจ {selectedPetOption.name}</p><small className="preview-decoration-caption">ของตกแต่งที่ติดตั้ง {equippedDecorations.filter(id => rewardUnlocks.some(unlock => unlock.id === id)).length} ชิ้น</small></div><div className="customization-section"><h3>เลือกบรรยากาศห้อง</h3><p className="muted">เลือกฉากที่ชอบเพื่อเปลี่ยนพื้นหลังทั้งตัวอย่างห้องและแบนเนอร์หน้าแรกได้ทันที ✨</p><div className="room-theme-grid">{ROOM_OPTIONS.map(item => <button type="button" key={item.theme} className={`room-theme-card ${selectedRoomTheme === item.theme ? 'selected' : ''}`} onClick={() => setSelectedRoomTheme(item.theme)} aria-pressed={selectedRoomTheme === item.theme}><span className="room-theme-image"><img src={item.file} alt={item.name} loading="lazy" />{selectedRoomTheme === item.theme && <span className="room-theme-check">✓ เลือกแล้ว</span>}</span><strong>{item.icon} {item.name}</strong><small>{item.description}</small></button>)}</div></div><div className="customization-section"><h3>ตัวละครของฉัน</h3><div className="character-gender-tabs"><button type="button" className={selectedGender === 'หญิง' ? 'active' : ''} onClick={() => setSelectedGender('หญิง')}>🌸 หญิง (g)</button><button type="button" className={selectedGender === 'ชาย' ? 'active' : ''} onClick={() => setSelectedGender('ชาย')}>🌙 ชาย (b)</button></div><div className="character-choice-grid">{CHARACTER_OPTIONS.filter(item => item.gender === selectedGender).map(item => <button type="button" key={item.id} className={`character-choice-card ${selectedCharacter === item.id ? 'selected' : ''}`} onClick={() => { setSelectedCharacter(item.id); setSelectedGender(item.gender) }} aria-pressed={selectedCharacter === item.id}><span className="character-choice-image"><img src={item.file} alt={item.name} loading="lazy" /></span><strong>{item.name}</strong><small>{item.id.toUpperCase()}</small>{selectedCharacter === item.id && <span className="choice-check">✓ เลือกแล้ว</span>}</button>)}</div></div><div className="customization-section"><h3>สัตว์เลี้ยงคู่ใจ</h3><div className="pet-choice-grid">{PET_OPTIONS.map(item => { const value = `${item.id} ${item.name}`; return <button type="button" key={item.id} className={`pet-choice-card ${selectedPet === value ? 'selected' : ''}`} onClick={() => setSelectedPet(value)} aria-pressed={selectedPet === value}><span className="pet-choice-icon"><img src={item.file} alt={item.name} loading="lazy" /></span><strong>{item.name}</strong><small className="pet-choice-id">{item.id.toUpperCase()}</small>{selectedPet === value && <small>✓ เลือกแล้ว</small>}</button>})}</div></div><div className="customization-section"><h3>🎁 ตกแต่งพื้นที่ด้วยไอเทม</h3><p className="muted">ไอเทมที่ปลดล็อกแล้วสามารถติดตั้งหรือถอดออกจากพื้นที่ส่วนตัวได้</p><div className="customization-options decoration-options">{rewardItems.map(item => { const unlocked = rewardUnlocks.some(reward => reward.id === item.id); const equipped = equippedDecorations.includes(item.id); return <article className={`custom-option decoration-option ${equipped ? 'selected' : ''} ${!unlocked ? 'decoration-locked' : ''}`} key={item.id}><span>{item.icon}</span><strong>{item.name}</strong><small>{equipped ? 'ติดตั้งอยู่ในพื้นที่' : unlocked ? 'พร้อมติดตั้ง' : `ปลดล็อกเมื่อทำงานสำเร็จ ${item.goal} งาน`}</small><button type="button" disabled={!unlocked} onClick={() => toggleDecoration(item.id)}>{equipped ? 'ถอดออก' : 'ติดตั้ง'}</button></article>})}</div></div></section>}
        {activeNav === 'ตัวละคร' && <section className="panel customization-page character-select-page"><div className="panel-heading"><div className="character-page-title"><img src="/images/decorations/character-decoration.png" alt="" /><div><h2>✨ ตัวละครและสัตว์เลี้ยง</h2><p className="muted">เลือกตัวตนและคู่หูที่ชอบได้ตามใจ ไม่ต้องปลดล็อกด้วยเลเวล</p></div></div><span className="gamification-level">Lv. {level} · {exp} EXP</span></div><div className="character-showcase character-showcase-art"><div className="showcase-character-art"><img src={(CHARACTER_OPTIONS.find(item => item.id === selectedCharacter) || CHARACTER_OPTIONS[0]).file} alt="ตัวละครที่เลือก" /></div><div className="showcase-copy"><span className="soft-kicker">YOUR LITTLE UNIVERSE</span><h3>{(CHARACTER_OPTIONS.find(item => item.id === selectedCharacter) || CHARACTER_OPTIONS[0]).name}</h3><p className="muted">รหัสตัวละคร {(CHARACTER_OPTIONS.find(item => item.id === selectedCharacter) || CHARACTER_OPTIONS[0]).id.toUpperCase()} · {selectedGender}</p><div className="selected-pet-pill"><img src={selectedPetOption.file} alt="" /><span>เพื่อนคู่ใจ: {selectedPetOption.name}</span></div><p className="muted">การเลือกจะบันทึกไว้ในเบราว์เซอร์นี้โดยอัตโนมัติ</p></div></div><div className="customization-section"><h3>🌷 เลือกตัวละคร</h3><div className="character-gender-tabs"><button type="button" className={selectedGender === 'หญิง' ? 'active' : ''} onClick={() => setSelectedGender('หญิง')}>🌸 ตัวละครหญิง (g1–g7)</button><button type="button" className={selectedGender === 'ชาย' ? 'active' : ''} onClick={() => setSelectedGender('ชาย')}>🌙 ตัวละครชาย (b1–b5)</button></div><div className="character-choice-grid">{CHARACTER_OPTIONS.filter(item => item.gender === selectedGender).map(item => <button type="button" key={item.id} className={`character-choice-card ${selectedCharacter === item.id ? 'selected' : ''}`} onClick={() => { setSelectedCharacter(item.id); setSelectedGender(item.gender) }} aria-pressed={selectedCharacter === item.id}><span className="character-choice-image"><img src={item.file} alt={item.name} loading="lazy" /></span><strong>{item.name}</strong><small>{item.id.toUpperCase()}</small>{selectedCharacter === item.id && <span className="choice-check">✓ เลือกแล้ว</span>}</button>)}</div></div><div className="customization-section"><h3>🐾 เลือกสัตว์เลี้ยง</h3><div className="pet-choice-grid">{PET_OPTIONS.map(item => { const value = `${item.id} ${item.name}`; return <button type="button" key={item.id} className={`pet-choice-card ${selectedPet === value ? 'selected' : ''}`} onClick={() => setSelectedPet(value)} aria-pressed={selectedPet === value}><span className="pet-choice-icon"><img src={item.file} alt={item.name} loading="lazy" /></span><strong>{item.name}</strong><small className="pet-choice-id">{item.id.toUpperCase()}</small>{selectedPet === value && <small>✓ เลือกแล้ว</small>}</button>})}</div></div></section>}
        {activeNav === 'ตั้งค่า' && <section className="panel profile-settings-page">
          <div className="panel-heading"><div><h2>👤 โปรไฟล์และข้อมูลของฉัน</h2><p className="muted">ปรับข้อมูลที่แสดงบนหน้า Aevora และสำรองข้อมูลไว้ได้</p></div><span className="gamification-level">Lv. {level}</span></div>
          <div className="profile-card"><div className="profile-avatar-large">{profileEmoji}</div><div><h3>{profileName || 'เพื่อนของ Aevora'}</h3><p>{profileBio}</p><small>{completed} งานสำเร็จ · {exp} EXP · Streak {streak} วัน</small></div></div>
          <form className="profile-edit-form" onSubmit={event => { event.preventDefault(); setProfileName(profileName.trim().slice(0, 32) || 'เพื่อน'); setProfileBio(profileBio.trim().slice(0, 100)); setBackupMessage('บันทึกโปรไฟล์แล้ว ✨') }}>
            <label>ชื่อที่ใช้แสดง<input value={profileName} onChange={event => setProfileName(event.target.value)} maxLength={32} placeholder="ใส่ชื่อของคุณ" /></label>
            <label>คำทักทายสั้น ๆ<input value={profileBio} onChange={event => setProfileBio(event.target.value)} maxLength={100} placeholder="เช่น ค่อย ๆ เติบโตไปทีละก้าว" /></label>
            <div className="profile-emoji-picker"><span>เลือกไอคอนโปรไฟล์</span>{['🌷','🌙','⭐','🧚','🐱','🦊','🌸','🍀'].map(emoji => <button type="button" key={emoji} className={profileEmoji === emoji ? 'selected' : ''} onClick={() => setProfileEmoji(emoji)} aria-label={`เลือก ${emoji}`}>{emoji}</button>)}</div>
            <button type="submit" className="profile-primary-button">บันทึกโปรไฟล์</button>
          </form>
          <div className="backup-section"><div><h3>🗂️ สำรองและย้ายข้อมูล</h3><p>ดาวน์โหลดงาน ห้องกลุ่ม โปรไฟล์ ตัวละคร และรางวัลเป็นไฟล์ JSON เพื่อเก็บสำรองหรือย้ายไปเบราว์เซอร์อื่น</p></div><div className="backup-actions"><button type="button" className="profile-primary-button" onClick={exportBackup}>ดาวน์โหลดไฟล์สำรอง</button><label className="backup-import-button">นำเข้าไฟล์สำรอง<input type="file" accept="application/json,.json" onChange={event => { void importBackup(event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /></label></div><small>หมายเหตุ: ไฟล์แนบที่เก็บใน IndexedDB จะไม่รวมอยู่ในไฟล์สำรองนี้ และข้อมูลยังไม่ซิงก์ออนไลน์</small>{backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}</div>
          <div className="profile-data-summary"><h3>ข้อมูลที่อยู่ในเบราว์เซอร์นี้</h3><div><span>งานทั้งหมด</span><strong>{tasks.length}</strong></div><div><span>ห้องงานกลุ่ม</span><strong>{groupRooms.length}</strong></div><div><span>ไอเทมที่ปลดล็อก</span><strong>{rewardUnlocks.length}</strong></div></div>
        </section>}
        {activeNav !== 'หน้าหลัก' && activeNav !== 'งานของฉัน' && activeNav !== 'งานกลุ่ม' && activeNav !== 'ปฏิทิน' && activeNav !== 'ภารกิจ' && activeNav !== 'ความสำเร็จ' && activeNav !== 'พื้นที่ส่วนตัว' && activeNav !== 'ตัวละคร' && activeNav !== 'เชิญเพื่อน' && activeNav !== 'ตั้งค่า' && <div className="section-notice"><span>✦</span><div><strong>{activeNav}</strong><p>ส่วนนี้เราจะเชื่อมกับข้อมูลจริงในขั้นถัดไปค่ะ</p></div><button onClick={() => setActiveNav('หน้าหลัก')}>กลับหน้าหลัก</button></div>}

        {activeNav === 'หน้าหลัก' && <>

          <section className="hero-grid">

            <div className="hero-card"><div className="hero-overlay"><span className="eyebrow">YOUR LITTLE UNIVERSE ✦</span><h2>พื้นที่ของฉัน ✨</h2><p>มุมเล็ก ๆ ที่เต็มไปด้วยพลังในการทำงาน</p><button className="light-button" onClick={() => setActiveNav('พื้นที่ส่วนตัว')}>✿ ปรับแต่งพื้นที่</button></div><div className="hero-art"><img className="hero-room-image" src={selectedRoomOption.file} alt={selectedRoomOption.name}/><div className="hero-image-shade"/><img className="hero-character" src={(CHARACTER_OPTIONS.find(item => item.id === selectedCharacter) || CHARACTER_OPTIONS[0]).file} alt={`ตัวละคร ${characterLabel(selectedCharacter)} ที่เลือกไว้`} key={selectedCharacter}/><img className="hero-pet" src={selectedPetOption.file} alt={`สัตว์เลี้ยง ${selectedPetOption.name} ที่เลือกไว้`} key={selectedPetOption.id}/></div></div>

            <div className="level-card"><div className="level-heading"><span className="exp-orb exp-orb-image"><img src="/images/icons/exp.png" alt="EXP" /></span><div className="level-details"><h2>Lv. {level} <span>›</span></h2><div className="progress-track"><div className="progress-fill exp-fill" style={{ width: `${(expInLevel / 500) * 100}%` }}/></div><small>{expInLevel} / 500 EXP</small></div></div><div className="stat-grid"><div className="stat-box"><span className="stat-icon-image"><img src="/images/icons/Streaks.png" alt="" /></span><small>งานที่เสร็จ</small><strong>{completed} งาน</strong></div><div className="stat-box"><span className="stat-icon-image"><img src="/images/icons/king.png" alt="" /></span><small>งานทั้งหมด</small><strong>{tasks.length} งาน</strong></div><div className="stat-box"><span className="stat-icon-image"><img src="/images/icons/petty.png" alt="" /></span><small>สัตว์เลี้ยง</small><strong>Lv. 5</strong><small>น้องภูผา</small></div></div></div>

            <div className="daily-quote"><span>✦ AEVORA ✦</span><div className="quote-illustration">☾ ✧</div><h2>ทำวันนี้<br/>ให้ดีที่สุด</h2><p>เวอร์ชันที่ดีกว่าของเรา<br/>กำลังรออยู่เสมอ</p><small>Believe in your little steps</small></div>

          </section>

          <section className="dashboard-grid">

            <TaskPanel
              tasks={tasks.slice(0, 5)}
              completed={completed}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
              openTask={(task) => { setSelectedTaskId(task.id); setShowForm(false); setActiveNav(task.type === 'งานกลุ่ม' ? 'งานกลุ่ม' : 'งานของฉัน') }}
              onViewAll={() => setActiveNav('งานของฉัน')}
              onCreateTask={() => {
                setSelectedTaskId(null)
                setEditingId(null)
                setTitle('')
                setSubject('')
                setDescription('')
                setTaskRoomId('')
                setAssignedTo('')
                setType('งานเดี่ยว')
                setDue('')
                setShowForm(true)
                setActiveNav('งานของฉัน')
              }}
            />

            <div className="panel calendar-panel"><div className="panel-heading"><h2>▦ สรุปงาน</h2><button className="text-button" onClick={() => setActiveNav('งานของฉัน')}>ดูทั้งหมด →</button></div><div className="deadline-item"><span className="deadline-dot pink"/><span className="deadline-icon">▤</span><div><strong>งานที่ยังไม่เสร็จ</strong><small>มี {tasks.length - completed} งานที่ต้องจัดการ</small></div><b>{tasks.length - completed}</b></div><div className="deadline-item"><span className="deadline-dot green"/><span className="deadline-icon">✓</span><div><strong>งานที่เสร็จแล้ว</strong><small>ทำได้ดีมาก ค่อย ๆ ไปทีละขั้น</small></div><b>{completed}</b></div></div>

          </section>

          <section className="bottom-grid"><div className="panel projects-panel"><div className="panel-heading"><h2>♧ ภาพรวมงาน</h2><span className="muted">อัปเดตอัตโนมัติ</span></div><div className="project-row"><span className="project-icon purple">✿</span><div className="project-info"><strong>ความคืบหน้ารวม</strong><div className="mini-track"><div style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }}/></div></div><b>{tasks.length ? Math.round((completed / tasks.length) * 100) : 0}%</b></div></div><div className="world-card"><span>YOUR OWN LITTLE WORLD</span><h2>พื้นที่เล็ก ๆ<br/>ของคนที่กำลังเติบโต</h2><p>ทุกงานที่ทำสำเร็จคืออีกหนึ่งก้าว</p><button onClick={() => setActiveNav('งานของฉัน')}>จัดการงานของฉัน →</button></div></section>

        </>}

        {activeNav === 'งานกลุ่ม' && !selectedTask && !showForm && <section className="panel group-rooms-panel">
          <div className="panel-heading"><div><h2>♧ ห้องงานกลุ่ม</h2><p className="muted">สร้างห้องด้วยบัญชีของคุณ หรือเข้าร่วมด้วยรหัสที่เพื่อนส่งให้</p></div></div>
          <form className="group-room-create" onSubmit={createGroupRoom}>
            <input value={newRoomName} onChange={event => setNewRoomName(event.target.value)} placeholder="ตั้งชื่อห้อง เช่น โปรเจกต์วิทยาศาสตร์" maxLength={80} aria-label="ชื่อห้องงานกลุ่ม" required />
            <button type="submit" disabled={groupRoomBusy}>{groupRoomBusy ? 'กำลังบันทึก...' : '+ สร้างห้อง'}</button>
          </form>
          <form className="group-member-form" onSubmit={joinGroupRoom}>
            <input value={joinRoomCode} onChange={event => setJoinRoomCode(event.target.value.toUpperCase())} placeholder="กรอกรหัสห้องที่ได้รับ" maxLength={12} aria-label="รหัสห้องสำหรับเข้าร่วม" required />
            <button type="submit" disabled={groupRoomBusy}>เข้าร่วมด้วยรหัส</button>
          </form>
          {groupRoomMessage && <p className="task-inline-message" role="status">{groupRoomMessage}</p>}
          {groupRooms.length === 0 ? <div className="group-room-empty"><span>✦</span><strong>ยังไม่มีห้องงานกลุ่ม</strong><p>สร้างห้องใหม่หรือกรอกรหัสที่เพื่อนส่งให้เพื่อเข้าร่วม</p></div> : <div className="group-room-grid">{groupRooms.map(room => {
            return <article className={`group-room-card ${selectedRoomId === room.id ? 'room-selected' : ''}`} key={room.dbId}>
              <div className="group-room-card-top"><span className="group-room-icon">♧</span><span className="group-room-count">{room.members.length} คน · {tasks.filter(task => task.groupRoomId === room.id).length} งาน</span></div>
              <h3>{room.name}</h3>
              <p className="group-room-code">รหัสห้อง <strong>{room.code}</strong><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(room.code); setGroupRoomMessage('คัดลอกรหัสห้องแล้ว') } catch { setGroupRoomMessage(`รหัสห้อง: ${room.code}`) } }}>คัดลอกรหัส</button></p>
              <div className="group-room-invite-action"><button type="button" onClick={() => { setSelectedInviteRoomId(room.id); setInviteFormat('message'); setGroupRoomMessage(''); setActiveNav('เชิญเพื่อน') }}>✉ จัดการคำเชิญเพื่อน</button></div>
              <div className="group-room-members"><strong>สมาชิกที่เข้าร่วมจริง</strong><div>{room.members.map(member => <span className="group-member-chip" key={`${room.dbId}-${member.userId}`}>👤 {member.userId === authSession?.user?.id ? 'คุณ' : `สมาชิก ${member.userId.slice(0, 6)}`} {member.role === 'owner' ? '(เจ้าของห้อง)' : ''}</span>)}</div></div>
              {room.ownerId === authSession?.user?.id && <button type="button" className="group-room-delete" onClick={async () => {
                if (!window.confirm(`ต้องการลบห้อง “${room.name}” ใช่ไหม?`)) return
                if (!supabase) return
                setGroupRoomBusy(true)
                try {
                  const { error } = await supabase.from('group_rooms').delete().eq('id', room.dbId).eq('owner_id', authSession.user.id)
                  if (error) throw error
                  setGroupRooms(current => current.filter(item => item.dbId !== room.dbId))
                  setGroupRoomMessage('ลบห้องแล้ว')
                } catch (error) { setGroupRoomMessage(error instanceof Error ? `ลบห้องไม่สำเร็จ: ${error.message}` : 'ลบห้องไม่สำเร็จ') }
                finally { setGroupRoomBusy(false) }
              }}>ลบห้อง</button>}
            </article>
          })}</div>}
        </section>}

        {activeNav === 'เชิญเพื่อน' && <section className="panel invite-page">
          <button type="button" className="task-back-button" onClick={() => setActiveNav('งานกลุ่ม')}>← กลับไปห้องงานกลุ่ม</button>
          <div className="invite-page-hero">
            <span className="invite-hero-icon">✉</span>
            <div><span className="eyebrow">AEVORA · INVITATION STUDIO</span><h2>ชวนเพื่อนเข้าห้อง</h2><p>เลือกรูปแบบคำเชิญให้เหมาะกับที่ที่คุณจะส่ง แล้วคัดลอกหรือแชร์ได้ทันที</p></div>
          </div>
          {groupRooms.length === 0 ? <div className="invite-empty-state"><span>♧</span><h3>ยังไม่มีห้องให้ชวนเพื่อน</h3><p>สร้างห้องงานกลุ่มก่อน แล้วกลับมาทำคำเชิญได้ที่หน้านี้</p><button type="button" onClick={() => setActiveNav('งานกลุ่ม')}>ไปสร้างห้องงานกลุ่ม</button></div> : <>
            <div className="invite-room-picker"><label htmlFor="invite-room-select">เลือกห้องที่ต้องการชวนเพื่อน</label><select id="invite-room-select" value={inviteRoom?.id ?? ''} onChange={event => setSelectedInviteRoomId(event.target.value ? Number(event.target.value) : null)}>{groupRooms.map(room => <option key={room.dbId} value={room.id}>{room.name}</option>)}</select><div className="invite-room-summary"><span>♧</span><div><strong>{inviteRoom?.name}</strong><small>{inviteRoom?.members.length ?? 0} สมาชิก · {inviteRoom ? tasks.filter(task => task.groupRoomId === inviteRoom.id).length : 0} งาน</small></div><b>รหัส {inviteRoom?.code}</b></div></div>
            <div className="invite-format-heading"><div><h3>เลือกรูปแบบคำเชิญ</h3><p>เปลี่ยนรูปแบบได้ตลอดเวลา โดยไม่กระทบข้อมูลห้อง</p></div></div>
            <div className="invite-format-grid">
              <button type="button" className={`invite-format-card ${inviteFormat === 'link' ? 'selected' : ''}`} onClick={() => setInviteFormat('link')}><span>🔗</span><strong>ลิงก์เข้าห้อง</strong><small>เหมาะกับแชตหรือโพสต์ให้เพื่อนกดเข้า</small><b>{inviteFormat === 'link' ? '✓ เลือกอยู่' : 'เลือกรูปแบบนี้'}</b></button>
              <button type="button" className={`invite-format-card ${inviteFormat === 'code' ? 'selected' : ''}`} onClick={() => setInviteFormat('code')}><span>🔑</span><strong>รหัสห้อง</strong><small>ส่งรหัสสั้น ๆ ให้เพื่อนกรอกใน Aevora</small><b>{inviteFormat === 'code' ? '✓ เลือกอยู่' : 'เลือกรูปแบบนี้'}</b></button>
              <button type="button" className={`invite-format-card ${inviteFormat === 'message' ? 'selected' : ''}`} onClick={() => setInviteFormat('message')}><span>💌</span><strong>ข้อความพร้อมส่ง</strong><small>มีชื่อห้อง รหัส และลิงก์ในข้อความเดียว</small><b>{inviteFormat === 'message' ? '✓ เลือกอยู่' : 'เลือกรูปแบบนี้'}</b></button>
            </div>
            <div className="invite-preview-card"><div className="invite-preview-heading"><div><span className="eyebrow">PREVIEW</span><h3>ตัวอย่างคำเชิญของคุณ</h3></div><span className="invite-live-badge">อัปเดตตามรูปแบบ</span></div><textarea aria-label="ตัวอย่างคำเชิญ" value={inviteContent} readOnly rows={inviteFormat === 'message' ? 7 : 3}/><div className="invite-preview-actions"><button type="button" className="invite-primary-action" onClick={async () => { try { await navigator.clipboard.writeText(inviteContent); setGroupRoomMessage('คัดลอกคำเชิญแล้ว พร้อมนำไปส่งให้เพื่อน ✨') } catch { setGroupRoomMessage('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความในช่องแล้วคัดลอก') } }}>▣ คัดลอกคำเชิญ</button><button type="button" className="invite-secondary-action" onClick={async () => { try { if (navigator.share) await navigator.share({ title: `ชวนเข้าห้อง ${inviteRoom?.name || ''}`, text: inviteContent, url: inviteFormat === 'link' ? inviteLink : undefined }); else { await navigator.clipboard.writeText(inviteContent); setGroupRoomMessage('อุปกรณ์นี้ไม่รองรับแชร์โดยตรง จึงคัดลอกคำเชิญให้แล้ว') } } catch (error) { if (error instanceof Error && error.name !== 'AbortError') setGroupRoomMessage('แชร์ไม่สำเร็จ ลองกดคัดลอกคำเชิญแทนได้เลย') } }}>↗ แชร์จากอุปกรณ์</button></div>{groupRoomMessage && <p className="task-inline-message" role="status">{groupRoomMessage}</p>}<p className="invite-security-note">✦ เพื่อนต้องเข้าสู่ระบบ Aevora และเข้าร่วมด้วยรหัส/ลิงก์ก่อน จึงจะถือว่าเป็นสมาชิกห้อง</p></div>
          </>}
        </section>}

        {(activeNav === 'งานของฉัน' || activeNav === 'งานกลุ่ม') && !selectedTask && !showForm && <section className="panel tasks-panel task-manager"><div className="panel-heading"><div><h2>{activeNav === 'งานกลุ่ม' ? '♧ งานกลุ่ม' : '▣ งานของฉัน'}</h2><p className="muted">เพิ่ม แก้ไข ค้นหา และจัดการงานได้จากที่นี่</p></div><button className="text-button" onClick={() => { setSelectedTaskId(null); setEditingId(null); setTitle(''); setSubject(''); setDescription(''); setTaskRoomId(''); setAssignedTo(''); setType(activeNav === 'งานกลุ่ม' ? 'งานกลุ่ม' : 'งานเดี่ยว'); setDue(''); setShowForm(true) }}>+ สร้างงานใหม่</button></div>

          <input id="task-search" className="task-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาจากชื่องานหรือวิชา..." aria-label="ค้นหางาน"/><div className="task-filters filter-buttons">{(['ทั้งหมด', 'กำลังทำ', 'เสร็จแล้ว', 'งานเดี่ยว', 'งานกลุ่ม'] as Filter[]).map(item => <button key={item} className={filter === item ? 'filter-active' : ''} onClick={() => setFilter(item)}>{item}{item === 'ทั้งหมด' ? ` (${tasks.length})` : item === 'เสร็จแล้ว' ? ` (${completed})` : ''}</button>)}</div>

          <div className="task-list">{filteredTasks.length ? filteredTasks.map(task => <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}><button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => toggleTask(task.id)} aria-label={task.done ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'ทำเครื่องหมายว่าเสร็จแล้ว'}>{task.done ? '✓' : ''}</button><div className="task-info"><button type="button" className="task-title-link" onClick={() => setSelectedTaskId(task.id)}>{task.title}</button><small>{task.subject}</small>{(task.groupRoomId || task.assignedTo) && <small className="task-assignment-meta">{task.groupRoomId ? groupRooms.find(room => room.id === task.groupRoomId)?.name : ''}{task.groupRoomId && task.assignedTo ? ' · ' : ''}{task.assignedTo ? `ผู้รับผิดชอบ: ${task.assignedTo}` : ''}</small>}</div><span className={`task-type ${task.type === 'งานกลุ่ม' ? 'group-type' : ''}`}>{task.type}</span><span className="task-due">◷ {task.due}</span><div className="task-progress"><div className="mini-track"><div style={{ width: `${getTaskProgress(task)}%` }}/></div><small>{getTaskProgress(task)}%</small></div><div className="task-actions"><button type="button" onClick={() => startEdit(task)} aria-label={`แก้ไข ${task.title}`}>แก้ไข</button><button type="button" onClick={() => deleteTask(task)} aria-label={`ลบ ${task.title}`}>ลบ</button></div></div>) : <p className="empty-tasks">ไม่พบงานที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นหาหรือตัวกรองนะ</p>}</div><div className="task-footer">ทำเสร็จแล้ว {completed} จาก {tasks.length} งาน ✦</div></section>}

        {(activeNav === 'งานของฉัน' || activeNav === 'งานกลุ่ม') && (selectedTask || (showForm && editingId === null)) && (
          <TaskDetailPanel
            authSession={authSession}
            task={selectedTask}
            showForm={showForm}
            title={title}
            setTitle={setTitle}
            subject={subject}
            setSubject={setSubject}
            type={type}
            setType={setType}
            due={due}
            setDue={setDue}
            description={description}
            setDescription={setDescription}
            groupRooms={groupRooms}
            taskRoomId={taskRoomId}
            setTaskRoomId={setTaskRoomId}
            assignedTo={assignedTo}
            setAssignedTo={setAssignedTo}
            updateSubtasks={updateSubtasks}
            updateTaskExtras={updateTaskExtras}
            saveTask={saveTask}
            resetForm={resetForm}
            startEdit={startEdit}
            deleteTask={deleteTask}
            toggleTask={toggleTask}
            onBack={() => {
              resetForm()
              setSelectedTaskId(null)
            }}
          />
        )}

        {activeNav === 'ปฏิทิน' && (
        <CalendarPanel
          tasks={tasks}
          onOpenTask={(taskId) => {
            setSelectedTaskId(taskId)
            setShowForm(false)
            setEditingId(null)
            setActiveNav('งานของฉัน')
          }}
          onAddTask={(date) => {
            setDue(date)
            setTitle('')
            setSubject('')
            setDescription('')
            setType('งานเดี่ยว')
            setEditingId(null)
            setSelectedTaskId(null)
            setShowForm(true)
            setActiveNav('งานของฉัน')
          }}
        />
      )}

      <footer className="app-footer">✦ Aevora · Work · Grow · Together ✦</footer>

      </main>

    </div>

  )

}

type TaskPanelProps = {
  tasks: Task[]
  completed: number
  toggleTask: (id: number) => void
  deleteTask: (task: Task) => void
  openTask: (task: Task) => void
  onViewAll: () => void
  onCreateTask: () => void
}

function TaskPanel(props: TaskPanelProps) {
  const { tasks, completed, toggleTask, deleteTask, openTask, onViewAll, onCreateTask } = props

  return (
    <div className="panel tasks-panel">
      <div className="panel-heading">
        <h2>▣ งานของฉันวันนี้</h2>
        <button className="text-button" onClick={onCreateTask}>+ สร้างงานใหม่</button>
      </div>
      <div className="task-filters">
        <span>ทั้งหมด <b>{tasks.length}</b></span>
        <span>เสร็จแล้ว <b>{completed}</b></span>
        <button className="text-button" onClick={onViewAll}>จัดการงาน →</button>
      </div>
      <div className="task-list">
        {tasks.length ? tasks.map(task => (
          <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}>
            <button className={`task-check ${task.done ? 'checked' : ''}`} onClick={() => toggleTask(task.id)} aria-label={task.done ? 'ทำเครื่องหมายว่ายังไม่เสร็จ' : 'ทำเครื่องหมายว่าเสร็จแล้ว'}>{task.done ? '✓' : ''}</button>
            <div className="task-info">
              <button type="button" className="task-title-link" onClick={() => openTask(task)}>{task.title}</button>
              <small>{task.subject}</small>
            </div>
            <span className={`task-type ${task.type === 'งานกลุ่ม' ? 'group-type' : ''}`}>{task.type}</span>
            <span className="task-due">◷ {task.due}</span>
            <div className="task-progress"><div className="mini-track"><div style={{ width: `${getTaskProgress(task)}%` }} /></div><small>{getTaskProgress(task)}%</small></div>
            <div className="task-actions"><button type="button" onClick={() => openTask(task)}>ดูงาน</button><button type="button" onClick={() => deleteTask(task)}>ลบ</button></div>
          </div>
        )) : <p className="empty-tasks">ยังไม่มีงานในรายการนี้</p>}
      </div>
      <div className="task-footer">ทำเสร็จแล้ว {completed} จาก {tasks.length} งาน ✦</div>
    </div>
  )
}

type TaskDetailPanelProps = {
  authSession: Session | null
  task: Task | null
  showForm: boolean
  title: string
  setTitle: (value: string) => void
  subject: string
  setSubject: (value: string) => void
  type: 'งานเดี่ยว' | 'งานกลุ่ม'
  setType: (value: 'งานเดี่ยว' | 'งานกลุ่ม') => void
  due: string
  setDue: (value: string) => void
  description: string
  setDescription: (value: string) => void
  groupRooms: GroupRoom[]
  taskRoomId: number | ''
  setTaskRoomId: (value: number | '') => void
  assignedTo: string
  setAssignedTo: (value: string) => void
  updateSubtasks: (taskId: number, subtasks: Subtask[]) => void
  updateTaskExtras: (taskId: number, patch: Partial<Pick<Task, 'attachments' | 'comments' | 'helpRequests' | 'activity'>>) => void
  saveTask: (event: React.FormEvent<HTMLFormElement>) => void
  resetForm: () => void
  startEdit: (task: Task) => void
  deleteTask: (task: Task) => void
  toggleTask: (id: number) => void
  onBack: () => void
}

function TaskDetailPanel(props: TaskDetailPanelProps) {
  const { authSession, task, showForm, title, setTitle, subject, setSubject, type, setType, due, setDue, description, setDescription, groupRooms, taskRoomId, setTaskRoomId, assignedTo, setAssignedTo, updateSubtasks, updateTaskExtras, saveTask, startEdit, deleteTask, toggleTask, onBack } = props
  const isCreating = task === null
  const progress = task ? getTaskProgress(task) : 0
  const [newSubtask, setNewSubtask] = useState('')
  const [commentText, setCommentText] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('ฉัน')
  const [privateNote, setPrivateNote] = useState(false)
  const [helpText, setHelpText] = useState('')
  const [fileMessage, setFileMessage] = useState('')
  const dueLabel = task?.dueDate
    ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : task?.due || 'ยังไม่กำหนด'

  return (
    <section className="panel task-detail-page">
      <button type="button" className="task-back-button" onClick={onBack}>← กลับไปหน้ารายการงาน</button>
      {showForm ? (
        <>
          <div className="task-detail-heading">
            <span className="eyebrow">{isCreating ? 'NEW TASK' : 'EDIT TASK'}</span>
            <h2>{isCreating ? 'สร้างงานใหม่' : 'แก้ไขรายละเอียดงาน'}</h2>
            <p className="muted">{isCreating ? 'กรอกรายละเอียดงานของคุณ แล้วบันทึกเพื่อเริ่มต้น' : 'เปลี่ยนเฉพาะข้อมูลที่ต้องการ แล้วกดบันทึก'}</p>
          </div>
          <form className="new-task-form task-edit-form detail-edit-form" onSubmit={saveTask}>
            <label>ชื่องาน *<input value={title} onChange={event => setTitle(event.target.value)} placeholder="เช่น ทำรายงานบทที่ 1" required maxLength={120} /></label>
            <label>วิชา / โปรเจกต์<input value={subject} onChange={event => setSubject(event.target.value)} placeholder="เช่น วิทยาศาสตร์" maxLength={100} /></label>
            <label>ประเภทงาน<select value={type} onChange={event => setType(event.target.value as 'งานเดี่ยว' | 'งานกลุ่ม')}><option value="งานเดี่ยว">งานเดี่ยว</option><option value="งานกลุ่ม">งานกลุ่ม</option></select></label>
            {type === 'งานกลุ่ม' && <div className="task-assignment-fields">
              <label>ห้องงานกลุ่ม<select value={taskRoomId} onChange={event => { const value = event.target.value; const roomId = value ? Number(value) : ''; setTaskRoomId(roomId); const room = groupRooms.find(item => item.id === roomId); if (room && assignedTo && !room.members.some(member => member.userId === assignedTo)) setAssignedTo('') }}><option value="">ยังไม่เลือกห้อง</option>{groupRooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
              <label>ผู้รับผิดชอบ<select value={assignedTo} onChange={event => setAssignedTo(event.target.value)} disabled={taskRoomId === ''}><option value="">ยังไม่มอบหมาย</option>{groupRooms.find(room => room.id === taskRoomId)?.members.map(member => <option key={member.userId} value={member.userId}>{member.userId === authSession?.user?.id ? 'ฉัน' : `${member.userId.slice(0, 8)}…`}</option>)}</select></label>
              {groupRooms.length === 0 && <p className="task-assignment-hint">ยังไม่มีห้องงานกลุ่ม ไปที่เมนู “งานกลุ่ม” เพื่อสร้างห้องก่อนนะ</p>}
            </div>}
            <label>วันกำหนดส่ง<input type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
            <label className="detail-description-field">รายละเอียดเพิ่มเติม<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="จดสิ่งที่ต้องทำหรือรายละเอียดของงาน..." rows={4} maxLength={1000} /></label>
            {task && <section className="task-edit-attachments">
              <div className="task-extra-heading"><h3>ไฟล์แนบของงานนี้</h3><span>{task.attachments?.length || 0} ไฟล์</span></div>
              <p className="muted task-extra-help">เพิ่มไฟล์ได้สูงสุด 25 MB ต่อไฟล์ ระบบจะเก็บไว้ในเบราว์เซอร์เครื่องนี้</p>
              <label className="task-file-picker">+ เพิ่มไฟล์แนบ<input type="file" onChange={async event => {
                const input = event.currentTarget
                const file = input.files?.[0]
                if (!file || !task) return
                if (file.size > MAX_ATTACHMENT_SIZE) { setFileMessage('ไฟล์มีขนาดเกิน 25 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้'); input.value = ''; return }
                const attachmentId = Date.now()
                try {
                  if (!supabase || !authSession?.user?.id) {
                    throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์')
                  }

                  const userId = authSession.user.id
                  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                  const storagePath = `${userId}/${task.id}/${attachmentId}-${safeName}`

                  const { error: uploadError } = await supabase.storage
                    .from('task-attachments')
                    .upload(storagePath, file, {
                      contentType: file.type || 'application/octet-stream',
                      upsert: false,
                    })

                  if (uploadError) throw uploadError

                  const attachment: TaskAttachment = {
                    id: attachmentId,
                    name: file.name,
                    size: file.size,
                    addedAt: new Date().toISOString(),
                    storagePath,
                  }

                  updateTaskExtras(task.id, {
                    attachments: [...(task.attachments || []), attachment],
                    activity: [
                      ...(task.activity || []),
                      {
                        id: Date.now() + 1,
                        text: `แนบไฟล์ ${file.name}`,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  })

                  setFileMessage('อัปโหลดไฟล์ขึ้นออนไลน์สำเร็จ')
                } catch (error) {
                  console.error('อัปโหลดไฟล์ไม่สำเร็จ:', error)
                  setFileMessage(
                    error instanceof Error
                      ? `อัปโหลดไม่สำเร็จ: ${error.message}`
                      : 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Supabase'
                  )
                }
                input.value = ''
              }} /></label>
              {fileMessage && <p className="task-inline-message" role="status">{fileMessage}</p>}
              {task.attachments?.length ? <ul className="task-attachment-list">{task.attachments.map(file => <li key={file.id}><button type="button" className="task-attachment-download" onClick={async () => {
                try {
                  if (file.storagePath) {
                    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase')
                    const { data, error } = await supabase.storage.from('task-attachments').download(file.storagePath)
                    if (error) throw error
                    if (!data) throw new Error('ไม่พบไฟล์ในพื้นที่จัดเก็บ')
                    const url = URL.createObjectURL(data)
                    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click()
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
                    return
                  }
                  if (file.dataUrl) { const link = document.createElement('a'); link.href = file.dataUrl; link.download = file.name; link.click(); return }
                  const blob = await getAttachmentBlob(`${task.id}:${file.id}`)
                  if (!blob) { setFileMessage('ไม่พบข้อมูลไฟล์นี้ในเบราว์เซอร์'); return }
                  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
                } catch (error) { console.error('ดาวน์โหลดไฟล์ไม่สำเร็จ:', error); setFileMessage('ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่') }
              }}>{file.name}</button><small>{file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`}</small><button type="button" onClick={async () => {
                try {
                  if (file.storagePath) {
                    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase')
                    const { error } = await supabase.storage.from('task-attachments').remove([file.storagePath])
                    if (error) throw error
                  } else {
                    await removeAttachmentBlob(`${task.id}:${file.id}`)
                  }
                  updateTaskExtras(task.id, { attachments: (task.attachments || []).filter(item => item.id !== file.id), activity: [...(task.activity || []), { id: Date.now(), text: `ลบไฟล์ ${file.name}`, createdAt: new Date().toISOString() }] })
                  setFileMessage('ลบไฟล์เรียบร้อยแล้ว')
                } catch (error) {
                  console.error('ลบไฟล์ไม่สำเร็จ:', error)
                  setFileMessage('ลบไฟล์ไม่สำเร็จ ไฟล์ยังคงอยู่ กรุณาลองใหม่')
                }
              }}>ลบ</button></li>)}</ul> : <p className="task-extra-empty">ยังไม่มีไฟล์แนบในงานนี้</p>}
            </section>}
            {!task && <p className="task-edit-attachment-note">สร้างงานและบันทึกก่อน แล้วจึงเพิ่มไฟล์แนบได้ค่ะ</p>}
            <div className="task-form-actions">
              <button type="submit">{isCreating ? 'สร้างงาน' : 'บันทึกการแก้ไข'}</button>
              <button type="button" className="text-button" onClick={onBack}>ยกเลิก</button>
            </div>
          </form>
        </>
      ) : task ? (
        <>
          <div className="task-detail-heading">
            <span className="eyebrow">TASK DETAILS · {task.type}</span>
            <h2>{task.title}</h2>
            <p className="muted">{task.subject || 'งานทั่วไป'}</p>
          </div>
          {task.description?.trim() && <div className="task-description-card"><h3>รายละเอียดงาน</h3><p>{task.description}</p></div>}
          <div className="task-detail-grid">
            <div className="task-detail-card"><span>วันกำหนดส่ง</span><strong>◷ {dueLabel}</strong></div>
            <div className="task-detail-card"><span>ประเภทงาน</span><strong>{task.type}</strong></div>
            {task.type === 'งานกลุ่ม' && <div className="task-detail-card"><span>ห้องงานกลุ่ม</span><strong>{groupRooms.find(room => room.id === task.groupRoomId)?.name || 'ยังไม่เลือกห้อง'}</strong></div>}
            {task.type === 'งานกลุ่ม' && <div className="task-detail-card"><span>ผู้รับผิดชอบ</span><strong>{task.assignedTo || 'ยังไม่มอบหมาย'}</strong></div>}
            <div className="task-detail-card"><span>สถานะ</span><strong className={task.done ? 'detail-status-done' : 'detail-status-pending'}>{task.done ? '✓ เสร็จแล้ว' : '◷ กำลังทำ'}</strong></div>
            <div className="task-detail-card"><span>ความคืบหน้า</span><strong>{progress}%</strong><div className="task-detail-progress"><div style={{ width: `${progress}%` }} /></div></div>
          </div>
          <div className="subtask-panel">
            <div className="subtask-heading"><div><h3>งานย่อยของงานนี้</h3><p>{task.subtasks?.filter(item => item.done).length || 0} / {task.subtasks?.length || 0} รายการเสร็จแล้ว</p></div><span>{task.subtasks?.length ? Math.round(task.subtasks.filter(item => item.done).length / task.subtasks.length * 100) : 0}%</span></div>
            <form className="subtask-add-form" onSubmit={event => { event.preventDefault(); const value = newSubtask.trim(); if (!value) return; updateSubtasks(task.id, [...(task.subtasks || []), { id: Date.now(), title: value, done: false }]); setNewSubtask('') }}>
              <input value={newSubtask} onChange={event => setNewSubtask(event.target.value)} placeholder="เพิ่มงานย่อย เช่น ค้นหาข้อมูล" aria-label="ชื่องานย่อย" maxLength={120} />
              <button type="submit">+ เพิ่ม</button>
            </form>
            {task.subtasks?.length ? <div className="subtask-list">{task.subtasks.map(item => <div className={`subtask-row ${item.done ? 'subtask-done' : ''}`} key={item.id}><label><input type="checkbox" checked={item.done} onChange={event => updateSubtasks(task.id, (task.subtasks || []).map(sub => sub.id === item.id ? { ...sub, done: event.target.checked } : sub))} /><span>{item.title}</span></label><button type="button" aria-label={`ลบงานย่อย ${item.title}`} onClick={() => updateSubtasks(task.id, (task.subtasks || []).filter(sub => sub.id !== item.id))}>ลบ</button></div>)}</div> : <p className="subtask-empty">ยังไม่มีงานย่อย ลองแบ่งงานนี้เป็นขั้นตอนเล็ก ๆ ดูนะ</p>}
          </div>
          <div className="task-extra-grid">
            <section className="task-extra-card">
              <div className="task-extra-heading"><h3>ไฟล์แนบ</h3><span>{task.attachments?.length || 0}</span></div>
              <p className="muted task-extra-help">แนบไฟล์ได้สูงสุด 25 MB ต่อไฟล์ ไฟล์จะเก็บในพื้นที่จัดเก็บของเบราว์เซอร์นี้</p>
              <label className="task-file-picker">+ เลือกไฟล์<input type="file" onChange={async event => {
                const input = event.currentTarget
                const file = input.files?.[0]
                if (!file || !task) return
                if (file.size > MAX_ATTACHMENT_SIZE) { setFileMessage('ไฟล์มีขนาดเกิน 25 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้'); input.value = ''; return }
                const attachmentId = Date.now()
                try {
                  if (!supabase || !authSession?.user?.id) {
                    throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดไฟล์')
                  }

                  const userId = authSession.user.id
                  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                  const storagePath = `${userId}/${task.id}/${attachmentId}-${safeName}`

                  const { error: uploadError } = await supabase.storage
                    .from('task-attachments')
                    .upload(storagePath, file, {
                      contentType: file.type || 'application/octet-stream',
                      upsert: false,
                    })

                  if (uploadError) throw uploadError

                  const attachment: TaskAttachment = {
                    id: attachmentId,
                    name: file.name,
                    size: file.size,
                    addedAt: new Date().toISOString(),
                    storagePath,
                  }

                  updateTaskExtras(task.id, {
                    attachments: [...(task.attachments || []), attachment],
                    activity: [
                      ...(task.activity || []),
                      {
                        id: Date.now() + 1,
                        text: `แนบไฟล์ ${file.name}`,
                        createdAt: new Date().toISOString(),
                      },
                    ],
                  })

                  setFileMessage('อัปโหลดไฟล์ขึ้นออนไลน์สำเร็จ')
                } catch (error) {
                  console.error('อัปโหลดไฟล์ไม่สำเร็จ:', error)
                  setFileMessage(
                    error instanceof Error
                      ? `อัปโหลดไม่สำเร็จ: ${error.message}`
                      : 'อัปโหลดไฟล์ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Supabase'
                  )
                }
                input.value = ''
              }} /></label>
              {fileMessage && <p className="task-inline-message" role="status">{fileMessage}</p>}
              {task.attachments?.length ? <ul className="task-attachment-list">{task.attachments.map(file => <li key={file.id}><button type="button" className="task-attachment-download" onClick={async () => {
                try {
                  if (file.storagePath) {
                    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase')
                    const { data, error } = await supabase.storage.from('task-attachments').download(file.storagePath)
                    if (error) throw error
                    if (!data) throw new Error('ไม่พบไฟล์ในพื้นที่จัดเก็บ')
                    const url = URL.createObjectURL(data)
                    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                    return
                  }
                  if (file.dataUrl) { const link = document.createElement('a'); link.href = file.dataUrl; link.download = file.name; link.click(); return }
                  const blob = await getAttachmentBlob(`${task.id}:${file.id}`)
                  if (!blob) { setFileMessage('ไม่พบข้อมูลไฟล์นี้ในเบราว์เซอร์'); return }
                  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
                } catch (error) { console.error('ดาวน์โหลดไฟล์ไม่สำเร็จ:', error); setFileMessage('ดาวน์โหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่') }
              }}>{file.name}</button><small>{file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`}</small><button type="button" onClick={async () => {
                try {
                  if (file.storagePath) {
                    if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อ Supabase')
                    const { error } = await supabase.storage.from('task-attachments').remove([file.storagePath])
                    if (error) throw error
                  } else {
                    await removeAttachmentBlob(`${task.id}:${file.id}`)
                  }
                  updateTaskExtras(task.id, { attachments: (task.attachments || []).filter(item => item.id !== file.id), activity: [...(task.activity || []), { id: Date.now(), text: `ลบไฟล์ ${file.name}`, createdAt: new Date().toISOString() }] })
                  setFileMessage('ลบไฟล์เรียบร้อยแล้ว')
                } catch (error) {
                  console.error('ลบไฟล์ไม่สำเร็จ:', error)
                  setFileMessage('ลบไฟล์ไม่สำเร็จ ไฟล์ยังคงอยู่ กรุณาลองใหม่')
                }
              }}>ลบ</button></li>)}</ul> : <p className="task-extra-empty">ยังไม่มีไฟล์แนบ</p>}
            </section>
            <section className="task-extra-card">
              <div className="task-extra-heading"><h3>ความคิดเห็น</h3><span>{task.comments?.length || 0}</span></div>
              <form className="task-comment-form" onSubmit={event => { event.preventDefault(); const value = commentText.trim(); if (!value) return; const comment: TaskComment = { id: Date.now(), author: commentAuthor.trim() || 'ฉัน', text: value, createdAt: new Date().toISOString(), privateNote }; updateTaskExtras(task.id, { comments: [...(task.comments || []), comment], activity: [...(task.activity || []), { id: Date.now() + 1, text: privateNote ? 'เพิ่มบันทึกส่วนตัว' : 'เพิ่มความคิดเห็น', createdAt: new Date().toISOString() }] }); setCommentText(''); setPrivateNote(false) }}>
                <input value={commentAuthor} onChange={event => setCommentAuthor(event.target.value)} aria-label="ชื่อผู้แสดงความคิดเห็น" placeholder="ชื่อของคุณ" maxLength={40} />
                <textarea value={commentText} onChange={event => setCommentText(event.target.value)} placeholder="เขียนความคิดเห็นหรือบันทึก..." rows={3} maxLength={1000} required />
                <label className="task-private-toggle"><input type="checkbox" checked={privateNote} onChange={event => setPrivateNote(event.target.checked)} /> บันทึกส่วนตัว (แสดงเฉพาะในเครื่องนี้)</label>
                <button type="submit">เพิ่มความคิดเห็น</button>
              </form>
              {task.comments?.length ? <div className="task-comment-list">{[...task.comments].reverse().map(comment => <article key={comment.id} className="task-comment"><div><strong>{comment.author}</strong>{comment.privateNote && <span className="task-private-badge">ส่วนตัว</span>}<small>{new Date(comment.createdAt).toLocaleString('th-TH')}</small></div><p>{comment.text}</p><button type="button" onClick={() => updateTaskExtras(task.id, { comments: (task.comments || []).filter(item => item.id !== comment.id), activity: [...(task.activity || []), { id: Date.now(), text: 'ลบความคิดเห็น', createdAt: new Date().toISOString() }] })}>ลบ</button></article>)}</div> : <p className="task-extra-empty">ยังไม่มีความคิดเห็น</p>}
            </section>
            <section className="task-extra-card">
              <div className="task-extra-heading"><h3>ขอความช่วยเหลือ</h3><span>{(task.helpRequests || []).filter(item => item.status === 'เปิดอยู่').length} รายการเปิดอยู่</span></div>
              <form className="task-help-form" onSubmit={event => { event.preventDefault(); const value = helpText.trim(); if (!value) return; const request: HelpRequest = { id: Date.now(), text: value, status: 'เปิดอยู่', createdAt: new Date().toISOString() }; updateTaskExtras(task.id, { helpRequests: [...(task.helpRequests || []), request], activity: [...(task.activity || []), { id: Date.now() + 1, text: 'ส่งคำขอความช่วยเหลือ', createdAt: new Date().toISOString() }] }); setHelpText('') }}><textarea value={helpText} onChange={event => setHelpText(event.target.value)} placeholder="ติดปัญหาตรงไหน ต้องการให้ช่วยอะไร..." rows={3} maxLength={500} required /><button type="submit">ส่งคำขอ</button></form>
              {task.helpRequests?.length ? <div className="task-help-list">{[...task.helpRequests].reverse().map(request => <article key={request.id}><div><span className={request.status === 'เปิดอยู่' ? 'help-open' : 'help-resolved'}>{request.status}</span><small>{new Date(request.createdAt).toLocaleString('th-TH')}</small></div><p>{request.text}</p>{request.status === 'เปิดอยู่' && <button type="button" onClick={() => updateTaskExtras(task.id, { helpRequests: (task.helpRequests || []).map(item => item.id === request.id ? { ...item, status: 'แก้ไขแล้ว' } : item), activity: [...(task.activity || []), { id: Date.now(), text: 'ทำเครื่องหมายคำขอช่วยเหลือว่าแก้ไขแล้ว', createdAt: new Date().toISOString() }] })}>ทำเครื่องหมายว่าแก้ไขแล้ว</button>}</article>)}</div> : <p className="task-extra-empty">ยังไม่มีคำขอความช่วยเหลือ</p>}
            </section>
            <section className="task-extra-card">
              <div className="task-extra-heading"><h3>ประวัติการทำงาน</h3><span>{task.activity?.length || 0} รายการ</span></div>
              {task.activity?.length ? <ul className="task-activity-list">{[...task.activity].reverse().slice(0, 12).map(entry => <li key={entry.id}><span>{entry.text}</span><small>{new Date(entry.createdAt).toLocaleString('th-TH')}</small></li>)}</ul> : <p className="task-extra-empty">กิจกรรมที่เกิดขึ้นในส่วนไฟล์ ความคิดเห็น และคำขอช่วยเหลือจะแสดงตรงนี้</p>}
            </section>
          </div>
          <div className="task-detail-actions">
            <button type="button" className="detail-primary-button" onClick={() => startEdit(task)}>✎ แก้ไขรายละเอียด</button>
            <button type="button" className="detail-success-button" onClick={() => toggleTask(task.id)}>{task.done ? '↶ ทำต่อ' : '✓ ทำเครื่องหมายว่าเสร็จ'}</button>
            <button type="button" className="detail-delete-button" onClick={() => deleteTask(task)}>ลบงาน</button>
          </div>
        </>
      ) : null}
    </section>
  )
}

type CalendarPanelProps = {
  tasks: Task[]
  onAddTask: (date: string) => void
  onOpenTask: (taskId: number) => void
}

function CalendarPanel({ tasks, onAddTask, onOpenTask }: CalendarPanelProps) {
  const [month, setMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
  })

  const monthName = month.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  const startOffset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function dateKey(day: number) {
    return [month.getFullYear(), String(month.getMonth() + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
  }

  const selectedTasks = tasks.filter(task => task.dueDate === selectedDate)

  return (
    <section className="panel aevora-calendar">
      <div className="panel-heading">
        <div><h2>▦ ปฏิทินของฉัน</h2><p className="muted">วางแผนงานและดูวันกำหนดส่งในแต่ละวัน</p></div>
        <button className="text-button" onClick={() => onAddTask(selectedDate)}>+ เพิ่มงานวันนี้</button>
      </div>
      <div className="calendar-month-control">
        <button className="calendar-arrow" aria-label="เดือนก่อนหน้า" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <strong>{monthName}</strong>
        <button className="calendar-arrow" aria-label="เดือนถัดไป" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="calendar-grid">
        {['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
        {cells.map((day, index) => {
          if (day === null) return <div className="calendar-empty" key={`empty-${index}`} />
          const key = dateKey(day)
          const dayTasks = tasks.filter(task => task.dueDate === key)
          const isSelected = selectedDate === key
          return <button key={key} className={`calendar-day ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedDate(key)} aria-pressed={isSelected}>
            <span>{day}</span>{dayTasks.length > 0 && <span className="calendar-day-dot">{dayTasks.length}</span>}
          </button>
        })}
      </div>
      <div className="calendar-task-section">
        <h3>งานวันที่ {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</h3>
        {selectedTasks.length === 0 ? <p className="empty-tasks">วันนี้ยังไม่มีงานที่กำหนดส่ง</p> : <div className="calendar-task-list">
          {selectedTasks.map(task => <div className="calendar-task-item" key={task.id}>
            <span className={task.done ? 'calendar-task-check done' : 'calendar-task-check'}>{task.done ? '✓' : '•'}</span>
            <div><button type="button" className="task-title-link calendar-task-title" onClick={() => onOpenTask(task.id)}>{task.title}</button><small>{task.subject}</small></div>
            <span className="calendar-task-status">{task.done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ'}</span>
          </div>)}
        </div>}
      </div>
    </section>
  )
}

type AuthMode = 'login' | 'signup'

function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleGuestLogin() {
    setMessage('')
    setErrorMessage('')
    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage('ยังเชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสอบไฟล์ .env แล้วเริ่มเว็บใหม่')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: { data: { display_name: 'นักเดินทาง' } },
      })
      if (error) throw error
      setMessage('เข้าใช้ชั่วคราวสำเร็จ กำลังเปิด Aevora...')
    } catch (error) {
      const detail = error instanceof Error ? error.message : ''
      setErrorMessage(detail.toLowerCase().includes('anonymous') || detail.toLowerCase().includes('disabled')
        ? 'ยังไม่ได้เปิด Anonymous Sign-Ins ใน Supabase กรุณาเปิดที่ Authentication → Sign In / Providers → Anonymous แล้วลองใหม่'
        : `เข้าใช้ชั่วคราวไม่สำเร็จ: ${detail}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')
    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage('ยังเชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสอบไฟล์ .env แล้วปิดและเปิด npm run dev ใหม่')
      return
    }
    if (password.length < 6) {
      setErrorMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() || email.trim().split('@')[0] } },
        })
        if (error) throw error
        if (data.session) setMessage('สมัครสมาชิกสำเร็จ กำลังเข้าสู่ระบบ...')
        else setMessage('สมัครสมาชิกเรียบร้อยแล้วค่ะ กรุณาเปิดอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        setMessage('เข้าสู่ระบบสำเร็จ กำลังเปิด Aevora...')
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    setMessage('')
    setErrorMessage('')
    if (!supabase || !isSupabaseConfigured) {
      setErrorMessage('ยังเชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสอบไฟล์ .env')
      return
    }
    if (!email.trim()) {
      setErrorMessage('กรอกอีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้งนะคะ')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      if (error) throw error
      setMessage('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว หากไม่พบให้ตรวจสอบโฟลเดอร์ Spam')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'ส่งลิงก์ไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setBusy(false)
    }
  }

  return <main className="aevora-auth-page"><div className="aevora-auth-orbit orbit-one"/><div className="aevora-auth-orbit orbit-two"/><section className="aevora-auth-card"><div className="aevora-auth-brand"><span className="aevora-auth-logo">✦</span><p className="aevora-auth-kicker">YOUR LITTLE UNIVERSE</p><h1>Aevora</h1><p>Work · Grow · Together</p></div><div className="aevora-auth-welcome"><h2>{mode === 'login' ? 'กลับมาแล้ว ยินดีต้อนรับ ✨' : 'มาเริ่มเติบโตไปด้วยกัน 🌷'}</h2><p>{mode === 'login' ? 'เข้าสู่ระบบเพื่อไปต่อในโลกของคุณ' : 'สร้างบัญชีเพื่อเริ่มต้นใช้งาน Aevora'}</p></div><div className="aevora-auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); setErrorMessage('') }}>เข้าสู่ระบบ</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage(''); setErrorMessage('') }}>สมัครสมาชิก</button></div><form className="aevora-auth-form" onSubmit={handleSubmit}>{mode === 'signup' && <label>ชื่อที่ใช้แสดง<input value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="ชื่อของคุณ (ไม่บังคับ)" maxLength={32}/></label>}<label>อีเมล<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required/></label><label>รหัสผ่าน<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required/></label><button className="aevora-auth-submit" type="submit" disabled={busy}>{busy ? 'กำลังดำเนินการ...' : mode === 'login' ? 'เข้าสู่ระบบ →' : 'สร้างบัญชี →'}</button></form><button type="button" className="aevora-auth-guest" onClick={handleGuestLogin} disabled={busy}>{busy ? 'กำลังดำเนินการ...' : 'เข้าใช้ชั่วคราว ✨'}</button>{mode === 'login' && <button type="button" className="aevora-auth-forgot" onClick={handleResetPassword} disabled={busy}>ลืมรหัสผ่าน?</button>}{message && <p className="aevora-auth-message" role="status">{message}</p>}{errorMessage && <p className="aevora-auth-error" role="alert">{errorMessage}</p>}<p className="aevora-auth-footnote">ข้อมูลบัญชีจัดการผ่าน Supabase Authentication</p></section></main>
}

export default App  
  
