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

import { isAdminAuthenticated } from '@/lib/admin-actions'

export type MailAccessStatus = 'pending' | 'approved' | 'expired' | 'rejected' | 'joined'

export interface MailAccessRequest {
  id: string
  email: string
  status: MailAccessStatus
  created_at: string
  decided_at: string | null
  joined_at: string | null
  invite_expires_at: string | null
  invites_sent: number
  workspace: string | null
  username: string | null
  sent: number
}

const base = () => process.env.FORKE_MAIL_INTERNAL_URL || 'http://127.0.0.1:8085'

async function platform(path: string, method = 'GET') {
  const token = process.env.FORKE_MAIL_PLATFORM_TOKEN
  if (!token) throw new Error('FORKE_MAIL_PLATFORM_TOKEN is not set')
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
  return data
}

export async function getMailAccessRequestsAction(): Promise<{ success: boolean; data?: MailAccessRequest[]; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  try {
    const data = await platform('/api/platform/access')
    return { success: true, data: data.requests ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not load requests' }
  }
}

export async function decideMailAccessAction(id: string, decision: 'approve' | 'reject'): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { success: false, error: 'Invalid request' }
  try {
    await platform(`/api/platform/access/${id}/${decision}`, 'POST')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    return { success: false, error: message === 'invite_email_failed' ? 'Approved, but the invite email could not be sent. Try Resend.' : message }
  }
}
