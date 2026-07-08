import { NextRequest, NextResponse, after } from 'next/server'
import { db, sandboxRepos, developerForks, sandboxUsers, codeReviews } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { updateCommitStatus } from '@/lib/github/commitStatus'
import { runFullPRPipeline } from '@/lib/review/pipeline'
import { activeJobs } from '@/lib/jobs'

export async function POST(req: NextRequest) {
  try {
    const { username, sandboxRepo, prNumber } = await req.json()

    if (!username || !sandboxRepo || !prNumber) {
      return NextResponse.json(
        { error: 'Missing required parameters: username, sandboxRepo, prNumber' },
        { status: 400 }
      )
    }

    // 1. Get developer fork record
    const forkRecords = await db
      .select()
      .from(developerForks)
      .where(
        and(
          eq(developerForks.githubUsername, username),
          eq(developerForks.sandboxRepo, sandboxRepo)
        )
      )
      .limit(1)

    if (forkRecords.length === 0) {
      return NextResponse.json({ error: 'Developer fork record not found in database' }, { status: 404 })
    }

    const forkRecord = forkRecords[0]

    // 2. Get sandbox repository & owner token
    const sandboxRecords = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .limit(1)

    if (sandboxRecords.length === 0) {
      return NextResponse.json({ error: 'Sandbox repository record not found' }, { status: 404 })
    }

    const sandboxRecord = sandboxRecords[0]

    const ownerRecords = await db
      .select()
      .from(sandboxUsers)
      .where(and(eq(sandboxUsers.id, sandboxRecord.ownerId), eq(sandboxUsers.role, 'owner')))
      .limit(1)

    if (ownerRecords.length === 0) {
      return NextResponse.json({ error: 'Sandbox owner not found' }, { status: 404 })
    }

    const ownerToken = ownerRecords[0].accessToken

    // 3. Fetch PR info from GitHub API to get title, description, and head SHA
    const prResponse = await fetch(`https://api.github.com/repos/${sandboxRepo}/pulls/${prNumber}`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Forke-Sandbox-App',
      },
    })

    if (!prResponse.ok) {
      const errText = await prResponse.text()
      console.error(`[Trigger Review] Failed to fetch PR #${prNumber} from GitHub: ${errText}`)
      return NextResponse.json({ error: `GitHub API returned error: ${prResponse.statusText}` }, { status: 500 })
    }

    const prData = await prResponse.json()
    const prTitle = prData.title || ''
    const prBody = prData.body || ''
    const headSha = prData.head?.sha
    const developerUsername = prData.user?.login

    if (!headSha) {
      return NextResponse.json({ error: 'Could not retrieve head commit SHA for PR' }, { status: 400 })
    }

    // Update PR URL in db if it's different or missing
    if (prData.html_url && forkRecord.prUrl !== prData.html_url) {
      await db
        .update(developerForks)
        .set({ prUrl: prData.html_url })
        .where(eq(developerForks.id, forkRecord.id))
    }

    // 4. Check commit status on GitHub for this SHA to see if already verified
    const statusesUrl = `https://api.github.com/repos/${sandboxRepo}/commits/${headSha}/statuses`
    const statusesResponse = await fetch(statusesUrl, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Forke-Sandbox-App',
      },
    })

    let isPending = false
    let isCompleted = false

    if (statusesResponse.ok) {
      const statuses = await statusesResponse.json()
      const forkeStatus = statuses.find((s: any) => s.context === 'Forke AI Review')
      if (forkeStatus) {
        if (forkeStatus.state === 'pending') {
          isPending = true
        } else {
          isCompleted = true
        }
      }
    }

    // Check database to see if we actually have a saved review report
    const existingReviews = await db
      .select()
      .from(codeReviews)
      .where(
        and(
          eq(codeReviews.sandboxRepoId, sandboxRecord.id),
          eq(codeReviews.commitSha, headSha)
        )
      )
      .limit(1)

    const hasSavedReview = existingReviews.length > 0

    // Bypassed check to allow manual verification report generation
    /*
    if (isCompleted && hasSavedReview) {
      return NextResponse.json({
        triggered: false,
        message: 'Review already complete for this commit SHA.',
      })
    }
    */

    if (isPending) {
      let foundJobId: string | null = null
      for (const [key, value] of activeJobs.entries()) {
        if (key.startsWith(`pr-review-${prNumber}-`) && value.status === 'running') {
          foundJobId = key
          break
        }
      }
      return NextResponse.json({
        triggered: false,
        jobId: foundJobId,
        message: 'AI Review is currently in progress in the background.',
      })
    }

    // Set commit status to pending immediately on GitHub
    await updateCommitStatus({
      repoFullName: sandboxRepo,
      sha: headSha,
      verdict: 'pending',
      accessToken: ownerToken,
      prNumber: parseInt(prNumber, 10),
    })

    const jobId = `pr-review-${prNumber}-${Date.now()}`
    activeJobs.set(jobId, {
      id: jobId,
      status: 'running',
      progress: 5,
      logs: ['INIT Pull request verification triggered.']
    })

    // 5. Trigger review asynchronously using Next.js after()
    after(async () => {
      try {
        await runFullPRPipeline({
          sandboxId: sandboxRecord.id,
          ownerToken,
          prNumber: parseInt(prNumber, 10),
          prTitle,
          prBody,
          headSha,
          developerUsername,
          repoFullName: sandboxRepo,
          developerForkId: forkRecord.id,
          jobId
        })
      } catch (err) {
        console.error('[Trigger Review API] Background pipeline error:', err)
      }
    })

    return NextResponse.json({
      triggered: true,
      jobId,
      message: 'AI review pipeline triggered successfully.',
    }, { status: 202 })

  } catch (error: any) {
    console.error('[Trigger Review API] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
