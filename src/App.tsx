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
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
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

    return onSnapshot(chatQuery, (snapshot) => {
      const nextChats = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<ChatSummary, 'id'>
        return { id: docSnap.id, ...data }
      })
      setChats(nextChats)
      setActiveChatId((prev) => prev ?? nextChats[0]?.id ?? null)
    })
  }, [user])

  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([])
      return
    }

    const messageQuery = query(
      collection(db, 'chats', activeChatId, 'messages'),
      orderBy('createdAt', 'asc'),
    )

    return onSnapshot(messageQuery, (snapshot) => {
      const nextMessages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<MessageItem, 'id'>
        return { id: docSnap.id, ...data }
      })
      setMessages(nextMessages)
    })
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
    if (!user) return

    if (!currentNumber) {
      setChatError('Finish setting up your profile before chatting.')
      return
    }

    const cleanedTarget = sanitizeNumber(searchNumber)
    if (cleanedTarget.length !== 6) {
      setChatError('Enter a 6-digit ID to start a chat.')
      return
    }

    if (cleanedTarget === currentNumber) {
      setChatError('That is your own ID.')
      return
    }

    const userQuery = query(
      collection(db, 'users'),
      where('number', '==', cleanedTarget),
    )

    const snapshot = await getDocs(userQuery)
    if (snapshot.empty) {
      setChatError('No user found with that ID.')
      return
    }

    const otherUser = snapshot.docs[0]
    const chatId = [user.uid, otherUser.id].sort().join('_')
    await setDoc(
      doc(db, 'chats', chatId),
      {
        participants: [user.uid, otherUser.id],
        participantNumbers: [currentNumber, cleanedTarget],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    setActiveChatId(chatId)
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

  return (
    <div className="app">
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <main className="shell">
        <header className="brand">
          <div>
            <p className="eyebrow">Winter Retreat</p>
            <h1>Frostline Chat</h1>
            <p className="lede">
              A cozy realtime chat built on Firebase with six-digit IDs.
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
                  {authMode === 'login' ? 'Enter chat' : 'Create account'}
                </button>
                <p className="helper">
                  Use any six digits as your ID. Your password is stored securely
                  in Firebase Auth.
                </p>
              </form>
            </div>

            <div className="panel highlight">
              <h2>How it works</h2>
              <ul>
                <li>Claim a six-digit ID and set a password.</li>
                <li>Search someone by ID to open a private chat.</li>
                <li>Messages sync instantly with Firestore.</li>
              </ul>
              <div className="highlight-footer">
                <span>Built for your winter retreat crew.</span>
              </div>
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
              <div className="chat-list">
                {chats.length === 0 ? (
                  <div className="empty">No chats yet. Start one!</div>
                ) : (
                  chats.map((chat) => {
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
                  })
                )}
              </div>
            </aside>

            <section className="panel messages-panel">
              <div className="panel-header">
                <div>
                  <h2>{partnerNumber ? `Chat with ${partnerNumber}` : 'Chat'}</h2>
                  <p>
                    {activeChat
                      ? 'Keep it warm and friendly.'
                      : 'Select a chat on the left.'}
                  </p>
                </div>
                <span className="chip muted">
                  {activeChat ? `${messages.length} messages` : 'No chat selected'}
                </span>
              </div>

              <div className="messages">
                {activeChat ? (
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
                    <div className="empty">Say hello to start the chat.</div>
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
                    activeChat ? 'Write a message...' : 'Select a chat first'
                  }
                  value={compose}
                  onChange={(event) => setCompose(event.target.value)}
                  disabled={!activeChat}
                />
                <button className="primary" type="submit" disabled={!activeChat}>
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
