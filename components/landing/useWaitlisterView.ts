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

import { useEffect, useState } from 'react'

/**
 * Mirrors the middleware's waitlist gate on the client: true when the waitlist
 * is active and this visitor has no site access — CTAs should read "Coming
 * soon" and route to "/" instead of /register.
 */
export function useWaitlisterView(): boolean {
  const [hasSiteAccess, setHasSiteAccess] = useState(true)
  const [waitlistActive, setWaitlistActive] = useState(false)

  useEffect(() => {
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null
      return null
    }

    setHasSiteAccess(getCookie('site_access_public') === 'true')
    setWaitlistActive(getCookie('waitlist_active') === 'true')
  }, [])

  return waitlistActive && !hasSiteAccess
}
