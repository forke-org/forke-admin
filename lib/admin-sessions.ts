/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { createHash, randomBytes } from 'crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { admins, adminSessions } from '@/lib/db/schema'

// Admin sessions: the cookie carries a random 256-bit token; only its SHA-256
// hash is stored. Server-only module (not 'use server'), so none of these can
// be invoked from a browser.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = 'forke_admin_session:'

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createAdminSession(adminId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(adminSessions).values({
    adminId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date())).catch(() => {})
  return token
}

function tokenFromCookie(cookie: string | undefined | null): string | null {
  if (!cookie || !cookie.startsWith(PREFIX)) return null
  const token = cookie.slice(PREFIX.length)
  return /^[A-Za-z0-9_-]{40,}$/.test(token) ? token : null
}

/** The active, non-disabled admin for a session cookie, or null. */
export async function adminFromSessionCookie(cookie: string | undefined | null) {
  const token = tokenFromCookie(cookie)
  if (!token) return null
  const rows = await db
    .select({ admin: admins })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(and(eq(adminSessions.tokenHash, hash(token)), gt(adminSessions.expiresAt, new Date()), eq(admins.isDisabled, false)))
    .limit(1)
  return rows[0]?.admin ?? null
}

export async function deleteAdminSession(cookie: string | undefined | null) {
  const token = tokenFromCookie(cookie)
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hash(token)))
}
