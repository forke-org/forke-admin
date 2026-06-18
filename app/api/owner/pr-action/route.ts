/**
 * POST /api/owner/pr-action
 * Executes owner actions on a developer PR: approve/merge, request changes, or reject.
 *
 * Body:
 *   - action: 'merge' | 'request_changes' | 'reject'
 *   - sandboxRepo: full repo name (e.g. "forke-sandbox/acme-dashboard")
 *   - prNumber: PR number
 *   - username: owner's GitHub username (for auth)
 *   - message: optional message/comment to leave on PR
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, sandboxOwners } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, sandboxRepo, prNumber, username, message } = body

    if (!action || !sandboxRepo || !prNumber || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: action, sandboxRepo, prNumber, username' },
        { status: 400 }
      )
    }

    if (!['merge', 'request_changes', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: merge, request_changes, or reject' },
        { status: 400 }
      )
    }

    // Get owner's access token
    const ownerRecords = await db
      .select()
      .from(sandboxOwners)
      .where(eq(sandboxOwners.username, username))
      .limit(1)

    if (ownerRecords.length === 0) {
      return NextResponse.json({ error: 'Owner not found' }, { status: 404 })
    }

    const accessToken = ownerRecords[0].accessToken
    const baseUrl = `https://api.github.com/repos/${sandboxRepo}`
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Forke-AI-Review-Engine/1.0',
    }

    if (action === 'merge') {
      // Merge the PR
      const mergeResponse = await fetch(`${baseUrl}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          commit_title: `Forke: Merged PR #${prNumber}`,
          commit_message: message || 'Approved and merged by repository owner via Forke platform.',
          merge_method: 'squash',
        }),
      })

      if (!mergeResponse.ok) {
        const err = await mergeResponse.json()
        return NextResponse.json(
          { error: err.message || 'Failed to merge PR' },
          { status: mergeResponse.status }
        )
      }

      return NextResponse.json({ success: true, action: 'merged', prNumber })
    }

    if (action === 'request_changes' || action === 'reject') {
      // Leave a review comment on the PR
      const reviewBody = action === 'reject'
        ? `🔴 **PR Rejected** by the repository owner.\n\n${message || 'This PR has been rejected. Please review the requirements and resubmit.'}`
        : `🟡 **Changes Requested** by the repository owner.\n\n${message || 'Please address the requested changes and update your PR.'}`

      const commentResponse = await fetch(`${baseUrl}/issues/${prNumber}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: reviewBody }),
      })

      if (!commentResponse.ok) {
        const err = await commentResponse.json()
        return NextResponse.json(
          { error: err.message || 'Failed to post review comment' },
          { status: commentResponse.status }
        )
      }

      // For rejection, also close the PR
      if (action === 'reject') {
        await fetch(`${baseUrl}/pulls/${prNumber}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ state: 'closed' }),
        })
      }

      return NextResponse.json({ success: true, action, prNumber })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[API /owner/pr-action POST] Error:', err)
    return NextResponse.json(
      { error: 'Failed to execute PR action', details: String(err) },
      { status: 500 }
    )
  }
}
