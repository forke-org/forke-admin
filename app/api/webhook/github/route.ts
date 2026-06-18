import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { sandboxRepos, developerForks, sandboxOwners } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { updateCommitStatus } from '@/lib/github/commitStatus'
import { runFullPRPipeline } from '@/lib/review/pipeline'

/**
 * Verifies the GitHub webhook HMAC-SHA256 signature.
 */
async function verifyWebhookSignature(
  body: string,
  signatureHeader: string | null
): Promise<boolean> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret || secret === 'your_webhook_secret_here') {
    console.warn('[Webhook] GITHUB_WEBHOOK_SECRET not configured — skipping signature verification')
    return true
  }
  if (!signatureHeader) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedSig = 'sha256=' + Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expectedSig.length !== signatureHeader.length) return false
  let diff = 0
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text()

  // Verify signature
  const signature = req.headers.get('x-hub-signature-256')
  const isValid = await verifyWebhookSignature(bodyText, signature)
  if (!isValid) {
    console.error('[Webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // Parse event
  const event = req.headers.get('x-github-event')
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  // Only handle pull_request events
  if (event !== 'pull_request') {
    return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 })
  }

  const action = payload.action as string
  if (action !== 'opened' && action !== 'synchronize') {
    return NextResponse.json({ message: `Ignored PR action: ${action}` }, { status: 200 })
  }

  // Extract PR data
  const pr = payload.pull_request as Record<string, unknown>
  const repo = payload.repository as Record<string, unknown>

  const prNumber = pr.number as number
  const prTitle = (pr.title as string) || ''
  const prBody = (pr.body as string) || ''
  const headSha = ((pr.head as Record<string, unknown>).sha as string)
  const developerUsername = ((pr.user as Record<string, unknown>).login as string)
  const repoFullName = repo.full_name as string

  console.log(`[Webhook] PR #${prNumber} ${action} on ${repoFullName} by @${developerUsername}`)

  // Look up the sandbox repo + task metadata
  const sandboxRecords = await db
    .select()
    .from(sandboxRepos)
    .where(eq(sandboxRepos.sandboxRepo, repoFullName))
    .limit(1)

  if (sandboxRecords.length === 0) {
    console.log(`[Webhook] No sandbox record found for ${repoFullName} — ignoring`)
    return NextResponse.json({ message: 'Sandbox repo not found in DB' }, { status: 200 })
  }

  const sandboxRecord = sandboxRecords[0]

  // Check if task metadata is configured
  if (!sandboxRecord.taskTitle || !sandboxRecord.taskDescription) {
    console.log(`[Webhook] No task metadata for ${repoFullName} — AI review skipped`)
    return NextResponse.json({ message: 'No task metadata configured for this sandbox' }, { status: 200 })
  }

  // Get the owner's access token for GitHub API calls
  const ownerRecords = await db
    .select()
    .from(sandboxOwners)
    .where(eq(sandboxOwners.id, sandboxRecord.ownerId))
    .limit(1)

  if (ownerRecords.length === 0) {
    console.error(`[Webhook] Owner not found for sandbox ${repoFullName}`)
    return NextResponse.json({ message: 'Owner not found' }, { status: 200 })
  }

  const ownerToken = ownerRecords[0].accessToken

  // Set commit status to pending immediately
  await updateCommitStatus({
    repoFullName,
    sha: headSha,
    verdict: 'pending',
    accessToken: ownerToken,
    prNumber,
  })

  // Find or create developer fork record
  let forkRecord = await db
    .select()
    .from(developerForks)
    .where(
      and(
        eq(developerForks.sandboxRepo, repoFullName),
        eq(developerForks.githubUsername, developerUsername)
      )
    )
    .limit(1)

  let forkId: string
  if (forkRecord.length === 0) {
    // Auto-create fork record from webhook data
    const prUrl = pr.html_url as string
    const forkUrl = `https://github.com/${developerUsername}/${repoFullName.split('/')[1]}`

    const inserted = await db
      .insert(developerForks)
      .values({
        githubUsername: developerUsername,
        sandboxRepo: repoFullName,
        forkUrl,
        prUrl,
      })
      .returning({ id: developerForks.id })

    forkId = inserted[0].id
  } else {
    forkId = forkRecord[0].id
    // Update PR URL if new PR
    await db
      .update(developerForks)
      .set({ prUrl: pr.html_url as string })
      .where(eq(developerForks.id, forkId))
  }

  // Run AI review asynchronously in the background using Next.js after()
  after(async () => {
    try {
      await runFullPRPipeline({
        sandboxId: sandboxRecord.id,
        ownerToken,
        prNumber,
        prTitle,
        prBody,
        headSha,
        developerUsername,
        repoFullName,
        developerForkId: forkId,
      })
    } catch (err) {
      console.error('[Webhook] AI pipeline error:', err)
    }
  })

  return NextResponse.json({
    message: 'AI review pipeline triggered',
    prNumber,
    repoFullName,
  }, { status: 202 })
}
