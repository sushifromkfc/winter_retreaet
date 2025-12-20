import { FirebaseError } from 'firebase/app'
import type { FirestoreError } from 'firebase/firestore'

export const authErrorMessage = (error: unknown) => {
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

export const firestoreErrorMessage = (error: FirestoreError) => {
  if (error.code === 'failed-precondition') {
    return 'Firestore needs an index for chats (participants array-contains + updatedAt desc).'
  }
  if (error.code === 'permission-denied') {
    return 'Firestore permission denied. Check your rules.'
  }
  return error.message
}
