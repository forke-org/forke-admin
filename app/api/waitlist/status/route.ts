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
import { isWaitlistEnabled } from '@/lib/db/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const enabled = await isWaitlistEnabled()
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error('Waitlist status API error:', error)
    return NextResponse.json({ enabled: true }) // Fallback
  }
}
