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
import { MousePointerClick, Users, Target, FileText, ExternalLink, RefreshCw } from 'lucide-react'
import { getTrackerData, getSignupSourceBreakdown, type TrackerData } from '@/lib/admin-dashboard-actions'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import WorldHeatmap, { countryName } from '@/components/admin/WorldHeatmap'

const RANGES: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'all', days: -1 },
]

const EMPTY: TrackerData = {
  stats: { clicks: 0, visitors: 0, conversions: 0, rate: 0 },
  series: [], funnel: [], landingPages: [], referrers: [], countries: [], recent: [],
}

/** Shorten a referrer/URL to host + truncated path for compact display. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const tail = (u.pathname + u.search).replace(/\/$/, '')
    return u.host + (tail && tail !== '/' ? tail.slice(0, 24) : '')
  } catch {
    return url.slice(0, 36)
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

/** Small "Show all (N) / Show less" toggle, shared by the lists below to cap page size. */
function ShowMoreToggle({ expanded, total, onToggle }: { expanded: boolean; total: number; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="mt-3 w-full text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white transition-colors py-1.5 rounded-md border border-[var(--color-border)] hover:bg-white/[0.03]"
    >
      {expanded ? 'Show less' : `Show all (${total})`}
    </button>
  )
}

/**
 * A simple horizontal-bar list (label · bar · count). Caps rows at `limit` with a
 * "Show all" toggle so a long breakdown never blows up the panel height.
 */
function BarList({
  rows,
  emptyHint,
  limit = 8,
}: {
  rows: { label: string; count: number; title?: string }[]
  emptyHint: string
  limit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  if (rows.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">{emptyHint}</p>
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  const visible = expanded ? rows : rows.slice(0, limit)
  return (
    <div>
      <div className="space-y-2.5">
        {visible.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-xs font-mono text-white/70 truncate" title={r.title || r.label}>{r.label}</span>
            <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full bg-accent/70" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right text-xs font-mono text-white/80">{r.count}</span>
          </div>
        ))}
      </div>
      {rows.length > limit && (
        <ShowMoreToggle expanded={expanded} total={rows.length} onToggle={() => setExpanded((v) => !v)} />
      )}
    </div>
  )
}

const RECENT_PAGE_SIZE = 8
const LIST_PAGE_SIZE = 10

