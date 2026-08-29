/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

/**
 * Background Job Manager
 * Tracks in-process async jobs (mirror operations, baseline scans, review runs)
 * with progress reporting and log streaming.
 */

export interface Job {
  id: string
  status: 'running' | 'success' | 'failed'
  progress: number
  logs: string[]
}

const globalForJobs = globalThis as unknown as {
  jobs: Map<string, Job> | undefined
}

export const activeJobs = globalForJobs.jobs ?? new Map<string, Job>()
if (process.env.NODE_ENV !== 'production') globalForJobs.jobs = activeJobs
