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
