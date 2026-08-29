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
import { subscribers } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
    
    const count = Number(result[0]?.count || 0)
    return NextResponse.json({ success: true, count })
  } catch (error) {
    console.error('Waitlist count API error:', error)
    return NextResponse.json({ success: false, count: 0 }, { status: 500 })
  }
}
