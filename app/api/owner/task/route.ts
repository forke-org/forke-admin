/**
 * POST /api/owner/task    — Create or update task metadata for a sandbox repo
 * GET  /api/owner/task    — Fetch task metadata for a sandbox repo
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, sandboxRepos } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      sandboxRepo,
      username,
      taskTitle,
      taskDescription,
      frontendStack,
      backendStack,
      allowedPaths,
      restrictedPaths,
      acceptanceCriteria,
    } = body

    // Validate required fields
    if (!sandboxRepo || !username || !taskTitle || !taskDescription || !frontendStack || !backendStack) {
      return NextResponse.json(
        { error: 'Missing required fields: sandboxRepo, username, taskTitle, taskDescription, frontendStack, backendStack' },
        { status: 400 }
      )
    }

    // Find the sandbox repo record
    const existing = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .limit(1)

    if (existing.length === 0) {
      return NextResponse.json(
        { error: `Sandbox repo "${sandboxRepo}" not found in database` },
        { status: 404 }
      )
    }

    const sandboxRecord = existing[0]

    // Serialize arrays/text for DB storage
    const allowedPathsStr = Array.isArray(allowedPaths)
      ? allowedPaths.join('\n')
      : (allowedPaths || '')

    const restrictedPathsStr = Array.isArray(restrictedPaths)
      ? restrictedPaths.join('\n')
      : (restrictedPaths || '')

    // Update the sandbox repo record with task metadata
    await db
      .update(sandboxRepos)
      .set({
        taskTitle: taskTitle.trim(),
        taskDescription: taskDescription.trim(),
        frontendStack: frontendStack.trim(),
        backendStack: backendStack.trim(),
        allowedPaths: allowedPathsStr.trim() || null,
        restrictedPaths: restrictedPathsStr.trim() || null,
        acceptanceCriteria: acceptanceCriteria?.trim() || null,
      })
      .where(eq(sandboxRepos.id, sandboxRecord.id))

    return NextResponse.json({
      success: true,
      message: 'Task metadata saved successfully',
      sandboxRepo,
      taskTitle,
    })
  } catch (err: unknown) {
    console.error('[API /owner/task POST] Error:', err)
    return NextResponse.json(
      { error: 'Failed to save task metadata', details: String(err) },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sandboxRepo = searchParams.get('sandboxRepo')

    if (!sandboxRepo) {
      return NextResponse.json({ error: 'Missing sandboxRepo parameter' }, { status: 400 })
    }

    const records = await db
      .select()
      .from(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
      .limit(1)

    if (records.length === 0) {
      return NextResponse.json({ error: 'Sandbox repo not found' }, { status: 404 })
    }

    const record = records[0]

    return NextResponse.json({
      id: record.id,
      sandboxRepo: record.sandboxRepo,
      sourceRepo: record.sourceRepo,
      taskTitle: record.taskTitle,
      taskDescription: record.taskDescription,
      frontendStack: record.frontendStack,
      backendStack: record.backendStack,
      allowedPaths: record.allowedPaths,
      restrictedPaths: record.restrictedPaths,
      acceptanceCriteria: record.acceptanceCriteria,
      hasTaskMetadata: !!(record.taskTitle && record.taskDescription),
      createdAt: record.createdAt,
    })
  } catch (err: unknown) {
    console.error('[API /owner/task GET] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch task metadata', details: String(err) },
      { status: 500 }
    )
  }
}
