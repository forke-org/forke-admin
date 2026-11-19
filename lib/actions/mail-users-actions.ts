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

async function platform(path: string, method = 'GET', body?: unknown) {
  const token = process.env.FORKE_MAIL_PLATFORM_TOKEN
  if (!token) throw new Error('FORKE_MAIL_PLATFORM_TOKEN is not set')
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: body === undefined ? { Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
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

export interface MailMember {
  name: string
  email: string
  username: string | null
  role: 'super_admin' | 'admin'
  forke: boolean
}

export interface MailAccount {
  id: string
  name: string
  plan: 'trial' | 'paid'
  status: 'active' | 'paused'
  forke: boolean
  credits: number
  credits_used: number
  daily_limit: number
  sent_30d: number
  sent_total: number
  contacts: number
  domains: string[]
  sending_paused: boolean
  created_at: string
  last_sent_at: string | null
  members: MailMember[]
}

export async function getMailAccountsAction(): Promise<{ success: boolean; data?: MailAccount[]; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  try {
    const data = await platform('/api/platform/accounts')
    return { success: true, data: data.accounts ?? [] }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not load accounts' }
  }
}

const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id)

export async function addMailCreditsAction(id: string, amount: number): Promise<{ success: boolean; credits?: number; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  if (!validId(id) || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10_000_000) return { success: false, error: 'Enter a whole number of credits' }
  try {
    const data = await platform(`/api/platform/accounts/${id}/credits`, 'POST', { amount })
    return { success: true, credits: data.credits }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function setMailAccountStatusAction(id: string, status: 'active' | 'paused'): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  if (!validId(id)) return { success: false, error: 'Invalid account' }
  try {
    await platform(`/api/platform/accounts/${id}/status`, 'POST', { status })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteMailAccountAction(id: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  if (!validId(id)) return { success: false, error: 'Invalid account' }
  try {
    await platform(`/api/platform/accounts/${id}`, 'DELETE')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}

export async function deleteMailRequestAction(id: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }
  if (!validId(id)) return { success: false, error: 'Invalid request' }
  try {
    await platform(`/api/platform/access/${id}`, 'DELETE')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed' }
  }
}
