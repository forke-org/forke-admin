import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sandboxOwners, sandboxRepos, baselineSnapshots } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { runReviewPipeline } from '@/lib/review/runner'
import { analyzeBaselineWithAI } from '@/lib/review/gemini'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { activeJobs } from '@/lib/jobs'

const execPromise = promisify(exec)

export async function POST(request: Request) {
  try {
    const { username, sandboxRepo } = await request.json()

    if (!username || !sandboxRepo) {
      return NextResponse.json({ error: 'Missing required parameters: username, sandboxRepo' }, { status: 400 })
    }

    // 1. Authenticate owner token
    const cookieStore = await cookies()
    let token = cookieStore.get('forke_access_token')?.value

    const ownerRecord = await db
      .select()
      .from(sandboxOwners)
      .where(eq(sandboxOwners.username, username))
      .limit(1)

    if (ownerRecord.length > 0 && !token) {
      token = ownerRecord[0].accessToken
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub access token not found. Please log in again.' }, { status: 401 })
    }

    // 2. Fetch sandbox repo details
    const repoInfo = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .orderBy(desc(sandboxRepos.createdAt))
      .limit(1)

    if (repoInfo.length === 0) {
      return NextResponse.json({ error: 'Sandbox repository not found in database.' }, { status: 404 })
    }

    const sandboxRepoId = repoInfo[0].id
    const repoBasename = sandboxRepo.split('/')[1] || sandboxRepo
    const jobId = `baseline-${repoBasename}-${Date.now()}`
    const tempDir = path.resolve(process.cwd(), 'git-mirrors', jobId)

    // Initialize Job logs
    const jobLogs: string[] = []
    const addLog = (tag: string, message: string) => {
      const formatted = `${tag} ${message}`
      jobLogs.push(formatted)
      const currentJob = activeJobs.get(jobId)
      if (currentJob) {
        currentJob.logs = [...jobLogs]
      }
    }
    const updateProgress = (progress: number) => {
      const currentJob = activeJobs.get(jobId)
      if (currentJob) {
        currentJob.progress = progress
      }
    }

    activeJobs.set(jobId, {
      id: jobId,
      status: 'running',
      progress: 0,
      logs: jobLogs
    })

    // Run baseline pipeline in the background
    ;(async () => {
      try {
        addLog('INIT', `Starting baseline snapshot generation for ${sandboxRepo}`)
        fs.mkdirSync(path.resolve(process.cwd(), 'git-mirrors'), { recursive: true })
        updateProgress(15)

        // A. Clone main/default branch
        addLog('GIT_CLONE', `Cloning sandbox branch for baseline checks...`)
        const authenticatedCloneUrl = `https://x-access-token:${token}@github.com/${sandboxRepo}.git`
        await execPromise(`git clone --depth 1 "${authenticatedCloneUrl}" "${tempDir}"`)
        updateProgress(45)

        // B. Get latest commit SHA
        const { stdout: commitShaOut } = await execPromise(`git -C "${tempDir}" rev-parse HEAD`)
        const commitSha = commitShaOut.trim()

        // C. Run validation checks
        const runResults = await runReviewPipeline(tempDir, commitSha, (tag, msg) => {
          addLog(tag, msg)
        })

        // Run AI diagnostics on baseline
        let aiSummaryStr: string | null = null
        try {
          addLog('AI', 'Triggering Gemini AI baseline diagnostic analysis...')
          const aiDiag = await analyzeBaselineWithAI(
            tempDir,
            runResults.techStack,
            runResults.results,
            (tag, msg) => addLog(tag, msg)
          )
          if (aiDiag) {
            aiSummaryStr = JSON.stringify(aiDiag)
            addLog('AI', `AI diagnostic generated successfully! Health: ${aiDiag.overallHealth}`)
          } else {
            addLog('AI', 'AI diagnostic returned empty report.')
          }
        } catch (aiErr: any) {
          addLog('AI', `AI diagnostic failed: ${aiErr.message || String(aiErr)}`)
        }
        updateProgress(85)

        // D. Save to DB (overwrite if one exists for the branch)
        addLog('CHECKING', 'Saving generated snapshot results to database.')
        const existing = await db
          .select()
          .from(baselineSnapshots)
          .where(eq(baselineSnapshots.sandboxRepoId, sandboxRepoId))
          .orderBy(desc(baselineSnapshots.createdAt))
          .limit(1)

        if (existing.length > 0) {
          await db
            .update(baselineSnapshots)
            .set({
              commitSha,
              techStack: JSON.stringify(runResults.techStack),
              results: JSON.stringify(runResults.results),
              aiSummary: aiSummaryStr,
              createdAt: new Date()
            })
            .where(eq(baselineSnapshots.id, existing[0].id))
        } else {
          await db.insert(baselineSnapshots).values({
            sandboxRepoId,
            branch: 'main',
            commitSha,
            techStack: JSON.stringify(runResults.techStack),
            results: JSON.stringify(runResults.results),
            aiSummary: aiSummaryStr
          })
        }

        addLog('SUCCESS', `Baseline snapshot generation succeeded for commit: ${commitSha}`)
        updateProgress(100)
        const finalJob = activeJobs.get(jobId)
        if (finalJob) {
          finalJob.status = 'success'
        }
      } catch (err: any) {
        console.error(`Baseline snapshot generation failed for ${sandboxRepo}:`, err)
        addLog('FAILED', `Baseline snapshot failed: ${err.message || 'Validation error'}`)
        const finalJob = activeJobs.get(jobId)
        if (finalJob) {
          finalJob.status = 'failed'
        }
      } finally {
        // E. Cleanup temp files
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
      }
    })()

    return NextResponse.json({ success: true, jobId })
  } catch (error: any) {
    console.error('Trigger baseline snapshot error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sandboxRepo = searchParams.get('sandboxRepo')

    if (!sandboxRepo) {
      return NextResponse.json({ error: 'Missing required parameter: sandboxRepo' }, { status: 400 })
    }

    const repoInfo = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .orderBy(desc(sandboxRepos.createdAt))
      .limit(1)

    if (repoInfo.length === 0) {
      return NextResponse.json({ error: 'Sandbox repository not found.' }, { status: 404 })
    }

    const snapshot = await db
      .select()
      .from(baselineSnapshots)
      .where(eq(baselineSnapshots.sandboxRepoId, repoInfo[0].id))
      .orderBy(desc(baselineSnapshots.createdAt))
      .limit(1)

    if (snapshot.length === 0) {
      return NextResponse.json({ snapshot: null })
    }

    return NextResponse.json({
      snapshot: {
        id: snapshot[0].id,
        branch: snapshot[0].branch,
        commitSha: snapshot[0].commitSha,
        techStack: snapshot[0].techStack ? JSON.parse(snapshot[0].techStack) : null,
        results: snapshot[0].results ? JSON.parse(snapshot[0].results) : null,
        aiSummary: snapshot[0].aiSummary ? JSON.parse(snapshot[0].aiSummary) : null,
        createdAt: snapshot[0].createdAt
      }
    })
  } catch (error: any) {
    console.error('Fetch baseline snapshot error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
