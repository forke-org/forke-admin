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
import { Search, X } from 'lucide-react'

// Composed geo view: 3D globe (left) + searchable, paginated country table (right).
// Click a row to rotate the globe to that country and pin a detail box.
// The globe is loaded client-only (WebGL + window) so it never SSRs.

type CountryDatum = { country: string; clicks: number; conversions?: number }

const GlobeView = dynamic(() => import('@/components/admin/GlobeView'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square max-h-[460px] grid place-items-center text-xs text-[var(--color-text-muted)]">
      Loading globe…
    </div>
  ),
})

// Full ISO-3166 coverage via the platform's own CLDR data, so every code resolves to a
// readable name. The previous hardcoded map only listed ~20 countries, which is why codes
// like KE / TH / LK / MG rendered as raw ISO instead of names.
const COUNTRY_DISPLAY =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

export function countryName(iso?: string | null): string {
  if (!iso) return 'Unknown'
  const code = iso.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return 'Unknown'
  try {
    // Intl returns the input unchanged for codes it doesn't recognise.
    return COUNTRY_DISPLAY?.of(code) || code
  } catch {
    return code
  }
}

const PAGE_SIZES = [10, 20, 50] as const

// Reliable flag images (flagcdn) — emoji regional-indicator flags don't render on
// many systems (e.g. Windows/Chrome showed a globe instead of the US flag).
function Flag({ iso }: { iso: string }) {
  const code = iso.toLowerCase()
  if (!/^[a-z]{2}$/.test(code) || iso === 'unknown') {
    return <span className="inline-block w-[22px] h-[15px] rounded-[2px] bg-white/10 shrink-0" />
  }
  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={iso}
      width={22}
      height={15}
      unoptimized
      className="rounded-[2px] object-cover shrink-0"
    />
  )
}

/** SVG ring showing a country's share of total clicks. */
function PercentRing({ pct }: { pct: number }) {
  const r = 8
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle
        cx="11" cy="11" r={r} fill="none" stroke="var(--color-accent, #ff7a00)" strokeWidth="2.5"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(-90 11 11)"
      />
    </svg>
  )
}

export default function WorldHeatmap({ data }: { data: CountryDatum[] }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0])
  const [hover, setHover] = useState<{ name: string; clicks: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const total = useMemo(() => data.reduce((a, r) => a + r.clicks, 0), [data])

  const rows = useMemo(() => {
    const withMeta = data
      .map((d) => ({
        iso: d.country,
        name: countryName(d.country),
        clicks: d.clicks,
        conversions: d.conversions ?? 0,
        pct: total > 0 ? Math.round((d.clicks / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
    const q = query.trim().toLowerCase()
    return q ? withMeta.filter((r) => r.name.toLowerCase().includes(q) || r.iso.toLowerCase().includes(q)) : withMeta
  }, [data, total, query])

  const selectedRow = useMemo(() => rows.find((r) => r.iso === selected) || null, [rows, selected])

  if (data.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">No geo data yet (needs edge geo headers in production).</p>
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const slice = rows.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Globe */}
      <div className="relative rounded-lg bg-white/[0.015] border border-[var(--color-border)] p-2 min-h-[360px] flex items-center justify-center overflow-hidden">
        <GlobeView data={data} focusIso={selected} onHover={setHover} />

        {/* Selected-country detail box (clicks + conversions) */}
        {selectedRow && (
          <div className="absolute top-3 left-3 z-20 w-[200px] rounded-lg border border-[var(--color-border)] bg-[#0d0d0f]/95 backdrop-blur p-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Flag iso={selectedRow.iso} />
                <span className="text-[13px] font-medium text-white truncate">{selectedRow.name}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-white/40 hover:text-white shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">Clicks</p>
                <p className="text-lg font-mono text-white leading-tight">{selectedRow.clicks.toLocaleString()}</p>
              </div>
              <div className="rounded-md bg-white/[0.03] px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">Converted</p>
                <p className="text-lg font-mono text-accent leading-tight">{selectedRow.conversions.toLocaleString()}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] font-mono text-[var(--color-text-muted)]">
              {selectedRow.clicks > 0 ? Math.round((selectedRow.conversions / selectedRow.clicks) * 1000) / 10 : 0}% conversion
              · {selectedRow.pct}% of clicks
            </p>
          </div>
        )}

        {/* Hover label (only when nothing is pinned) */}
        {hover && !selectedRow && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border border-[var(--color-border)] bg-[#111] px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2 text-xs font-mono text-white/90">{hover.name}</div>
            <div className="text-base font-mono text-white mt-0.5">{hover.clicks.toLocaleString()} <span className="text-[10px] text-[var(--color-text-muted)]">clicks</span></div>
          </div>
        )}

        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-3 text-[10px] font-mono text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,122,0,0.95)' }} />high</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,122,0,0.45)' }} />mid</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />none</span>
        </div>
      </div>

      {/* Country table */}
      <div className="flex flex-col">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0) }}
            placeholder="Search countries…"
            className="w-full h-9 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {/* header — fixed column widths, generous gaps so it never clusters */}
        <div className="flex items-center px-3 pb-2 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          <span className="flex-grow">Country</span>
          <span className="w-20 text-right">Clicks</span>
          <span className="w-24 text-right pr-1">Percent</span>
        </div>

        <div className="flex-grow space-y-0.5">
          {slice.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">No countries match “{query}”.</p>
          ) : (
            slice.map((r) => {
              const isSel = r.iso === selected
              return (
                <button
                  key={r.iso}
                  onClick={() => setSelected(isSel ? null : r.iso)}
                  className={
                    'w-full flex items-center px-3 py-2.5 rounded-lg transition-colors text-left ' +
                    (isSel ? 'bg-accent/[0.08] border border-accent/30' : 'border border-transparent hover:bg-white/[0.025]')
                  }
                >
                  <span className="flex items-center gap-2.5 flex-grow min-w-0">
                    <Flag iso={r.iso} />
                    <span className="text-[13px] text-white/90 truncate" title={r.name}>{r.name}</span>
                  </span>
                  <span className="w-20 text-right text-[13px] font-mono text-white/80 tabular-nums">{r.clicks.toLocaleString()}</span>
                  <span className="w-24 flex items-center justify-end gap-2 pr-1">
                    <span className="text-[12px] font-mono text-white/55 tabular-nums w-10 text-right">{r.pct}%</span>
                    <PercentRing pct={r.pct} />
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--color-border)]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0 || rows.length === 0}
            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors"
          >← Prev</button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
              {rows.length > 0 ? `${safePage * pageSize + 1}–${Math.min((safePage + 1) * pageSize, rows.length)} of ${rows.length}` : '0'}
            </span>
            <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-md overflow-hidden">
              {PAGE_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => { setPageSize(s); setPage(0) }}
                  className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${pageSize === s ? 'bg-white/[0.08] text-white' : 'text-[var(--color-text-muted)] hover:text-white'}`}
                >{s}</button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1 || rows.length === 0}
            className="text-[11px] font-mono text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors"
          >Next →</button>
        </div>
      </div>
    </div>
  )
}
