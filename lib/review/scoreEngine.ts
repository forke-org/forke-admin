/**
 * Score Engine
 * Deterministic scoring from real test execution results + AI requirement match.
 *
 * Key design principles:
 *  - NO fixed point allocations per category (no "build = 20 pts")
 *  - Relative weights: a build failure hurts proportionally more than a format failure
 *  - Score emerges from what actually ran — skipped categories don't penalise
 *  - Build failure is a hard gate (score capped, verdict can never be 'pass')
 *  - AI only contributes requirement_match (0-1 float), not the score number
 *  - Final score = test execution quality (70%) + requirement fulfillment (30%)
 */

import type { CategoryResult } from './runner'

export type Verdict = 'pass' | 'needs_changes' | 'high_risk'
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type RiskSeverity = 'high' | 'medium' | 'low'

export interface AIIssue {
  file: string
  line: number
  severity: IssueSeverity
  message: string
  suggestion: string
  status?: 'new' | 'unresolved'
}

export interface AIRisk {
  category: 'security' | 'safety' | 'credential'
  message: string
  severity: RiskSeverity
  status?: 'new' | 'unresolved'
}

export interface AIResolvedIssue {
  file: string
  line: number
  severity: IssueSeverity
  message: string
  resolution: string
}

export interface AIResolvedRisk {
  category: 'security' | 'safety' | 'credential'
  message: string
  severity: RiskSeverity
  resolution: string
}

export interface AIReviewResult {
  verdict: Verdict
  score: number
  requirement_match: number // 0.0 to 1.0 — the ONLY number the AI contributes
  summary: string
  strengths: string[]
  issues: AIIssue[]
  risks: AIRisk[]
  unauthorized_file_edits: string[]
  resolved_issues?: AIResolvedIssue[]
  resolved_risks?: AIResolvedRisk[]
}

export interface ScoredReview extends AIReviewResult {
  finalScore: number
  finalVerdict: Verdict
  unauthorizedFiles: string[]
}

// ─── Relative Weight Model ────────────────────────────────────────────────────

/**
 * Relative importance weights — NOT fixed point allocations.
 *
 * These are multipliers expressing how much a failure in each category hurts
 * relative to other categories. The actual score emerges proportionally from
 * whatever categories ran. Skipped categories are fully excluded.
 *
 * A build failure (weight 3.0) hurts 12× more than a format failure (0.25).
 */
const CATEGORY_WEIGHTS: Record<string, { weight: number; isBlocking: boolean }> = {
  build:             { weight: 3.0,  isBlocking: true  },
  unit_tests:        { weight: 2.5,  isBlocking: true  },
  type_checks:       { weight: 2.0,  isBlocking: true  },
  security:          { weight: 2.0,  isBlocking: false },
  integration_tests: { weight: 1.5,  isBlocking: true  },
  e2e_tests:         { weight: 1.5,  isBlocking: true  },
  lint:              { weight: 1.0,  isBlocking: false },
  sast:              { weight: 1.0,  isBlocking: false },
  dependencies:      { weight: 0.75, isBlocking: false },
  code_quality:      { weight: 0.5,  isBlocking: false },
  format:            { weight: 0.5,  isBlocking: false },
  performance:       { weight: 0.25, isBlocking: false },
}

/**
 * Calculates a dynamic quality factor (0.0 to 1.0) based on category status and issue counts.
 *
 * - status === 'pass': quality = 1.0
 * - status === 'fail': quality = 0.0
 * - status === 'warn':
 *   - Quality scales down with issue count so that 1 warning is penalized less than 10 warnings.
 *   - For non-blocking categories (lint, format, etc.): loses 5% quality per issue, floor of 10% (0.1).
 *   - For blocking categories (unit tests, etc.): loses 15% quality per issue, floor of 10% (0.1).
 */
export function calculateCategoryQuality(status: string, issuesCount: number, isBlocking: boolean): number {
  if (status === 'pass') return 1.0
  if (status === 'fail') return 0.0

  if (status === 'warn') {
    const penaltyPerIssue = isBlocking ? 0.15 : 0.05
    const safeIssuesCount = typeof issuesCount === 'number' && !isNaN(issuesCount) ? issuesCount : 1
    const count = Math.max(1, safeIssuesCount) // ensure at least 1 issue counts if it's warn status
    return Math.max(0.1, 1.0 - count * penaltyPerIssue)
  }

  return 0.0
}

/**
 * If build fails, raw execution score is capped here.
 * This means even if everything else passes, a broken build
 * can never push the final score above ~(40×0.7 + 30) = 58, landing in needs_changes.
 */
const BUILD_FAIL_SCORE_CAP = 40

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TestScoreCategoryRow {
  name: string
  status: string
  weight: number          // relative importance multiplier
  quality: number         // 0.0 to 1.0
  contribution: number    // weight × quality (earned)
  maxContribution: number // weight × 1.0 (maximum possible)
  isBlocking: boolean
  issuesCount: number
}

