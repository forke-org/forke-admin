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

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  getActiveQueries, 
  getDatabaseMetrics, 
  getDatabaseQueryPerformance, 
  getDatabaseAdvisors 
} from '@/lib/db-client-actions'
import { 
  RefreshCw, 
  ShieldAlert, 
  Check,
  AlertTriangle,
} from 'lucide-react'
import { toast } from '@/components/shared/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// ─── Interfaces ───────────────────────────────────────────

interface ActiveQuery {
  pid: number
  query: string
  state: string
  duration: string
  user: string
}

interface QueryPerformance {
  role: string
  calls: number
  averageTime: string
  totalTime: string
  query: string
}

interface AdvisorRecommendation {
  id: string
  type: 'index' | 'security' | 'performance'
  title: string
  description: string
  sqlSuggestion?: string
}

interface MetricPoint {
  time: string
  timestamp: number
  connectionsActive: number
  connectionsIdle: number
  connectionsTotal: number
  connectionsMax: number
  deadlocks: number
  rowsInserted: number
  rowsUpdated: number
  rowsDeleted: number
  cacheHitRate: number
  dbSizeMb: number
  allDbsSizeMb: number
  transactionCommits: number
  transactionRollbacks: number
}

// ─── Chart series config ──────────────────────────────────

interface ChartSeriesConfig {
  key: string
  label: string
  color: string
  extract: (p: MetricPoint) => number
  dashed?: boolean
}

// ─── Neon-style Chart Component ───────────────────────────

const CHART_W = 800
const CHART_H = 200
const PAD = { left: 55, right: 15, top: 12, bottom: 32 }
const PLOT_W = CHART_W - PAD.left - PAD.right
const PLOT_H = CHART_H - PAD.top - PAD.bottom

function niceMax(val: number): number {
  if (val <= 0) return 1
  if (val <= 1) return 1
  if (val <= 5) return 5
  if (val <= 10) return 10
  if (val <= 50) return 50
  if (val <= 100) return 100
  if (val <= 500) return 500
  if (val <= 1000) return 1000
  return Math.ceil(val / 100) * 100
}

function generateTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min]
  const step = (max - min) / count
  const ticks: number[] = []
  for (let i = 0; i <= count; i++) {
    ticks.push(min + step * i)
  }
  return ticks
}

