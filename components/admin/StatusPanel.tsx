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
import { ExternalLink, RefreshCw } from 'lucide-react'
import { getStatusOverviewAction, type CheckState, type StatusOverview } from '@/lib/actions/status-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

const STATE_STYLE: Record<CheckState, string> = {
  operational: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  degraded: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  down: 'bg-red-500/10 border-red-500/20 text-red-300',
  unknown: 'bg-white/[0.03] border-[var(--color-border)] text-white/50',
}
const STATE_LABEL: Record<CheckState, string> = { operational: 'Operational', degraded: 'Degraded', down: 'Down', unknown: 'No data' }

function Pill({ state }: { state: CheckState }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider', STATE_STYLE[state])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATE_LABEL[state]}
    </span>
  )
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-[13px] font-medium text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

const pct = (v: number | null | undefined, digits = 2) => (v == null ? '—' : `${(v * 100).toFixed(digits).replace(/\.?0+$/, '')}%`)
const ago = (iso: string | null | undefined) => {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export default function StatusPanel() {
  const [data, setData] = useState<StatusOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getStatusOverviewAction()
      if (res.success && res.data) { setData(res.data); setError(null) } else setError(res.error || 'Could not load status')
    } catch {
      setError('Could not load status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  if (!data && !error) return <PanelSkeleton />

  const internal = data?.internal ?? []
  const worst: CheckState = internal.some((c) => c.state === 'down') ? 'down' : internal.some((c) => c.state === 'degraded') ? 'degraded' : 'operational'
  const mail = data?.mail?.windows?.['7d']

  return (
    <div className="flex flex-col min-h-0 flex-grow gap-5 overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-white">Status</h2>
            {data && <Pill state={worst} />}
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Private checks from this server, refreshed every 30 seconds. The public page shows only the Website, Dashboard, API and Forke Mail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="https://status.forke.space" target="_blank" rel="noreferrer"
            className="h-8 px-3 rounded-lg text-xs transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] inline-flex items-center gap-1.5 font-medium text-white leading-none">
            <ExternalLink className="w-3.5 h-3.5" /> Public page
          </a>
          <button onClick={load}
            className="h-8 px-3 rounded-lg text-xs transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] inline-flex items-center gap-1.5 font-medium text-white leading-none">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      <Card title="Servers and apps" subtitle={data ? `Checked ${ago(data.checkedAt)} over localhost` : undefined}>
        <div className="divide-y divide-[var(--color-border)]">
          {internal.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] text-white">{c.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">{c.detail}{c.info ? ` · ${c.info}` : ''}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{c.ms == null ? '—' : `${c.ms} ms`}</span>
                <Pill state={c.state} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Public status page" subtitle={data?.publicUpdatedAt ? `Outside checks, updated ${ago(data.publicUpdatedAt)}` : 'Waiting for the first outside check'}>
          {data?.publicServices?.length ? (
            <div className="divide-y divide-[var(--color-border)]">
              {data.publicServices.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="text-[13px] text-white">{s.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{pct(s.uptime90)} · 90 d</span>
                    <Pill state={s.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-xs text-[var(--color-text-muted)]">No outside checks yet. They start once the forke-status repo is live on GitHub.</p>
          )}
        </Card>

        <Card title="Email delivery (7 days)" subtitle="All Forke Mail accounts, from mail.forke.space/api/public/status">
          {mail ? (
            <div className="grid grid-cols-2 gap-px bg-[var(--color-border)]">
              {[
                ['Delivered', pct(mail.delivery_rate), `${(mail.delivered ?? 0).toLocaleString()} of ${(mail.sent ?? 0).toLocaleString()}`],
                ['Typical delivery', mail.delivery_seconds_p50 == null ? '—' : `${mail.delivery_seconds_p50.toFixed(1)}s`, `95% within ${mail.delivery_seconds_p95 == null ? '—' : `${mail.delivery_seconds_p95.toFixed(1)}s`}`],
                ['Bounce rate', pct(mail.bounce_rate), `pauses above ${pct(data?.mail?.limits?.max_bounce_rate, 1)}`],
                ['Complaints', pct(mail.complaint_rate, 3), `pauses above ${pct(data?.mail?.limits?.max_complaint_rate, 1)}`],
              ].map(([label, value, sub]) => (
                <div key={label} className="bg-[#0a0a0c] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">{label}</p>
                  <p className="text-lg text-white font-medium mt-1">{value}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{sub}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-xs text-[var(--color-text-muted)]">Forke Mail metrics are unavailable.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Scheduled jobs" subtitle="Last run, from the cron log files">
          <div className="divide-y divide-[var(--color-border)]">
            {(data?.cron ?? []).map((j) => (
              <div key={j.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-[13px] text-white font-mono">{j.name}</p>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{ago(j.lastRun)}</span>
                  <Pill state={j.state} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Backups and processes">
          <div className="divide-y divide-[var(--color-border)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="text-[13px] text-white">Last database backup</p>
              {data?.backup ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{data.backup.tier} · {ago(data.backup.finishedAt)}</span>
                  <Pill state={data.backup.status === 'success' ? 'operational' : 'down'} />
                </div>
              ) : <Pill state="unknown" />}
            </div>
            {(data?.processes ?? []).map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[13px] text-white font-mono">{p.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{p.memoryMb} MB · {p.restarts} restarts · up since {ago(p.uptimeSince)}</p>
                </div>
                <Pill state={p.status === 'online' ? 'operational' : 'down'} />
              </div>
            ))}
            {data && data.processes === null && <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">Process list unavailable (pm2 not found).</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
