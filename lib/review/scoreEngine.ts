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

/**
 * Calculates the final weighted score and verdict.
 *
 * Directly returns the AI's calculated score and verdict.
 */
export function calculateFinalScore(
  rawResult: AIReviewResult,
  unauthorizedFiles: string[]
): { finalScore: number; finalVerdict: Verdict } {
  const finalScore = rawResult.score
  const finalVerdict = rawResult.verdict
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
