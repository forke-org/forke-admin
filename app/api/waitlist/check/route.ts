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
import { db } from '@/lib/db'
import { subscribers, users } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ success: false, joined: false, message: 'Email required' })
    }

    // Check subscribers table
    const subscriber = await db
      .select()
      .from(subscribers)
      .where(sql`LOWER(${subscribers.email}) = ${email}`)
      .limit(1)
      .then((rows) => rows[0])

    if (subscriber) {
      return NextResponse.json({ success: true, joined: true })
    }

    // Check users table
    const user = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1)
      .then((rows) => rows[0])

    if (user) {
      return NextResponse.json({ success: true, joined: true })
    }

    return NextResponse.json({ success: true, joined: false })
  } catch (error) {
    console.error('Waitlist check error:', error)
    return NextResponse.json(
      { success: false, joined: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
