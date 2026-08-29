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
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { pageVisits } from '@/lib/db/schema'
import { normalizeSource } from '@/lib/utils/attribution'
import { getCountry, isBotUserAgent } from '@/lib/utils/analytics'

/** Validate a 2-letter ISO country code coming from the middleware body. */
function cleanCountry(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

// Node runtime: postgres-js cannot run on the Edge, which is exactly why the Edge
// middleware pings THIS route (fire-and-forget) instead of inserting directly.
export const runtime = 'nodejs'

function clean(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().slice(0, max)
  return v || null
}

export async function POST(req: NextRequest) {
  try {
    const consent = req.cookies.get('forke_cookie_consent')?.value
    if (consent === 'declined') {
      return NextResponse.json({ ok: true, skipped: 'consent_declined' })
    }

    const body = await req.json().catch(() => ({}))

    const ua = req.headers.get('user-agent')
    const isBot = isBotUserAgent(ua)

    // Don't write bot rows at all — keeps the table small and the charts human.
    if (isBot) return NextResponse.json({ ok: true, skipped: 'bot' })


    await db.insert(pageVisits).values({
      sessionId: clean(body.sessionId, 64),
      source: normalizeSource(typeof body.source === 'string' ? body.source : null),
      medium: clean(body.medium, 64),
      campaign: clean(body.campaign, 64),
      referrer: clean(body.referrer, 255),
      landingPath: clean(body.landingPath, 255),
      // Prefer the geo the middleware resolved from the ORIGINAL request. The edge geo
      // headers are absent on this internal fetch, so getCountry() is only a fallback
      // for any direct (non-middleware) caller.
      country: cleanCountry(body.country) ?? getCountry(req.headers),
      isBot: false,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    // Tracking must never break a page load — swallow and report 204-ish.
    console.error('track insert failed:', error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
