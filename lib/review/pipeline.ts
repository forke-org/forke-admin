import { db } from '../db'
import { sandboxRepos, baselineSnapshots, codeReviews, developerForks } from '../db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { runReviewPipeline } from './runner'
import { compareToBaseline } from './comparison'
import { 
  validateFileBoundaries, 
  scanPRSecrets, 
  checkDependencyChanges, 
  validateForkeSubmission, 
  parsePathList 
} from './scopeValidator'
import { buildReviewContext, truncateDiff, PreviousReviewData } from './contextBuilder'
import { runAIReview } from './gemini'
import { calculateFinalScore } from './scoreEngine'
import { updateCommitStatus } from '../github/commitStatus'
import { fetchPRFiles, fetchRepoTree, buildGitDiff } from '../github/prFetcher'
import { registerReviewJob, unregisterReviewJob } from '../activeReviews'
import { activeJobs } from '../jobs'
import path from 'path'
import fs from 'fs'

export interface PipelineParams {
  sandboxId: string
  ownerToken: string
  prNumber: number
  prTitle: string
  prBody: string
  headSha: string
  developerUsername: string
  repoFullName: string
  developerForkId?: string // Optional, null if reviewed within task branch directly
  jobId?: string
}

/**
 * Full 4-Layer PR Submission Review Pipeline
 * Coordinates deterministic execution, context gathering, AI reasoning, and risk calculation.
 */
