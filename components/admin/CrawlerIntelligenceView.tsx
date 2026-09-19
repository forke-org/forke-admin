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

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  ShieldAlert,
  Search,
  Cpu,
  Share2,
  Activity,
  RefreshCw,
  Terminal,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react'
import {
  getCrawlerIntelligenceData,
  type CrawlerIntelligenceData,
} from '@/lib/admin-dashboard-actions'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

const RANGES: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: 'all', days: -1 },
]

function getCategoryBadge(category?: string | null) {
  switch (category) {
    case 'ai_agent':
      return {
        label: 'AI Agent',
        icon: Cpu,
        style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      }
    case 'search_engine':
      return {
        label: 'Search Engine',
        icon: Search,
        style: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      }
    case 'malicious_scanner':
      return {
        label: 'Scanner Probe',
        icon: ShieldAlert,
        style: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      }
    case 'social_preview':
      return {
        label: 'Social Bot',
        icon: Share2,
        style: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      }
    case 'uptime_monitor':
      return {
        label: 'Uptime Monitor',
        icon: Activity,
        style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      }
    default:
      return {
        label: category || 'Bot',
        icon: Bot,
        style: 'bg-white/5 text-[var(--color-text-muted)] border-white/10',
      }
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${Math.max(1, s)}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Card({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

export default function CrawlerIntelligenceView() {
  const [days, setDays] = useState(14)
  const [data, setData] = useState<CrawlerIntelligenceData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [feedPage, setFeedPage] = useState(0)
  const [hoverBar, setHoverBar] = useState<{
    day: string
    ai: number
    search: number
    scanner: number
    other: number
  } | null>(null)

  const load = useCallback(async (d: number) => {
    setIsLoading(true)
    setFeedPage(0)
    try {
      const res = await getCrawlerIntelligenceData(d)
      if (res.success) {
        setData(res.data)
      }
    } catch (e) {
      console.error('Failed to load crawler intelligence:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const {
    summary,
    categoryBreakdown,
    topCrawlers,
    topProbedPaths,
    dailySeries,
    recentBotVisits,
  } = data

  const maxDaily = Math.max(
    ...dailySeries.map((d) => d.ai + d.search + d.scanner + d.other),
    1
  )

  const PAGE_SIZE = 10
  const totalFeedPages = Math.ceil(recentBotVisits.length / PAGE_SIZE)
  const paginatedFeed = recentBotVisits.slice(
    feedPage * PAGE_SIZE,
    (feedPage + 1) * PAGE_SIZE
  )

  return (
    <div className="space-y-4">
      {/* Sub-header controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Bot Classification Engine
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            Tiered retention: 14d raw logs · permanent daily rollups
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[var(--color-border)] p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-mono transition-colors',
                  days === r.days
                    ? 'bg-accent/15 text-accent font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-white'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.03] transition-colors"
            title="Refresh crawler data"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Bot className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wide">
              Total Bot Traffic
            </span>
          </div>
          <p className="text-2xl font-mono text-white mt-1.5">
            {summary.totalBotHits.toLocaleString()}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Filtered from human funnel
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Cpu className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wide">
              AI Agents / LLMs
            </span>
          </div>
          <p className="text-2xl font-mono text-white mt-1.5">
            {summary.aiAgentHits.toLocaleString()}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            GPTBot, Claude, Perplexity
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wide">
              Search Indexers
            </span>
          </div>
          <p className="text-2xl font-mono text-white mt-1.5">
            {summary.searchEngineHits.toLocaleString()}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Googlebot, Bing, Baidu
          </p>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase tracking-wide">
              Scanner Probes
            </span>
          </div>
          <p className="text-2xl font-mono text-white mt-1.5">
            {summary.scannerHits.toLocaleString()}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
            Probing .env, id_rsa, owa
          </p>
        </div>
      </div>

      {/* Bot Traffic Over Time Chart */}
      <Card
        title="Crawler activity over time"
        subtitle={
          days === -1
            ? 'Daily automated traffic breakdown · all-time rollups'
            : `Daily automated traffic breakdown · last ${days} days`
        }
        badge={
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> AI
            </span>
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400" /> Search
            </span>
            <span className="flex items-center gap-1 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Scanners
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-400" /> Other
            </span>
          </div>
        }
      >
        {dailySeries.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] py-8 text-center">
            No crawler data in selected time window.
          </p>
        ) : (
          <div>
            {/* Inline tooltip if hovering */}
            <div className="h-6 mb-2 flex items-center justify-between text-xs font-mono">
              {hoverBar ? (
                <div className="flex items-center gap-4 text-white">
                  <span className="text-[var(--color-text-muted)]">
                    {hoverBar.day}:
                  </span>
                  <span className="text-emerald-400">
                    AI: {hoverBar.ai.toLocaleString()}
                  </span>
                  <span className="text-blue-400">
                    Search: {hoverBar.search.toLocaleString()}
                  </span>
                  <span className="text-rose-400">
                    Scanners: {hoverBar.scanner.toLocaleString()}
                  </span>
                  <span className="text-purple-400">
                    Other: {hoverBar.other.toLocaleString()}
                  </span>
                  <span className="font-semibold text-white">
                    Total:{' '}
                    {(
                      hoverBar.ai +
                      hoverBar.search +
                      hoverBar.scanner +
                      hoverBar.other
                    ).toLocaleString()}
                  </span>
                </div>
              ) : (
                <span className="text-[var(--color-text-muted)]">
                  Hover over bars to inspect daily breakdown
                </span>
              )}
            </div>

            {/* Stacked Bars */}
            <div className="flex items-end gap-1.5 h-36 w-full pt-4 border-b border-[var(--color-border)]">
              {dailySeries.map((item) => {
                const total = item.ai + item.search + item.scanner + item.other
                const totalPct = Math.min(100, (total / maxDaily) * 100)

                const aiPct = total > 0 ? (item.ai / total) * 100 : 0
                const searchPct = total > 0 ? (item.search / total) * 100 : 0
                const scannerPct = total > 0 ? (item.scanner / total) * 100 : 0
                const otherPct = total > 0 ? (item.other / total) * 100 : 0

                return (
                  <div
                    key={item.day}
                    className="flex-1 flex flex-col justify-end h-full group relative cursor-pointer"
                    onMouseEnter={() => setHoverBar(item)}
                    onMouseLeave={() => setHoverBar(null)}
                  >
                    <div
                      className="w-full rounded-t-sm flex flex-col-reverse overflow-hidden transition-all duration-150 group-hover:brightness-125"
                      style={{ height: `${Math.max(4, totalPct)}%` }}
                    >
                      {item.scanner > 0 && (
                        <div
                          style={{ height: `${scannerPct}%` }}
                          className="w-full bg-rose-500/80"
                        />
                      )}
                      {item.search > 0 && (
                        <div
                          style={{ height: `${searchPct}%` }}
                          className="w-full bg-blue-500/80"
                        />
                      )}
                      {item.ai > 0 && (
                        <div
                          style={{ height: `${aiPct}%` }}
                          className="w-full bg-emerald-500/80"
                        />
                      )}
                      {item.other > 0 && (
                        <div
                          style={{ height: `${otherPct}%` }}
                          className="w-full bg-purple-500/80"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between items-center text-[10px] font-mono text-[var(--color-text-muted)] mt-2">
              <span>{dailySeries[0]?.day}</span>
              <span>{dailySeries[dailySeries.length - 1]?.day}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Breakdowns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Crawlers & AI Agents */}
        <Card
          title="Top Bots & Crawlers"
          subtitle="Identified indexing services, LLM training agents, and search spiders"
        >
          {topCrawlers.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
              No crawler records found.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topCrawlers.map((c) => {
                const max = topCrawlers[0]?.count || 1
                const badge = getCategoryBadge(c.category)
                const Icon = badge.icon
                return (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 flex items-center gap-1.5">
                      <Icon className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                      <span
                        className="text-xs font-mono text-white/90 truncate"
                        title={c.name}
                      >
                        {c.name}
                      </span>
                    </div>

                    <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          c.category === 'ai_agent'
                            ? 'bg-emerald-500/70'
                            : c.category === 'search_engine'
                              ? 'bg-blue-500/70'
                              : 'bg-rose-500/70'
                        )}
                        style={{ width: `${(c.count / max) * 100}%` }}
                      />
                    </div>

                    <span className="w-20 shrink-0 text-right text-xs font-mono text-white/80">
                      {c.count.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Top Scanner Targets / Probed Paths */}
        <Card
          title="Top Probed Paths"
          subtitle="Target paths hit by automated crawlers & security vulnerability scanners"
        >
          {topProbedPaths.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
              No probed paths recorded.
            </p>
          ) : (
            <div className="space-y-2.5">
              {topProbedPaths.map((p) => {
                const max = topProbedPaths[0]?.count || 1
                const isMalicious =
                  p.path.includes('.env') ||
                  p.path.includes('rsa') ||
                  p.path.includes('solr') ||
                  p.path.includes('owa') ||
                  p.path.includes('ssh') ||
                  p.path.includes('wp-')
                return (
                  <div key={p.path} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-48 shrink-0 text-xs font-mono truncate',
                        isMalicious ? 'text-rose-400' : 'text-white/80'
                      )}
                      title={p.path}
                    >
                      {p.path}
                    </span>

                    <div className="flex-grow h-2 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          isMalicious ? 'bg-rose-500/70' : 'bg-white/20'
                        )}
                        style={{ width: `${(p.count / max) * 100}%` }}
                      />
                    </div>

                    <span className="w-16 shrink-0 text-right text-xs font-mono text-white/80">
                      {p.count.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Live Recent Crawler Feed */}
      <Card
        title="Live Crawler Audit Stream"
        subtitle="Recent 50 automated visits captured in 14-day operational log"
        badge={
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              Page {feedPage + 1} of {Math.max(1, totalFeedPages)}
            </span>
            <button
              onClick={() => setFeedPage((p) => Math.max(0, p - 1))}
              disabled={feedPage === 0}
              className="p-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                setFeedPage((p) => Math.min(totalFeedPages - 1, p + 1))
              }
              disabled={feedPage >= totalFeedPages - 1}
              className="p-1 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-2">
                <th className="pb-2 font-normal">Timestamp</th>
                <th className="pb-2 font-normal">Bot / Crawler</th>
                <th className="pb-2 font-normal">Category</th>
                <th className="pb-2 font-normal">Path Requested</th>
                <th className="pb-2 font-normal">User-Agent Snippet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {paginatedFeed.map((visit, idx) => {
                const badge = getCategoryBadge(visit.botCategory)
                return (
                  <tr
                    key={idx}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2.5 text-[var(--color-text-muted)] whitespace-nowrap">
                      {timeAgo(visit.createdAt)}
                    </td>
                    <td className="py-2.5 text-white font-medium whitespace-nowrap">
                      {visit.botName || 'Generic Bot'}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border',
                          badge.style
                        )}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-white/80 max-w-[200px] truncate">
                      {visit.landingPath || '/'}
                    </td>
                    <td
                      className="py-2.5 text-[var(--color-text-muted)] max-w-[260px] truncate"
                      title={visit.userAgentSnippet || '—'}
                    >
                      {visit.userAgentSnippet || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
