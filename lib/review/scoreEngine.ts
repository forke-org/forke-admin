/**
 * Risk & Score Engine
 * Deterministic scoring from real test results + AI requirement match.
 * AI does NOT generate the score — only requirement_match (0-1 float).
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
  scoreBreakdown?: {
    requirementFulfillment: {
      score: number
      deductions: { points: number; reason: string }[]
    }
    techStackAdherence: {
      score: number
      deductions: { points: number; reason: string }[]
    }
    codeCleanliness: {
      score: number
      deductions: { points: number; reason: string }[]
    }
    executionSafety: {
      score: number
      deductions: { points: number; reason: string }[]
    }
  }
  requirement_match: number // 0.0 to 1.0
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

// ─── Deterministic Test Score ─────────────────────────────────────────────────

/** Per-category scoring weights. Total = 115, normalized to 70 points max. */
const CATEGORY_WEIGHTS: Record<string, { weight: number; isBlocking: boolean }> = {
  build:             { weight: 20, isBlocking: true },
  unit_tests:        { weight: 15, isBlocking: true },
  type_checks:       { weight: 15, isBlocking: true },
  security:          { weight: 15, isBlocking: false },
  integration_tests: { weight: 10, isBlocking: true },
  e2e_tests:         { weight: 10, isBlocking: true },
  lint:              { weight: 8,  isBlocking: false },
  sast:              { weight: 7,  isBlocking: false },
  dependencies:      { weight: 5,  isBlocking: false },
  code_quality:      { weight: 5,  isBlocking: false },
  format:            { weight: 3,  isBlocking: false },
  performance:       { weight: 2,  isBlocking: false },
}

const WARN_FACTOR = 0.55 // warn = 55% of full points

export interface TestScoreCategoryRow {
  name: string
  status: string
  pointsEarned: number
  pointsMax: number
  isBlocking: boolean
  issuesCount: number
}

export interface TestScoreResult {
  /** 0-70: score from test results (30 remaining come from AI requirement_match) */
  testScore: number
  categories: TestScoreCategoryRow[]
  penalties: { reason: string; points: number }[]
}

/**
 * Deterministically computes the "reliability" portion of the score (0-70).
 * Based entirely on real runner.ts execution results — no AI involved.
 *
 * @param runnerResults  Output of runReviewPipeline().results
 * @param unauthorizedFiles  Files edited outside allowed paths
 * @param secretCount  Number of detected secret/credential leaks
 * @param hasSubmission  Whether FORKE_SUBMISSION.md is present and valid
 */
export function computeTestScore(
  runnerResults: Record<string, CategoryResult>,
  unauthorizedFiles: string[],
  secretCount: number,
  hasSubmission: boolean
): TestScoreResult {
  const categories: TestScoreCategoryRow[] = []
  let totalWeight = 0
  let earnedWeight = 0

  for (const [name, cfg] of Object.entries(CATEGORY_WEIGHTS)) {
    const result = runnerResults[name]
    if (!result || result.status === 'skip') continue

    totalWeight += cfg.weight

    let factor = 0
    if (result.status === 'pass') factor = 1.0
    else if (result.status === 'warn') factor = WARN_FACTOR
    // 'fail' → 0

    const pointsEarned = cfg.weight * factor
    earnedWeight += pointsEarned

    categories.push({
      name,
      status: result.status,
      pointsEarned: Math.round(pointsEarned * 10) / 10,
      pointsMax: cfg.weight,
      isBlocking: cfg.isBlocking,
      issuesCount: result.issuesCount,
    })
  }

  // Normalize earned score to 0-70 scale
  const normalizedScore = totalWeight > 0 ? (earnedWeight / totalWeight) * 70 : 35

  // Deterministic penalties on top of normalized score
  const penalties: { reason: string; points: number }[] = []

  const unauthorizedPenalty = Math.min(unauthorizedFiles.length * 10, 30)
  if (unauthorizedPenalty > 0) {
    penalties.push({
      reason: `${unauthorizedFiles.length} unauthorized file edit(s) detected`,
      points: unauthorizedPenalty,
    })
  }

  const secretPenalty = Math.min(secretCount * 15, 25)
  if (secretPenalty > 0) {
    penalties.push({
      reason: `${secretCount} hardcoded secret/credential leak(s) detected`,
      points: secretPenalty,
    })
  }

  if (!hasSubmission) {
    penalties.push({ reason: 'Missing or incomplete FORKE_SUBMISSION.md', points: 5 })
  }

  const totalPenalty = penalties.reduce((sum, p) => sum + p.points, 0)
  const testScore = Math.max(0, Math.min(70, Math.round(normalizedScore - totalPenalty)))

  return { testScore, categories, penalties }
}

// ─── Final Score Computation ──────────────────────────────────────────────────

/**
 * Combines:
 *   - testScore (0-70): deterministic, from computeTestScore()
 *   - requirementScore (0-30): from AI's requirement_match float (0-1)
 * into a final 0-100 score.
 */
export function calculateFinalScore(
  rawResult: AIReviewResult,
  unauthorizedFiles: string[],
  testScoreResult?: TestScoreResult
): { finalScore: number; finalVerdict: Verdict } {
  let finalScore: number

  if (testScoreResult !== undefined) {
    // Deterministic path: combine test score + AI requirement_match
    const requirementScore = Math.round((rawResult.requirement_match ?? 0.5) * 30)
    finalScore = Math.min(100, testScoreResult.testScore + requirementScore)
  } else {
    // Fallback: use AI's own score (old behaviour)
    finalScore = rawResult.score
  }

  const finalVerdict = determineVerdict(finalScore, unauthorizedFiles, rawResult.risks || [])
  return { finalScore, finalVerdict }
}

/**
 * Determines the final verdict based on score and risk factors.
 *
 * HIGH_RISK if any of:
 * - Unauthorized file edits exist
 * - Any critical/high severity risk
 * - Score < 40
 *
 * NEEDS_CHANGES if any of:
 * - Score between 40-74
 * - Any medium severity risk
 * - Any high/critical severity issues
 *
 * PASS if:
 * - Score >= 75, no critical risks, no unauthorized edits
 */
export function determineVerdict(
  score: number,
  unauthorizedFiles: string[],
  risks: AIRisk[]
): Verdict {
  // Immediate HIGH_RISK conditions
  if (unauthorizedFiles.length > 0) return 'high_risk'

  const hasCriticalRisk = risks.some(r => r.severity === 'high')
  if (hasCriticalRisk) return 'high_risk'

  if (score < 40) return 'high_risk'

  // NEEDS_CHANGES conditions
  if (score < 75) return 'needs_changes'

  const hasMediumRisk = risks.some(r => r.severity === 'medium')
  if (hasMediumRisk) return 'needs_changes'

  return 'pass'
}
