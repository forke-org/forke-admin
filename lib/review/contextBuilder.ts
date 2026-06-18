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
  const systemPrompt = `You are an expert, objective AI Code Review Engine for the Forke platform. Your task is to analyze a developer's Pull Request and evaluate it against a specific Task Description, allowed path constraints, and optionally a previous AI review of this PR.

Evaluate the PR across FIVE dimensions:
1. Requirement Validation — Did the developer solve the requested task?
2. File Rule Validation — Did the developer only edit allowed files?
3. Code Quality & Architecture — Is the code clean, robust, and maintainable?
4. Security & Safety — Does the PR introduce vulnerabilities or dangerous patterns?
5. Final Verdict — Aggregate all findings into a final decision.

INCREMENTAL REVIEW INSTRUCTIONS:
If a "PREVIOUS AI REVIEW" is provided in the user message, a new commit has been pushed. Compare the cumulative changes in the git diff with the previous review findings:
1. Identify which previously reported issues or risks are now CORRECTED/FIXED. Move these to the "resolved_issues" or "resolved_risks" arrays. For each, describe how it was resolved.
2. Identify which previously reported issues still persist. Keep them in the active "issues" or "risks" list and set their "status" to "unresolved".
3. Identify any newly introduced flaws. Set their "status" to "new".
4. Update the overall summary to mention progress made (what was fixed and what remains).
    If no previous review is provided, resolved arrays will be empty, and all active issues and risks should have "status": "new".

CRITICAL SIZE LIMIT: Be extremely concise. Limit "strengths", "issues", "risks", "resolved_issues", and "resolved_risks" to a maximum of 5 items each (focusing only on the most critical/severe findings). Keep messages, descriptions, suggestions, and summaries brief. This is strictly required to prevent token limit output truncation.

IMPORTANT: Return your ENTIRE analysis as a single valid JSON object. Do NOT include any text before or after the JSON. The JSON must strictly follow this schema:

{
  "verdict": "pass" | "needs_changes" | "high_risk",
  "score": <integer 0 to 100>,
  "requirement_match": <float 0.0 to 1.0>,
  "summary": "<concise overall summary string of the review, mentioning previous resolution progress if applicable>",
  "strengths": ["<positive observation>", ...],
  "issues": [
    {
      "file": "<filename>",
      "line": <integer line number or 0 if unknown>,
      "severity": "critical" | "high" | "medium" | "low",
      "message": "<description of the issue>",
      "suggestion": "<how to fix it>",
      "status": "new" | "unresolved"
    }
  ],
  "risks": [
    {
      "category": "security" | "safety" | "credential",
      "message": "<description of the risk>",
      "severity": "high" | "medium" | "low",
      "status": "new" | "unresolved"
    }
  ],
  "resolved_issues": [
    {
      "file": "<filename>",
      "line": <integer>,
      "severity": "critical" | "high" | "medium" | "low",
      "message": "<original message>",
      "resolution": "<brief explanation of how the developer fixed this issue>"
    }
  ],
  "resolved_risks": [
    {
      "category": "security" | "safety" | "credential",
      "message": "<original message>",
      "severity": "high" | "medium" | "low",
      "resolution": "<brief explanation of how the developer resolved this security concern>"
    }
  ],
  "unauthorized_file_edits": ["<file path>", ...]
}

Verdict guide:
- "pass": Requirements met well, no critical/high issues, good quality (score >= 75)
- "needs_changes": Minor/major issues found, improvements needed (score 40-74)
- "high_risk": Critical security issues, credential leaks, unauthorized file edits, or severe bugs (score < 40 or blocking issues)`

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
