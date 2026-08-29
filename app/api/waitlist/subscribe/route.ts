/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { subscribers } from '@/lib/db/schema'
import { z } from 'zod'
import { sendWelcomeEmail } from '@/lib/email'
import { eq } from 'drizzle-orm'
import { logAudit } from '@/lib/actions/audit-actions'
import { readAttributionCookie, normalizeSource, readSessionId } from '@/lib/utils/attribution'
import { getCountry } from '@/lib/utils/analytics'

export const runtime = 'nodejs'

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  source: z.string().trim().max(64).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, source } = emailSchema.parse(body)

    // First-touch cookie is authoritative; the form's ?source= is a fallback for the rare no-cookie case.
    const attribution = await readAttributionCookie()
    const sessionId = await readSessionId()
    const channel = attribution.source !== 'direct' ? attribution.source : normalizeSource(source)
    const country = getCountry(request.headers)

    // Check if subscriber already exists in Drizzle
    const existing = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email))
      .limit(1)
      .then((rows) => rows[0])

    if (existing) {
      return NextResponse.json({ 
        success: true, 
        message: "You're already on the list!" 
      })
    }

    await db.insert(subscribers).values({
      email,
      source: channel,
      attribution: {
        ...(attribution.medium && { medium: attribution.medium }),
        ...(attribution.campaign && { campaign: attribution.campaign }),
        ...(attribution.referrer && { referrer: attribution.referrer }),
        ...(attribution.landingPage && { landingPage: attribution.landingPage }),
        ...(sessionId && { sessionId }),
        ...(country && { country }),
      },
    }).onConflictDoNothing()

    // Log the event explicitly for the activity feed
    await logAudit({
      category: 'system',
      action: 'subscriber.joined',
      target: email,
      actorName: 'system'
    })

    // Dispatch the welcome email synchronously to guarantee delivery and zero delays before responding
    await sendWelcomeEmail(email).catch((err) => {
      console.error('Failed to send welcome email:', err)
    })

    return NextResponse.json({ success: true, message: "You're on the list!" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    console.error('Waitlist subscribe error:', error)
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
