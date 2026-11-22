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

import React, { useCallback, useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { clearMailGuardAction, getMailGuardAction, type MailGuard } from '@/lib/actions/mail-users-actions'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils/cn'

const pct = (v: number, d = 2) => `${(v * 100).toFixed(d).replace(/\.?0+$/, '')}%`

export default function MailGuardCard() {
  const [guard, setGuard] = useState<MailGuard | null>(null)
  const [superAdmin, setSuperAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const res = await getMailGuardAction()
    if (res.success && res.data) { setGuard(res.data); setSuperAdmin(Boolean(res.superAdmin)) }
  }, [])
  useEffect(() => { load(); const id = setInterval(load, 60000); return () => clearInterval(id) }, [load])
  if (!guard) return null
  const clear = async () => {
    setBusy(true)
    const res = await clearMailGuardAction()
    setBusy(false)
    if (res.success) toast('Protection turned off', 'success'); else toast(res.error || 'Failed', 'error')
    load()
  }
  const Icon = guard.active ? ShieldAlert : ShieldCheck
  return (
    <section className={cn('rounded-xl border overflow-hidden', guard.active ? 'bg-red-500/[0.04] border-red-500/30' : 'bg-white/[0.018] border-[var(--color-border)]')}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          <Icon className={cn('w-4 h-4', guard.active ? 'text-red-400' : 'text-emerald-400')} />
          <div>
            <h3 className="text-[13px] font-medium text-white">Forke Mail protection {guard.active ? 'is on' : 'is off'}</h3>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {guard.active
                ? `Since ${guard.activated_at ? new Date(guard.activated_at).toLocaleString() : '-'} (${guard.reason.replace(/_/g, ' ')}). Broadcasts from ${guard.held_projects} new or unproven projects are on hold; transactional mail keeps sending.`
                : 'Turns on by itself when bounces or spam reports across all projects get close to Amazon SES limits.'}
            </p>
          </div>
        </div>
        {guard.active && superAdmin && (
          <button disabled={busy} onClick={clear} className="h-8 px-3 rounded-lg text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50 whitespace-nowrap">Turn off</button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-px bg-[var(--color-border)]">
        {guard.windows.map((w) => (
          <div key={w.window} className="bg-[#0a0a0c] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">All projects · {w.window === '24h' ? 'last 24 hours' : 'last 7 days'}</p>
            <p className="text-sm text-white mt-1 font-mono">{w.sent.toLocaleString()} sent</p>
            <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{pct(w.bounce_rate)} bounced · {pct(w.complaint_rate, 3)} spam</p>
          </div>
        ))}
      </div>
    </section>
  )
}
