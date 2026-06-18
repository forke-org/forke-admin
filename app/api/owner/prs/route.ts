/**
 * GET /api/owner/prs
 * Fetches all developer PRs + their AI reviews for a specific sandbox repo.
 *
 * Query params:
 *   - sandboxRepo: Full sandbox repo name (e.g. "forke-sandbox/acme-dashboard")
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, developerForks, aiReviews, sandboxRepos, reviewResults } from '@/lib/db'
import { eq, desc, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sandboxRepo = searchParams.get('sandboxRepo')

    if (!sandboxRepo) {
      return NextResponse.json({ error: 'Missing sandboxRepo parameter' }, { status: 400 })
    }

    // Get all developer forks for this sandbox
    const forks = await db
      .select()
      .from(developerForks)
      .where(eq(developerForks.sandboxRepo, sandboxRepo))
      .orderBy(desc(developerForks.createdAt))

    // Find sandboxRepoId
    const repoInfo = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .limit(1)

    const sandboxRepoId = repoInfo.length > 0 ? repoInfo[0].id : null

    // For each fork, get its latest AI review and deterministic reviewResults
    const prsWithReviews = await Promise.all(
      forks.map(async fork => {
        const reviews = await db
          .select()
          .from(aiReviews)
          .where(eq(aiReviews.developerForkId, fork.id))
          .orderBy(desc(aiReviews.createdAt))
          .limit(1)

        const latestReview = reviews[0] || null

        let prNumber: number | null = latestReview ? latestReview.prNumber : null
        if (!prNumber && fork.prUrl) {
          const match = fork.prUrl.match(/\/pull\/(\d+)/)
          if (match) {
            prNumber = parseInt(match[1], 10)
          }
        }

        let detReview = null
        if (prNumber && sandboxRepoId) {
          const detReviews = await db
            .select()
            .from(reviewResults)
            .where(
              and(
                eq(reviewResults.sandboxRepoId, sandboxRepoId),
                eq(reviewResults.prNumber, prNumber)
              )
            )
            .orderBy(desc(reviewResults.createdAt))
            .limit(1)
          detReview = detReviews[0] || null
        }

        return {
          fork: {
            id: fork.id,
            githubUsername: fork.githubUsername,
            sandboxRepo: fork.sandboxRepo,
            forkUrl: fork.forkUrl,
            prUrl: fork.prUrl,
            createdAt: fork.createdAt,
          },
          review: (latestReview || detReview) ? {
            id: latestReview ? latestReview.id : (detReview ? detReview.id : null),
            prNumber: prNumber,
            commitSha: detReview ? detReview.commitSha : '',
            verdict: latestReview ? latestReview.verdict : (detReview ? detReview.verdict : 'pass'),
            score: latestReview ? latestReview.score : (detReview ? (detReview.verdict === 'pass' ? 100 : 50) : 100),
            requirementMatch: latestReview ? parseFloat(latestReview.requirementMatch) : 0,
            summary: latestReview ? latestReview.summary : 'Validation completed.',
            strengths: latestReview ? safeParseJSON(latestReview.strengths, []) : [],
            issues: latestReview ? safeParseJSON(latestReview.issues, []) : [],
            risks: latestReview ? safeParseJSON(latestReview.risks, []) : [],
            unauthorizedEdits: latestReview ? safeParseJSON(latestReview.unauthorizedEdits, []) : [],
            resolvedIssues: latestReview ? safeParseJSON(latestReview.resolvedIssues, []) : [],
            resolvedRisks: latestReview ? safeParseJSON(latestReview.resolvedRisks, []) : [],
            results: detReview ? safeParseJSON(detReview.results, {}) : {},
            comparison: detReview ? safeParseJSON(detReview.comparison, {}) : {},
            reportHtml: detReview ? detReview.reportHtml : '',
            createdAt: latestReview ? latestReview.createdAt : (detReview ? detReview.createdAt : fork.createdAt)
          } : null,
        }
      })
    )

    return NextResponse.json({ prs: prsWithReviews, total: prsWithReviews.length })
  } catch (err: unknown) {
    console.error('[API /owner/prs GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch PRs', details: String(err) },
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
