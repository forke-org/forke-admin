/**
 * Risk & Score Engine
 * Applies weighted scoring penalties on top of the raw AI assessment
 * to produce a final 0-100 score and a deterministic verdict.
 */

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

/**
 * Calculates the final weighted score and verdict.
 *
 * Penalty rules:
 * - Base score: AI's raw 0-100 score
 * - If requirement_match < 0.80: multiply score by 0.75 (-25%)
 * - If unauthorized file edits exist: multiply score by 0.50 (-50%)
 * - Each critical/high severity issue: -15 points
 * - Each medium severity issue: -5 points
 * - Score is clamped to [0, 100]
 */
export function calculateFinalScore(
  rawResult: AIReviewResult,
  unauthorizedFiles: string[]
): { finalScore: number; finalVerdict: Verdict } {
  let score = rawResult.score

  // Penalty 1: Low requirement match
  if (rawResult.requirement_match < 0.8) {
    score = Math.floor(score * 0.75)
  }

  // Penalty 2: Unauthorized file edits (immediate heavy penalty)
  if (unauthorizedFiles.length > 0) {
    score = Math.floor(score * 0.5)
  }

  // Penalty 3: Issue severity penalties
  for (const issue of rawResult.issues || []) {
    if (issue.severity === 'critical' || issue.severity === 'high') {
      score -= 15
    } else if (issue.severity === 'medium') {
      score -= 5
    }
  }

  // Clamp to valid range
  const finalScore = Math.max(0, Math.min(100, score))

  // Determine verdict
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
