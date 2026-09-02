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

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Shield, User, Briefcase, Database, MessageSquare, Zap, Settings, AlertTriangle,
  RefreshCw, Pause, Play, Terminal, Trash2, FileText
} from 'lucide-react'
import { getActivityFeed, purgeAuditLogsAction, getActivityLogLiveStatusAction, setActivityLogLiveStatusAction, type ActivityEvent, type ActivityCategory } from '@/lib/actions/audit-actions'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/components/shared/Toast'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'

type IconType = React.ComponentType<{ className?: string }>
const CATEGORY: Record<ActivityCategory, { label: string; icon: IconType; color: string; dot: string }> = {
  admin: { label: 'ADMIN', icon: Shield, color: 'text-amber-400', dot: 'bg-amber-400' },
  user: { label: 'USER', icon: User, color: 'text-blue-400', dot: 'bg-blue-400' },
  owner: { label: 'OWNER', icon: Briefcase, color: 'text-purple-400', dot: 'bg-purple-400' },
  db: { label: 'DB', icon: Database, color: 'text-emerald-400', dot: 'bg-emerald-400' },
  support: { label: 'SUPPORT', icon: MessageSquare, color: 'text-rose-400', dot: 'bg-rose-400' },
  task: { label: 'TASK', icon: Zap, color: 'text-cyan-400', dot: 'bg-cyan-400' },
  system: { label: 'SYSTEM', icon: Settings, color: 'text-white/60', dot: 'bg-white/50' },
  error: { label: 'ERROR', icon: AlertTriangle, color: 'text-red-400', dot: 'bg-red-400' },
  content: { label: 'CONTENT', icon: FileText, color: 'text-orange-400', dot: 'bg-orange-400' },
}

const FILTERS: { value: ActivityCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Users' },
  { value: 'owner', label: 'Owners' },
  { value: 'db', label: 'Database' },
  { value: 'support', label: 'Support' },
  { value: 'task', label: 'Tasks' },
  { value: 'content', label: 'Content' },
]

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function clockTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return iso
  }
}

interface ActivityFeedPanelProps {
  currentAdmin?: {
    id: string
    name: string
    role: string
  } | null
}