export async function runFullPRPipeline(params: PipelineParams) {
  const {
    sandboxId,
    ownerToken,
    prNumber,
    prTitle,
    prBody,
    headSha,
    developerUsername,
    repoFullName,
    developerForkId,
    jobId
  } = params

  const addLog = (tag: string, message: string) => {
    const formatted = `${tag} ${message}`
    console.log(`[ReviewPipelineJob ${jobId || 'none'}] ${formatted}`)
    if (jobId) {
      const currentJob = activeJobs.get(jobId)
      if (currentJob) {
        currentJob.logs.push(formatted)
      }
    }
  }

  const updateProgress = (progress: number) => {
    if (jobId) {
      const currentJob = activeJobs.get(jobId)
      if (currentJob) {
        currentJob.progress = progress
      }
    }
  }

  addLog('INIT', `Starting 4-layer orchestrator for PR #${prNumber} on ${repoFullName}`)
  updateProgress(5)

  // Track the active job so we can abort if a newer push occurs
  const abortController = registerReviewJob(repoFullName, prNumber)
  const signal = abortController.signal

  const jobDirName = `pipeline-job-${prNumber}-${Date.now()}`
  const checkoutDir = path.join(process.cwd(), 'git-mirrors', jobDirName)

  try {
    // 0. Fetch the Sandbox record containing task criteria and configuration
    addLog('CHECKING', 'Fetching sandbox configuration from database...')
    const sandboxes = await db.select().from(sandboxRepos).where(eq(sandboxRepos.id, sandboxId))
    if (sandboxes.length === 0) {
      throw new Error(`Sandbox record with ID ${sandboxId} not found.`)
    }
    const sandbox = sandboxes[0]
    updateProgress(10)

    // Fetch the latest baseline snapshot to compare test results against
    const baselines = await db
      .select()
      .from(baselineSnapshots)
      .where(eq(baselineSnapshots.sandboxRepoId, sandboxId))
      .orderBy(desc(baselineSnapshots.createdAt))
      .limit(1)

    const baseline = baselines.length > 0 ? baselines[0] : null
    if (!baseline) {
      addLog('WARN', `No baseline snapshot found for sandbox ${sandboxId}. Baseline comparison will be skipped.`)
    } else {
      addLog('CHECKING', `Found baseline snapshot. Commit: ${baseline.commitSha}`)
    }
    updateProgress(15)

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 1: Automated Validation & Pre-screening
    // ─────────────────────────────────────────────────────────────────────────
    addLog('INIT', 'LAYER 1: Running automated validation...')
    updateProgress(20)

    // A. Fetch PR files and assemble the diff via GitHub API
    addLog('CHECKING', 'Fetching PR changed files and git diff from GitHub...')
    const prFiles = await fetchPRFiles(repoFullName, prNumber, ownerToken)
    const changedFileNames = prFiles.map(f => f.filename)
    const rawDiff = buildGitDiff(prFiles)
    const gitDiff = truncateDiff(rawDiff)
    addLog('CHECKING', `Fetched ${changedFileNames.length} changed file(s).`)
    updateProgress(25)

    // B. Validate File Boundaries (deterministic)
    addLog('CHECKING', 'Validating project file changes against owner restrictions...')
    const allowedPaths = parsePathList(sandbox.allowedPaths)
    const restrictedPaths = parsePathList(sandbox.restrictedPaths)
    const unauthorizedFiles = validateFileBoundaries(changedFileNames, allowedPaths)
    if (unauthorizedFiles.length > 0) {
      addLog('WARN', `Detected ${unauthorizedFiles.length} unauthorized file modification(s).`)
    } else {
      addLog('SUCCESS', 'File path modifications conform to boundaries.')
    }
    updateProgress(30)

    // C. Flag Dependency Changes
    addLog('CHECKING', 'Checking manifest changes for package changes...')
    const dependencyChanges = checkDependencyChanges(changedFileNames)
    updateProgress(33)

    // D. Clone repository locally for isolated test runner execution
    addLog('GIT_CLONE', `Cloning PR ref to execute local tests...`)
    fs.mkdirSync(checkoutDir, { recursive: true })
    const authenticatedUrl = `https://x-access-token:${ownerToken}@github.com/${repoFullName}.git`
    
    // We clone base, fetch PR head, and checkout
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execPromise = promisify(exec)

    await execPromise(`git clone "${authenticatedUrl}" "${checkoutDir}"`)
    await execPromise(`git -C "${checkoutDir}" fetch origin pull/${prNumber}/head:pr-${prNumber}`)
    await execPromise(`git -C "${checkoutDir}" checkout pr-${prNumber}`)
    addLog('GIT_CLONE', 'Local repository checked out successfully.')
    updateProgress(45)

    // E. Scan checkout dir for hardcoded secrets
    addLog('CHECKING', 'Scanning workspace for hardcoded secrets...')
    const secretFindings = await scanPRSecrets(checkoutDir, changedFileNames)
    if (secretFindings.length > 0) {
      addLog('WARN', `Secrets scanner flagged ${secretFindings.length} potential secret(s).`)
    }
    updateProgress(50)

    // F. Validate Forke Submission Report File
    addLog('CHECKING', 'Checking for presence of FORKE_SUBMISSION.md...')
    const submissionValidation = validateForkeSubmission(checkoutDir)
    updateProgress(55)

    // G. Run the 12-category deterministic execution pipeline
    addLog('INIT', 'Starting 12-category deterministic execution pipeline...')
    const deterministicResults = await runReviewPipeline(checkoutDir, headSha, (tag, msg) => {
      addLog(tag, msg)
    })
    addLog('SUCCESS', 'Layer 1 deterministic tests complete.')
    updateProgress(75)

    // H. Execute Baseline Comparison
    addLog('CHECKING', 'Comparing PR verification results against repository baseline...')
    let comparisonReport = null
    let finalDeterministicVerdict: 'pass' | 'warn' | 'fail' = 'pass'
    let reportHtml = ''

    if (baseline && baseline.results) {
      try {
        const parsedBaselineResults = JSON.parse(baseline.results)
        comparisonReport = compareToBaseline(parsedBaselineResults, deterministicResults.results)
        
        // Map comparison findings to verdict
        const regressionCount = Object.keys(comparisonReport.regressions).length
        const debtCount = Object.keys(comparisonReport.baselineDebt).length
        
        if (regressionCount > 0) {
          finalDeterministicVerdict = 'fail'
          addLog('WARN', `Regressions detected: ${regressionCount} failure(s) not present in baseline.`)
        } else {
          addLog('SUCCESS', 'Zero regressions found compared to baseline.')
        }
        
        if (debtCount > 0 || unauthorizedFiles.length > 0 || secretFindings.length > 0) {
          if (finalDeterministicVerdict !== 'fail') {
            finalDeterministicVerdict = 'warn'
          }
        }
        
        // Generate a visual report summary HTML
        reportHtml = comparisonReport.summaryHtml
      } catch (err) {
        addLog('FAILED', `Failed baseline comparison: ${err}`)
      }
    }
    updateProgress(80)

    updateProgress(83)

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 2: Context Assembly
    // ─────────────────────────────────────────────────────────────────────────
    addLog('INIT', 'LAYER 2: Assembling codebase review context...')
    updateProgress(85)
    
    // Fetch repository tree representation
    addLog('CHECKING', 'Constructing file system tree structure context...')
    const repoStructure = await fetchRepoTree(repoFullName, headSha, ownerToken)

    // Retrieve previous PR review if incremental review is occurring
    let previousReviewData: PreviousReviewData | undefined = undefined
    try {
      const query = db
        .select({
          score: codeReviews.aiScore,
          verdict: codeReviews.aiVerdict,
          summary: codeReviews.aiSummary,
          issues: codeReviews.aiIssues,
          risks: codeReviews.aiRisks,
        })
        .from(codeReviews)
        .where(
          and(
            eq(codeReviews.sandboxRepoId, sandboxId),
            eq(codeReviews.prNumber, prNumber)
          )
        )
        .orderBy(desc(codeReviews.createdAt))
        .limit(1)

      const previousReviews = await query
      if (previousReviews.length > 0) {
        const first = previousReviews[0]
        previousReviewData = {
          score: first.score ?? 100,
          verdict: first.verdict ?? 'pass',
          summary: first.summary ?? '',
          issues: first.issues,
          risks: first.risks,
        }
        addLog('CHECKING', 'Incremental review context: Found previous review findings.')
      } else if (baseline) {
        // Fall back to comparing against the original baseline snapshot findings
        previousReviewData = {
          score: baseline.aiSummary ? 80 : 100,
          verdict: 'pass',
          summary: baseline.aiSummary || 'Repository baseline scan complete.',
          issues: null,
          risks: null
        }
      }
    } catch (e) {
      addLog('WARN', `Error reading history context: ${e}`)
    }

    // Build LLM prompts
    const { systemPrompt, userMessage } = buildReviewContext(
      {
        prNumber,
        prTitle,
        prDescription: prBody,
        developerUsername,
        changedFiles: changedFileNames,
        gitDiff,
        repoStructure
      },
      {
        taskTitle: sandbox.taskTitle || 'Coding Task',
        taskDescription: sandbox.taskDescription || '',
        frontendStack: sandbox.frontendStack || '',
        backendStack: sandbox.backendStack || '',
        allowedPaths,
        restrictedPaths,
        acceptanceCriteria: sandbox.acceptanceCriteria || ''
      },
      previousReviewData
    )
    updateProgress(88)

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 3: AI Code Review Verdict
    // ─────────────────────────────────────────────────────────────────────────
    addLog('INIT', 'LAYER 3: Triggering Gemini AI review...')
    updateProgress(90)
    const aiResult = await runAIReview(systemPrompt, userMessage, signal)
    addLog('SUCCESS', 'Gemini AI Code Review completed.')

    // ─────────────────────────────────────────────────────────────────────────
    // LAYER 4: Risk Scoring & Routing
    // ─────────────────────────────────────────────────────────────────────────
    addLog('INIT', 'LAYER 4: Assessing risk metrics and routing...')
    updateProgress(95)

    // Inject any deterministic warnings into the AI review list
    if (unauthorizedFiles.length > 0) {
      aiResult.unauthorized_file_edits = Array.from(new Set([
        ...aiResult.unauthorized_file_edits,
        ...unauthorizedFiles
      ]))
    }

    // Inject secret findings as high-risk security items
    if (secretFindings.length > 0) {
      for (const secret of secretFindings) {
        aiResult.risks.push({
          category: 'credential',
          message: `Potential credential/secret leak in ${secret.file}:${secret.line} (${secret.type})`,
          severity: 'high',
          status: 'new'
        })
      }
    }

    // Inject missing FORKE_SUBMISSION.md check
    if (!submissionValidation.valid) {
      aiResult.issues.push({
        file: 'FORKE_SUBMISSION.md',
        line: 0,
        severity: 'high',
        message: submissionValidation.error || 'Submission report is incomplete or missing.',
        suggestion: 'Create a FORKE_SUBMISSION.md in the root directory summarizing your implementation, features, and self-evaluation.',
        status: 'new'
      })
    }

    // Run the scoring algorithms
    const { finalScore, finalVerdict } = calculateFinalScore(aiResult, unauthorizedFiles)

    // Compute composite risk score (Layer 4)
    // 0-100 where higher is riskier
    let compositeRisk = 0
    if (finalVerdict === 'high_risk') {
      compositeRisk = 90 + Math.floor(Math.random() * 10) // 90-100
    } else if (finalVerdict === 'needs_changes') {
      compositeRisk = 40 + (100 - finalScore) * 0.5 // 40-74
    } else {
      compositeRisk = Math.max(0, Math.floor((100 - finalScore) * 0.3)) // 0-30
    }

    // Risk routing categories:
    // ≤ 30: 'auto_approve'
    // 31-70: 'owner_review'
    // > 70: 'reviewer_queue'
    let riskRouting: 'auto_approve' | 'owner_review' | 'reviewer_queue' = 'owner_review'
    if (compositeRisk <= 30 && finalVerdict === 'pass') {
      riskRouting = 'auto_approve'
    } else if (compositeRisk > 70 || finalVerdict === 'high_risk') {
      riskRouting = 'reviewer_queue'
    }

    // Save Unified PR Review Result to database (both deterministic and AI metrics)
    addLog('CHECKING', 'Saving unified verification and AI review results to database...')
    await db.insert(codeReviews).values({
      prNumber,
      sandboxRepoId: sandboxId,
      developerForkId: developerForkId || null,
      commitSha: headSha,
      baselineSnapshotId: baseline ? baseline.id : null,
      // Deterministic Results
      results: JSON.stringify({
        ...deterministicResults,
        scoreBreakdown: aiResult.scoreBreakdown
      }),
      comparison: comparisonReport ? JSON.stringify(comparisonReport) : '{}',
      verdict: finalDeterministicVerdict,
      reportHtml,
      // AI Review Metrics
      aiVerdict: finalVerdict,
      aiScore: finalScore,
      requirementMatch: String(aiResult.requirement_match),
      aiSummary: aiResult.summary,
      aiStrengths: aiResult.strengths.length > 0 ? JSON.stringify(aiResult.strengths) : null,
      aiIssues: aiResult.issues.length > 0 ? JSON.stringify(aiResult.issues) : null,
      aiRisks: aiResult.risks.length > 0 ? JSON.stringify(aiResult.risks) : null,
      unauthorizedEdits: aiResult.unauthorized_file_edits.length > 0 ? JSON.stringify(aiResult.unauthorized_file_edits) : null,
      resolvedIssues: aiResult.resolved_issues && aiResult.resolved_issues.length > 0 ? JSON.stringify(aiResult.resolved_issues) : null,
      resolvedRisks: aiResult.resolved_risks && aiResult.resolved_risks.length > 0 ? JSON.stringify(aiResult.resolved_risks) : null,
      riskScore: compositeRisk,
      riskRouting,
      aiModel: 'gemini-2.5-flash'
    })

    // Update the commit check status inside the GitHub PR UI
    addLog('CHECKING', 'Updating commit status check on GitHub...')
    await updateCommitStatus({
      repoFullName,
      sha: headSha,
      verdict: finalVerdict,
      score: finalScore,
      accessToken: ownerToken,
      prNumber
    })

    addLog('SUCCESS', `✅ E2E Review Complete! Score: ${finalScore}/100, Verdict: ${finalVerdict}, Routing: ${riskRouting}`)
    updateProgress(100)
    if (jobId) {
      const finalJob = activeJobs.get(jobId)
      if (finalJob) {
        finalJob.status = 'success'
      }
    }

  } catch (err: any) {
    if (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
      addLog('FAILED', `Job aborted for PR #${prNumber} due to newer synchronization push.`)
      if (jobId) {
        const finalJob = activeJobs.get(jobId)
        if (finalJob) {
          finalJob.status = 'failed'
        }
      }
      return
    }

    addLog('FAILED', `Critical failure running review pipeline: ${err.message || String(err)}`)
    if (jobId) {
      const finalJob = activeJobs.get(jobId)
      if (finalJob) {
        finalJob.status = 'failed'
      }
    }
    
    // Update commit check status to failure safely
    await updateCommitStatus({
      repoFullName,
      sha: headSha,
      verdict: 'high_risk',
      score: 0,
      accessToken: ownerToken,
      prNumber
    }).catch(() => {})

  } finally {
    // Delete local workspace checking folder
    try {
      if (fs.existsSync(checkoutDir)) {
        fs.rmSync(checkoutDir, { recursive: true, force: true })
      }
    } catch (e) {
      console.error(`[Pipeline] Failed to clean up checkout workspace:`, e)
    }
    
    unregisterReviewJob(repoFullName, prNumber)
  }
}
