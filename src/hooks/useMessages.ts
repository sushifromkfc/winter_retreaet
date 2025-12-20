import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { db } from '../firebase'
import type { MessageItem } from '../types'
import { firestoreErrorMessage } from '../utils/errors'

type MessageState = {
  messages: MessageItem[]
  messageStreamError: string
}

export const useMessages = (
  user: User | null,
  activeChatId: string | null,
): MessageState => {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [messageStreamError, setMessageStreamError] = useState('')

  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([])
      setMessageStreamError('')
      return
    }

    const messageQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    return onSnapshot(
      messageQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Omit<MessageItem, 'id'>
          return { id: docSnap.id, ...data }
        })
        setMessages(nextMessages)
        setMessageStreamError('')
      },
      (error) => {
        console.error(error)
        setMessageStreamError(firestoreErrorMessage(error))
      },
    )
  }, [user, activeChatId])

  return { messages, messageStreamError }
}
