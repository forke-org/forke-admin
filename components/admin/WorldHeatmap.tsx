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

import React, { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Search, X, Globe2 } from 'lucide-react'

// Composed geo view: 3D globe (left) + searchable, paginated country table (right).
// Click a row to rotate the globe to that country and pin a detail box.
// The globe is loaded client-only (WebGL + window) so it never SSRs.

type CountryDatum = { country: string; clicks: number; conversions?: number }

const GlobeView = dynamic(() => import('@/components/admin/GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center text-xs font-mono text-[var(--color-text-muted)]">
      Loading 3D globe…
    </div>
  ),
})

// Full ISO-3166 coverage via the platform's own CLDR data.
const COUNTRY_DISPLAY =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

export function countryName(iso?: string | null): string {
  if (!iso) return 'Unknown'
  const code = iso.trim().toUpperCase()
  if (code === 'UNKNOWN') return 'Direct / Unknown'
  if (!/^[A-Z]{2}$/.test(code)) return 'Unknown'
  try {
    return COUNTRY_DISPLAY?.of(code) || code
  } catch {
    return code
  }
}

const PAGE_SIZE = 9

// Reliable flag images (flagcdn)
function Flag({ iso }: { iso: string }) {
  const code = iso.toLowerCase()
  if (!/^[a-z]{2}$/.test(code) || code === 'unknown') {
    return (
      <span className="inline-flex items-center justify-center w-[20px] h-[14px] rounded-[2px] bg-white/10 shrink-0 text-[9px] font-mono text-white/40">
        ?
      </span>
    )
  }
  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={iso}
      width={20}
      height={14}
      unoptimized
      className="rounded-[2px] object-cover shrink-0 shadow-sm"
    />
  )
}

