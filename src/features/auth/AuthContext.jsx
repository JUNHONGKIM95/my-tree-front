import { useState } from 'react'
import {
  clearStoredUser,
  readStoredUser,
  writeStoredUser,
} from '@/features/auth/authStorage'
import AuthContext from '@/features/auth/context'

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => readStoredUser())

  const signIn = (user) => {
    writeStoredUser(user)
    setCurrentUser(user)
  }

  const signOut = () => {
    clearStoredUser()
    setCurrentUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: currentUser !== null,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
