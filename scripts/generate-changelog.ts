/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export type ChangeKind =
  | 'feature'
  | 'fix'
  | 'polish'
  | 'refactor'
  | 'perf'
  | 'docs'
  | 'chore'
  | 'update'

export interface ChangelogEntry {
  shortHash: string
  author: string
  date: string
  kind: ChangeKind
  scope: string | null
  title: string
}

export interface ChangelogDay {
  date: string
  label: string
  entries: ChangelogEntry[]
}

const KIND_MAP: Record<string, ChangeKind> = {
  feat: 'feature',
  feature: 'feature',
  fix: 'fix',
  hotfix: 'fix',
  bugfix: 'fix',
  style: 'polish',
  polish: 'polish',
  ui: 'polish',
  refactor: 'refactor',
  perf: 'perf',
  docs: 'docs',
  doc: 'docs',
  chore: 'chore',
  build: 'chore',
  ci: 'chore',
  test: 'chore',
}

const SUBJECT_RE = /^([a-zA-Z]+)(?:\(([^)]*)\))?!?:\s*(.+)$/

function parseSubject(subject: string): { kind: ChangeKind; scope: string | null; title: string } {
  const m = subject.match(SUBJECT_RE)
  if (m && KIND_MAP[m[1].toLowerCase()]) {
    const title = m[3].trim()
    return {
      kind: KIND_MAP[m[1].toLowerCase()],
      scope: m[2]?.trim() || null,
      title: title.charAt(0).toUpperCase() + title.slice(1),
    }
  }
  const title = subject.trim()
  return { kind: 'update', scope: null, title: title.charAt(0).toUpperCase() + title.slice(1) }
}

export function isChangelogCommit(subject: string): boolean {
  const normalized = subject.toLowerCase()
  return (
    normalized.includes('changelog') &&
    (normalized.includes('commit count') ||
     normalized.includes('update changelog') ||
     normalized.includes('changelog entries') ||
     normalized.includes('add changelog'))
  )
}


function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toLowerCase()
}

// Get raw entries from git log
function getGitLogEntries(limit = 300): ChangelogEntry[] {
  let raw: string
  try {
    raw = execSync(`git log --no-merges -n ${limit} --pretty=format:%h%x1f%an%x1f%aI%x1f%s`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (err: any) {
    console.error('Failed to run git log:', err.message || err)
    return []
  }

  const entries: ChangelogEntry[] = []
  for (const line of raw.split('\n')) {
    const [shortHash, author, isoDate, subject] = line.split('\x1f')
    if (!shortHash || !isoDate || !subject) continue

    const { kind, scope, title } = parseSubject(subject)
    entries.push({ shortHash, author, date: isoDate, kind, scope, title })
  }
  return entries
}

async function main() {
  console.log('Checking repository clone depth...')
  try {
    const isShallow = execSync('git rev-parse --is-shallow-repository', { 
      cwd: process.cwd(), 
      encoding: 'utf8' 
    }).trim() === 'true'
    
    if (isShallow) {
      console.log('Shallow clone detected. Attempting fetch unshallow...')
      execSync('git fetch --unshallow', { 
        cwd: process.cwd(), 
        stdio: 'ignore' 
      })
    } else {
      console.log('Full clone detected.')
    }
  } catch (e: any) {
    console.warn('Skipping unshallow fetch:', e.message || e)
  }

  const jsonPath = path.resolve(process.cwd(), 'lib/changelog.json')
  let existingDays: ChangelogDay[] = []

  // 1. Read existing static JSON file if it exists
  if (fs.existsSync(jsonPath)) {
    try {
      const rawJson = fs.readFileSync(jsonPath, 'utf8')
      existingDays = JSON.parse(rawJson) as ChangelogDay[]
    } catch (e) {
      console.error('Failed to read existing static changelog JSON:', e)
    }
  }

  // 2. Fetch shallow git log entries
  const gitEntries = getGitLogEntries().filter(e => !isChangelogCommit(e.title))

  // 3. Extract all existing entries
  const existingEntries: ChangelogEntry[] = []
  const existingHashes = new Set<string>()
  for (const day of existingDays) {
    for (const entry of day.entries) {
      if (isChangelogCommit(entry.title)) continue
      existingEntries.push(entry)
      existingHashes.add(entry.shortHash)
    }
  }

  // 4. Identify any new commits in git log not in static file
  const newEntries = gitEntries.filter(e => !existingHashes.has(e.shortHash))
  console.log(`Found ${newEntries.length} new commits in git log.`)

  // 5. Merge new commits with existing ones
  const mergedEntries = [...newEntries, ...existingEntries]

  // Sort by date descending
  mergedEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Group by day
  const daysMap = new Map<string, ChangelogDay>()
  for (const entry of mergedEntries) {
    const date = entry.date.slice(0, 10)
    let day = daysMap.get(date)
    if (!day) {
      day = { date, label: dayLabel(date), entries: [] }
      daysMap.set(date, day)
    }
    day.entries.push(entry)
  }
  const finalDays = Array.from(daysMap.values())

  // 6. Calculate total count
  const finalCount = mergedEntries.length

  // 7. Write output to JSON file
  fs.writeFileSync(jsonPath, JSON.stringify(finalDays, null, 2), 'utf8')
  console.log(`Successfully generated changelog JSON at ${jsonPath} (${finalDays.length} days, ${finalCount} commits)`)
}

main().catch(console.error)