export default function WorldHeatmap({ data }: { data: CountryDatum[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [hover, setHover] = useState<{ name: string; value: number; metric: string } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  // Default to 'subscribers' view
  const [sortBy, setSortBy] = useState<'clicks' | 'subscribers'>('subscribers')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const totalClicks = useMemo(() => data.reduce((a, r) => a + r.clicks, 0), [data])
  const totalSubscribers = useMemo(() => data.reduce((a, r) => a + (r.conversions ?? 0), 0), [data])

  const handleSort = (metric: 'clicks' | 'subscribers') => {
    if (sortBy === metric) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(metric)
      setSortDir('desc')
    }
    setPage(0)
  }

  const rows = useMemo(() => {
    const withMeta = data.map((d) => {
      const conversions = d.conversions ?? 0
      const activeTotal = sortBy === 'subscribers' ? totalSubscribers : totalClicks
      const activeVal = sortBy === 'subscribers' ? conversions : d.clicks
      const pct = activeTotal > 0 ? Math.round((activeVal / activeTotal) * 1000) / 10 : 0

      return {
        iso: d.country,
        name: countryName(d.country),
        clicks: d.clicks,
        conversions,
        pct,
      }
    })

    withMeta.sort((a, b) => {
      const valA = sortBy === 'subscribers' ? a.conversions : a.clicks
      const valB = sortBy === 'subscribers' ? b.conversions : b.clicks
      const secA = sortBy === 'subscribers' ? a.clicks : a.conversions
      const secB = sortBy === 'subscribers' ? b.clicks : b.conversions

      if (valA !== valB) {
        return sortDir === 'desc' ? valB - valA : valA - valB
      }
      return valB - valA || secB - secA
    })

    const q = query.trim().toLowerCase()
    return q
      ? withMeta.filter((r) => r.name.toLowerCase().includes(q) || r.iso.toLowerCase().includes(q))
      : withMeta
  }, [data, totalClicks, totalSubscribers, sortBy, sortDir, query])

  const selectedRow = useMemo(() => rows.find((r) => r.iso === selected) || null, [rows, selected])

  if (data.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)] py-12 text-center font-mono">
        No geo traffic data recorded yet.
      </p>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const slice = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col space-y-3.5">
      {/* Top Balanced Metrics Bar (Responsive on Phone & Desktop) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 text-xs font-mono text-white/50">
          <Globe2 className="w-3.5 h-3.5 text-accent shrink-0" />
          <span className="truncate">GLOBAL CONVERSIONS & TRAFFIC</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-0.5 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.025] border border-[var(--color-border)] text-[11px] sm:text-xs font-mono">
            <span className="text-white/40 text-[10px] sm:text-xs">Traffic:</span>
            <span className="text-white font-medium truncate">{totalClicks.toLocaleString()}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-0.5 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.025] border border-[var(--color-border)] text-[11px] sm:text-xs font-mono">
            <span className="text-white/40 text-[10px] sm:text-xs">Subscribers:</span>
            <span className="text-accent font-medium truncate">{totalSubscribers.toLocaleString()}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-0.5 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.025] border border-[var(--color-border)] text-[11px] sm:text-xs font-mono">
            <span className="text-white/40 text-[10px] sm:text-xs">Regions:</span>
            <span className="text-white/80 truncate">{data.length}</span>
          </div>
        </div>
      </div>

      {/* Responsive Dual-Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Left Column: 3D Globe Card */}
        <div className="relative rounded-xl bg-white/[0.015] border border-[var(--color-border)] p-2 h-[340px] sm:h-[420px] lg:h-[500px] flex items-center justify-center overflow-hidden">
          <GlobeView data={data} focusIso={selected} onHover={setHover} metric={sortBy} />

          {/* Selected-country detail box */}
          {selectedRow && (
            <div className="absolute top-3 left-3 z-20 w-[190px] sm:w-[210px] rounded-xl border border-white/15 bg-[#0e0e12]/95 backdrop-blur-md p-3 sm:p-3.5 shadow-2xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Flag iso={selectedRow.iso} />
                  <span className="text-xs sm:text-[13px] font-medium text-white truncate">{selectedRow.name}</span>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-white/40 hover:text-white shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div
                  className={`rounded-lg p-1.5 sm:p-2 ${
                    sortBy === 'subscribers'
                      ? 'bg-accent/15 border border-accent/30'
                      : 'bg-white/[0.03] border border-white/[0.06]'
                  }`}
                >
                  <p className="text-[9px] uppercase font-mono tracking-wider text-white/40">Subscribers</p>
                  <p className="text-sm sm:text-base font-mono font-medium text-accent leading-tight mt-0.5">
                    {selectedRow.conversions.toLocaleString()}
                  </p>
                </div>
                <div
                  className={`rounded-lg p-1.5 sm:p-2 ${
                    sortBy === 'clicks'
                      ? 'bg-accent/15 border border-accent/30'
                      : 'bg-white/[0.03] border border-white/[0.06]'
                  }`}
                >
                  <p className="text-[9px] uppercase font-mono tracking-wider text-white/40">Clicks</p>
                  <p className="text-sm sm:text-base font-mono font-medium text-white leading-tight mt-0.5">
                    {selectedRow.clicks.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="pt-1 text-[10px] font-mono text-white/45 flex items-center justify-between border-t border-white/[0.06]">
                <span>
                  {selectedRow.clicks > 0
                    ? (Math.round((selectedRow.conversions / selectedRow.clicks) * 1000) / 10).toFixed(1)
                    : '0.0'}
                  % conv.
                </span>
                <span>{selectedRow.pct}% of {sortBy}</span>
              </div>
            </div>
          )}

          {/* Hover label (only when nothing is pinned) */}
          {hover && !selectedRow && (
            <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-lg border border-white/15 bg-[#111]/95 backdrop-blur px-2.5 py-1.5 shadow-xl">
              <div className="flex items-center gap-1.5 text-xs font-mono text-white/90">{hover.name}</div>
              <div className="text-sm font-mono text-white mt-0.5">
                {hover.value.toLocaleString()}{' '}
                <span className="text-[10px] text-white/40">{hover.metric}</span>
              </div>
            </div>
          )}

          {/* Floating Globe Legend */}
          <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center pointer-events-none">
            <div className="px-3 py-1 rounded-full bg-[#0d0d10]/90 backdrop-blur border border-white/10 flex items-center gap-2.5 text-[10px] font-mono text-white/50 shadow-lg">
              <span className="text-white/70 capitalize font-medium">{sortBy}:</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,122,0,0.95)' }} />
                high
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,122,0,0.45)' }} />
                mid
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                low
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Country Table Card (No Share Column, Generous Room for Country Names) */}
        <div className="rounded-xl bg-white/[0.015] border border-[var(--color-border)] p-3 sm:p-4 flex flex-col min-h-[440px] lg:h-[500px] justify-between">
          <div>
            {/* Header Controls: Search & Segmented Sort (Stacked & Full-Width on Mobile, Inline on Desktop) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2.5">
              <div className="relative w-full sm:flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Search countries or codes…"
                  className="w-full h-8 bg-white/[0.025] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-accent/50 transition-all font-mono"
                />
              </div>

              {/* Segmented Sort Controls: Full-width 2-column grid on mobile, inline on sm+ */}
              <div className="grid grid-cols-2 sm:flex sm:items-center p-0.5 rounded-lg border border-[var(--color-border)] bg-white/[0.02] shrink-0 gap-1 w-full sm:w-auto">
                <button
                  onClick={() => handleSort('subscribers')}
                  title="Sort by subscribers (high to low)"
                  className={`h-7 px-2.5 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1 select-none cursor-pointer ${
                    sortBy === 'subscribers'
                      ? 'bg-accent/15 text-accent font-semibold border border-accent/30 shadow-[0_0_10px_rgba(255,122,0,0.1)]'
                      : 'text-white/45 hover:text-white border border-transparent'
                  }`}
                >
                  <span>Subscribers</span>
                  {sortBy === 'subscribers' && (
                    <span className="text-[10px] font-bold">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
                <button
                  onClick={() => handleSort('clicks')}
                  title="Sort by traffic clicks (high to low)"
                  className={`h-7 px-2.5 rounded-md text-[11px] font-mono transition-all flex items-center justify-center gap-1 select-none cursor-pointer ${
                    sortBy === 'clicks'
                      ? 'bg-accent/15 text-accent font-semibold border border-accent/30 shadow-[0_0_10px_rgba(255,122,0,0.1)]'
                      : 'text-white/45 hover:text-white border border-transparent'
                  }`}
                >
                  <span>Clicks</span>
                  {sortBy === 'clicks' && (
                    <span className="text-[10px] font-bold">{sortDir === 'desc' ? '↓' : '↑'}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Table Column Headers: ONLY Country, Subscribers, Clicks */}
            <div className="flex items-center px-2 sm:px-3 py-2 text-[10px] uppercase tracking-wider text-white/40 font-mono border-b border-[var(--color-border)] select-none">
              <span className="flex-1 min-w-0">COUNTRY</span>
              <button
                onClick={() => handleSort('subscribers')}
                className={`w-28 sm:w-32 shrink-0 text-right flex items-center justify-end gap-1 hover:text-white transition-colors cursor-pointer whitespace-nowrap ${
                  sortBy === 'subscribers' ? 'text-accent font-semibold' : ''
                }`}
              >
                <span>SUBSCRIBERS</span>
                {sortBy === 'subscribers' && (
                  <span className="text-[10px] font-bold">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </button>
              <button
                onClick={() => handleSort('clicks')}
                className={`w-16 sm:w-20 shrink-0 text-right flex items-center justify-end gap-1 hover:text-white transition-colors cursor-pointer whitespace-nowrap ${
                  sortBy === 'clicks' ? 'text-accent font-semibold' : ''
                }`}
              >
                <span>CLICKS</span>
                {sortBy === 'clicks' && (
                  <span className="text-[10px] font-bold">{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </button>
            </div>

            {/* Table Rows (Generous room for country names, never truncated) */}
            <div className="space-y-0.5 py-1">
              {slice.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] py-14 text-center font-mono">
                  No countries match “{query}”.
                </p>
              ) : (
                slice.map((r) => {
                  const isSel = r.iso === selected
                  return (
                    <button
                      key={r.iso}
                      onClick={() => setSelected(isSel ? null : r.iso)}
                      className={
                        'w-full flex items-center px-2 sm:px-3 py-2.5 rounded-lg transition-all text-left ' +
                        (isSel
                          ? 'bg-accent/[0.08] border border-accent/30 shadow-[0_0_12px_rgba(255,122,0,0.06)]'
                          : 'border border-transparent hover:bg-white/[0.03]')
                      }
                    >
                      <span className="flex-1 min-w-0 flex items-center gap-2 pr-2">
                        <Flag iso={r.iso} />
                        <span className="text-[13px] text-white/90 truncate font-normal" title={r.name}>
                          {r.name}
                        </span>
                        <span className="text-[10px] font-mono text-white/30 uppercase shrink-0">
                          {r.iso}
                        </span>
                      </span>
                      <span
                        className={`w-28 sm:w-32 shrink-0 text-right text-[13px] font-mono tabular-nums ${
                          sortBy === 'subscribers' ? 'text-accent font-medium' : 'text-white/60'
                        }`}
                      >
                        {r.conversions.toLocaleString()}
                      </span>
                      <span
                        className={`w-16 sm:w-20 shrink-0 text-right text-[13px] font-mono tabular-nums ${
                          sortBy === 'clicks' ? 'text-white font-medium' : 'text-white/60'
                        }`}
                      >
                        {r.clicks.toLocaleString()}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Pagination Footer Flush at Bottom */}
          <div className="flex items-center justify-between pt-2.5 border-t border-[var(--color-border)] mt-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0 || rows.length === 0}
              className="px-2 py-0.5 rounded text-[11px] font-mono border border-[var(--color-border)] text-white/60 hover:text-white hover:bg-white/[0.04] disabled:opacity-25 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              ← Prev
            </button>
            <span className="text-[11px] font-mono text-white/40">
              {rows.length > 0
                ? `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of ${rows.length}`
                : '0'}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1 || rows.length === 0}
              className="px-2 py-0.5 rounded text-[11px] font-mono border border-[var(--color-border)] text-white/60 hover:text-white hover:bg-white/[0.04] disabled:opacity-25 disabled:hover:bg-transparent transition-all cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
