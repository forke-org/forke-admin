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
import CHANGELOG_JSON from './changelog.json'

const CHANGELOG_DATA = CHANGELOG_JSON as any[]
const COMMIT_COUNT = CHANGELOG_DATA.reduce((acc, day) => acc + (day.entries?.length || 0), 0)

/**
 * Changelog sourced directly from git history.
 *
 * The marketing changelog page renders whatever has actually been merged —
 * no hand-written entries. Commits are expected to loosely follow
 * conventional-commit subjects (`feat: …`, `fix: …`, `style: …`); anything
 * that doesn't match still shows up, tagged as a generic update.
 *
 * On hosts without a .git directory (e.g. some container builds) this
 * degrades gracefully to an empty list and the page shows a fallback note.
 */

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

export function getChangelog(limit = 300): ChangelogDay[] {
  // Use pre-generated static data in production to avoid executing git
  if (process.env.NODE_ENV === 'production' && CHANGELOG_DATA && CHANGELOG_DATA.length > 0) {
    return CHANGELOG_DATA as ChangelogDay[]
  }

  let raw: string
  try {
    raw = execSync(`git log --no-merges -n ${limit} --pretty=format:%h%x1f%an%x1f%aI%x1f%s`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch {
    // Fall back to pre-generated static data if git execution fails
    return (CHANGELOG_DATA || []) as ChangelogDay[]
  }

  const days = new Map<string, ChangelogDay>()

  for (const line of raw.split('\n')) {
    const [shortHash, author, isoDate, subject] = line.split('\x1f')
    if (!shortHash || !isoDate || !subject) continue

    const date = isoDate.slice(0, 10)
    const { kind, scope, title } = parseSubject(subject)

    if (isChangelogCommit(title)) continue

    let day = days.get(date)
    if (!day) {
      day = { date, label: dayLabel(date), entries: [] }
      days.set(date, day)
    }
    day.entries.push({ shortHash, author, date: isoDate, kind, scope, title })
  }

  // git log already emits newest-first; Map preserves insertion order.
  return Array.from(days.values())
}

export function getCommitCount(): number | null {
  if (process.env.NODE_ENV === 'production' && COMMIT_COUNT !== null) {
    return COMMIT_COUNT
  }

  try {
    const changelog = getChangelog()
    let count = 0
    for (const day of changelog) {
      count += day.entries.length
    }
    return count
  } catch {
    return COMMIT_COUNT
  }
}
