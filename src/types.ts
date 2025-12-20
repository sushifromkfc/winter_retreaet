import type { Timestamp } from 'firebase/firestore'

export type ChatSummary = {
  id: string
  participants: string[]
  participantNumbers?: string[]
  lastMessage?: string
  updatedAt?: Timestamp
}

export type MessageItem = {
  id: string
  text: string
  senderId: string
  senderNumber?: string
  createdAt?: Timestamp
}

export type GamePhase = {
  label: string
  detail: string
}
