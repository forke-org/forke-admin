/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { db } from '../db'
import { sandboxRepos, baselineSnapshots, tasks } from '../db/schema'
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
  taskId?: string // The tasks table ID — when set, mirror updates task status on completion
}

/**
 * Pushes the cloned repository incrementally to bypass payload size and network speed limits.
 */
async function pushMirrorIncrementally(
  tempDir: string,
  authenticatedPushUrl: string,
  addLog: (tag: string, message: string) => void
): Promise<void> {
  const { stdout: refsOut } = await execPromise(`git -C "${tempDir}" for-each-ref --format="%(refname)" refs/heads/`)
  const branches = refsOut.trim().split('\n').filter(Boolean)
  
  addLog('GIT_PUSH', `Incremental Push: Detected ${branches.length} branches to mirror: ${branches.join(', ')}`)
  
  for (const branch of branches) {
    addLog('GIT_PUSH', `Pushing branch ${branch} incrementally...`)
    const { stdout: commitsOut } = await execPromise(`git -C "${tempDir}" rev-list --reverse "${branch}"`)
    const commits = commitsOut.trim().split('\n').filter(Boolean)
    const totalCommits = commits.length
    
    if (totalCommits === 0) {
      addLog('GIT_PUSH', `No commits found for branch ${branch}`)
      continue
    }
    
    let currentIndex = 0
    let batchSize = 20
    
    while (currentIndex < totalCommits) {
      const targetIndex = Math.min(currentIndex + batchSize - 1, totalCommits - 1)
      const targetSha = commits[targetIndex]
      
      addLog('GIT_PUSH', `Pushing ${branch} batch: commits ${currentIndex + 1} to ${targetIndex + 1} of ${totalCommits} (batch size: ${batchSize})`)
      
      let attempt = 0
      let success = false
      let lastError: any = null
      
      while (attempt < 3 && !success) {
        attempt++
        try {
          const pushCmd = `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 -C "${tempDir}" push -f "${authenticatedPushUrl}" "${targetSha}:${branch}"`
          await execPromise(pushCmd)
          success = true
        } catch (err: any) {
          lastError = err
          addLog('GIT_PUSH_WARNING', `Push attempt ${attempt} failed: ${err.message}`)
          if (attempt < 3 && batchSize === 1) {
            addLog('GIT_PUSH', 'Retrying single commit push in 3 seconds...')
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
      }
      
      if (success) {
        currentIndex = targetIndex + 1
        batchSize = Math.min(batchSize * 2, 50)
      } else {
        if (batchSize === 1) {
          throw new Error(`Failed to push single commit ${targetSha} after 3 attempts: ${lastError.message}`)
        }
        batchSize = Math.max(1, Math.floor(batchSize / 2))
        addLog('GIT_PUSH', `Reducing batch size to ${batchSize} due to push failure.`)
      }
    }
    addLog('GIT_PUSH_SUCCESS', `Successfully pushed branch ${branch}`)
  }
  
  try {
    addLog('GIT_PUSH', 'Mirroring tags...')
    await execPromise(`git -C "${tempDir}" push -f "${authenticatedPushUrl}" "+refs/tags/*:refs/tags/*"`)
    addLog('GIT_PUSH_SUCCESS', 'Tags mirrored successfully.')
  } catch (tagErr: any) {
    addLog('GIT_PUSH_WARNING', `Failed to mirror tags: ${tagErr.message}`)
  }
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
    await execPromise(`git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 clone --mirror "${authenticatedCloneUrl}" "${tempDir}"`)
    
    addLog('GIT_CLONE_SUCCESS', 'Original repository cloned successfully.')
    updateProgress(70)

    // Step D: Push bare mirror branches and tags
    addLog('GIT_PUSH', `Pushing branches and tags to sandbox repository ${fullTargetRepoPath}.`)
    
    const authenticatedPushUrl = `https://x-access-token:${token}@github.com/${fullTargetRepoPath}.git`
    let pushCommand = `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 -C "${tempDir}" push --prune "${authenticatedPushUrl}" "+refs/heads/*:refs/heads/*"`
    
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

    try {
      await execPromise(pushCommand)
      addLog('GIT_PUSH_SUCCESS', 'Bare mirror pushed successfully.')
    } catch (pushErr: any) {
      addLog('GIT_PUSH_WARNING', 'Full history push timed out or failed. Attempting incremental mirror push to bypass connection constraints...')
      console.warn('Full mirror push failed, attempting incremental mirror push:', pushErr)
      await pushMirrorIncrementally(tempDir, authenticatedPushUrl, addLog)
    }
    
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
      await execPromise(`git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 clone --depth 1 "${authenticatedCloneUrl}" "${tempReviewDir}"`)

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

    // Step H: If a taskId was provided, transition the task from 'processing' to 'open'
    //         and link the sandboxRepoId so we can track the task ↔ sandbox relationship.
    if (params.taskId && sandboxRepoId) {
      try {
        await db.update(tasks).set({
          status: 'open',
          sandboxRepoId: sandboxRepoId,
        }).where(eq(tasks.id, params.taskId))
        addLog('SUCCESS', `Task ${params.taskId} is now live and visible to developers!`)
      } catch (taskUpdateErr: any) {
        addLog('FAILED', `Failed to update task status: ${taskUpdateErr.message}`)
        console.error('[MirrorJob] Failed to update task status:', taskUpdateErr)
      }
    }

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