export interface TestScoreResult {
  /** Raw execution quality score 0-100, before build cap and penalties */
  rawScore: number
  /** Execution quality score 0-100, after build cap and penalties applied */
  testScore: number
  /** Whether build failed (used to block 'pass' verdict) */
  buildFailed: boolean
  categories: TestScoreCategoryRow[]
  penalties: { reason: string; points: number }[]
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Computes execution quality score (0-100) from real runner.ts results.
 *
 * Score = (sum of weight×quality for ran categories) / (sum of weights) × 100
 *
 * No category has a pre-allocated point budget. The score is purely proportional
 * to how well each category performed relative to its importance weight.
 */
export function computeTestScore(
  runnerResults: Record<string, CategoryResult>,
  unauthorizedFiles: string[],
  secretCount: number,
  hasSubmission: boolean
): TestScoreResult {
  const categories: TestScoreCategoryRow[] = []
  let earned = 0
  let possible = 0

  const buildResult = runnerResults['build']
  const buildFailed = !!buildResult && buildResult.status === 'fail'

  for (const [name, cfg] of Object.entries(CATEGORY_WEIGHTS)) {
    const result = runnerResults[name]
    if (!result || result.status === 'skip') continue // skipped = not counted

    const quality = calculateCategoryQuality(result.status, result.issuesCount, cfg.isBlocking)
    const contribution = cfg.weight * quality

    earned += contribution
    possible += cfg.weight

    categories.push({
      name,
      status: result.status,
      weight: cfg.weight,
      quality,
      contribution: Math.round(contribution * 100) / 100,
      maxContribution: cfg.weight,
      isBlocking: cfg.isBlocking,
      issuesCount: result.issuesCount,
    })
  }

  // Score emerges purely from proportion of what ran
  let rawScore = possible > 0 ? Math.round((earned / possible) * 100) : 50

  // Hard gate: build failure caps execution score
  if (buildFailed) {
    rawScore = Math.min(rawScore, BUILD_FAIL_SCORE_CAP)
  }

  // Deterministic penalties (applied after proportional score)
  const penalties: { reason: string; points: number }[] = []

  const unauthorizedPenalty = Math.min(unauthorizedFiles.length * 10, 20)
  if (unauthorizedPenalty > 0) {
    penalties.push({
      reason: `${unauthorizedFiles.length} unauthorized file edit(s) detected`,
      points: unauthorizedPenalty,
    })
  }

  const secretPenalty = Math.min(secretCount * 15, 20)
  if (secretPenalty > 0) {
    penalties.push({
      reason: `${secretCount} hardcoded secret/credential leak(s)`,
      points: secretPenalty,
    })
  }

  if (!hasSubmission) {
    penalties.push({ reason: 'Missing FORKE_SUBMISSION.md', points: 5 })
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0)
  const testScore = Math.max(0, Math.min(100, rawScore - totalPenalty))

  return { rawScore, testScore, buildFailed, categories, penalties }
}

// ─── Final Score ──────────────────────────────────────────────────────────────

/**
 * Blends execution quality (70%) + requirement fulfillment (30%) into final score.
 *
 * final_score = round(testScore × 0.7 + requirement_match × 100 × 0.3)
 *
 * Why 70/30?
 *   70% = "Did the code actually work?" — answered by real test execution
 *   30% = "Did it solve the right problem?" — answered by AI reading task + diff
 *   These are two genuinely different dimensions that can't measure each other.
 */
export function calculateFinalScore(
  rawResult: AIReviewResult,
  unauthorizedFiles: string[],
  testScoreResult?: TestScoreResult
): { finalScore: number; finalVerdict: Verdict } {
  let finalScore: number

  if (testScoreResult !== undefined) {
    const testPortion = testScoreResult.testScore * 0.7
    const requirementPortion = (rawResult.requirement_match ?? 0.5) * 100 * 0.3
    finalScore = Math.min(100, Math.round(testPortion + requirementPortion))
  } else {
    // Legacy fallback: use AI's own score
    finalScore = rawResult.score
  }

  let finalVerdict = determineVerdict(finalScore, unauthorizedFiles, rawResult.risks || [])

  // Build failure must never produce a 'pass' verdict — override if needed
  if (testScoreResult?.buildFailed && finalVerdict === 'pass') {
    finalVerdict = 'needs_changes'
  }

  return { finalScore, finalVerdict }
}

// ─── Verdict Rules ────────────────────────────────────────────────────────────

/**
 * Determines the final verdict from score + risk signals.
 *
 * high_risk  : unauthorized edits | high-severity risk | score < 40
 * needs_changes: score 40–74 | medium-severity risk
 * pass       : score ≥ 75, no critical risks, no unauthorized edits
 */
export function determineVerdict(
  score: number,
  unauthorizedFiles: string[],
  risks: AIRisk[]
): Verdict {
  if (unauthorizedFiles.length > 0) return 'high_risk'

  const hasCriticalRisk = risks.some(r => r.severity === 'high')
  if (hasCriticalRisk) return 'high_risk'

  if (score < 40) return 'high_risk'
  if (score < 75) return 'needs_changes'

  const hasMediumRisk = risks.some(r => r.severity === 'medium')
  if (hasMediumRisk) return 'needs_changes'

  return 'pass'
}
