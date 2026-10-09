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
