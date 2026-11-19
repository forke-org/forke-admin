'use client'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, RefreshCw, Send, X } from 'lucide-react'
import { decideMailAccessAction, getMailAccessRequestsAction, type MailAccessRequest, type MailAccessStatus } from '@/lib/actions/mail-users-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils/cn'

const STATUS_STYLE: Record<MailAccessStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  approved: 'bg-sky-500/10 border-sky-500/20 text-sky-300',
  expired: 'bg-white/[0.03] border-[var(--color-border)] text-white/50',
  rejected: 'bg-red-500/10 border-red-500/20 text-red-300',
  joined: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
}
const STATUS_LABEL: Record<MailAccessStatus, string> = { pending: 'Waiting', approved: 'Invited', expired: 'Invite expired', rejected: 'Rejected', joined: 'Joined' }
const FILTERS: [string, string][] = [['pending', 'Waiting'], ['approved', 'Invited'], ['joined', 'Joined'], ['rejected', 'Rejected'], ['all', 'All']]

const btn = 'h-8 px-3 rounded-lg text-xs transition-colors border inline-flex items-center gap-1.5 font-medium leading-none disabled:opacity-50'

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function MailUsersPanel() {
  const [rows, setRows] = useState<MailAccessRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getMailAccessRequestsAction()
    if (res.success) { setRows(res.data ?? []); setError(null) } else setError(res.error || 'Could not load requests')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows?.length ?? 0 }
    for (const r of rows ?? []) {
      const key = r.status === 'expired' ? 'approved' : r.status
      c[key] = (c[key] ?? 0) + 1
    }
    return c
  }, [rows])

  const visible = (rows ?? []).filter((r) => filter === 'all' || r.status === filter || (filter === 'approved' && r.status === 'expired'))

  const decide = async (r: MailAccessRequest, decision: 'approve' | 'reject') => {
    setBusy(r.id + decision)
    const res = await decideMailAccessAction(r.id, decision)
    setBusy(null)
    if (res.success) toast(decision === 'approve' ? `Invite sent to ${r.email}` : `Rejected ${r.email}`, 'success')
    else toast(res.error || 'Failed', 'error')
    load()
  }

  if (!rows && !error) return <PanelSkeleton />

  return (
    <div className="flex flex-col min-h-0 flex-grow gap-5 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 shrink-0">
        <div>
          <h2 className="text-base font-medium text-white">Mail users</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Early access requests from the Forke Mail sign-in page. Approving emails them a link to pick a username and password and open an empty workspace.
          </p>
        </div>
        <button onClick={load} className={cn(btn, 'border-[var(--color-border)] hover:bg-white/[0.05] text-white')}>
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)}
            className={cn(btn, filter === value ? 'border-accent/40 bg-accent/10 text-white' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.04]')}>
            {label}<span className="font-mono text-[10px] opacity-70">{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <section className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden">
        {visible.length ? (
          <div className="divide-y divide-[var(--color-border)]">
            {visible.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] text-white truncate">{r.email}</p>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider shrink-0', STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
                    Requested {when(r.created_at)}
                    {r.status === 'joined' && ` · ${r.workspace} · @${r.username} · joined ${when(r.joined_at)} · ${r.sent.toLocaleString()} sent`}
                    {(r.status === 'approved' || r.status === 'expired') && ` · invite ${r.status === 'expired' ? 'expired' : 'expires'} ${when(r.invite_expires_at)} · sent ${r.invites_sent}×`}
                  </p>
                </div>
                {r.status !== 'joined' && (
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status !== 'rejected' && (
                      <button disabled={busy !== null} onClick={() => decide(r, 'reject')} className={cn(btn, 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-300 hover:bg-red-500/[0.06]')}>
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    <button disabled={busy !== null} onClick={() => decide(r, 'approve')} className={cn(btn, 'border-accent/40 bg-accent text-black hover:bg-accent/90')}>
                      {r.status === 'pending' || r.status === 'rejected' ? <><Check className="w-3.5 h-3.5" /> Approve</> : <><Send className="w-3.5 h-3.5" /> Resend invite</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">{filter === 'pending' ? 'No one is waiting for access.' : 'Nothing here yet.'}</p>
        )}
      </section>
    </div>
  )
}
