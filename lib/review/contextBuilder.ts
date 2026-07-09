import { REVIEW_SYSTEM_PROMPT } from './prompt'
import type { TestScoreResult } from './scoreEngine'
/**
 * PR Context Builder
 * Assembles the full structured prompt payload to send to the AI model.
 */

export interface TaskMetadata {
  taskTitle: string
  taskDescription: string
  frontendStack: string
  backendStack: string
  allowedPaths: string[]
  restrictedPaths: string[]
  acceptanceCriteria: string
}

export interface PRData {
  prNumber: number
  prTitle: string
  prDescription: string
  developerUsername: string
  changedFiles: string[]
  gitDiff: string
  repoStructure?: string
  /** Pre-computed deterministic test score — AI does NOT change these numbers */
  testScoreResult?: TestScoreResult
}

export interface PreviousReviewData {
  score: number
  verdict: string
  summary: string
  issues: string | null // Serialized JSON array of issues
  risks: string | null // Serialized JSON array of risks
}

/**
 * Builds the complete system prompt for the AI review.
 * Supports incremental reviews by matching against a previous review if provided.
 * Returns: { systemPrompt, userMessage }
 */
export function buildReviewContext(
  prData: PRData,
  task: TaskMetadata,
  previousReview?: PreviousReviewData
): { systemPrompt: string; userMessage: string } {
  const systemPrompt = REVIEW_SYSTEM_PROMPT

  const allowedPathsSection = task.allowedPaths.length > 0
    ? `ALLOWED FILE PATHS (developer MUST only modify these):
${task.allowedPaths.map(p => `  - ${p}`).join('\n')}

Any file changed outside these paths is an UNAUTHORIZED EDIT and must be listed in unauthorized_file_edits.`
    : `ALLOWED FILE PATHS: Not restricted (all files allowed)`

  const restrictedPathsSection = task.restrictedPaths.length > 0
    ? `RESTRICTED PATHS (must NOT be modified under any circumstances):
${task.restrictedPaths.map(p => `  - ${p}`).join('\n')}`
    : ''

  const acceptanceCriteriaSection = task.acceptanceCriteria
    ? `ACCEPTANCE CRITERIA:
${task.acceptanceCriteria}`
    : ''

  const changedFilesSection = prData.changedFiles.length > 0
    ? `CHANGED FILES IN THIS PR (${prData.changedFiles.length} files):
${prData.changedFiles.map(f => `  - ${f}`).join('\n')}`
    : 'CHANGED FILES: None detected'

  const repoStructureSection = prData.repoStructure
    ? `REPOSITORY STRUCTURE (for topological context):
\`\`\`
${prData.repoStructure}
\`\`\``
    : ''

  // Build the previous review section if available
  let previousReviewSection = ''
  if (previousReview) {
    let prevIssuesText = 'None reported'
    try {
      if (previousReview.issues) {
        const parsed = JSON.parse(previousReview.issues)
        if (Array.isArray(parsed) && parsed.length > 0) {
          prevIssuesText = parsed.map((issue: any, index: number) => 
            `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.file}${issue.line ? `:${issue.line}` : ''} - ${issue.message}`
          ).join('\n')
        }
      }
    } catch (e) {
      prevIssuesText = 'Error reading previous issues'
    }

    let prevRisksText = 'None reported'
    try {
      if (previousReview.risks) {
        const parsed = JSON.parse(previousReview.risks)
        if (Array.isArray(parsed) && parsed.length > 0) {
          prevRisksText = parsed.map((risk: any, index: number) => 
            `${index + 1}. [${risk.severity.toUpperCase()}] Category: ${risk.category} - ${risk.message}`
          ).join('\n')
        }
      }
    } catch (e) {
      prevRisksText = 'Error reading previous risks'
    }

    previousReviewSection = `=== PREVIOUS AI REVIEW FINDINGS ===
Previous Score: ${previousReview.score}/100
Previous Verdict: ${previousReview.verdict.toUpperCase()}
Previous Summary: ${previousReview.summary}

Unresolved Issues from Previous Review:
${prevIssuesText}

Unresolved Security Risks from Previous Review:
${prevRisksText}

Check these previous issues and risks against the current git diff to see which ones are resolved and which ones persist. Describe resolutions in the "resolved_issues" and "resolved_risks" arrays.
`
  }

  // Build the test score table section
  let testScoreSection = ''
  if (prData.testScoreResult) {
    const { testScore, categories, penalties } = prData.testScoreResult
    const rows = categories.map(c =>
      `| ${c.name.replace(/_/g, ' ').padEnd(20)} | ${c.status.toUpperCase().padEnd(6)} | ${String(c.pointsEarned).padStart(5)} / ${String(c.pointsMax).padEnd(2)} | ${c.isBlocking ? 'YES' : 'no '} | ${c.issuesCount} issues |`
    ).join('\n')
    const penaltyRows = penalties.length > 0
      ? '\nPENALTIES:\n' + penalties.map(p => `  - ${p.reason}: -${p.points} pts`).join('\n')
      : ''
    testScoreSection = `
=== DETERMINISTIC TEST SCORE (computed by Forke engine — DO NOT change these numbers) ===
Test Suite Score: ${testScore} / 70 pts

| Category             | Status | Score     | Blocking | Details   |
|----------------------|--------|-----------|----------|-----------|
${rows}
${penaltyRows}

The remaining 30 points come from your assessment of REQUIREMENT FULFILLMENT.
Output a "requirement_match" float between 0.0 and 1.0 based on how well the developer met the task requirements.
Final score = ${testScore} + round(requirement_match × 30). DO NOT output a score — only output requirement_match.
`
  }

  const userMessage = `=== TASK DEFINITION ===
Title: ${task.taskTitle}
Description: ${task.taskDescription}
Frontend Stack: ${task.frontendStack}
Backend Stack: ${task.backendStack}

${acceptanceCriteriaSection}

=== FILE BOUNDARY RULES ===
${allowedPathsSection}
${restrictedPathsSection}

${testScoreSection}${previousReviewSection ? `\n${previousReviewSection}\n` : ''}=== PULL REQUEST DETAILS ===
PR #${prData.prNumber}: "${prData.prTitle}"
Developer: ${prData.developerUsername}
PR Description: ${prData.prDescription || '(no description provided)'}

${changedFilesSection}

${repoStructureSection}

=== GIT DIFF (Full Code Changes) ===
\`\`\`diff
${prData.gitDiff || '(no diff available)'}
\`\`\`

Please analyze the above PR. Output only requirement_match (0.0-1.0), summary, strengths, issues, risks, resolved_issues, resolved_risks, and unauthorized_file_edits. Do NOT output a score value.`

  return { systemPrompt, userMessage }
}

/**
 * Truncates a git diff if it's too large (token limit mitigation).
 * Keeps the first N characters and appends a note.
 */
export function truncateDiff(diff: string, maxChars = 50000): string {
  if (diff.length <= maxChars) return diff
  return diff.slice(0, maxChars) + '\n\n[... DIFF TRUNCATED — too large for single review pass ...]'
}
