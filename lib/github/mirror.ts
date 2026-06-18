import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { db } from '../db'
import { sandboxRepos, baselineSnapshots } from '../db/schema'
import { activeJobs } from '../jobs'
import { runReviewPipeline } from '../review/runner'
import { analyzeBaselineWithAI } from '../review/gemini'
import { eq } from 'drizzle-orm'

const execPromise = promisify(exec)

export interface MirrorParams {
  jobId: string
  token: string
  ownerId: string
  sourceRepo: string
  targetSpace: string // e.g. "forke-sandbox"
  targetRepoName: string
  taskTitle?: string
  taskDescription?: string
  frontendStack?: string
  backendStack?: string
  allowedPaths?: string
  restrictedPaths?: string
  acceptanceCriteria?: string
  sandboxRepoId?: string
}

/**
 * Executes a bare git repository clone and push mirror to the designated target organization.
 * Emits real-time progress to the activeJobs tracking singleton.
 */
export async function runMirrorJob(params: MirrorParams): Promise<void> {
  const { 
    jobId, 
    token, 
    ownerId, 
    sourceRepo, 
    targetSpace, 
    targetRepoName,
    taskTitle,
    taskDescription,
    frontendStack,
    backendStack,
    allowedPaths,
    restrictedPaths,
    acceptanceCriteria,
    sandboxRepoId
  } = params
  const fullTargetRepoPath = `${targetSpace}/${targetRepoName}`
  const tempDir = path.join(process.cwd(), 'git-mirrors', jobId)

  const addLog = (tag: string, message: string) => {
    const formatted = `${tag} ${message}`
    console.log(`[MirrorJob ${jobId}] ${formatted}`)
    const currentJob = activeJobs.get(jobId)
    if (currentJob) {
      currentJob.logs.push(formatted)
    }
  }

  const updateProgress = (progress: number) => {
    const currentJob = activeJobs.get(jobId)
    if (currentJob) {
      currentJob.progress = progress
    }
  }

  try {
    addLog('INIT', 'Initializing GitHub contribution mirror engine.')
    updateProgress(10)

    // Step A: Check if repository exists on target GitHub Space
    addLog('CHECKING', `Validating target repository ${fullTargetRepoPath}.`)
    const checkRepoResponse = await fetch(`https://api.github.com/repos/${fullTargetRepoPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
        Accept: 'application/vnd.github+json',
      }
    })

    updateProgress(25)

    if (checkRepoResponse.status === 404) {
      addLog('CREATING', `Creating new sandbox repository ${fullTargetRepoPath} on GitHub.`)
      
      const createUrl = `https://api.github.com/orgs/${targetSpace}/repos`

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Forke-Complete-Review-Engine/1.0',
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          name: targetRepoName,
          description: `Mirrored sandbox repository from ${sourceRepo}`,
          private: true, // Sandbox repositories are always private for safety
          has_issues: true,
          has_projects: false,
          has_wiki: false
        })
      })

      const createData = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(`GitHub Repo Creation Failed: ${createData.message || JSON.stringify(createData)}`)
      }

      addLog('CREATED', `Repository ${fullTargetRepoPath} created successfully.`)
    } else if (checkRepoResponse.ok) {
      addLog('CHECKING', `Repository ${fullTargetRepoPath} already exists on GitHub. Proceeding with mirror updates.`)
    } else {
      const checkError = await checkRepoResponse.json()
      throw new Error(`Failed to check repository existence: ${checkError.message}`)
    }

    updateProgress(40)

    // Step B: Set up local git-mirrors directory
    addLog('GIT_INIT', 'Initializing local git-mirrors directory.')
    fs.mkdirSync(path.join(process.cwd(), 'git-mirrors'), { recursive: true })

    // Step C: Clone original repo as bare mirror
    addLog('GIT_CLONE', `Cloning original repository (${sourceRepo}) as bare mirror.`)
    
    const authenticatedCloneUrl = `https://x-access-token:${token}@github.com/${sourceRepo}.git`
    await execPromise(`git clone --mirror "${authenticatedCloneUrl}" "${tempDir}"`)
    
    addLog('GIT_CLONE_SUCCESS', 'Original repository cloned successfully.')
    updateProgress(70)

    // Step D: Push bare mirror branches and tags
    addLog('GIT_PUSH', `Pushing branches and tags to sandbox repository ${fullTargetRepoPath}.`)
    
    const authenticatedPushUrl = `https://x-access-token:${token}@github.com/${fullTargetRepoPath}.git`
    let pushCommand = `git -C "${tempDir}" push --prune "${authenticatedPushUrl}" "+refs/heads/*:refs/heads/*"`
    
    // Check tags safely
    try {
      const { stdout: tagOutput } = await execPromise(`git -C "${tempDir}" tag`)
      if (tagOutput.trim()) {
        pushCommand += ` "+refs/tags/*:refs/tags/*"`
        addLog('GIT_PUSH', 'Detected repository tags. Mirroring branches and tags.')
      } else {
        addLog('GIT_PUSH', 'No tags detected. Mirroring branches only.')
      }
    } catch (tagErr) {
      console.log('No tags found or tag listing failed, defaulting to branches only:', tagErr)
    }

    await execPromise(pushCommand)
    
    addLog('GIT_PUSH_SUCCESS', 'Bare mirror pushed successfully.')
    updateProgress(90)

    // Step E: Clean up local disk mirror
    addLog('CLEANUP', 'Cleaning up local mirror files.')
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }

    // Step F: Save or update sandbox record in database
    let sandboxRepoId = params.sandboxRepoId

    if (sandboxRepoId) {
      await db.update(sandboxRepos).set({
        taskTitle: taskTitle || null,
        taskDescription: taskDescription || null,
        frontendStack: frontendStack || null,
        backendStack: backendStack || null,
        allowedPaths: allowedPaths || null,
        restrictedPaths: restrictedPaths || null,
        acceptanceCriteria: acceptanceCriteria || null,
        verificationStatus: 'verified' // Update to verified since git push was successful
      }).where(eq(sandboxRepos.id, sandboxRepoId))
    } else {
      const [insertedSandbox] = await db.insert(sandboxRepos).values({
        ownerId,
        sourceRepo,
        sandboxRepo: fullTargetRepoPath,
        taskTitle: taskTitle || null,
        taskDescription: taskDescription || null,
        frontendStack: frontendStack || null,
        backendStack: backendStack || null,
        allowedPaths: allowedPaths || null,
        restrictedPaths: restrictedPaths || null,
        acceptanceCriteria: acceptanceCriteria || null,
        verificationStatus: 'verified' // Set immediately to verified
      }).returning()
      sandboxRepoId = insertedSandbox.id
    }

    // Step G: Generate Automatic Baseline Snapshot with live logs in the terminal
    addLog('INIT', 'Starting automatic baseline snapshot generation.')
    updateProgress(92)
    
    const tempReviewDir = path.resolve(process.cwd(), 'git-mirrors', `baseline-${jobId}`)
    
    try {
      addLog('GIT_CLONE', `Cloning mirrored sandbox repository for baseline analysis.`)
      const authenticatedCloneUrl = `https://x-access-token:${token}@github.com/${fullTargetRepoPath}.git`
      await execPromise(`git clone --depth 1 "${authenticatedCloneUrl}" "${tempReviewDir}"`)

      // Retrieve commit SHA
      const { stdout: commitShaOut } = await execPromise(`git -C "${tempReviewDir}" rev-parse HEAD`)
      const commitSha = commitShaOut.trim()

      // Execute Review Pipeline using the live logs callback!
      const reviewResult = await runReviewPipeline(tempReviewDir, commitSha, (tag, msg) => {
        addLog(tag, msg)
      })

      // Run AI diagnostics on baseline
      let aiSummaryStr: string | null = null
      try {
        addLog('AI', 'Triggering Gemini AI baseline diagnostic analysis...')
        const aiDiag = await analyzeBaselineWithAI(
          tempReviewDir,
          reviewResult.techStack,
          reviewResult.results,
          (tag, msg) => addLog(tag, msg)
        )
        if (aiDiag) {
          aiSummaryStr = JSON.stringify(aiDiag)
          addLog('AI', `AI diagnostic generated successfully! Health: ${aiDiag.overallHealth}`)
        } else {
          addLog('AI', 'AI diagnostic returned empty report. Proceeding without AI summary.')
        }
      } catch (aiErr: any) {
        addLog('AI', `AI diagnostic failed: ${aiErr.message || String(aiErr)}`)
      }

      addLog('CHECKING', 'Saving baseline snapshot to database.')
      await db.insert(baselineSnapshots).values({
        sandboxRepoId,
        branch: 'main',
        commitSha,
        techStack: JSON.stringify(reviewResult.techStack),
        results: JSON.stringify(reviewResult.results),
        aiSummary: aiSummaryStr
      })
      
      addLog('SUCCESS', 'Automatic baseline snapshot generated successfully!')

    } catch (baselineErr: any) {
      console.error('Automatic baseline generation failed:', baselineErr)
      addLog('FAILED', `Automatic baseline snapshot failed: ${baselineErr.message || 'Validation error'}`)
      // Note: We do not re-throw baselineErr to avoid triggering the outer catch block
      // which would mark the entire mirror job status as failed.
    } finally {
      if (fs.existsSync(tempReviewDir)) {
        fs.rmSync(tempReviewDir, { recursive: true, force: true })
      }
    }

    addLog('SUCCESS', 'Repository mirroring and baseline scan completed successfully!')
    updateProgress(100)

    const finalJob = activeJobs.get(jobId)
    if (finalJob) {
      finalJob.status = 'success'
    }
  } catch (err: any) {
    console.error('[MirrorJob] Mirror Pipeline Async Error:', err)
    addLog('FAILED', `Mirror pipeline failed: ${err.message}`)
    
    // Clean up temp directory on failure
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupErr) {
        console.error('Failed to clean up dir on error:', cleanupErr)
      }
    }

    const finalJob = activeJobs.get(jobId)
    if (finalJob) {
      finalJob.status = 'failed'
    }
    throw err
  }
}
