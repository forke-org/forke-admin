/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

/**
 * GET /api/owner/prs
 * Fetches all developer PRs + their AI reviews for a specific sandbox repo.
 *
 * Query params:
 *   - sandboxRepo: Full sandbox repo name (e.g. "forke-sandbox/acme-dashboard")
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, developerForks, codeReviews, sandboxRepos } from '@/lib/db'
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

    // For each fork, get its latest unified review (which includes both AI and deterministic details)
    const prsWithReviews = await Promise.all(
      forks.map(async fork => {
        const reviews = await db
          .select()
          .from(codeReviews)
          .where(eq(codeReviews.developerForkId, fork.id))
          .orderBy(desc(codeReviews.createdAt))
          .limit(1)

        const latestReview = reviews[0] || null

        let prNumber: number | null = latestReview ? latestReview.prNumber : null
        if (!prNumber && fork.prUrl) {
          const match = fork.prUrl.match(/\/pull\/(\d+)/)
          if (match) {
            prNumber = parseInt(match[1], 10)
          }
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
          review: latestReview ? {
            id: latestReview.id,
            prNumber: prNumber,
            commitSha: latestReview.commitSha || '',
            verdict: latestReview.aiVerdict || 'pass',
            score: latestReview.aiScore !== null ? latestReview.aiScore : 100,
            requirementMatch: latestReview.requirementMatch ? parseFloat(latestReview.requirementMatch) : 0,
            summary: latestReview.aiSummary || 'Validation completed.',
            strengths: safeParseJSON(latestReview.aiStrengths, []),
            issues: safeParseJSON(latestReview.aiIssues, []),
            risks: safeParseJSON(latestReview.aiRisks, []),
            unauthorizedEdits: safeParseJSON(latestReview.unauthorizedEdits, []),
            resolvedIssues: safeParseJSON(latestReview.resolvedIssues, []),
            resolvedRisks: safeParseJSON(latestReview.resolvedRisks, []),
            results: safeParseJSON(latestReview.results, {}),
            comparison: safeParseJSON(latestReview.comparison, {}),
            reportHtml: latestReview.reportHtml || '',
            createdAt: latestReview.createdAt
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
