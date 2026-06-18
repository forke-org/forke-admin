import { NextRequest, NextResponse, after } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sandboxRepos, developerForks, sandboxOwners, sandboxDevelopers, reviewResults, aiReviews, baselineSnapshots } from '@/lib/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { updateCommitStatus } from '@/lib/github/commitStatus'
import { runFullPRPipeline } from '@/lib/review/pipeline'

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
      .from(sandboxOwners)
      .where(eq(sandboxOwners.id, sandboxRecord.ownerId))
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
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
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
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
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

    if (isCompleted) {
      return NextResponse.json({
        triggered: false,
        message: 'Review already complete for this commit SHA.',
      })
    }

    if (isPending) {
      return NextResponse.json({
        triggered: false,
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

    const jobId = `review-${prNumber}-${Date.now()}`

    // 5. Trigger full 4-layer review pipeline asynchronously
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
          developerForkId: forkRecord.id
        })
      } catch (err) {
        console.error('[Trigger Review API] Background pipeline error:', err)
      }
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'AI review pipeline triggered successfully.',
    }, { status: 202 })

  } catch (error: any) {
    console.error('[Trigger Review API] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const username = searchParams.get('username')
    const sandboxRepo = searchParams.get('sandboxRepo')
    const prNumberStr = searchParams.get('prNumber')
    const sandboxRepoId = searchParams.get('sandboxRepoId')

    // If sandboxRepoId is requested, return the baseline review
    if (sandboxRepoId) {
      const reviews = await db
        .select()
        .from(aiReviews)
        .where(
          and(
            eq(aiReviews.sandboxRepoId, sandboxRepoId),
            isNull(aiReviews.developerForkId)
          )
        )
        .orderBy(desc(aiReviews.createdAt))
        .limit(1)

      if (reviews.length === 0) {
        return NextResponse.json({ review: null, message: 'No baseline AI review found' }, { status: 200 })
      }

      const review = reviews[0]
      return NextResponse.json({
        review: {
          id: review.id,
          prNumber: review.prNumber,
          verdict: review.verdict,
          score: review.score,
          requirementMatch: parseFloat(review.requirementMatch),
          summary: review.summary,
          strengths: safeParseJSON(review.strengths, []),
          issues: safeParseJSON(review.issues, []),
          risks: safeParseJSON(review.risks, []),
          unauthorizedEdits: safeParseJSON(review.unauthorizedEdits, []),
          resolvedIssues: safeParseJSON(review.resolvedIssues, []),
          resolvedRisks: safeParseJSON(review.resolvedRisks, []),
          createdAt: review.createdAt,
        },
      })
    }

    if (!sandboxRepo) {
      return NextResponse.json(
        { error: 'Missing required parameter: sandboxRepo' },
        { status: 400 }
      )
    }

    const repoInfo = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .limit(1)

    if (repoInfo.length === 0) {
      return NextResponse.json({ error: 'Sandbox repository not found.' }, { status: 404 })
    }

    const currentSandboxId = repoInfo[0].id

    // If no prNumber is provided, fetch previous reviews history for this sandboxRepo
    if (!prNumberStr) {
      const reviews = await db
        .select()
        .from(reviewResults)
        .where(eq(reviewResults.sandboxRepoId, currentSandboxId))
        .orderBy(desc(reviewResults.createdAt))

      return NextResponse.json({
        reviews: reviews.map(r => ({
          id: r.id,
          prNumber: r.prNumber,
          commitSha: r.commitSha,
          verdict: r.verdict,
          reportHtml: r.reportHtml,
          results: safeParseJSON(r.results, {}),
          comparison: safeParseJSON(r.comparison, {}),
          createdAt: r.createdAt
        }))
      })
    }

    const prNumber = parseInt(prNumberStr, 10)

    // Query both deterministic review results AND AI reviews
    const detReviews = await db
      .select()
      .from(reviewResults)
      .where(
        and(
          eq(reviewResults.sandboxRepoId, currentSandboxId),
          eq(reviewResults.prNumber, prNumber)
        )
      )
      .orderBy(desc(reviewResults.createdAt))
      .limit(1)

    // Query the latest AI review for this developer fork/PR
    let forkId: string | null = null
    if (username) {
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

      if (forkRecords.length > 0) {
        forkId = forkRecords[0].id
      }
    }

    let aiReviewQuery = db
      .select()
      .from(aiReviews)
      .where(
        and(
          eq(aiReviews.sandboxRepoId, currentSandboxId),
          eq(aiReviews.prNumber, prNumber)
        )
      )
      .orderBy(desc(aiReviews.createdAt))
      .limit(1)

    if (forkId) {
      aiReviewQuery = db
        .select()
        .from(aiReviews)
        .where(
          and(
            eq(aiReviews.developerForkId, forkId),
            eq(aiReviews.prNumber, prNumber)
          )
        )
        .orderBy(desc(aiReviews.createdAt))
        .limit(1)
    }

    const aiReviewsList = await aiReviewQuery

    if (detReviews.length === 0 && aiReviewsList.length === 0) {
      return NextResponse.json({ review: null })
    }

    const detReview = detReviews[0]
    const aiReview = aiReviewsList[0]

    // Assemble unified review payload for the UI dashboard
    return NextResponse.json({
      review: {
        id: aiReview ? aiReview.id : detReview.id,
        prNumber: prNumber,
        commitSha: detReview ? detReview.commitSha : '',
        verdict: aiReview ? aiReview.verdict : detReview.verdict,
        score: aiReview ? aiReview.score : (detReview.verdict === 'pass' ? 100 : 50),
        requirementMatch: aiReview ? parseFloat(aiReview.requirementMatch) : 0,
        summary: aiReview ? aiReview.summary : 'Validation completed.',
        strengths: aiReview ? safeParseJSON(aiReview.strengths, []) : [],
        issues: aiReview ? safeParseJSON(aiReview.issues, []) : [],
        risks: aiReview ? safeParseJSON(aiReview.risks, []) : [],
        unauthorizedEdits: aiReview ? safeParseJSON(aiReview.unauthorizedEdits, []) : [],
        resolvedIssues: aiReview ? safeParseJSON(aiReview.resolvedIssues, []) : [],
        resolvedRisks: aiReview ? safeParseJSON(aiReview.resolvedRisks, []) : [],
        results: detReview ? safeParseJSON(detReview.results, {}) : {},
        comparison: detReview ? safeParseJSON(detReview.comparison, {}) : {},
        reportHtml: detReview ? detReview.reportHtml : '',
        createdAt: aiReview ? aiReview.createdAt : detReview.createdAt
      }
    })
  } catch (err: unknown) {
    console.error('[API /developer/review GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch review', details: String(err) },
      { status: 500 }
    )
  }
}

function safeParseJSON(val: string | null | undefined, fallback: unknown) {
  if (!val) return fallback
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}
