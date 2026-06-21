/**
 * POST /api/owner/task/publish
 *
 * Inserts a task from a sandbox repo into the main `tasks` table so it is
 * visible in the /tasks feed.  Requires an active Forke session (role=owner).
 *
 * Body: { title, description, budget, deadline?, skillTags?, sandboxRepo }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { tasks } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const user = session?.user as { id: string; role?: string } | undefined

    if (!user?.id || user.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized. Must be a logged-in owner.' }, { status: 401 })
    }

    const body = await req.json()
    const { title, description, budget, deadline, skillTags } = body

    if (!title || !description || !budget) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, budget' },
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

    const inserted = await db
      .insert(tasks)
      .values({
        title: title.trim(),
        description: description.trim(),
        budget: budgetPaise,
        skillTags: Array.isArray(skillTags) ? skillTags : [],
        deadline: parsedDeadline,
        clientId: user.id,
        status: 'open',
      })
      .returning({ id: tasks.id })

    return NextResponse.json({
      success: true,
      taskId: inserted[0]?.id,
    })
  } catch (err: unknown) {
    console.error('[API /owner/task/publish] Error:', err)
    return NextResponse.json(
      { error: 'Failed to publish task', details: String(err) },
      { status: 500 }
    )
  }
}
