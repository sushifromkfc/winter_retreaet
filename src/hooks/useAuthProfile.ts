import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { auth, db } from '../firebase'

type AuthProfile = {
  user: User | null
  currentNumber: string
  displayName: string
  loadingProfile: boolean
}

export const useAuthProfile = (): AuthProfile => {
  const [user, setUser] = useState<User | null>(null)
  const [currentNumber, setCurrentNumber] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setCurrentNumber('')
        setDisplayName('')
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
        setDisplayName(String(data.displayName ?? ''))
      } else {
        setCurrentNumber('')
        setDisplayName('')
      }
      setLoadingProfile(false)
    })

    return () => unsubscribe()
  }, [user])

  return { user, currentNumber, displayName, loadingProfile }
}
