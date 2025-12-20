import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type Timestamp,
} from 'firebase/firestore'

export const toEmail = (number: string) => `${number}@chat.local`

export const sanitizeNumber = (value: string) => value.replace(/\D/g, '').slice(0, 6)

export const formatTime = (timestamp?: Timestamp | null) => {
  if (!timestamp) return 'just now'
  const date = timestamp.toDate()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type LookupResult =
  | { cleanedNumber: string; userId: string }
  | { error: string }

export const lookupUserByNumber = async (
  db: Firestore,
  targetNumber: string,
  invalidMessage = 'Enter a 6-digit ID.',
): Promise<LookupResult> => {
  const cleanedNumber = sanitizeNumber(targetNumber)
  if (cleanedNumber.length !== 6) {
    return { error: invalidMessage }
  }

  const userQuery = query(
    collection(db, 'users'),
    where('number', '==', cleanedNumber),
  )

  const snapshot = await getDocs(userQuery)
  if (snapshot.empty) {
    return { error: 'No player found with that ID.' }
  }

  return { cleanedNumber, userId: snapshot.docs[0].id }
}

export const upsertChat = async (
  db: Firestore,
  userId: string,
  otherUserId: string,
  currentNumber: string,
  otherNumber: string,
) => {
  const chatId = [userId, otherUserId].sort().join('_')
  await setDoc(
    doc(db, 'chats', chatId),
    {
      participants: [userId, otherUserId],
      participantNumbers: [currentNumber, otherNumber],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  return chatId
}
