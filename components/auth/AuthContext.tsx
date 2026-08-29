'use client'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React, { createContext, useContext, useState } from 'react'

interface AuthContextType {
  isSignInModalOpen: boolean
  openSignInModal: () => void
  closeSignInModal: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)

  const openSignInModal = () => setIsSignInModalOpen(true)
  const closeSignInModal = () => setIsSignInModalOpen(false)

  return (
    <AuthContext.Provider
      value={{ isSignInModalOpen, openSignInModal, closeSignInModal }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthModal() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthModal must be used within an AuthProvider')
  }
  return context
}
