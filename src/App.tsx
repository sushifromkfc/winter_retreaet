import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  doc,
  type FirestoreError,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import './App.css'

type ChatSummary = {
  id: string
  participants: string[]
  participantNumbers?: string[]
  lastMessage?: string
  updatedAt?: Timestamp
}

type MessageItem = {
  id: string
  text: string
  senderId: string
  senderNumber?: string
  createdAt?: Timestamp
}

const toEmail = (number: string) => `${number}@chat.local`

const sanitizeNumber = (value: string) => value.replace(/\D/g, '').slice(0, 6)

const formatTime = (timestamp?: Timestamp | null) => {
  if (!timestamp) return 'just now'
  const date = timestamp.toDate()
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const authErrorMessage = (error: unknown) => {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'That 6-digit ID is already registered.'
      case 'auth/invalid-email':
        return 'Enter a valid 6-digit ID.'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.'
      case 'auth/wrong-password':
        return 'Incorrect password for that ID.'
      case 'auth/user-not-found':
        return 'No account found for that ID.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again soon.'
      default:
        return 'Unable to sign you in right now.'
    }
  }
  return 'Unable to sign you in right now.'
}

const formatFirestoreError = (error: FirestoreError) => {
  if (error.code === 'failed-precondition') {
    return 'Firestore needs an index for chats (participants array-contains + updatedAt desc).'
  }
  if (error.code === 'permission-denied') {
    return 'Firestore permission denied. Check your rules.'
  }
  return error.message
}

const gamePhases = [
  { label: 'Night 1', detail: 'Arrival' },
  { label: 'Day 1', detail: 'First clues' },
  { label: 'Night 2', detail: 'Cold trail' },
  { label: 'Day 2', detail: 'Cross-exam' },
  { label: 'Night 3', detail: 'Shadows' },
  { label: 'Day 3', detail: 'Pressure rises' },
  { label: 'Night 4', detail: 'Last strike' },
]

