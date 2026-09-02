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

import React, { useState, useEffect } from 'react'
import {
  getBackupRuns,
  getBackupStats,
  triggerManualBackupAction,
  getBackupDownloadUrl,
  type BackupRun,
} from '@/lib/actions/backup-actions'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Archive,
  Shield,
  Play,
  Download,
  Loader2,
} from 'lucide-react'
import { toast } from '@/components/shared/Toast'

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Never'
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch {
    return iso
  }
}

const TIER_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  on_demand: 'On-Demand',
}

export default function BackupsPanel() {
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [stats, setStats] = useState<{
    lastSuccess?: string | null
    lastRun?: string | null
    successCount?: number
    failureCount?: number
  }>({})
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [runsRes, statsRes] = await Promise.all([getBackupRuns(), getBackupStats()])
    if (runsRes.success) {
      setRuns(runsRes.runs || [])
    } else {
      toast(runsRes.error || 'Failed to load backup history.', 'error')
    }
    if (statsRes.success) {
      setStats(statsRes)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleManualBackup() {
    if (triggering) return
    setTriggering(true)
    try {
      const res = await triggerManualBackupAction()
      if (res.success) {
        toast('Database backup generated and uploaded to R2 successfully.', 'success')
        await loadData()
      } else {
        toast(res.error || 'Failed to generate backup.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Failed to trigger backup.', 'error')
    } finally {
      setTriggering(false)
    }
  }

  async function handleDownload(r2Key: string) {
    if (downloadingKey) return
    setDownloadingKey(r2Key)
    try {
      const res = await getBackupDownloadUrl(r2Key)
      if (res.success && res.url) {
        window.open(res.url, '_blank')
      } else {
        toast(res.error || 'Failed to get download URL', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Failed to download backup', 'error')
    } finally {
      setDownloadingKey(null)
    }
  }

  if (loading) {
    return <PanelSkeleton />
  }

  const lastSuccessStale =
    stats.lastSuccess && Date.now() - new Date(stats.lastSuccess).getTime() > 2 * 24 * 60 * 60 * 1000

  return (
    <div className="flex-grow flex flex-col space-y-4 overflow-hidden h-full min-h-0 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-1">
        <div>
          <h2 className="text-base font-medium text-white">Database Backups</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Automated backups with multi-tier retention stored securely offsite on Cloudflare R2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualBackup}
            disabled={triggering}
            className="h-8 px-3 rounded-lg text-xs transition-all bg-accent text-black hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium shadow-[0_0_15px_rgba(255,122,0,0.15)] select-none"
          >
            {triggering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Backing up...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Backup Now
              </>
            )}
          </button>
          <button
            onClick={loadData}
            disabled={loading || triggering}
            className="h-8 px-3 rounded-lg text-xs transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] flex items-center gap-1.5 font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          className={`rounded-xl bg-white/[0.018] border p-4 space-y-2 ${
            lastSuccessStale ? 'border-red-500/30' : 'border-[var(--color-border)]'
          }`}
        >
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Last Successful</span>
            <CheckCircle2 className={`w-3.5 h-3.5 ${lastSuccessStale ? 'text-red-400' : 'text-emerald-400'}`} />
          </div>
          <div className="text-sm font-mono font-medium text-white">
            {formatLocalDateTime(stats.lastSuccess ?? null)}
          </div>
          {lastSuccessStale && <div className="text-[9px] text-red-400 font-mono">No backup in 2+ days</div>}
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Last Run</span>
            <Clock className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-sm font-mono font-medium text-white">{formatLocalDateTime(stats.lastRun ?? null)}</div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Successful (90d)</span>
            <Archive className="w-3.5 h-3.5 text-accent/60" />
          </div>
          <div className="text-lg font-mono font-medium text-white">{stats.successCount ?? 0}</div>
        </div>

        <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-4 space-y-2">
          <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider flex items-center justify-between">
            <span>Failed (90d)</span>
            <Shield
              className={`w-3.5 h-3.5 ${
                (stats.failureCount ?? 0) > 0 ? 'text-red-400' : 'text-white/30'
              }`}
            />
          </div>
          <div
            className={`text-lg font-mono font-medium ${
              (stats.failureCount ?? 0) > 0 ? 'text-red-400' : 'text-white'
            }`}
          >
            {stats.failureCount ?? 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-grow overflow-auto rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35 font-medium">
              <th className="px-4 py-2.5">Started (Local)</th>
              <th className="px-4 py-2.5">Tier</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Size</th>
              <th className="px-4 py-2.5">Trigger</th>
              <th className="px-4 py-2.5 text-right font-medium">Error</th>
              <th className="px-4 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[var(--color-text-muted)] text-xs font-mono">
                  No backup runs recorded yet.
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.id} className="group hover:bg-white/[0.015] transition-colors">
                  <td className="px-4 py-3 text-white/80 font-mono text-xs">
                    {formatLocalDateTime(run.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-medium uppercase tracking-wider bg-white/[0.03] border border-[var(--color-border)] text-white/70">
                      {TIER_LABEL[run.tier] || run.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {run.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider border border-red-500/30 bg-red-500/10 text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Failed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">{formatBytes(run.sizeBytes)}</td>
                  <td className="px-4 py-3 text-white/60 font-mono text-xs">{run.triggeredBy || 'cron'}</td>
                  <td
                    className="px-4 py-3 text-right text-red-400/80 font-mono text-xs max-w-[200px] truncate"
                    title={run.errorMessage || ''}
                  >
                    {run.errorMessage || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {run.status === 'success' && run.r2Key ? (
                      <button
                        onClick={() => handleDownload(run.r2Key!)}
                        disabled={downloadingKey === run.r2Key}
                        title="Download Backup"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono border border-white/10 hover:border-white/20 hover:bg-white/[0.05] text-white/70 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {downloadingKey === run.r2Key ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>Download</span>
                      </button>
                    ) : (
                      <span className="text-white/20 text-xs font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
