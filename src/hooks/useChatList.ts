import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { db } from '../firebase'
import type { ChatSummary } from '../types'
import { firestoreErrorMessage } from '../utils/errors'

type ChatListState = {
  chats: ChatSummary[]
  activeChatId: string | null
  setActiveChatId: (chatId: string | null) => void
  chatStreamError: string
}

export const useChatList = (user: User | null): ChatListState => {
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [chatStreamError, setChatStreamError] = useState('')

  useEffect(() => {
    if (!user) {
      setChats([])
      setActiveChatId(null)
      setChatStreamError('')
      return
    }

    const chatQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
    )

    return onSnapshot(
      chatQuery,
      (snapshot) => {
        const nextChats = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<ChatSummary, 'id'>
          return { id: docSnap.id, ...data }
        })
        setChats(nextChats)
        setActiveChatId((prev) => prev ?? nextChats[0]?.id ?? null)
        setChatStreamError('')
      },
      (error) => {
        console.error(error)
        setChatStreamError(firestoreErrorMessage(error))
      },
    )
  }, [user])

  return { chats, activeChatId, setActiveChatId, chatStreamError }
}