function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [numberInput, setNumberInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [confirmInput, setConfirmInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [currentNumber, setCurrentNumber] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [compose, setCompose] = useState('')
  const [searchNumber, setSearchNumber] = useState('')
  const [chatError, setChatError] = useState('')
  const [chatStreamError, setChatStreamError] = useState('')
  const [messageStreamError, setMessageStreamError] = useState('')
  const [pendingPartnerNumber, setPendingPartnerNumber] = useState('')
  const [policeNumber, setPoliceNumber] = useState('')
  const [policeStatus, setPoliceStatus] = useState('')
  const [policeError, setPoliceError] = useState('')
  const [page, setPage] = useState<'home' | 'messages'>('home')
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      setPage('home')
      setChats([])
      setMessages([])
      setActiveChatId(null)
      setChatError('')
      setAuthError('')
      if (!nextUser) {
        setCurrentNumber('')
        setLoadingProfile(false)
        return
      }
      setLoadingProfile(true)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return

    const profileRef = doc(db, 'users', user.uid)
    const unsubscribe = onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setCurrentNumber(String(data.number ?? ''))
      } else {
        setCurrentNumber('')
      }
      setLoadingProfile(false)
    })

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    if (!user) return

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
        setChatStreamError(formatFirestoreError(error))
      },
    )
  }, [user])

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
        setMessageStreamError(formatFirestoreError(error))
      },
    )
  }, [user, activeChatId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  useEffect(() => {
    if (partnerNumber) {
      setPendingPartnerNumber('')
    }
  }, [partnerNumber])

  const hasActiveChat = Boolean(activeChatId)
  const displayPartnerNumber = partnerNumber || pendingPartnerNumber
  const totalPhases = gamePhases.length
  const currentPhaseIndex = 0
  const progressPercent =
    totalPhases > 1 ? (currentPhaseIndex / (totalPhases - 1)) * 100 : 0
  const currentPhase = gamePhases[currentPhaseIndex]

  const findUserByNumber = async (targetNumber: string) => {
    const cleanedTarget = sanitizeNumber(targetNumber)
    if (cleanedTarget.length !== 6) {
      return { error: 'Enter a 6-digit ID.' }
    }

    const userQuery = query(
      collection(db, 'users'),
      where('number', '==', cleanedTarget),
    )

    const snapshot = await getDocs(userQuery)
    if (snapshot.empty) {
      return { error: 'No player found with that ID.' }
    }

    return { cleanedNumber: cleanedTarget, userId: snapshot.docs[0].id }
  }

  const startChatWithNumber = async (targetNumber: string) => {
    if (!user) {
      return { error: 'Sign in to start a chat.' }
    }

    if (!currentNumber) {
      return { error: 'Finish setting up your profile before chatting.' }
    }

    const lookup = await findUserByNumber(targetNumber)
    if ('error' in lookup) {
      return { error: lookup.error }
    }

    if (lookup.cleanedNumber === currentNumber) {
      return { error: 'That is your own ID.' }
    }

    const chatId = [user.uid, lookup.userId].sort().join('_')
    await setDoc(
      doc(db, 'chats', chatId),
      {
        participants: [user.uid, lookup.userId],
        participantNumbers: [currentNumber, lookup.cleanedNumber],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    setActiveChatId(chatId)
    setPendingPartnerNumber(lookup.cleanedNumber)
    return { chatId, number: lookup.cleanedNumber }
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
        })
      }

      setNumberInput('')
      setPasswordInput('')
      setConfirmInput('')
    } catch (error) {
      setAuthError(authErrorMessage(error))
    }
  }

  const handleStartChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChatError('')
    const result = await startChatWithNumber(searchNumber)
    if ('error' in result) {
      setChatError(result.error)
      return
    }
    setSearchNumber('')
  }

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !activeChatId) return

    const trimmed = compose.trim()
    if (!trimmed) return

    await addDoc(collection(db, 'chats', activeChatId, 'messages'), {
      text: trimmed,
      senderId: user.uid,
      senderNumber: currentNumber,
      createdAt: serverTimestamp(),
    })

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

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const handleContactPolice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPoliceError('')
    setPoliceStatus('')

    const result = await startChatWithNumber(policeNumber)
    if ('error' in result) {
      setPoliceError(result.error)
      return
    }

    setPoliceStatus(`Police channel opened with ID ${result.number}.`)
    setPoliceNumber('')
    setPage('messages')
  }

  return (
    <div className="app">
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <main className="shell">
        <header className="brand">
          <div>
            <p className="eyebrow">Winter Retreat Mystery</p>
            <h1>Silent Pines Case</h1>
            <p className="lede">
              Track the timeline, connect with teammates, and report to the
              police before the final night.
            </p>
          </div>
          {user ? (
            <div className="account">
              <div className="chip">
                {loadingProfile ? 'Loading ID...' : `ID ${currentNumber || '------'}`}
              </div>
              <button className="ghost" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : null}
        </header>

        {user ? (
          <nav className="top-nav">
            <button
              className={page === 'home' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setPage('home')}
            >
              Main page
            </button>
            <button
              className={page === 'messages' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setPage('messages')}
            >
              Messages
            </button>
          </nav>
        ) : null}

        {!user ? (
          <section className="auth-shell">
            <div className="panel auth-card">
              <div className="tabs">
                <button
                  className={authMode === 'login' ? 'tab active' : 'tab'}
                  type="button"
                  onClick={() => {
                    setAuthMode('login')
                    setAuthError('')
                  }}
                >
                  Sign in
                </button>
                <button
                  className={authMode === 'signup' ? 'tab active' : 'tab'}
                  type="button"
                  onClick={() => {
                    setAuthMode('signup')
                    setAuthError('')
                  }}
                >
                  Create account
                </button>
              </div>

              <form className="form" onSubmit={handleAuthSubmit}>
                <label className="field">
                  <span>6-digit ID</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    pattern="\d{6}"
                    placeholder="e.g. 482901"
                    value={numberInput}
                    onChange={(event) =>
                      setNumberInput(sanitizeNumber(event.target.value))
                    }
                  />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input
                    className="input"
                    type="password"
                    placeholder="Your secret"
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                  />
                </label>
                {authMode === 'signup' ? (
                  <label className="field">
                    <span>Confirm password</span>
                    <input
                      className="input"
                      type="password"
                      placeholder="Repeat password"
                      value={confirmInput}
                      onChange={(event) => setConfirmInput(event.target.value)}
                    />
                  </label>
                ) : null}
                {authError ? <p className="error">{authError}</p> : null}
                <button className="primary" type="submit">
                  {authMode === 'login' ? 'Enter case' : 'Join the case'}
                </button>
                <p className="helper">
                  Use any six digits as your ID. Your password is stored securely
                  in Firebase Auth.
                </p>
              </form>
            </div>

            <div className="panel highlight">
              <h2>How to win</h2>
              <ul>
                <li>Play each challenge to uncover hidden clues.</li>
                <li>Share theories privately and compare alibis.</li>
                <li>Report the murderer to the police before the final night.</li>
              </ul>
              <div className="highlight-footer">
                <span>Trust no one until the final reveal.</span>
              </div>
            </div>
          </section>
        ) : page === 'home' ? (
          <section className="home-grid">
            <div className="panel progress-card">
              <div className="progress-header">
                <div>
                  <h2>Time Passed</h2>
                  <p className="helper">4 Nights • 3 Days</p>
                </div>
                <span className="chip muted">{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="progress-meta">
                <span>{currentPhase?.label}</span>
                <span>{currentPhase?.detail}</span>
              </div>
              <div className="phase-row">
                {gamePhases.map((phase) => (
                  <div key={phase.label} className="phase-pill">
                    <span>{phase.label}</span>
                    <small>{phase.detail}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel action-card">
              <h2>Operations</h2>
              <p className="helper">
                Move between private chats and the police line.
              </p>
              <button
                className="primary action-button"
                type="button"
                onClick={() => setPage('messages')}
              >
                Open messages
              </button>
              <form className="police-form" onSubmit={handleContactPolice}>
                <label className="field">
                  <span>Police 6-digit ID</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    pattern="\d{6}"
                    placeholder="Police/admin ID"
                    value={policeNumber}
                    onChange={(event) =>
                      setPoliceNumber(sanitizeNumber(event.target.value))
                    }
                  />
                </label>
                <button className="primary" type="submit">
                  Call police
                </button>
                {policeError ? <p className="error">{policeError}</p> : null}
                {policeStatus ? <p className="status">{policeStatus}</p> : null}
              </form>
            </div>
          </section>
        ) : (
          <section className="chat-shell">
            <aside className="panel chat-panel">
              <div className="panel-header">
                <div>
                  <h2>Chats</h2>
                  <p>Start by entering a six-digit ID.</p>
                </div>
              </div>
              <form className="start-chat" onSubmit={handleStartChat}>
                <input
                  className="input"
                  inputMode="numeric"
                  pattern="\d{6}"
                  placeholder="Friend ID"
                  value={searchNumber}
                  onChange={(event) =>
                    setSearchNumber(sanitizeNumber(event.target.value))
                  }
                  disabled={loadingProfile}
                />
                <button className="primary" type="submit" disabled={loadingProfile}>
                  Start
                </button>
              </form>
              {chatError ? <p className="error">{chatError}</p> : null}
              {chatStreamError ? <p className="error">{chatStreamError}</p> : null}
              <div className="chat-list">
                {chats.length === 0 && !hasActiveChat ? (
                  <div className="empty">No chats yet. Start one!</div>
                ) : (
                  <>
                    {hasActiveChat && !activeChat ? (
                      <div className="chat-item pending">
                        <div>
                          <strong>{displayPartnerNumber || 'New chat'}</strong>
                          <span className="meta">
                            Waiting for chat to sync...
                          </span>
                        </div>
                        <span className="time">just now</span>
                      </div>
                    ) : null}
                    {chats.map((chat) => {
                      const label =
                        chat.participantNumbers?.find(
                          (number) => number !== currentNumber,
                        ) ?? 'Unknown'
                      return (
                        <button
                          key={chat.id}
                          className={
                            chat.id === activeChatId
                              ? 'chat-item active'
                              : 'chat-item'
                          }
                          type="button"
                          onClick={() => setActiveChatId(chat.id)}
                        >
                          <div>
                            <strong>{label}</strong>
                            <span className="meta">
                              {chat.lastMessage
                                ? chat.lastMessage
                                : 'No messages yet'}
                            </span>
                          </div>
                          <span className="time">
                            {formatTime(chat.updatedAt ?? null)}
                          </span>
                        </button>
                      )
                    })}
                  </>
                )}
              </div>
            </aside>

            <section className="panel messages-panel">
              <div className="panel-header">
                <div>
                  <h2>
                    {displayPartnerNumber
                      ? `Chat with ${displayPartnerNumber}`
                      : 'Chat'}
                  </h2>
                  <p>
                    {hasActiveChat
                      ? 'Keep your clues discreet.'
                      : 'Select a chat on the left.'}
                  </p>
                </div>
                <span className="chip muted">
                  {hasActiveChat
                    ? `${messages.length} messages`
                    : 'No chat selected'}
                </span>
              </div>
              {messageStreamError ? (
                <p className="error">{messageStreamError}</p>
              ) : null}

              <div className="messages">
                {hasActiveChat ? (
                  messages.length ? (
                    messages.map((message) => {
                      const isMine = message.senderId === user.uid
                      return (
                        <div
                          key={message.id}
                          className={isMine ? 'message-row mine' : 'message-row'}
                        >
                          <div className={isMine ? 'bubble mine' : 'bubble'}>
                            <p>{message.text}</p>
                            <span className="meta">
                              {isMine
                                ? 'You'
                                : message.senderNumber ?? 'Friend'}{' '}
                              • {formatTime(message.createdAt ?? null)}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty">Share your first clue.</div>
                  )
                ) : (
                  <div className="empty">Pick a chat to see messages.</div>
                )}
                <div ref={messageEndRef} />
              </div>

              <form className="composer" onSubmit={handleSendMessage}>
                <input
                  className="input"
                  placeholder={
                    hasActiveChat ? 'Write a message...' : 'Select a chat first'
                  }
                  value={compose}
                  onChange={(event) => setCompose(event.target.value)}
                  disabled={!hasActiveChat}
                />
                <button
                  className="primary"
                  type="submit"
                  disabled={!hasActiveChat}
                >
                  Send
                </button>
              </form>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
