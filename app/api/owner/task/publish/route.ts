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
 * POST /api/owner/task/publish
 *
 * Inserts a task from the post-task flow into the main `tasks` table with
 * status='processing', then triggers the background mirror pipeline.
 * The mirror pipeline will update the task to status='open' once complete.
 *
 * Body: { title, description, budget, deadline?, skillTags?, sourceRepo,
 *         username, allowedPaths?, restrictedPaths?, acceptanceCriteria?,
 *         frontendStack?, backendStack?, selectedScope? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { tasks, sandboxUsers, sandboxRepos } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { activeJobs } from '@/lib/jobs'
import { runMirrorJob } from '@/lib/github/mirror'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { id: string; role?: string } | undefined

    if (!user?.id || user.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized. Must be a logged-in owner.' }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      description,
      budget,
      deadline,
      skillTags,
      sourceRepo,
      username,
      allowedPaths,
      restrictedPaths,
      acceptanceCriteria,
      frontendStack,
      backendStack,
      selectedScope,
    } = body

    if (!title || !description || !budget) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, budget' },
        { status: 400 }
      )
    }

    if (!sourceRepo || !username) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceRepo, username' },
        { status: 400 }
      )
    }

    // Budget comes in as INR rupees from the sandbox form; convert to paise for storage
    const budgetPaise = Math.round(Number(budget) * 100)
    if (isNaN(budgetPaise) || budgetPaise < 10000) {
      // Minimum ₹100 = 10000 paise
      return NextResponse.json(
        { error: 'Budget must be at least ₹100' },
        { status: 400 }
      )
    }

    const parsedDeadline = deadline ? new Date(deadline) : null

    // 1. Insert task immediately with status='processing'
    const inserted = await db
      .insert(tasks)
      .values({
        title: title.trim(),
        description: description.trim(),
        budget: budgetPaise,
        skillTags: Array.isArray(skillTags) ? skillTags : [],
        deadline: parsedDeadline,
        clientId: user.id,
        status: 'processing',
        sourceRepo: sourceRepo,
      })
      .returning({ id: tasks.id })

    const taskId = inserted[0]?.id
    if (!taskId) {
      return NextResponse.json({ error: 'Failed to create task record' }, { status: 500 })
    }

    // 2. Resolve GitHub access token and ownerId for the mirror pipeline
    const cookieStore = await cookies()
    let token = cookieStore.get('forke_access_token')?.value

    let ownerId: string | null = null

    const existing = await db
      .select()
      .from(sandboxUsers)
      .where(and(eq(sandboxUsers.username, username), eq(sandboxUsers.role, 'owner')))

    if (existing.length > 0) {
      ownerId = existing[0].id
      if (!token) {
        token = existing[0].accessToken
      }
    }

    // Auto-heal if database was reset but user session is still alive in cookies
    if (!ownerId && token) {
      try {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Forke-Sandbox-AutoHeal/1.0',
            Accept: 'application/vnd.github+json',
          },
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          if (userData?.id && userData?.login?.toLowerCase() === username.toLowerCase()) {
            const ins = await db
              .insert(sandboxUsers)
              .values({
                githubId: userData.id,
                username: userData.login,
                accessToken: token,
                role: 'owner',
              })
              .returning()
            if (ins.length > 0) {
              ownerId = ins[0].id
            }
          }
        }
      } catch (err) {
        console.error('Failed to auto-heal owner session in DB:', err)
      }
    }

    if (!token || !ownerId) {
      // Task was created but we can't start the mirror — mark it so the owner knows
      console.error(`[Publish] Task ${taskId} created but no token/ownerId for mirror. Token: ${!!token}, OwnerId: ${ownerId}`)
      return NextResponse.json({
        success: true,
        taskId,
        warning: 'Task created but mirror pipeline could not start — GitHub token expired. Please re-authenticate.',
      })
    }

    // 3. Determine target repo name (same logic as mirror/route.ts)
    const targetSpace = 'forke-sandbox'
    const repoBasename = sourceRepo.split('/')[1] || sourceRepo
    let targetRepoName = `sandbox-${repoBasename}`

    const existingMirrors = await db.select().from(sandboxRepos)
    const existingNames = new Set(existingMirrors.map((m: { sandboxRepo: string }) => m.sandboxRepo.toLowerCase()))

    let count = 1
    let uniqueTargetRepoName = targetRepoName
    while (existingNames.has(`${targetSpace}/${uniqueTargetRepoName}`.toLowerCase())) {
      uniqueTargetRepoName = `${targetRepoName}-${count}`
      count++
    }
    targetRepoName = uniqueTargetRepoName

    // 4. Initialize background job and kick off mirror pipeline
    const jobId = `${username}-${repoBasename}-${Date.now()}`

    activeJobs.set(jobId, {
      id: jobId,
      status: 'running',
      progress: 0,
      logs: ['[INIT] Background mirror pipeline queued for task.'],
    })

    // Fire and forget — the mirror pipeline will update the task status to 'open'
    runMirrorJob({
      jobId,
      token,
      ownerId,
      sourceRepo,
      targetSpace,
      targetRepoName,
      taskTitle: title.trim(),
      taskDescription: description.trim(),
      frontendStack: frontendStack || '',
      backendStack: backendStack || '',
      allowedPaths: allowedPaths || '',
      restrictedPaths: restrictedPaths || '',
      acceptanceCriteria: acceptanceCriteria || '',
      taskId, // NEW: pass the task ID so mirror can update task status
    }).catch(err => {
      console.error(`[Publish] Background mirror job failed for task ${taskId}:`, err)
    })

    return NextResponse.json({
      success: true,
      taskId,
      jobId,
    })
  } catch (err: unknown) {
    console.error('[API /owner/task/publish] Error:', err)
    return NextResponse.json(
      { error: 'Failed to publish task', details: String(err) },
      { status: 500 }
    )
  }
}