export default function ActivityFeedPanel({ currentAdmin }: ActivityFeedPanelProps) {
  const isSuperAdmin = currentAdmin?.role === 'super_admin'
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [, forceTick] = useState(0) // re-render to refresh relative timestamps
  const [purging, setPurging] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)

  const doPurge = async () => {
    setPurging(true)
    try {
      const res = await purgeAuditLogsAction()
      if (res.success) {
        toast('All administrative activity logs have been successfully purged.', 'success')
        load(true)
      } else {
        toast(res.error || 'Failed to purge logs.', 'error')
      }
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'An error occurred while purging logs.', 'error')
    } finally {
      setPurging(false)
    }
  }

  const handlePurge = () => {
    setConfirmState({
      title: 'Purge All Logs',
      message: 'This permanently deletes every activity log entry and cannot be undone. Continue?',
      confirmLabel: 'Purge Logs',
      tone: 'danger',
      onConfirm: doPurge,
    })
  }

  const toggleLive = async () => {
    if (!isSuperAdmin) {
      toast('Only Super Admins can pause or resume the global activity feed.', 'error')
      return
    }
    const newLive = !live
    setLive(newLive)
    try {
      const res = await setActivityLogLiveStatusAction(newLive)
      if (res.success) {
        toast(`Global activity feed successfully ${newLive ? 'resumed' : 'paused'}.`, 'success')
      } else {
        toast(res.error || 'Failed to update global live status.', 'error')
        setLive(!newLive)
      }
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'An error occurred.', 'error')
      setLive(!newLive)
    }
  }

  const filterRef = useRef(filter)
  filterRef.current = filter

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    const res = await getActivityFeed({ category: filterRef.current, limit: 200 })
    if (res.success) {
      setEvents(res.events)
      setLastUpdated(new Date())
    }
    setLoading(false)
  }, [])

  // (Re)load on filter change
  useEffect(() => {
    load(true)
  }, [filter, load])

  // Sync initial live status
  useEffect(() => {
    async function initLiveStatus() {
      const res = await getActivityLogLiveStatusAction()
      if (res.success && res.live !== undefined) {
        setLive(res.live)
      }
    }
    initLiveStatus()
  }, [])

  // Live polling (every 5 seconds, verifying global status)
  useEffect(() => {
    let active = true
    const checkAndLoad = async () => {
      const statusRes = await getActivityLogLiveStatusAction()
      if (!active) return

      if (statusRes.success && statusRes.live !== undefined) {
        setLive(statusRes.live)
        if (statusRes.live) {
          await load(false)
        }
      } else {
        if (live) {
          await load(false)
        }
      }
    }

    if (!live) return

    const id = setInterval(checkAndLoad, 5000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [live, load])

  // Tick every 15s so "2m ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 15000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      {/* Header */}
      <div className="shrink-0 space-y-4 pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-medium text-white">Activity</h2>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              Live audit trail of admin actions and platform events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLive}
              disabled={!isSuperAdmin}
              className={cn(
                'h-8 px-3 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                live
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-white/[0.02] border-white/[0.08] text-white/50 hover:text-white'
              )}
              title={isSuperAdmin ? "Toggle global live/paused state" : "Only Super Admins can configure global live status"}
            >
              {live ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {live ? 'Live' : 'Paused'}
              {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            </button>
            <button
              onClick={() => load(true)}
              className="h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
            {isSuperAdmin && (
              <button
                onClick={handlePurge}
                disabled={purging}
                className="h-8 px-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Purge all logs from the database"
              >
                <Trash2 className={cn('w-3.5 h-3.5', purging && 'animate-spin')} />
                <span>Purge Logs</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'h-7 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer border',
                filter === f.value
                  ? 'bg-accent/15 border-accent/30 text-accent'
                  : 'bg-white/[0.02] border-white/[0.06] text-white/45 hover:text-white hover:border-white/12'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal log */}
      <div className="flex-grow min-h-0 rounded-xl border border-white/[0.06] bg-[#060608] overflow-hidden flex flex-col">
        <div className="shrink-0 h-9 px-4 flex items-center justify-between border-b border-white/[0.05] bg-white/[0.01]">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">forke://activity.log</span>
          </div>
          <span className="text-[10px] font-mono text-white/30">
            {events.length} events{lastUpdated ? ` · synced ${clockTime(lastUpdated.toISOString())}` : ''}
          </span>
        </div>

        <div className="flex-grow min-h-0 overflow-y-auto px-1 py-1 font-mono text-[11px] leading-tight">
          {loading && events.length === 0 ? (
            <div className="p-2 space-y-1">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1">
                  <Skeleton className="h-2.5 w-16 shrink-0" />
                  <Skeleton className="h-2.5 w-16 shrink-0" />
                  <Skeleton className="h-2.5 flex-grow" style={{ maxWidth: `${50 + ((i * 7) % 40)}%` }} />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/25 text-xs font-mono">No activity in this view yet.</div>
          ) : (
            <div className="divide-y divide-white/[0.02]">
              {events.map((e) => {
                const c = CATEGORY[e.category] ?? CATEGORY.system
                const Icon = c.icon
                return (
                  <div
                    key={e.id}
                    className="flex items-center gap-2.5 px-2.5 py-1 hover:bg-white/[0.025] transition-colors rounded group text-[11px] leading-normal"
                  >
                    {/* Timestamp */}
                    <span
                      className="text-white/30 shrink-0 tabular-nums w-[74px] select-none text-[10.5px]"
                      title={new Date(e.createdAt).toLocaleString()}
                    >
                      {clockTime(e.createdAt)}
                    </span>

                    {/* Compact Category Tag */}
                    <span
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-[9.5px] font-bold tracking-wider uppercase select-none',
                        c.color
                      )}
                    >
                      <Icon className="w-2.5 h-2.5 shrink-0" />
                      <span>{c.label}</span>
                    </span>

                    {/* Action Name */}
                    <span className={cn('shrink-0 font-medium', c.color)}>
                      {e.action}
                    </span>

                    {/* Actor */}
                    {e.actor && (
                      <span className="text-white/35 shrink-0 select-none">
                        · {e.actor}
                      </span>
                    )}

                    {/* Target / Details */}
                    {e.target && (
                      <span className="text-white/60 truncate min-w-0">
                        <span className="text-white/20 select-none">→ </span>
                        {e.target}
                      </span>
                    )}

                    {/* Relative Time on right */}
                    <span className="ml-auto shrink-0 text-white/25 text-[10px] tabular-nums pl-2 select-none group-hover:text-white/40 transition-colors">
                      {relativeTime(e.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