function NeonChart({ 
  title, 
  subtitle, 
  series, 
  history, 
  yMaxOverride,
  yFormatter,
  showArea,
}: {
  title: string
  subtitle: string
  series: ChartSeriesConfig[]
  history: MetricPoint[]
  yMaxOverride?: number
  yFormatter?: (v: number) => string
  showArea?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [tooltipX, setTooltipX] = useState(0)

  // Calculate Y range from actual data
  let dataMax = 0
  if (history.length > 0) {
    for (const s of series) {
      for (const p of history) {
        const v = s.extract(p)
        if (v > dataMax) dataMax = v
      }
    }
  }
  const yMax = yMaxOverride ?? niceMax(dataMax)
  const yMin = 0

  const ticks = generateTicks(yMin, yMax, 4)
  const fmt = yFormatter || ((v: number) => {
    if (yMax >= 1000) return v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v.toFixed(0)
    if (yMax <= 1) return v.toFixed(2)
    if (yMax <= 10 && yMax > 1) return v.toFixed(1)
    return v.toFixed(0)
  })

  function toX(idx: number): number {
    if (history.length <= 1) return PAD.left
    return PAD.left + (idx / (history.length - 1)) * PLOT_W
  }
  function toY(val: number): number {
    const ratio = (val - yMin) / (yMax - yMin || 1)
    return PAD.top + PLOT_H - ratio * PLOT_H
  }

  function linePath(extract: (p: MetricPoint) => number): string {
    if (history.length < 2) return ''
    return history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(extract(p)).toFixed(1)}`).join(' ')
  }

  function areaPath(extract: (p: MetricPoint) => number): string {
    if (history.length < 2) return ''
    const line = linePath(extract)
    return `${line} L ${toX(history.length - 1).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)} L ${toX(0).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)} Z`
  }

  // Select ~5 x-axis labels evenly
  const xLabelIndices: number[] = []
  if (history.length > 0) {
    const step = Math.max(1, Math.floor((history.length - 1) / 4))
    for (let i = 0; i < history.length; i += step) xLabelIndices.push(i)
    if (!xLabelIndices.includes(history.length - 1)) xLabelIndices.push(history.length - 1)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || history.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const svgX = (relX / rect.width) * CHART_W

    if (svgX < PAD.left || svgX > CHART_W - PAD.right) {
      setHoverIdx(null)
      return
    }

    const ratio = (svgX - PAD.left) / PLOT_W
    const idx = Math.round(ratio * (history.length - 1))
    if (idx >= 0 && idx < history.length) {
      setHoverIdx(idx)
      setTooltipX(relX)
    }
  }, [history.length])

  const handleMouseLeave = useCallback(() => setHoverIdx(null), [])

  const hasData = history.length >= 2

  return (
    <div className="border border-white/[0.06] rounded-xl bg-[#111114] overflow-hidden">
      {/* Header with title + legends */}
      <div className="px-5 pt-4 pb-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-medium text-white">{title}</div>
          <div className="text-[10px] text-white/25 font-bold uppercase tracking-widest mt-0.5">{subtitle}</div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
          {series.map(s => (
            <div key={s.key} className="flex items-center gap-1.5 text-[10px] text-white/40">
              <span 
                className="w-2.5 h-2.5 rounded-[2px] shrink-0" 
                style={{ backgroundColor: s.color, opacity: s.dashed ? 0.5 : 1 }} 
              />
              <span className="uppercase font-semibold tracking-wider">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div 
        ref={containerRef} 
        className="relative px-2 pb-2 cursor-crosshair" 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave}
      >
        {!hasData ? (
          <div className="flex items-center justify-center h-44 text-xs text-white/20 font-mono select-none">
            Waiting for metrics data...
          </div>
        ) : (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: 180 }} preserveAspectRatio="none">
            {/* Horizontal grid lines */}
            {ticks.map((tick, i) => (
              <g key={i}>
                <line 
                  x1={PAD.left} y1={toY(tick)} x2={CHART_W - PAD.right} y2={toY(tick)} 
                  stroke="rgba(255,255,255,0.05)" strokeWidth="1" 
                />
                <text 
                  x={PAD.left - 8} y={toY(tick) + 3.5} 
                  fill="rgba(255,255,255,0.2)" fontSize="10" textAnchor="end" fontFamily="monospace"
                >
                  {fmt(tick)}
                </text>
              </g>
            ))}

            {/* Vertical grid lines (faint, at x-label positions) */}
            {xLabelIndices.map(idx => (
              <line 
                key={idx} 
                x1={toX(idx)} y1={PAD.top} x2={toX(idx)} y2={PAD.top + PLOT_H} 
                stroke="rgba(255,255,255,0.03)" strokeWidth="1" 
              />
            ))}

            {/* X-axis labels */}
            {xLabelIndices.map(idx => (
              <text 
                key={idx} 
                x={toX(idx)} y={CHART_H - 6} 
                fill="rgba(255,255,255,0.2)" fontSize="9" textAnchor="middle" fontFamily="monospace"
              >
                {history[idx]?.time || ''}
              </text>
            ))}

            {/* Data area fills */}
            {showArea && series.filter(s => !s.dashed).map(s => (
              <path key={`area-${s.key}`} d={areaPath(s.extract)} fill={s.color} fillOpacity="0.08" />
            ))}

            {/* Data lines */}
            {series.map(s => (
              <path 
                key={s.key} 
                d={linePath(s.extract)} 
                fill="none" 
                stroke={s.color} 
                strokeWidth={s.dashed ? 1.5 : 2} 
                strokeDasharray={s.dashed ? "6,4" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Hover vertical line */}
            {hoverIdx !== null && (
              <line 
                x1={toX(hoverIdx)} y1={PAD.top} x2={toX(hoverIdx)} y2={PAD.top + PLOT_H} 
                stroke="rgba(255,255,255,0.15)" strokeWidth="1" 
              />
            )}

            {/* Hover dots */}
            {hoverIdx !== null && series.map(s => (
              <circle 
                key={s.key} 
                cx={toX(hoverIdx)} 
                cy={toY(s.extract(history[hoverIdx]))} 
                r="4" 
                fill={s.color} 
                stroke="#111114" 
                strokeWidth="2" 
              />
            ))}
          </svg>
        )}

        {/* Tooltip popup */}
        {hoverIdx !== null && hasData && containerRef.current && (
          <div 
            className="absolute z-50 pointer-events-none bg-[#1a1a24] border border-white/[0.1] rounded-xl px-4 py-3 shadow-2xl min-w-[180px]"
            style={{ 
              left: tooltipX > (containerRef.current.clientWidth * 0.6) ? tooltipX - 200 : tooltipX + 16,
              top: 8
            }}
          >
            <div className="text-[11px] text-white/70 font-semibold mb-2.5">
              {new Date(history[hoverIdx].timestamp).toLocaleString([], { 
                month: 'short', day: 'numeric', year: 'numeric', 
                hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true 
              })}
            </div>
            {series.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-6 text-[11px] py-[3px]">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-[2px] rounded shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-white/45">{s.label}:</span>
                </div>
                <span className="text-white font-bold font-mono tabular-nums">
                  {s.key === 'cacheHitRate' 
                    ? s.extract(history[hoverIdx]).toFixed(2) + '%'
                    : s.key === 'dbSizeMb' || s.key === 'allDbsSizeMb'
                    ? s.extract(history[hoverIdx]).toFixed(2)
                    : s.extract(history[hoverIdx]).toFixed(0)
                  }
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Panel Component ─────────────────────────────────

export default function DatabaseMonitoringPanel() {
  const [activeTab, setActiveTab] = useState<'metrics' | 'queries' | 'performance' | 'advisors'>('metrics')
  const [history, setHistory] = useState<MetricPoint[]>([])

  // Sidebar summary
  const [summary, setSummary] = useState({
    dbSizeMb: 0, allDbsSizeMb: 0, maxConnections: 100, currentConnections: 0, cacheHitRate: 0, deadlocks: 0
  })

  // Tab: Active queries
  const [queries, setQueries] = useState<ActiveQuery[]>([])
  const [loadingQueries, setLoadingQueries] = useState(false)

  // Tab: Query performance
  const [performance, setPerformance] = useState<QueryPerformance[]>([])
  const [loadingPerformance, setLoadingPerformance] = useState(false)

  // Tab: Advisors
  const [advisors, setAdvisors] = useState<AdvisorRecommendation[]>([])
  const [loadingAdvisors, setLoadingAdvisors] = useState(false)

  // Polling
  const pollMetrics = useCallback(async () => {
    const res = await getDatabaseMetrics()
    if (res.success) {
      const data = res as any
      const now = Date.now()
      setHistory(prev => {
        const newPoint: MetricPoint = {
          time: new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
          timestamp: now,
          connectionsActive: data.connections.active,
          connectionsIdle: data.connections.idle,
          connectionsTotal: data.connections.total,
          connectionsMax: data.connections.max,
          deadlocks: data.deadlocks,
          rowsInserted: data.rows.inserted,
          rowsUpdated: data.rows.updated,
          rowsDeleted: data.rows.deleted,
          cacheHitRate: data.cacheHitRate,
          dbSizeMb: data.dbSizeMb,
          allDbsSizeMb: data.allDbsSizeMb,
          transactionCommits: data.transactions.commits,
          transactionRollbacks: data.transactions.rollbacks,
        }
        const list = [...prev, newPoint]
        if (list.length > 30) list.shift()
        return list
      })
      setSummary({
        dbSizeMb: data.dbSizeMb,
        allDbsSizeMb: data.allDbsSizeMb,
        maxConnections: data.connections.max,
        currentConnections: data.connections.total,
        cacheHitRate: data.cacheHitRate,
        deadlocks: data.deadlocks,
      })
    }
  }, [])

  useEffect(() => {
    pollMetrics()
    const interval = setInterval(pollMetrics, 5000)
    return () => clearInterval(interval)
  }, [pollMetrics])

  // Tab data fetching
  useEffect(() => {
    if (activeTab === 'queries') fetchQueries()
    else if (activeTab === 'performance') fetchPerformance()
    else if (activeTab === 'advisors') fetchAdvisors()
  }, [activeTab])

  async function fetchQueries() {
    setLoadingQueries(true)
    const res = await getActiveQueries()
    if (res.success) setQueries(res.queries || [])
    else toast(res.error || 'Failed to load active queries.', 'error')
    setLoadingQueries(false)
  }

  async function fetchPerformance() {
    setLoadingPerformance(true)
    const res = await getDatabaseQueryPerformance()
    if (res.success) setPerformance(res.performance || [])
    else toast(res.error || 'Failed to load query performance.', 'error')
    setLoadingPerformance(false)
  }

  async function fetchAdvisors() {
    setLoadingAdvisors(true)
    const res = await getDatabaseAdvisors()
    if (res.success) setAdvisors(res.recommendations || [])
    else toast(res.error || 'Failed to load database advisors.', 'error')
    setLoadingAdvisors(false)
  }

  // ─── Chart series definitions (all real data) ───────────

  const connectionsChartSeries: ChartSeriesConfig[] = [
    { key: 'active', label: 'Active', color: '#3b82f6', extract: p => p.connectionsActive },
    { key: 'idle', label: 'Idle', color: '#38bdf8', extract: p => p.connectionsIdle },
    { key: 'total', label: 'Total', color: '#ffffff', extract: p => p.connectionsTotal },
    { key: 'max', label: 'Max', color: '#f59e0b', extract: p => p.connectionsMax, dashed: true },
  ]

  const rowsChartSeries: ChartSeriesConfig[] = [
    { key: 'inserted', label: 'Inserted', color: '#10b981', extract: p => p.rowsInserted },
    { key: 'updated', label: 'Updated', color: '#3b82f6', extract: p => p.rowsUpdated },
    { key: 'deleted', label: 'Deleted', color: '#f43f5e', extract: p => p.rowsDeleted },
  ]

  const deadlocksChartSeries: ChartSeriesConfig[] = [
    { key: 'deadlocks', label: 'Deadlocks', color: '#f43f5e', extract: p => p.deadlocks },
  ]

  const cacheHitChartSeries: ChartSeriesConfig[] = [
    { key: 'cacheHitRate', label: 'Hit Rate', color: '#818cf8', extract: p => p.cacheHitRate },
  ]

  const dbSizeChartSeries: ChartSeriesConfig[] = [
    { key: 'dbSizeMb', label: 'Primary DB', color: '#10b981', extract: p => p.dbSizeMb },
    { key: 'allDbsSizeMb', label: 'All Databases', color: '#38bdf8', extract: p => p.allDbsSizeMb },
  ]

  const transactionsChartSeries: ChartSeriesConfig[] = [
    { key: 'commits', label: 'Commits', color: '#10b981', extract: p => p.transactionCommits },
    { key: 'rollbacks', label: 'Rollbacks', color: '#f43f5e', extract: p => p.transactionRollbacks },
  ]

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 text-left select-none bg-[#070709] text-white font-sans h-full min-h-0">
      
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.04] pb-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-white">Monitoring</h1>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className="bg-white/[0.04] border border-white/[0.08] text-white/70 px-2 py-0.5 rounded text-[10px] font-mono">
              production
            </span>
            <span>•</span>
            <span>Live PostgreSQL statistics</span>
          </div>
        </div>

        <button 
          onClick={() => {
            pollMetrics()
            if (activeTab === 'queries') fetchQueries()
            if (activeTab === 'performance') fetchPerformance()
            if (activeTab === 'advisors') fetchAdvisors()
          }}
          className="p-1.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-lg text-xs font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          title="Refresh statistics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="space-y-5">
        
        <div className="border-b border-white/[0.06] flex items-center gap-5 shrink-0">
          {(['metrics', 'queries', 'performance', 'advisors'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-2.5 text-xs font-semibold tracking-wider transition-all relative border-b-2 cursor-pointer capitalize",
                activeTab === tab ? "border-accent text-accent" : "border-transparent text-white/40 hover:text-white/70"
              )}
            >
              {tab === 'metrics' ? 'Metrics' 
                : tab === 'queries' ? 'Active queries' 
                : tab === 'performance' ? 'Query performance' 
                : 'Data API Advisors'}
            </button>
          ))}
        </div>

        {/* ==================== TAB: Metrics ==================== */}
        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            
            {/* Sidebar: Database Statistics (real data) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="border border-white/[0.06] rounded-xl bg-[#111114] p-5 space-y-5">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Database Statistics</div>
                <div className="space-y-3.5 text-xs font-mono">
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40 font-sans">Primary DB</span>
                    <span className="text-white font-bold">{summary.dbSizeMb.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40 font-sans">All DBs</span>
                    <span className="text-white font-bold">{summary.allDbsSizeMb.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40 font-sans">Connections</span>
                    <span className="text-white font-bold">{summary.currentConnections} / {summary.maxConnections}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.03] pb-2">
                    <span className="text-white/40 font-sans">Cache Hit</span>
                    <span className="text-white font-bold">{summary.cacheHitRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40 font-sans">Deadlocks</span>
                    <span className={cn("font-bold", summary.deadlocks > 0 ? "text-rose-400" : "text-emerald-400")}>
                      {summary.deadlocks}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts grid (real data only) */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5 pb-8">
              
              <NeonChart 
                title="Postgres connections count" 
                subtitle="COUNT" 
                series={connectionsChartSeries} 
                history={history} 
                showArea
              />

              <NeonChart 
                title="Rows" 
                subtitle="COUNT" 
                series={rowsChartSeries} 
                history={history} 
              />

              <NeonChart 
                title="Deadlocks" 
                subtitle="COUNT" 
                series={deadlocksChartSeries} 
                history={history} 
              />

              <NeonChart 
                title="Local file cache hit rate" 
                subtitle="PERCENTAGE" 
                series={cacheHitChartSeries} 
                history={history} 
                yMaxOverride={100}
                yFormatter={v => v.toFixed(0) + '%'}
                showArea
              />

              <NeonChart 
                title="Database size" 
                subtitle="MEGABYTES" 
                series={dbSizeChartSeries} 
                history={history} 
                yFormatter={v => v.toFixed(1)}
                showArea
              />

              <NeonChart 
                title="Transactions" 
                subtitle="COUNT" 
                series={transactionsChartSeries} 
                history={history} 
              />

            </div>
          </div>
        )}

        {/* ==================== TAB: Active Queries ==================== */}
        {activeTab === 'queries' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-white/45">
              <span>Live queries from pg_stat_activity</span>
              <button 
                onClick={fetchQueries}
                disabled={loadingQueries}
                className="px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", loadingQueries ? "animate-spin" : "")} />
                Refresh queries
              </button>
            </div>

            <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#111114]">
              <table className="w-full border-collapse font-sans text-xs text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold select-none">
                    <th className="px-4 py-3 w-16">PID</th>
                    <th className="px-4 py-3 w-20">User</th>
                    <th className="px-4 py-3 w-24">State</th>
                    <th className="px-4 py-3 w-24">Duration</th>
                    <th className="px-4 py-3">Query</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {loadingQueries ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(5)].map((_, c) => (
                          <td key={c} className="px-4 py-3">
                            <Skeleton className="h-3.5 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : queries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/30 font-sans select-none">
                        No active queries currently running.
                      </td>
                    </tr>
                  ) : (
                    queries.map((q, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-3 text-white/50">{q.pid}</td>
                        <td className="px-4 py-3 text-white/70 font-semibold">{q.user}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded select-none",
                            q.state === 'active' 
                              ? "bg-accent/15 text-accent border border-accent/20" 
                              : "bg-white/[0.03] text-white/40 border border-white/[0.06]"
                          )}>
                            {q.state}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/60">{q.duration}</td>
                        <td className="px-4 py-3 text-white/80 max-w-lg truncate" title={q.query}>
                          {q.query}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB: Query Performance ==================== */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-white/45">
              <span>Query execution frequency and time profiles</span>
              <button 
                onClick={fetchPerformance}
                disabled={loadingPerformance}
                className="px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", loadingPerformance ? "animate-spin" : "")} />
                Refresh list
              </button>
            </div>

            <div className="overflow-x-auto border border-white/[0.06] rounded-xl bg-[#111114]">
              <table className="w-full border-collapse font-sans text-xs text-left">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.01] text-white/40 font-semibold select-none">
                    <th className="px-4 py-3 w-32">Role</th>
                    <th className="px-4 py-3 w-20">Calls</th>
                    <th className="px-4 py-3 w-32">Avg Time</th>
                    <th className="px-4 py-3 w-32">Total Time</th>
                    <th className="px-4 py-3">Query</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] font-mono">
                  {loadingPerformance ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(5)].map((_, c) => (
                          <td key={c} className="px-4 py-3">
                            <Skeleton className="h-3.5 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : performance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-white/30 font-sans select-none">
                        No query metrics recorded yet. Run queries to generate statistics.
                      </td>
                    </tr>
                  ) : (
                    performance.map((p, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-3 text-white/70 font-semibold">{p.role}</td>
                        <td className="px-4 py-3 text-white/85 font-bold">{p.calls}</td>
                        <td className="px-4 py-3 text-amber-400 font-bold">{p.averageTime}</td>
                        <td className="px-4 py-3 text-white/60">{p.totalTime}</td>
                        <td className="px-4 py-3 text-white/80 max-w-xl truncate" title={p.query}>
                          {p.query}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB: Data API Advisors ==================== */}
        {activeTab === 'advisors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-white/45">
              <span>Automatic index & security scanning recommendation engine</span>
              <button 
                onClick={fetchAdvisors}
                disabled={loadingAdvisors}
                className="px-2.5 py-1 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded text-[11px] font-medium text-white/80 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={cn("w-3 h-3", loadingAdvisors ? "animate-spin" : "")} />
                Run scan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
              {loadingAdvisors ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="border border-white/[0.06] rounded-xl bg-[#111114] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))
              ) : advisors.length === 0 ? (
                <div className="col-span-2 border border-white/[0.06] rounded-xl bg-[#111114] p-12 text-center text-emerald-400 space-y-2 select-none">
                  <Check className="w-8 h-8 mx-auto" />
                  <div className="text-sm font-medium text-white">Database Optimization Scan Clean</div>
                  <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
                    All scanned tables have row-level security enabled and key lookup columns are properly indexed!
                  </p>
                </div>
              ) : (
                advisors.map(rec => (
                  <div key={rec.id} className="border border-white/[0.06] rounded-xl bg-[#111114] p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {rec.type === 'security' ? (
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <h4 className="text-xs font-medium text-white leading-tight">
                          {rec.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>

                    {rec.sqlSuggestion && (
                      <div className="space-y-2 pt-3 border-t border-white/[0.03]">
                        <div className="text-[9px] font-bold text-white/30 uppercase font-sans">Recommended SQL query</div>
                        <div className="p-3 bg-black/60 border border-white/[0.04] rounded-lg font-mono text-[10px] text-white/80 select-all overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {rec.sqlSuggestion}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
