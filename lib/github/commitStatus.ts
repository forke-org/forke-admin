/**
 * GitHub Commit Status Updater
 * Updates the PR commit check status visible inside the GitHub PR UI.
 * Maps AI verdicts to GitHub status states.
 */

type GitHubState = 'success' | 'pending' | 'failure' | 'error'

interface CommitStatusPayload {
  state: GitHubState
  target_url: string
  description: string
  context: string
}

/**
 * Posts a commit status to GitHub for the given SHA.
 * Uses the repository owner's OAuth access token.
 */
export async function updateCommitStatus(params: {
  repoFullName: string // e.g. "forke-sandbox/acme-dashboard"
  sha: string
  verdict: 'pass' | 'needs_changes' | 'high_risk' | 'pending'
  score?: number
  accessToken: string
  prNumber?: number
}): Promise<void> {
  const { repoFullName, sha, verdict, score, accessToken, prNumber } = params

  const payload = buildStatusPayload(verdict, score, repoFullName, prNumber)

  const url = `https://api.github.com/repos/${repoFullName}/statuses/${sha}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[CommitStatus] Failed to update status for ${sha}: ${errText}`)
    } else {
      console.log(`[CommitStatus] Updated ${repoFullName}@${sha.slice(0, 7)} → ${payload.state}`)
    }
  } catch (err) {
    console.error('[CommitStatus] Network error:', err)
  }
}

function buildStatusPayload(
  verdict: 'pass' | 'needs_changes' | 'high_risk' | 'pending',
  score: number | undefined,
  repoFullName: string,
  prNumber: number | undefined
): CommitStatusPayload {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const reviewUrl = prNumber
    ? `${baseUrl}/reviews/${repoFullName}/pr/${prNumber}`
    : baseUrl

  switch (verdict) {
    case 'pass':
      return {
        state: 'success',
        context: 'Forke AI Review',
        description: score !== undefined
          ? `✅ AI Review Passed! Score: ${score}/100`
          : '✅ AI Review Passed!',
        target_url: reviewUrl,
      }
    case 'needs_changes':
      return {
        state: 'pending',
        context: 'Forke AI Review',
        description: score !== undefined
          ? `⚠️ Changes requested by AI review. Score: ${score}/100`
          : '⚠️ Minor changes requested by AI review engine.',
        target_url: reviewUrl,
      }
    case 'high_risk':
      return {
        state: 'failure',
        context: 'Forke AI Review',
        description: '🔴 Blocking issues or unauthorized file edits detected!',
        target_url: reviewUrl,
      }
    case 'pending':
    default:
      return {
        state: 'pending',
        context: 'Forke AI Review',
        description: '🔄 AI Review in progress...',
        target_url: reviewUrl,
      }
  }
}
