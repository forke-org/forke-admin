'use server'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { authEvents } from '@/lib/db/schema'
import { hashIp, getClientIp, getCountry } from '@/lib/utils/analytics'

type RecordAuthEventArgs = {
  userId?: string | null
  email?: string | null
  event: 'signin' | 'signup'
  provider?: string | null
}

/**
 * Append a row to the auth security log. Stores a SALTED HASH of the IP (never the raw
 * address) plus coarse country + user-agent, for abuse/fraud detection only.
 * Best-effort: a logging failure must never block sign-in or sign-up.
 */
export async function recordAuthEvent({ userId, email, event, provider }: RecordAuthEventArgs) {
  try {
    const h = await headers()
    const ip = getClientIp(h)
    await db.insert(authEvents).values({
      userId: userId || null,
      email: email || null,
      event,
      provider: provider || null,
      ipHash: hashIp(ip),
      country: getCountry(h),
      userAgent: h.get('user-agent')?.slice(0, 255) || null,
    })
  } catch (error) {
    console.error('recordAuthEvent failed:', error)
  }
}
