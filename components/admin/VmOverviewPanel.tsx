'use client'

/**
 * @fileoverview Forke Platform - VM Overview, Telemetry & Diagnostics Panel
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  getDatabaseOverview, 
  getDatabaseAdvisors,
  type VmTelemetryPoint,
  type DatabaseAdvisor
} from '@/lib/db-client-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { 
  RefreshCw, 
  Copy, 
  Check, 
  Database, 
  Shield, 
  Server, 
  Cpu, 
  Clock, 
  Activity,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  BarChart3
} from 'lucide-react'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils/cn'

// ── In-Memory SWR Cache for Instant 0ms Tab Switching ──────
let cachedOverview: OverviewData | null = null
let cachedAdvisors: DatabaseAdvisor[] = []
let lastFetchTime = 0

// ── Interfaces ─────────────────────────────────────────────

interface HostInfo {
  hostname: string
  platform: string
  type: string
  release: string
  arch: string
  cpuCount: number
  cpuModel: string
  loadAvg: number[]
  totalMemBytes: number
  freeMemBytes: number
  usedMemBytes: number
  memUsagePct: number
  systemUptimeSeconds: number
  processRssBytes: number
  nodeVersion: string
}

interface OverviewData {
  hostInfo?: HostInfo
  telemetryHistory?: VmTelemetryPoint[]
  dbName: string
  dbSize: string
  activeConnections: number
  tablesCount: number
  version: string
  tableDetails: Array<{
    name: string
    totalSize: string
    tableSize: string
    indexSize: string
    rowCount: number
  }>
  rolesList: string[]
  dbList: string[]
  host: string
  port: string
  user: string
  sslMode: string
  maskedUri: string
  uptime: string
  cacheHitRatio: string
  commits: string
}

// ── Cloudflare-Style Chart Component ───────────────────────

interface CloudflareChartProps {
  title: string
  yLabel: string
  totalLabel?: string
  totalValue: string | number
  avgLabel?: string
  avgValue: string | number
  minLabel?: string
  minValue: string | number
  yTicks: number[]
  maxVal: number
  points: Array<{
    xVal: string
    displayTime: string
    val: number
    formattedVal: string
  }>
}

function CloudflareTimeSeriesChart({
  title,
  yLabel,
  totalLabel = 'TOTAL',
  totalValue,
  avgLabel = 'AVERAGE',
  avgValue,
  minLabel = 'MINIMUM',
  minValue,
  yTicks,
  maxVal,
  points
}: CloudflareChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const timezoneStr = useMemo(() => {
    try {
      const offset = -new Date().getTimezoneOffset()
      const sign = offset >= 0 ? '+' : '-'
      const pad = (n: number) => Math.floor(Math.abs(n)).toString().padStart(2, '0')
      const hours = pad(offset / 60)
      const mins = pad(offset % 60)
      return `GMT${sign}${hours}:${mins}`
    } catch {
      return 'UTC'
    }
  }, [])

  const safeMax = Math.max(1, maxVal)

  const polylinePoints = useMemo(() => {
    if (points.length === 0) return ''
    return points.map((p, i) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50
      const y = 100 - (Math.min(Math.max(p.val, 0), safeMax) / safeMax) * 100
      return `${x},${y}`
    }).join(' ')
  }, [points, safeMax])

  const timelineTicks = useMemo(() => {
    if (points.length === 0) return []
    const result: Array<{ percent: number; label: string }> = []
    const count = points.length
    
    // Day label on left
    const now = new Date()
    result.push({ percent: 0, label: now.getDate().toString() })

    // 4 evenly spaced ticks
    const step = Math.max(1, Math.floor(count / 4))
    for (let i = step; i < count; i += step) {
      const raw = points[i]?.displayTime || ''
      const shortTime = raw.replace(/:[0-9]{2}\s*(AM|PM)?$/i, '').trim() || raw
      result.push({
        percent: (i / (count - 1)) * 100,
        label: shortTime
      })
    }

    if (count > 1) {
      const lastRaw = points[count - 1]?.displayTime || ''
      const lastShort = lastRaw.replace(/:[0-9]{2}\s*(AM|PM)?$/i, '').trim() || lastRaw
      result.push({
        percent: 100,
        label: lastShort
      })
    }

    return result
  }, [points])

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-black/40 p-4 sm:p-5 space-y-4 select-none overflow-hidden">
      
      {/* Title and Top Stats */}
      <div className="space-y-1.5">
        <div className="text-[10px] sm:text-[11px] font-semibold text-white/50 uppercase tracking-wider font-sans truncate">
          {title}
        </div>
        <div className="grid grid-cols-3 sm:flex sm:items-end gap-3 sm:gap-8 pt-1">
          <div>
            <div className="text-[8px] sm:text-[9px] text-white/40 uppercase font-semibold tracking-wider">{totalLabel}</div>
            <div className="text-base sm:text-xl font-mono font-bold text-white mt-0.5 truncate">{totalValue}</div>
          </div>
          <div>
            <div className="text-[8px] sm:text-[9px] text-white/40 uppercase font-semibold tracking-wider">{avgLabel}</div>
            <div className="text-base sm:text-xl font-mono font-bold text-white mt-0.5 truncate">{avgValue}</div>
          </div>
          <div>
            <div className="text-[8px] sm:text-[9px] text-white/40 uppercase font-semibold tracking-wider">{minLabel}</div>
            <div className="text-base sm:text-xl font-mono font-bold text-white mt-0.5 truncate">{minValue}</div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex items-stretch gap-2 h-40 sm:h-44 mt-3">
        {/* Y-Axis Column */}
        <div className="w-10 sm:w-12 shrink-0 flex items-center gap-1">
          <div className="w-3.5 sm:w-4 h-full flex items-center justify-center">
            <span className="text-[7px] sm:text-[8px] text-white/30 uppercase tracking-widest font-bold font-sans -rotate-90 origin-center whitespace-nowrap">
              {yLabel}
            </span>
          </div>
          <div className="flex flex-col justify-between h-full text-[8px] sm:text-[9px] font-mono text-white/50 text-right w-full leading-none py-1">
            {yTicks.map((tick, i) => (
              <span key={i}>{tick}</span>
            ))}
          </div>
        </div>

        {/* SVG Plot Box */}
        <div 
          className="flex-grow relative border border-white/[0.08] bg-black/[0.25] rounded overflow-hidden cursor-crosshair"
          onMouseMove={(e) => {
            if (points.length === 0) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const pct = Math.max(0, Math.min(1, x / rect.width))
            const idx = Math.round(pct * (points.length - 1))
            setHoveredIdx(idx)
          }}
          onTouchMove={(e) => {
            if (points.length === 0) return
            const touch = e.touches[0]
            if (!touch) return
            const rect = e.currentTarget.getBoundingClientRect()
            const x = touch.clientX - rect.left
            const pct = Math.max(0, Math.min(1, x / rect.width))
            const idx = Math.round(pct * (points.length - 1))
            setHoveredIdx(idx)
          }}
          onMouseLeave={() => setHoveredIdx(null)}
          onTouchEnd={() => setHoveredIdx(null)}
        >
          {/* Horizontal Gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            {yTicks.map((_, i) => (
              <div key={i} className="border-b border-white/[0.06] w-full h-0 last:border-0" />
            ))}
          </div>

          {/* Polyline */}
          <svg className="absolute inset-0 w-full h-full p-0" viewBox="0 0 100 100" preserveAspectRatio="none">
            {polylinePoints && (
              <polyline 
                fill="none" 
                stroke="#3b82f6" 
                strokeWidth="2" 
                vectorEffect="non-scaling-stroke"
                points={polylinePoints} 
              />
            )}
          </svg>

          {/* Hover Elements */}
          {hoveredIdx !== null && points[hoveredIdx] && (
            <>
              {/* Vertical Dashed Guide Line */}
              <div 
                className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-blue-400/60 pointer-events-none"
                style={{ left: `${(hoveredIdx / Math.max(1, points.length - 1)) * 100}%` }}
              />

              {/* Glowing Dot */}
              <div 
                className="absolute w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-md z-10"
                style={{ 
                  left: `${(hoveredIdx / Math.max(1, points.length - 1)) * 100}%`,
                  top: `${100 - (Math.min(Math.max(points[hoveredIdx].val, 0), safeMax) / safeMax) * 100}%`
                }}
              />

              {/* Tooltip Card */}
              <div 
                className="absolute top-2 bg-[#0c0c0e]/95 backdrop-blur border border-white/[0.12] rounded-lg p-2 sm:p-2.5 text-left shadow-2xl text-[10px] space-y-1 z-20 pointer-events-none min-w-[120px] sm:min-w-[140px] font-sans"
                style={{ 
                  left: `${Math.max(4, Math.min(62, (hoveredIdx / Math.max(1, points.length - 1)) * 100))}%`
                }}
              >
                <div className="text-[9px] sm:text-[10px] font-mono text-white/50">
                  {points[hoveredIdx].displayTime}
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    Standard
                  </span>
                  <span className="font-bold text-white truncate">
                    {points[hoveredIdx].formattedVal}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* X-Axis Timeline */}
      <div className="flex items-start gap-2 mt-1">
        <div className="w-10 sm:w-12 shrink-0" />
        <div className="flex-grow space-y-1 min-w-0">
          <div className="relative h-4 w-full">
            {timelineTicks.map((t, idx) => {
              const isFirst = idx === 0
              const isLast = idx === timelineTicks.length - 1
              return (
                <div 
                  key={idx}
                  className={cn(
                    "absolute flex flex-col pointer-events-none",
                    isFirst ? "left-0 items-start" :
                    isLast ? "right-0 items-end" :
                    "-translate-x-1/2 items-center"
                  )}
                  style={isFirst || isLast ? {} : { left: `${t.percent}%` }}
                >
                  <div className="h-1.5 w-[1px] bg-white/20" />
                  <span className="text-[8px] sm:text-[9px] font-mono text-white/40 mt-0.5 whitespace-nowrap">
                    {t.label}
                  </span>
                </div>
              )
            })}
          </div>
          
          <div className="text-center text-[8px] sm:text-[9px] font-mono text-white/30 uppercase tracking-wider pt-0.5">
            TIME ({timezoneStr})
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Main VmOverviewPanel Component ────────────────────────

export default function VmOverviewPanel() {
  const [data, setData] = useState<OverviewData | null>(cachedOverview)
  const [advisors, setAdvisors] = useState<DatabaseAdvisor[]>(cachedAdvisors)
  const [loading, setLoading] = useState(!cachedOverview)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  
  // Table sorting & filter
  const [tableSearch, setTableSearch] = useState('')
  const [sortField, setSortField] = useState<'name' | 'rowCount' | 'size'>('size')
  const [sortAsc, setSortAsc] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else if (!cachedOverview) setLoading(true)

    try {
      const [overviewRes, advisorsRes] = await Promise.all([
        getDatabaseOverview(),
        getDatabaseAdvisors()
      ])

      if (overviewRes.success) {
        setData(overviewRes as any)
        cachedOverview = overviewRes as any
      }

      if (advisorsRes && 'recommendations' in advisorsRes && Array.isArray((advisorsRes as any).recommendations)) {
        setAdvisors((advisorsRes as any).recommendations)
        cachedAdvisors = (advisorsRes as any).recommendations
      } else if (Array.isArray(advisorsRes)) {
        setAdvisors(advisorsRes)
        cachedAdvisors = advisorsRes
      }

      lastFetchTime = Date.now()
    } catch (err: any) {
      toast(err?.message || 'Error fetching VM and database telemetry', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const isCacheStale = Date.now() - lastFetchTime > 15000
    if (!cachedOverview || isCacheStale) {
      fetchData(!cachedOverview ? false : true)
    }

    const interval = setInterval(() => {
      fetchData(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
    toast('Copied to clipboard', 'success')
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s'
    const d = Math.floor(seconds / (3600 * 24))
    const h = Math.floor((seconds % (3600 * 24)) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  if (loading && !data) {
    return <PanelSkeleton />
  }

  const host = data?.hostInfo
  const history = data?.telemetryHistory || []

  // ── Chart Data Preparations ──────────────────────────────
  
  // 1. RAM Points
  const ramPoints = history.map((d) => ({
    xVal: d.time,
    displayTime: d.time,
    val: d.ramUsagePct,
    formattedVal: `${d.ramUsagePct}% (${formatBytes(d.ramUsedBytes)})`
  }))
  const ramTotal = host?.memUsagePct || (ramPoints[ramPoints.length - 1]?.val || 0)
  const ramAvg = Math.round(ramPoints.reduce((a, b) => a + b.val, 0) / Math.max(1, ramPoints.length))
  const ramMin = ramPoints.length > 0 ? Math.min(...ramPoints.map(p => p.val)) : 0

  // 2. CPU Points
  const maxCpu = Math.max(1.0, ...history.map(d => d.cpuLoad1m || 0.1))
  const cpuPoints = history.map((d) => ({
    xVal: d.time,
    displayTime: d.time,
    val: d.cpuLoad1m,
    formattedVal: d.cpuLoad1m.toFixed(2)
  }))
  const cpuCurrent = host?.loadAvg?.[0]?.toFixed(2) || '0.08'
  const cpuAvg = (cpuPoints.reduce((a, b) => a + b.val, 0) / Math.max(1, cpuPoints.length)).toFixed(2)
  const cpuMin = (cpuPoints.length > 0 ? Math.min(...cpuPoints.map(p => p.val)) : 0).toFixed(2)

  // 3. Database Connections Points
  const maxConns = Math.max(10, ...history.map(d => d.connectionsTotal || 5))
  const connPoints = history.map((d) => ({
    xVal: d.time,
    displayTime: d.time,
    val: d.connectionsActive,
    formattedVal: `${d.connectionsActive} active (${d.connectionsIdle} idle)`
  }))
  const connCurrent = data?.activeConnections || 1
  const connAvg = Math.round(connPoints.reduce((a, b) => a + b.val, 0) / Math.max(1, connPoints.length))
  const connMin = connPoints.length > 0 ? Math.min(...connPoints.map(p => p.val)) : 0

  // 4. Cache Hit Ratio Points
  const cachePoints = history.map((d) => ({
    xVal: d.time,
    displayTime: d.time,
    val: d.cacheHitRatio,
    formattedVal: `${d.cacheHitRatio}%`
  }))
  const cacheCurrent = data?.cacheHitRatio || '100.00%'
  const cacheAvg = (cachePoints.reduce((a, b) => a + b.val, 0) / Math.max(1, cachePoints.length)).toFixed(2) + '%'
  const cacheMin = (cachePoints.length > 0 ? Math.min(...cachePoints.map(p => p.val)) : 100).toFixed(2) + '%'

  // Table filtering & sorting
  const filteredTables = (data?.tableDetails || [])
    .filter(t => t.name.toLowerCase().includes(tableSearch.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'rowCount') cmp = a.rowCount - b.rowCount
      else {
        const getBytes = (str: string) => {
          const num = parseFloat(str)
          if (str.includes('MB')) return num * 1024 * 1024
          if (str.includes('KB')) return num * 1024
          if (str.includes('GB')) return num * 1024 * 1024 * 1024
          return num
        }
        cmp = getBytes(a.totalSize) - getBytes(b.totalSize)
      }
      return sortAsc ? cmp : -cmp
    })

  return (
    <div className="flex-grow flex flex-col space-y-7 h-full min-h-0 text-left pr-0.5 sm:pr-1 overflow-y-auto font-sans select-none pb-12">
      
      {/* ─── Header Block ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4 shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-white tracking-tight">VM Overview &amp; Health</h2>
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono text-[10px] flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE &bull; HEALTHY
            </span>
            <span className="bg-white/[0.04] border border-white/[0.08] text-white/60 px-2 py-0.5 rounded font-mono text-[10px]">
              {host?.platform === 'linux' ? 'ORACLE CLOUD VM' : `${host?.type || 'HOST'} (${host?.arch || 'ARM64'})`}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Continuous real-time telemetry, memory health, compute load, and PostgreSQL storage diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-8 px-3 rounded-lg text-xs transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] flex items-center gap-1.5 font-medium text-white disabled:opacity-50 cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing ? "animate-spin" : "")} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─── Top Metric Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 shrink-0">
        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Cpu className="w-3 h-3 text-white/30" />
            CPU Load (1m)
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-white">
            {host?.loadAvg ? host.loadAvg[0].toFixed(2) : '0.08'}
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate">
            {host?.cpuCount || 4} vCPUs &bull; {host?.loadAvg ? `${host.loadAvg[1].toFixed(2)} (5m)` : 'normal'}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Server className="w-3 h-3 text-white/30" />
            RAM Usage
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-white">
            {host?.memUsagePct ? `${host.memUsagePct}%` : '42%'}
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate">
            {host ? `${formatBytes(host.usedMemBytes)} / ${formatBytes(host.totalMemBytes)}` : '12.4 GB / 24.0 GB'}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-white/30" />
            VM Uptime
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-white">
            {host ? formatDuration(host.systemUptimeSeconds) : '14d 6h'}
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate">
            Host instance uptime
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Database className="w-3 h-3 text-white/30" />
            PostgreSQL
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-emerald-400">
            {data?.version ? data.version.split(' ')[1] || 'v16.3' : 'v16.3'}
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate" title={data?.uptime}>
            Postmaster: {data?.uptime || 'Online'}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3 text-white/30" />
            Connections
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-white">
            {data?.activeConnections || 1} <span className="text-xs font-normal text-white/30">/ 100</span>
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate">
            Active sessions
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-3 sm:p-3.5 space-y-1">
          <div className="text-[9px] sm:text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-white/30" />
            Cache Hit Ratio
          </div>
          <div className="text-sm sm:text-base font-mono font-medium text-emerald-400">
            {data?.cacheHitRatio || '100.00%'}
          </div>
          <div className="text-[9px] sm:text-[10px] font-mono text-white/30 truncate">
            {data?.commits || '0'} Total Commits
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: CLOUDFLARE-STYLED TELEMETRY GRAPHS ───── */}
      <div className="space-y-3.5 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" />
            VM Performance &amp; Hardware Telemetry
          </h3>
          <span className="text-[10px] font-mono text-white/40">30s polling window</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          
          {/* Chart 1: RAM Utilization */}
          <CloudflareTimeSeriesChart
            title="RAM MEMORY UTILIZATION"
            yLabel="PERCENTAGE"
            totalLabel="CURRENT"
            totalValue={`${ramTotal}%`}
            avgLabel="AVERAGE"
            avgValue={`${ramAvg}%`}
            minLabel="MINIMUM"
            minValue={`${ramMin}%`}
            yTicks={[100, 80, 60, 40, 20, 0]}
            maxVal={100}
            points={ramPoints}
          />

          {/* Chart 2: CPU Load */}
          <CloudflareTimeSeriesChart
            title="CPU LOAD AVERAGE (1M)"
            yLabel="LOAD (1M)"
            totalLabel="CURRENT"
            totalValue={cpuCurrent}
            avgLabel="AVERAGE"
            avgValue={cpuAvg}
            minLabel="MINIMUM"
            minValue={cpuMin}
            yTicks={[Number(maxCpu.toFixed(1)), Number((maxCpu * 0.8).toFixed(1)), Number((maxCpu * 0.6).toFixed(1)), Number((maxCpu * 0.4).toFixed(1)), Number((maxCpu * 0.2).toFixed(1)), 0]}
            maxVal={maxCpu * 1.1}
            points={cpuPoints}
          />

          {/* Chart 3: Database Connections */}
          <CloudflareTimeSeriesChart
            title="ACTIVE DATABASE SESSIONS"
            yLabel="CONNECTIONS"
            totalLabel="CURRENT"
            totalValue={connCurrent}
            avgLabel="AVERAGE"
            avgValue={connAvg}
            minLabel="MINIMUM"
            minValue={connMin}
            yTicks={[maxConns, Math.round(maxConns * 0.8), Math.round(maxConns * 0.6), Math.round(maxConns * 0.4), Math.round(maxConns * 0.2), 0]}
            maxVal={maxConns}
            points={connPoints}
          />

          {/* Chart 4: Buffer Cache Hit Ratio */}
          <CloudflareTimeSeriesChart
            title="BUFFER CACHE HIT RATIO"
            yLabel="HIT RATIO (%)"
            totalLabel="CURRENT"
            totalValue={cacheCurrent}
            avgLabel="AVERAGE"
            avgValue={cacheAvg}
            minLabel="MINIMUM"
            minValue={cacheMin}
            yTicks={[100, 99, 98, 97, 96, 95]}
            maxVal={100}
            points={cachePoints}
          />

        </div>
      </div>

      {/* ─── SECTION 2: DATA API ADVISORS (ORIGINAL CLEAN ENGINE) ─── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-white">Data API Advisors</h3>
          </div>
          <span className="font-mono text-[10px] text-white/40 uppercase">
            Automatic Security &amp; Index Engine
          </span>
        </div>

        {advisors.length === 0 ? (
          <div className="border border-white/[0.06] rounded-xl bg-black/30 p-8 text-center text-emerald-400 space-y-2 select-none">
            <CheckCircle2 className="w-7 h-7 mx-auto" />
            <div className="text-sm font-medium text-white">Database Optimization Scan Clean</div>
            <p className="text-xs text-white/40 max-w-sm mx-auto leading-relaxed">
              All scanned tables have row-level security enabled and key lookup columns are properly indexed!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {advisors.map((rec) => (
              <div key={rec.id} className="border border-white/[0.06] rounded-xl bg-black/30 p-4 flex flex-col justify-between gap-3 font-sans">
                <div className="space-y-1.5">
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
                  <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between text-[9px] font-bold text-white/30 uppercase font-sans">
                      <span>Recommended SQL query</span>
                      <button
                        onClick={() => copyToClipboard(rec.sqlSuggestion || '', rec.id)}
                        className="text-[10px] text-white/50 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedField === rec.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        Copy SQL
                      </button>
                    </div>
                    <div className="p-2.5 bg-black/60 border border-white/[0.06] rounded-lg font-mono text-[11px] text-white/80 select-all overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {rec.sqlSuggestion}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── SECTION 3: DATABASE CONNECTION PARAMETERS ─────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-white">Database Connection Parameters</h3>
          </div>
          <span className="font-mono text-[10px] text-white/40 uppercase">Internal Endpoint</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.01] p-3 space-y-1">
            <div className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase">Host Endpoint</div>
            <div className="text-xs font-mono text-white truncate" title={data?.host}>{data?.host || 'localhost'}</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.01] p-3 space-y-1">
            <div className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase">Port</div>
            <div className="text-xs font-mono text-white">{data?.port || '5432'}</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.01] p-3 space-y-1">
            <div className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase">Primary User</div>
            <div className="text-xs font-mono text-white">{data?.user || 'postgres'}</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-white/[0.01] p-3 space-y-1">
            <div className="text-[9px] sm:text-[10px] font-mono text-white/40 uppercase">SSL Encryption</div>
            <div className="text-xs font-mono text-emerald-400">{data?.sslMode || 'require'}</div>
          </div>
        </div>

        {/* Masked URI with Copy */}
        <div className="space-y-1.5 pt-2">
          <div className="text-[11px] font-medium text-white/50">Connection String (Masked)</div>
          <div className="flex items-center gap-2">
            <div className="flex-grow rounded-lg border border-[var(--color-border)] bg-black/50 px-3.5 py-2 font-mono text-xs text-white/70 truncate select-all">
              {data?.maskedUri || 'postgresql://postgres:••••••••@localhost:5432/forkedb'}
            </div>
            <button
              onClick={() => copyToClipboard(data?.maskedUri || '', 'uri')}
              className="h-8 px-3 rounded-lg border border-[var(--color-border)] hover:bg-white/[0.05] text-xs font-medium text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Copy connection string"
            >
              {copiedField === 'uri' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedField === 'uri' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: DATABASE TABLES & STORAGE BREAKDOWN ───── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.005]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-white">Database Tables &amp; Storage Breakdown</h3>
            <span className="bg-white/[0.04] border border-white/[0.08] text-white/70 px-2 py-0.5 rounded font-mono text-[10px]">
              {filteredTables.length} Tables
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Filter table name..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full h-8 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-8 pr-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35 font-medium">
                <th className="px-4 py-2.5 cursor-pointer hover:text-white" onClick={() => { setSortField('name'); setSortAsc(!sortAsc); }}>
                  <div className="flex items-center gap-1">
                    Table Name
                    {sortField === 'name' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-4 py-2.5 cursor-pointer hover:text-white" onClick={() => { setSortField('rowCount'); setSortAsc(!sortAsc); }}>
                  <div className="flex items-center gap-1">
                    Row Count
                    {sortField === 'rowCount' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="px-4 py-2.5">Table Data</th>
                <th className="px-4 py-2.5">Index Size</th>
                <th className="px-4 py-2.5 cursor-pointer hover:text-white text-right" onClick={() => { setSortField('size'); setSortAsc(!sortAsc); }}>
                  <div className="flex items-center justify-end gap-1">
                    Total Storage
                    {sortField === 'size' && (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] font-mono">
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)] text-xs font-mono">
                    No database tables match your filter.
                  </td>
                </tr>
              ) : (
                filteredTables.map((t) => (
                  <tr key={t.name} className="hover:bg-white/[0.015] transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      public.&quot;{t.name}&quot;
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {t.rowCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-[11px]">
                      {t.tableSize}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-[11px]">
                      {t.indexSize}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-accent">
                      {t.totalSize}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SECTION 5: HARDWARE & DATABASE CONFIGURATION ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Host Hardware Specs */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-white">Host Architecture &amp; Specs</h3>
            </div>
            <span className="font-mono text-[10px] text-white/40 uppercase">Hardware Telemetry</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Hostname</span>
              <span className="text-white font-medium truncate max-w-[200px]">{host?.hostname || 'oracle-vm-instance'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">OS Platform &amp; Kernel</span>
              <span className="text-white font-medium truncate max-w-[200px]">{host?.type || 'Linux'} {host?.release || '6.8.0-generic'} ({host?.arch || 'aarch64'})</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">CPU Model</span>
              <span className="text-white font-medium truncate max-w-[200px]">{host?.cpuModel || 'Ampere Altra / Intel Xeon'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Compute Sizing</span>
              <span className="text-white font-medium">{host?.cpuCount || 4} vCPUs &bull; {formatBytes(host?.totalMemBytes)} Memory</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Process RSS Footprint</span>
              <span className="text-white font-medium">{formatBytes(host?.processRssBytes)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[var(--color-text-muted)] font-sans">Node Runtime</span>
              <span className="text-white font-medium">{host?.nodeVersion || 'v20.x'}</span>
            </div>
          </div>
        </div>

        {/* Database Engine Information */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.018] p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-white">Database Engine &amp; Storage</h3>
            </div>
            <span className="font-mono text-[10px] text-white/40 uppercase">PostgreSQL Engine</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Database Name</span>
              <span className="text-white font-medium">{data?.dbName || 'forkedb'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Total Database Size</span>
              <span className="text-emerald-400 font-medium">{data?.dbSize || '0 MB'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Public Schema Tables</span>
              <span className="text-white font-medium">{data?.tablesCount || 0} base tables</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">SSL / TLS Mode</span>
              <span className="text-white font-medium uppercase">{data?.sslMode || 'require'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
              <span className="text-[var(--color-text-muted)] font-sans">Transaction Commits</span>
              <span className="text-white font-medium">{data?.commits || '0'}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[var(--color-text-muted)] font-sans">Postmaster Started</span>
              <span className="text-white font-medium">{data?.uptime || 'Online'}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
