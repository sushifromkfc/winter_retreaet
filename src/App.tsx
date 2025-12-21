import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { AuthPage } from './components/AuthPage'
import { DashboardPage } from './components/DashboardPage'
import { HeaderBar } from './components/HeaderBar'
import { HomePage } from './components/HomePage'
import { MessagesPage } from './components/MessagesPage'
import { TopNav } from './components/TopNav'
import { useAuthProfile } from './hooks/useAuthProfile'
import { useChatList } from './hooks/useChatList'
import { useMessages } from './hooks/useMessages'
import type { GamePhase } from './types'
import { authErrorMessage } from './utils/errors'
import {
  lookupUserByNumber,
  sanitizeNumber,
  toEmail,
  upsertChat,
} from './utils/chat'
import './App.css'

const gamePhases: GamePhase[] = [
  { label: 'Night 1', detail: 'Arrival' },
  { label: 'Day 1', detail: 'First clues' },
  { label: 'Night 2', detail: 'Cold trail' },
  { label: 'Day 2', detail: 'Cross-exam' },
  { label: 'Night 3', detail: 'Shadows' },
  { label: 'Day 3', detail: 'Pressure rises' },
  { label: 'Night 4', detail: 'Last strike' },
]

type StartChatResult =
  | { ok: true; chatId: string; number: string }
  | { ok: false; error: string }

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [numberInput, setNumberInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [confirmInput, setConfirmInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [compose, setCompose] = useState('')
  const [chatError, setChatError] = useState('')
  const [pendingPartnerNumber, setPendingPartnerNumber] = useState('')
  const [policeNumber, setPoliceNumber] = useState('')
  const [policeStatus, setPoliceStatus] = useState('')
  const [policeError, setPoliceError] = useState('')
  const [page, setPage] = useState<'home' | 'messages' | 'dashboard'>('home')
  const [nameInput, setNameInput] = useState('')
  const [nameStatus, setNameStatus] = useState('')
  const [nameError, setNameError] = useState('')

  const { user, currentNumber, displayName, loadingProfile } = useAuthProfile()
  const { chats, activeChatId, setActiveChatId, chatStreamError } =
    useChatList(user)
  const { messages, messageStreamError } = useMessages(user, activeChatId)

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [chats, activeChatId],
  )

  const partnerNumber = useMemo(() => {
    if (!activeChat?.participantNumbers?.length) return ''
    const other = activeChat.participantNumbers.find(
      (number) => number !== currentNumber,
    )
    return other ?? ''
  }, [activeChat, currentNumber])

  const displayPartnerNumber = partnerNumber || pendingPartnerNumber

  useEffect(() => {
    if (partnerNumber) {
      setPendingPartnerNumber('')
    }
  }, [partnerNumber])

  useEffect(() => {
    setNameInput(displayName)
  }, [displayName])

  useEffect(() => {
    if (!user) {
      setPage('home')
      setSearchNumber('')
      setCompose('')
      setChatError('')
      setPendingPartnerNumber('')
      setPoliceNumber('')
      setPoliceStatus('')
      setPoliceError('')
      setNameInput('')
      setNameStatus('')
      setNameError('')
    }
  }, [user])

  const totalPhases = gamePhases.length
  const currentPhaseIndex = 0
  const progressPercent =
    totalPhases > 1 ? (currentPhaseIndex / (totalPhases - 1)) * 100 : 0
  const currentPhase = gamePhases[currentPhaseIndex]

  const startChatWithNumber = async (
    targetNumber: string,
    invalidMessage = 'Enter a 6-digit ID.',
  ): Promise<StartChatResult> => {
    if (!user) {
      return { ok: false, error: 'Sign in to start a chat.' }
    }

    if (!currentNumber) {
      return {
        ok: false,
        error: 'Finish setting up your profile before chatting.',
      }
    }

    const lookup = await lookupUserByNumber(db, targetNumber, invalidMessage)
    if ('error' in lookup) {
      return { ok: false, error: lookup.error }
    }

    if (lookup.cleanedNumber === currentNumber) {
      return { ok: false, error: 'That is your own ID.' }
    }

    const chatId = await upsertChat(
      db,
      user.uid,
      lookup.userId,
      currentNumber,
      lookup.cleanedNumber,
    )

    setActiveChatId(chatId)
    setPendingPartnerNumber(lookup.cleanedNumber)
    return { ok: true, chatId, number: lookup.cleanedNumber }
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    const cleanedNumber = sanitizeNumber(numberInput)

    if (cleanedNumber.length !== 6) {
      setAuthError('Your ID must be exactly 6 digits.')
      return
    }

    if (!passwordInput.trim()) {
      setAuthError('Please enter a password.')
      return
    }

    if (authMode === 'signup' && passwordInput !== confirmInput) {
      setAuthError('Passwords do not match.')
      return
    }

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(
          auth,
          toEmail(cleanedNumber),
          passwordInput,
        )
      } else {
        const credential = await createUserWithEmailAndPassword(
          auth,
          toEmail(cleanedNumber),
          passwordInput,
        )
        await setDoc(doc(db, 'users', credential.user.uid), {
          number: cleanedNumber,
          createdAt: serverTimestamp(),
          displayName: '',
        })
      }

      setNumberInput('')
      setPasswordInput('')
      setConfirmInput('')
    } catch (error) {
      setAuthError(authErrorMessage(error))
    }
  }

  const handleAuthModeChange = (mode: 'login' | 'signup') => {
    setAuthMode(mode)
    setAuthError('')
  }

  const handleStartChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChatError('')
    const result = await startChatWithNumber(
      searchNumber,
      'Enter a 6-digit ID to start a chat.',
    )
    if (!result.ok) {
      setChatError(result.error)
      return
    }
    setSearchNumber('')
    setPage('messages')
  }

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !activeChatId) return

    const trimmed = compose.trim()
    if (!trimmed) return

    const senderName = displayName.trim()
    const messagePayload: {
      text: string
      senderId: string
      senderNumber: string
      createdAt: ReturnType<typeof serverTimestamp>
      senderName?: string
    } = {
      text: trimmed,
      senderId: user.uid,
      senderNumber: currentNumber,
      createdAt: serverTimestamp(),
    }
    if (senderName) {
      messagePayload.senderName = senderName
    }

    await addDoc(
      collection(db, 'chats', activeChatId, 'messages'),
      messagePayload,
    )

    await setDoc(
      doc(db, 'chats', activeChatId),
      {
        lastMessage: trimmed,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    setCompose('')
  }

  const handleContactPolice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPoliceError('')
    setPoliceStatus('')

    const result = await startChatWithNumber(
      policeNumber,
      'Enter a 6-digit police ID.',
    )
    if (!result.ok) {
      setPoliceError(result.error)
      return
    }

    setPoliceStatus(`Police channel opened with ID ${result.number}.`)
    setPoliceNumber('')
    setPage('messages')
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const handleNameSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNameError('')
    setNameStatus('')
    if (!user) {
      setNameError('Sign in to update your profile.')
      return
    }

    const trimmed = nameInput.trim()
    if (!trimmed) {
      setNameError('Name cannot be empty.')
      return
    }

    await setDoc(
      doc(db, 'users', user.uid),
      { displayName: trimmed },
      { merge: true },
    )
    setNameStatus('Name updated.')
  }

  return (
    <div className="app">
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <main className="shell">
        <HeaderBar
          user={user}
          loadingProfile={loadingProfile}
          currentNumber={currentNumber}
          onSignOut={handleSignOut}
          onIdClick={() => setPage('dashboard')}
        />
        {user ? <TopNav page={page} onChange={setPage} /> : null}

        {!user ? (
          <AuthPage
            authMode={authMode}
            onAuthModeChange={handleAuthModeChange}
            numberInput={numberInput}
            passwordInput={passwordInput}
            confirmInput={confirmInput}
            authError={authError}
            onNumberChange={(value) => setNumberInput(sanitizeNumber(value))}
            onPasswordChange={setPasswordInput}
            onConfirmChange={setConfirmInput}
            onSubmit={handleAuthSubmit}
          />
        ) : page === 'home' ? (
          <HomePage
            progressPercent={progressPercent}
            currentPhase={currentPhase}
            phases={gamePhases}
            policeNumber={policeNumber}
            policeError={policeError}
            policeStatus={policeStatus}
            onPoliceNumberChange={(value) =>
              setPoliceNumber(sanitizeNumber(value))
            }
            onPoliceSubmit={handleContactPolice}
            onOpenMessages={() => setPage('messages')}
          />
        ) : page === 'dashboard' ? (
          <DashboardPage
            currentNumber={currentNumber}
            nameInput={nameInput}
            status={nameStatus}
            error={nameError}
            onNameChange={setNameInput}
            onSubmit={handleNameSave}
          />
        ) : (
          <MessagesPage
            chats={chats}
            activeChatId={activeChatId}
            activeChat={activeChat}
            currentUserId={user?.uid ?? null}
            currentNumber={currentNumber}
            displayPartnerNumber={displayPartnerNumber}
            messages={messages}
            searchNumber={searchNumber}
            chatError={chatError}
            chatStreamError={chatStreamError}
            messageStreamError={messageStreamError}
            loadingProfile={loadingProfile}
            compose={compose}
            onSearchNumberChange={(value) => setSearchNumber(value)}
            onStartChat={handleStartChat}
            onSelectChat={setActiveChatId}
            onComposeChange={setCompose}
            onSendMessage={handleSendMessage}
          />
        )}
      </main>
    </div>
  )
}

export default App
