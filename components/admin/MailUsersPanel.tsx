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
import { AtSign, Building2, Coins, RefreshCw, Search } from 'lucide-react'
import {
  addMailCreditsAction,
  decideMailAccessAction,
  deleteMailAccountAction,
  deleteMailRequestAction,
  getMailAccessRequestsAction,
  getMailAccountsAction,
  setMailAccountStatusAction,
  type MailAccessRequest,
  type MailAccount,
} from '@/lib/actions/mail-users-actions'
import { TableLoadingRows } from '@/components/ui/Skeleton'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils/cn'

type SubTab = 'accounts' | 'requests' | 'rejected'

const th = 'px-4 py-2.5'
const action = 'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50'
const neutral = 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.05]'
const danger = 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10'
const primary = 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'muted'; children: React.ReactNode }) {
  const tones = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    muted: 'border-[var(--color-border)] bg-white/[0.03] text-white/50',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider border whitespace-nowrap', tones[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {children}
    </span>
  )
}

function SubTabButton({ active, onClick, label, count, alert }: { active: boolean; onClick: () => void; label: string; count: number; alert?: boolean }) {
  return (
    <button onClick={onClick} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5', active ? 'bg-white/[0.08] text-white' : 'text-[var(--color-text-muted)] hover:text-white')}>
      {label}
      {alert && count > 0 ? (
        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-[5px] bg-orange-500/15 border border-orange-500/25 text-orange-400 leading-none">{count}</span>
      ) : (
        <span className={cn('text-[10px] font-mono', active ? 'text-white/60' : 'text-white/25')}>{count}</span>
      )}
    </button>
  )
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const num = (n: number) => n.toLocaleString()

function CreditsModal({ account, onClose, onDone }: { account: MailAccount; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('1000')
  const [busy, setBusy] = useState(false)
  const value = Number(amount)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await addMailCreditsAction(account.id, value)
    setBusy(false)
    if (!res.success) { toast(res.error || 'Could not change credits', 'error'); return }
    toast(`${account.name} now has ${num(res.credits ?? 0)} credits`, 'success')
    onDone()
    onClose()
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm bg-[#1a1919] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl space-y-4">
        <div className="border-b border-[var(--color-border)] pb-3">
          <h3 className="text-base font-medium text-white">Add credits</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{account.name} · {num(account.credits_used)} of {num(account.credits)} used</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[1000, 5000, 10000, 50000].map((n) => (
            <button type="button" key={n} onClick={() => setAmount(String(n))} className={cn(action, amount === String(n) ? primary : neutral)}>+{num(n)}</button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs text-[var(--color-text-muted)]">Credits to add (one credit sends one email; use a negative number to remove)</span>
          <input type="number" step={1} value={amount} onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg px-3 text-[13px] text-white font-mono focus:outline-none focus:border-accent" />
        </label>
        {Number.isInteger(value) && value !== 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">New total: <span className="text-white font-mono">{num(Math.max(account.credits_used, account.credits + value))}</span></p>
        )}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-white/[0.05]">Cancel</button>
          <button type="submit" disabled={busy || !Number.isInteger(value) || value === 0} className="h-8 px-3 rounded-lg text-xs font-medium border border-accent bg-accent text-black disabled:opacity-50">
            {busy ? 'Saving…' : 'Save credits'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function MailUsersPanel() {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null)
  const [requests, setRequests] = useState<MailAccessRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<SubTab>('accounts')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [crediting, setCrediting] = useState<MailAccount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, r] = await Promise.all([getMailAccountsAction(), getMailAccessRequestsAction()])
    if (a.success) setAccounts(a.data ?? [])
    if (r.success) setRequests(r.data ?? [])
    setError(!a.success ? a.error || 'Could not load accounts' : !r.success ? r.error || 'Could not load requests' : null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const waiting = (requests ?? []).filter((r) => r.status === 'pending' || r.status === 'approved' || r.status === 'expired')
  const rejected = (requests ?? []).filter((r) => r.status === 'rejected')
  const q = query.trim().toLowerCase()

  const visibleAccounts = useMemo(() => (accounts ?? []).filter((a) => !q
    || a.name.toLowerCase().includes(q)
    || a.domains.some((d) => d.includes(q))
    || a.members.some((m) => m.email.includes(q) || m.name.toLowerCase().includes(q) || (m.username ?? '').includes(q))), [accounts, q])
  const visibleRequests = (tab === 'rejected' ? rejected : waiting).filter((r) => !q || r.email.includes(q))

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (res.success) toast(ok, 'success')
    else toast(res.error || 'Something went wrong', 'error')
    load()
  }

  const totalCreditsLeft = (accounts ?? []).filter((a) => a.plan === 'trial').reduce((s, a) => s + Math.max(0, a.credits - a.credits_used), 0)

  return (
    <div className="flex flex-col min-h-0 flex-grow gap-5 overflow-y-auto pr-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 [&_button]:whitespace-nowrap border-b border-[var(--color-border)] pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-white">Forke Mail Users</h2>
            <span className="bg-white/[0.04] border border-[var(--color-border)] text-white/70 px-2 py-0.5 rounded font-mono text-[10px] whitespace-nowrap">
              {(accounts ?? []).length} TEAMS · {(accounts ?? []).reduce((s, a) => s + a.members.length, 0)} USERS
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Every Forke Mail team with its people, credits and sending. Approve early access requests, top up credits, suspend or delete teams. {num(totalCreditsLeft)} credits unused across beta teams.
          </p>
        </div>
        <button onClick={load} className="h-8 px-3 rounded-lg text-xs transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] flex items-center gap-1.5 font-medium text-white">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden flex flex-col min-h-0 flex-grow">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center gap-3 bg-white/[0.005]">
          <div className="flex items-center gap-1 bg-white/[0.03] border border-[var(--color-border)] rounded-lg p-1 shrink-0">
            <SubTabButton active={tab === 'accounts'} onClick={() => setTab('accounts')} label="Teams" count={(accounts ?? []).length} />
            <SubTabButton active={tab === 'requests'} onClick={() => setTab('requests')} label="Requests" count={waiting.filter((r) => r.status === 'pending').length} alert />
            <SubTabButton active={tab === 'rejected'} onClick={() => setTab('rejected')} label="Rejected" count={rejected.length} />
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === 'accounts' ? 'Search by team, name, email, username or domain...' : 'Search by email...'}
              className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white focus:outline-none focus:border-accent transition-colors" />
          </div>
        </div>

        <div className="overflow-auto flex-grow min-h-0">
          {tab === 'accounts' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[#1e1d1c] font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-[#8e8e93] whitespace-nowrap">
                  <th className={th}>Team</th>
                  <th className={th}>People</th>
                  <th className={th}>Credits</th>
                  <th className={th}>Sending</th>
                  <th className={th}>Joined</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, 'text-right font-medium')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {!accounts ? <TableLoadingRows cols={7} rows={5} /> : visibleAccounts.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--color-text-muted)] text-xs font-mono">No matching teams</td></tr>
                ) : visibleAccounts.map((a) => {
                  const left = Math.max(0, a.credits - a.credits_used)
                  const pct = a.credits ? Math.min(100, (a.credits_used / a.credits) * 100) : 0
                  return (
                    <tr key={a.id} className="group hover:bg-white/[0.015] transition-colors align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-9 h-9 rounded-md border flex items-center justify-center shrink-0', a.forke ? 'bg-accent/10 border-accent/30' : 'bg-white/[0.02] border-[var(--color-border)]')}>
                            {a.forke ? <span className="text-accent font-semibold text-sm">*</span> : <Building2 className="w-4 h-4 text-white/60" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white text-[13px] flex items-center gap-1.5">{a.name}{a.forke && <Pill tone="accent">Forke</Pill>}</p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono truncate max-w-[220px]">{a.domains.length ? a.domains.join(', ') : 'No verified domain yet'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {a.members.map((m) => (
                            <div key={m.email} className="text-xs leading-tight">
                              <span className="text-white">{m.name}</span>
                              {m.username && <span className="text-accent font-mono ml-1.5">@{m.username}</span>}
                              <span className="ml-1.5 text-[10px] font-mono uppercase text-white/40">{m.role === 'super_admin' ? 'owner' : 'admin'}</span>
                              <p className="text-[var(--color-text-muted)] font-mono text-[11px]">{m.email}</p>
                            </div>
                          ))}
                          {a.members.length === 0 && <span className="text-xs text-white/20 font-mono">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {a.plan === 'trial' ? (
                          <div className="w-36">
                            <p className="text-white">{num(left)} <span className="text-[var(--color-text-muted)]">left</span></p>
                            <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className={cn('h-full rounded-full', pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-accent')} style={{ width: `${pct}%` }} /></div>
                            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{num(a.credits_used)} / {num(a.credits)} used</p>
                          </div>
                        ) : <span className="text-[var(--color-text-muted)]">Unlimited</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                        <p className="text-white">{num(a.sent_30d)} <span className="text-[var(--color-text-muted)]">/ 30 d</span></p>
                        <p className="mt-0.5">{num(a.sent_total)} total · {num(a.contacts)} contacts</p>
                        <p className="mt-0.5">last {a.last_sent_at ? date(a.last_sent_at) : 'never'}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">{date(a.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {a.status === 'paused' ? <Pill tone="red">Suspended</Pill> : <Pill tone="green">Active</Pill>}
                          {a.sending_paused && <Pill tone="amber">Sending paused</Pill>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          {a.plan === 'trial' && (
                            <button disabled={busy !== null} onClick={() => setCrediting(a)} className={cn(action, primary, 'inline-flex items-center gap-1')}>
                              <Coins className="w-3 h-3" /> Credits
                            </button>
                          )}
                          {!a.forke && (
                            <>
                              <button disabled={busy !== null} onClick={() => run(a.id + 'status', () => setMailAccountStatusAction(a.id, a.status === 'paused' ? 'active' : 'paused'), a.status === 'paused' ? `${a.name} restored` : `${a.name} suspended`)}
                                className={cn(action, a.status === 'paused' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20')}>
                                {a.status === 'paused' ? 'Restore' : 'Suspend'}
                              </button>
                              <button disabled={busy !== null} className={cn(action, danger)} onClick={() => setConfirm({
                                title: 'Delete team',
                                message: `Delete ${a.name}, its ${a.members.length} ${a.members.length === 1 ? 'user' : 'users'}, ${num(a.contacts)} contacts, every email and its domains?\nThey can request access again later. This cannot be undone.`,
                                confirmLabel: 'Delete team',
                                tone: 'danger',
                                onConfirm: () => run(a.id + 'delete', () => deleteMailAccountAction(a.id), `${a.name} deleted`),
                              })}>Delete</button>
                            </>
                          )}
                          {a.forke && a.plan !== 'trial' && <span className="text-xs text-white/20 font-mono">-</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[#1e1d1c] font-mono text-[11px] font-normal uppercase tracking-[0.06em] text-[#8e8e93] whitespace-nowrap">
                  <th className={th}>Email</th>
                  <th className={th}>Requested</th>
                  <th className={th}>Invite</th>
                  <th className={th}>Status</th>
                  <th className={cn(th, 'text-right font-medium')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {!requests ? <TableLoadingRows cols={5} rows={5} /> : visibleRequests.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--color-text-muted)] text-xs font-mono">{tab === 'requests' ? 'No one is waiting for access' : 'No rejected requests'}</td></tr>
                ) : visibleRequests.map((r) => (
                  <tr key={r.id} className="group hover:bg-white/[0.015] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-white/[0.02] border border-[var(--color-border)] flex items-center justify-center shrink-0"><AtSign className="w-4 h-4 text-white/60" /></div>
                        <p className="font-medium text-white text-[13px]">{r.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">{date(r.created_at)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                      {r.invites_sent ? <>{r.status === 'expired' ? 'expired' : 'expires'} {date(r.invite_expires_at)}<span className="block text-[11px]">sent {r.invites_sent}×</span></> : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? <Pill tone="amber">Waiting</Pill> : r.status === 'approved' ? <Pill tone="blue">Invited</Pill> : r.status === 'expired' ? <Pill tone="muted">Invite expired</Pill> : <Pill tone="red">Rejected</Pill>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {r.status !== 'rejected' && (
                          <button disabled={busy !== null} onClick={() => run(r.id + 'reject', () => decideMailAccessAction(r.id, 'reject'), `Rejected ${r.email}`)} className={cn(action, 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20')}>Reject</button>
                        )}
                        <button disabled={busy !== null} onClick={() => run(r.id + 'approve', () => decideMailAccessAction(r.id, 'approve'), `Invite sent to ${r.email}`)} className={cn(action, 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20')}>
                          {r.status === 'pending' || r.status === 'rejected' ? 'Approve' : 'Resend invite'}
                        </button>
                        <button disabled={busy !== null} className={cn(action, danger)} onClick={() => setConfirm({
                          title: 'Delete request',
                          message: `Remove ${r.email} from the list? Any invite link they have stops working. They can request again.`,
                          confirmLabel: 'Delete',
                          tone: 'danger',
                          onConfirm: () => run(r.id + 'delete', () => deleteMailRequestAction(r.id), `Removed ${r.email}`),
                        })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      {crediting && <CreditsModal account={crediting} onClose={() => setCrediting(null)} onDone={load} />}
    </div>
  )
}
