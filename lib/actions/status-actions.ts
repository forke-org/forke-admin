'use server'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { execFile } from 'child_process'
import { stat } from 'fs/promises'
import { promisify } from 'util'
import { desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { backupRuns } from '@/lib/db/schema'
import { isAdminAuthenticated } from '@/lib/admin-actions'

const execFileAsync = promisify(execFile)

// Private status for the admin panel. The public page (status.forke.space)
// shows the Website, Dashboard, API and Forke Mail; this adds everything that
// must stay internal: the admin app itself, the database, processes, cron
// jobs and backups. All checks run from this server over localhost.

export type CheckState = 'operational' | 'degraded' | 'down' | 'unknown'

export interface ServiceCheck {
  id: string
  name: string
  detail: string
  state: CheckState
  ms: number | null
  info?: string
}

export interface StatusOverview {
  checkedAt: string
  internal: ServiceCheck[]
  publicServices: { id: string; name: string; status: CheckState; uptime90: number | null; lastMs: number | null }[] | null
  publicUpdatedAt: string | null
  mail: any | null
  cron: { name: string; lastRun: string | null; state: CheckState }[]
  backup: { status: string; tier: string; finishedAt: string | null; sizeBytes: number | null } | null
  processes: { name: string; status: string; restarts: number; memoryMb: number; uptimeSince: string | null }[] | null
}

const PUBLIC_STATUS_JSON = 'https://raw.githubusercontent.com/forke-org/forke-status/data/status.json'
const CRON_JOBS = ['backup-db', 'cleanup-backups', 'analytics-maintenance', 'purge-logs']

async function probe(id: string, name: string, detail: string, url: string, headers?: Record<string, string>): Promise<ServiceCheck> {
  const started = Date.now()
  try {
    const res = await fetch(url, { headers, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(5000) })
    const ms = Date.now() - started
    const ok = res.status >= 200 && res.status < 400
    return { id, name, detail, ms, state: !ok ? 'down' : ms > 3000 ? 'degraded' : 'operational', info: `HTTP ${res.status}` }
  } catch (err) {
    return { id, name, detail, ms: null, state: 'down', info: err instanceof Error ? err.name : 'error' }
  }
}

async function databaseCheck(): Promise<ServiceCheck> {
  const started = Date.now()
  try {
    const rows: any = await db.execute(sql`SELECT count(*)::int AS conns, pg_size_pretty(pg_database_size(current_database())) AS size FROM pg_stat_activity`)
    const row = (rows.rows ?? rows)[0] ?? {}
    const ms = Date.now() - started
    return { id: 'postgres', name: 'PostgreSQL', detail: 'forkedb, shared by all Forke apps', ms, state: ms > 1000 ? 'degraded' : 'operational', info: `${row.conns} connections · ${row.size}` }
  } catch {
    return { id: 'postgres', name: 'PostgreSQL', detail: 'forkedb, shared by all Forke apps', ms: null, state: 'down', info: 'query failed' }
  }
}

async function cronStatus() {
  const now = Date.now()
  return Promise.all(CRON_JOBS.map(async (name) => {
    try {
      const s = await stat(`/home/ubuntu/logs/cron-${name}.log`)
      const age = now - s.mtimeMs
      return { name, lastRun: s.mtime.toISOString(), state: (age < 26 * 3600 * 1000 ? 'operational' : 'degraded') as CheckState }
    } catch {
      return { name, lastRun: null, state: 'unknown' as CheckState }
    }
  }))
}

async function pm2Processes() {
  try {
    const { stdout } = await execFileAsync('pm2', ['jlist'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024 })
    const list = JSON.parse(stdout) as any[]
    return list.map((p) => ({
      name: String(p.name),
      status: String(p.pm2_env?.status ?? 'unknown'),
      restarts: Number(p.pm2_env?.restart_time ?? 0),
      memoryMb: Math.round(Number(p.monit?.memory ?? 0) / 1024 / 1024),
      uptimeSince: p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : null,
    }))
  } catch {
    return null
  }
}

async function publicStatus() {
  try {
    const res = await fetch(`${PUBLIC_STATUS_JSON}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { services: null, updatedAt: null }
    const data = await res.json()
    const ids: string[] = (data.groups ?? []).flatMap((g: any) => g.components ?? [])
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)
    const services = ids.map((id) => data.components?.[id]).filter((c: any) => c && c.status !== 'hidden').map((c: any) => {
      let down = 0
      let checks = 0
      for (const [day, d] of Object.entries<any>(c.days ?? {})) if (day >= cutoff) { down += d.down; checks += d.checks }
      const status: CheckState = ['operational', 'degraded', 'down'].includes(c.status) ? c.status : 'unknown'
      return { id: c.id, name: c.name, status, uptime90: checks ? (checks - down) / checks : null, lastMs: c.lastCheck?.ms ?? null }
    })
    return { services, updatedAt: data.updatedAt ?? null }
  } catch {
    return { services: null, updatedAt: null }
  }
}

export async function getStatusOverviewAction(): Promise<{ success: boolean; data?: StatusOverview; error?: string }> {
  if (!(await isAdminAuthenticated())) return { success: false, error: 'Unauthorized' }

  const internalToken = process.env.INTERNAL_API_TOKEN || ''
  const [internal, cron, processes, pub, mailRes, backupRows] = await Promise.all([
    Promise.all([
      probe('admin', 'Admin panel', 'admin.forke.space (this app)', 'http://127.0.0.1:3002/login'),
      probe('marketing', 'Website', 'forke.space on port 3000', 'http://127.0.0.1:3000/'),
      probe('dashboard', 'Dashboard', 'dashboard.forke.space on port 3001', 'http://127.0.0.1:3001/signin'),
      probe('backend', 'API', 'api.forke.space on port 8080', 'http://127.0.0.1:8080/health'),
      probe('telemetry', 'API telemetry', 'internal token check', 'http://127.0.0.1:8080/api/v1/system/telemetry', { Authorization: `Bearer ${internalToken}` }),
      probe('mail', 'Forke Mail', 'mail.forke.space on port 8085', 'http://127.0.0.1:8085/healthz'),
      databaseCheck(),
    ]),
    cronStatus(),
    pm2Processes(),
    publicStatus(),
    fetch('http://127.0.0.1:8085/api/public/status', { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(1).catch(() => []),
  ])

  const latest = backupRows[0]
  return {
    success: true,
    data: {
      checkedAt: new Date().toISOString(),
      internal,
      publicServices: pub.services,
      publicUpdatedAt: pub.updatedAt,
      mail: mailRes,
      cron,
      backup: latest
        ? { status: latest.status, tier: latest.tier, finishedAt: latest.finishedAt ? new Date(latest.finishedAt).toISOString() : null, sizeBytes: latest.sizeBytes ?? null }
        : null,
      processes,
    },
  }
}
