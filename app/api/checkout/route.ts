/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { getWaitlistBypassPassword } from '@/lib/db/settings'

const DEFAULT_BYPASS_HASH = '$2b$10$JEQiYsDtj2tUN2SXWMsYBu6g/cXZfWa5fDcYg0t32TSUx5NQklJpy'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { password } = body

    // Fetch bypass password from DB (set by Admin in dashboard)
    const dbBypass = await getWaitlistBypassPassword()

    // Allow overriding bypass password via environment variable (git-ignored) or DB settings
    let customBypass = dbBypass || process.env.WAITLIST_BYPASS_PASSWORD
    if (customBypass && customBypass.startsWith('"') && customBypass.endsWith('"')) {
      customBypass = customBypass.slice(1, -1)
    }
    const isMatch = customBypass 
      ? (password === customBypass)
      : (await bcrypt.compare(password, DEFAULT_BYPASS_HASH))

    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Incorrect password.' },
        { status: 401 }
      )
    }

    const cookieStore = await cookies()
    cookieStore.set('site_access', 'granted', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })
    cookieStore.set('site_access_public', 'true', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Something went wrong.' },
      { status: 500 }
    )
  }
}
