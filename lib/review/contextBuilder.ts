import { REVIEW_SYSTEM_PROMPT } from './prompt'
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
  repoStructure?: string // optional directory tree
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

  const userMessage = `=== TASK DEFINITION ===
Title: ${task.taskTitle}
Description: ${task.taskDescription}
Frontend Stack: ${task.frontendStack}
Backend Stack: ${task.backendStack}

${acceptanceCriteriaSection}

=== FILE BOUNDARY RULES ===
${allowedPathsSection}
${restrictedPathsSection}

${previousReviewSection ? `\n${previousReviewSection}\n` : ''}=== PULL REQUEST DETAILS ===
PR #${prData.prNumber}: "${prData.prTitle}"
Developer: ${prData.developerUsername}
PR Description: ${prData.prDescription || '(no description provided)'}

${changedFilesSection}

${repoStructureSection}

=== GIT DIFF (Full Code Changes) ===
\`\`\`diff
${prData.gitDiff || '(no diff available)'}
\`\`\`

Please analyze the above PR against the task requirements and previous feedback, and provide your structured JSON review.`

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
