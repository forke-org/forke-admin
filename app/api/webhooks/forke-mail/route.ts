/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/actions/audit-actions'

export const dynamic = 'force-dynamic'

// Forke Mail signs `${Webhook-Id}.${Webhook-Timestamp}.${raw body}` with the
// endpoint's whsec_ secret (HMAC-SHA256, hex, prefixed "v1="). Retries keep
// the same Webhook-Id, so it doubles as the idempotency key.
const MAX_SKEW_SECONDS = 5 * 60
const STATUSES = new Set(['active', 'unsubscribed', 'bounced', 'complained', 'invalid'])

interface ContactEvent {
  type: string
  created_at?: string
  data?: {
    email?: string
    status?: string
    status_changed_at?: string
    paused_until?: string
    topics_opted_out?: string[] | null
    suppression_source?: string
  }
}

function validSignature(secret: string, id: string, timestamp: string, raw: string, header: string) {
  const expected = 'v1=' + createHmac('sha256', secret).update(`${id}.${timestamp}.${raw}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const secret = process.env.FORKE_MAIL_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  const id = request.headers.get('webhook-id') || ''
  const timestamp = request.headers.get('webhook-timestamp') || ''
  const signature = request.headers.get('webhook-signature') || ''
  const raw = await request.text()

  const ts = Number(timestamp)
  if (!id || !Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
    return NextResponse.json({ error: 'invalid_timestamp' }, { status: 401 })
  }
  if (!validSignature(secret, id, timestamp, raw, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let event: ContactEvent
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = event.data?.email?.trim().toLowerCase()
  if (!email || (event.type !== 'contact.updated' && event.type !== 'contact.deleted')) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const changed = await db.transaction(async (tx) => {
      const fresh = await tx.execute(sql`
        INSERT INTO forke_mail_webhook_deliveries (delivery_id, event_type)
        VALUES (${id}, ${event.type})
        ON CONFLICT (delivery_id) DO NOTHING
        RETURNING delivery_id`)
      const freshRows = ((fresh as any).rows ?? fresh) as unknown[]
      if (freshRows.length === 0) return null

      if (event.type === 'contact.deleted') {
        // Forke Mail deletes a contact 30 days after it stopped being active,
        // keeping only its suppression record. Mirror that: drop the row unless
        // the person has since signed up again (status back to active).
        const res = await tx.execute(sql`
          DELETE FROM public.subscribers
          WHERE lower(email) = ${email} AND status <> 'active'
          RETURNING email`)
        return ((res as any).rows ?? res).length ? 'deleted' : null
      }

      const d = event.data!
      const status = d.status && STATUSES.has(d.status) ? d.status : null
      if (!status) return null
      const topics = Array.isArray(d.topics_opted_out) ? d.topics_opted_out.filter((t) => typeof t === 'string') : []
      const topicsLiteral = `{${topics.map((t) => `"${t.replace(/["\\]/g, '')}"`).join(',')}}`
      const res = await tx.execute(sql`
        UPDATE public.subscribers SET
          status = ${status},
          status_reason = ${status === 'active' ? null : d.suppression_source ?? null},
          status_changed_at = ${d.status_changed_at ?? event.created_at ?? new Date().toISOString()}::timestamptz,
          paused_until = ${d.paused_until ?? null}::timestamptz,
          topics_opted_out = ${topicsLiteral}::text[]
        WHERE lower(email) = ${email}
        RETURNING email`)
      return ((res as any).rows ?? res).length ? status : null
    })

    if (changed && changed !== 'active') {
      await logAudit({
        action: changed === 'deleted' ? 'subscriber.removed' : `subscriber.${changed}`,
        category: 'system',
        target: email,
        metadata: { source: 'forke-mail', reason: event.data?.suppression_source ?? null },
        actorName: 'Forke Mail',
      })
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('Forke Mail webhook failed:', err)
    return NextResponse.json({ error: 'try_later' }, { status: 503 })
  }
}
