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

import React, { createContext, useContext, useEffect, useState } from 'react'

export type ConsentState = 'accepted' | 'declined' | null

type ConsentContextType = {
  consent: ConsentState
  acceptConsent: () => void
  declineConsent: () => void
}

const ConsentContext = createContext<ConsentContextType>({
  consent: null,
  acceptConsent: () => {},
  declineConsent: () => {},
})

export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(null)

  useEffect(() => {
    // Read cookie consent from document.cookie
    const match = document.cookie.match(/(?:^|; )forke_cookie_consent=([^;]*)/)
    if (match) {
      setConsent(match[1] as ConsentState)
    }
  }, [])

  const acceptConsent = () => {
    // Set cookie for 1 year
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)
    document.cookie = `forke_cookie_consent=accepted; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`
    setConsent('accepted')
  }

  const declineConsent = () => {
    // Set cookie for 1 year
    const expiry = new Date()
    expiry.setFullYear(expiry.getFullYear() + 1)
    document.cookie = `forke_cookie_consent=declined; expires=${expiry.toUTCString()}; path=/; SameSite=Lax`
    
    // Explicitly delete tracking/attribution cookies
    document.cookie = 'forke_attribution=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
    document.cookie = 'forke_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
    
    setConsent('declined')
  }

  return (
    <ConsentContext.Provider value={{ consent, acceptConsent, declineConsent }}>
      {children}
    </ConsentContext.Provider>
  )
}

export const useCookieConsent = () => useContext(ConsentContext)