function PagedBarRows({
  rows,
  renderRow,
}: {
  rows: React.ReactNode[]
  renderRow?: never
}) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(rows.length / LIST_PAGE_SIZE)
  const p = Math.min(page, totalPages - 1)
  const slice = rows.slice(p * LIST_PAGE_SIZE, p * LIST_PAGE_SIZE + LIST_PAGE_SIZE)
  return (
    <div>
      <div className="space-y-2.5">{slice}</div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => setPage((x) => Math.max(0, x - 1))}
            disabled={p === 0}
            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            {p * LIST_PAGE_SIZE + 1}–{Math.min((p + 1) * LIST_PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <button
            onClick={() => setPage((x) => Math.min(totalPages - 1, x + 1))}
            disabled={p >= totalPages - 1}
            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

function FunnelCard({ funnel }: { funnel: { source: string; clicks: number; conversions: number; rate: number }[] }) {
  const [expanded, setExpanded] = useState(false)
  if (funnel.length === 0)
    return (
      <Card title="Click → signup funnel" subtitle="Per source: total clicks (grey) vs. signups they produced (accent)">
        <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">No source data yet.</p>
      </Card>
    )
  const maxClicks = Math.max(...funnel.map((f) => f.clicks), 1)
  const visible = expanded ? funnel : funnel.slice(0, LIST_PAGE_SIZE)
  return (
    <Card title="Click → signup funnel" subtitle="Per source: total clicks (grey) vs. signups they produced (accent)">
      <div className="space-y-2.5">
        {visible.map((f) => (
          <div key={f.source} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-mono text-white/70 truncate" title={f.source}>{f.source}</span>
            <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden relative">
              <div className="h-full rounded-full bg-white/15" style={{ width: `${(f.clicks / maxClicks) * 100}%` }} />
              <div className="h-full rounded-full bg-accent/80 absolute top-0 left-0" style={{ width: `${(f.conversions / maxClicks) * 100}%` }} />
            </div>
            <span className="w-36 shrink-0 text-right text-xs font-mono text-white/80">
              {f.conversions}/{f.clicks} <span className="text-[var(--color-text-muted)]">({f.rate}%)</span>
            </span>
          </div>
        ))}
      </div>
      {funnel.length > LIST_PAGE_SIZE && (
        <ShowMoreToggle expanded={expanded} total={funnel.length} onToggle={() => setExpanded((v) => !v)} />
      )}
    </Card>
  )
}

function SignupSourceCard({
  signupSources,
  signupTotal,
}: {
  signupSources: { source: string; count: number }[]
  signupTotal: number
}) {
  const max = Math.max(...signupSources.map((s) => s.count), 1)
  const rows = signupSources.map((s) => {
    const pct = signupTotal > 0 ? Math.round((s.count / signupTotal) * 1000) / 10 : 0
    return (
      <div key={s.source} className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs font-mono text-white/70 truncate" title={s.source}>{s.source}</span>
        <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
          <div className="h-full rounded-full bg-accent/70" style={{ width: `${(s.count / max) * 100}%` }} />
        </div>
        <span className="w-24 shrink-0 text-right text-xs font-mono text-white/80">
          {s.count} <span className="text-[var(--color-text-muted)]">({pct}%)</span>
        </span>
      </div>
    )
  })
  return (
    <Card
      title="Signups by source (all-time)"
      subtitle="Every real signup across users + subscribers, grouped by channel. These are confirmed conversions — click data wasn't recorded before the tracker, so no rate is shown here."
    >
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-mono text-white">{signupTotal.toLocaleString()}</span>
        <span className="text-xs text-[var(--color-text-muted)]">total signups · {signupSources.length} channels</span>
      </div>
      <PagedBarRows rows={rows} />
    </Card>
  )
}

export default function TrackerPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<TrackerData>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  // All-time signups by source (real conversions, predates the click tracker).
  const [signupSources, setSignupSources] = useState<{ source: string; count: number }[]>([])
  const [signupTotal, setSignupTotal] = useState(0)
  // Recent-clicks feed pagination (data is already capped to 25 rows server-side).
  const [recentPage, setRecentPage] = useState(0)
  // Instant hover tooltip for the clicks-over-time bars (native title has ~1s delay).
  const [hoverBar, setHoverBar] = useState<{ day: string; clicks: number; x: number } | null>(null)

  const load = useCallback(async (d: number) => {
    setIsLoading(true)
    setRecentPage(0) // reset feed paging whenever the range changes
    try {
      const res = await getTrackerData(d)
      setData(res.success ? res.data : EMPTY)
    } catch {
      setData(EMPTY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load(days) }, [days, load])

  // Historical signups-by-source loads once (it's all-time, not range-dependent).
  useEffect(() => {
    getSignupSourceBreakdown()
      .then((res) => { if (res.success) { setSignupSources(res.breakdown); setSignupTotal(res.total) } })
      .catch(() => {})
  }, [])

  const { stats, series, funnel, landingPages, referrers, countries, recent } = data

  return (
    <div className="flex flex-col min-h-0 flex-grow gap-4 overflow-y-auto pr-1">
      {/* Header + range selector */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-white">Tracker</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Link clicks, sources & conversions from your <span className="font-mono text-white/70">?source=</span> tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--color-border)] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-mono transition-colors',
                  days === r.days ? 'bg-white/[0.06] text-white' : 'text-[var(--color-text-muted)] hover:text-white'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            className="h-7 w-7 grid place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-white/[0.05] hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
            {[
              { icon: MousePointerClick, label: 'Clicks', value: stats.clicks.toLocaleString() },
              { icon: Users, label: 'Unique visitors', value: stats.visitors.toLocaleString() },
              // Total real signups (all-time) — matches the "total signups" figure in
              // the breakdown below. The smaller click-attributed subset lives in the
              // funnel, so the headline never contradicts the breakdown total.
              { icon: Target, label: 'Signups (all-time)', value: signupTotal.toLocaleString() },
              { icon: Target, label: 'Conversion rate', value: `${stats.rate}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                  <s.icon className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase tracking-wide">{s.label}</span>
                </div>
                <p className="text-2xl font-mono text-white mt-1.5">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Clicks over time */}
          <Card title="Clicks over time" subtitle={`Daily tracked clicks · last ${days} days`}>
            {series.length > 0 ? (
              <div className="relative">
                {/* Instant custom tooltip (no native-title delay) */}
                {hoverBar && (
                  <div
                    className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-[var(--color-border)] bg-[#111] px-2.5 py-1.5 text-[11px] font-mono text-white shadow-lg"
                    style={{ left: `${hoverBar.x}%` }}
                  >
                    <span className="text-accent">{hoverBar.clicks}</span> click{hoverBar.clicks === 1 ? '' : 's'}
                    <span className="text-[var(--color-text-muted)]"> · {hoverBar.day}</span>
                  </div>
                )}
                <div className="flex items-end gap-[3px] h-32" onMouseLeave={() => setHoverBar(null)}>
                  {(() => {
                    const max = Math.max(...series.map((d) => d.clicks), 1)
                    return series.map((d, i) => (
                      <div
                        key={d.day}
                        className="flex-1 min-w-[2px] rounded-t bg-accent/60 hover:bg-accent transition-colors cursor-pointer"
                        style={{ height: `${Math.max((d.clicks / max) * 100, 2)}%` }}
                        onMouseEnter={() =>
                          setHoverBar({ day: d.day, clicks: d.clicks, x: ((i + 0.5) / series.length) * 100 })
                        }
                      />
                    ))
                  })()}
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                  <span>{series[0]?.day}</span>
                  <span>{series[series.length - 1]?.day}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] py-8 text-center">
                No clicks tracked yet. Share a link like <span className="font-mono text-white/70">forke.space/?source=twitter</span> to start collecting.
              </p>
            )}
          </Card>

          {/* Per-source funnel */}
          <FunnelCard funnel={funnel} />

          {/* All-time signups by source */}
          {signupSources.length > 0 && (
            <SignupSourceCard signupSources={signupSources} signupTotal={signupTotal} />
          )}

          {/* Landing pages + Referrers side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Top landing pages" subtitle="First page visitors hit">
              <div className="flex items-center gap-2 mb-3 text-[var(--color-text-muted)]"><FileText className="w-3.5 h-3.5" /></div>
              <BarList
                rows={landingPages.map((p) => ({ label: p.path, count: p.clicks }))}
                emptyHint="No landing data yet."
              />
            </Card>
            <Card title="Top referrers" subtitle="External sites sending traffic">
              <div className="flex items-center gap-2 mb-3 text-[var(--color-text-muted)]"><ExternalLink className="w-3.5 h-3.5" /></div>
              <BarList
                rows={referrers.map((r) => ({ label: shortUrl(r.referrer), count: r.clicks, title: r.referrer }))}
                emptyHint="No external referrers yet — most traffic is direct or tagged."
              />
            </Card>
          </div>

          {/* Geo — full width: 3D globe + searchable country table */}
          <Card title="Clicks by country" subtitle="Spin the globe — countries glow by click volume. Search & page the table on the right.">
            <WorldHeatmap data={countries} />
          </Card>

          {/* Recent feed */}
          <div className="grid grid-cols-1 gap-4">
            <Card title="Recent clicks" subtitle="Live feed — confirms tracking is firing">
              {recent.length > 0 ? (
                (() => {
                  const totalPages = Math.ceil(recent.length / RECENT_PAGE_SIZE)
                  const page = Math.min(recentPage, totalPages - 1)
                  const start = page * RECENT_PAGE_SIZE
                  const slice = recent.slice(start, start + RECENT_PAGE_SIZE)
                  return (
                    <>
                      <div className="space-y-2">
                        {slice.map((r, i) => (
                          <div key={start + i} className="flex items-center gap-3 text-xs">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.03] border border-[var(--color-border)] font-mono text-white/70 shrink-0">
                              {r.source}
                            </span>
                            <span className="font-mono text-white/50 truncate flex-grow" title={r.referrer || r.landingPath || ''}>
                              {r.landingPath || '/'}{r.country ? ` · ${countryName(r.country)}` : ''}
                            </span>
                            <span className="font-mono text-[var(--color-text-muted)] shrink-0">{timeAgo(r.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                          <button
                            onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 disabled:hover:text-[var(--color-text-muted)] transition-colors"
                          >
                            ← Prev
                          </button>
                          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                            {page + 1} / {totalPages} · showing latest {recent.length}
                          </span>
                          <button
                            onClick={() => setRecentPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 disabled:hover:text-[var(--color-text-muted)] transition-colors"
                          >
                            Next →
                          </button>
                        </div>
                      )}
                    </>
                  )
                })()
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">No clicks recorded yet.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
