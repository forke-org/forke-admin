import { db } from '@/lib/db'
import { tasks, users, submissions, revisionRequests } from '@/lib/db/schema'
import { eq, and, or, desc, lte, ilike, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

export async function getOpenTasks(filters: { skillTags?: string[]; maxBudget?: number; q?: string; includeClaimed?: boolean } = {}) {
  const { skillTags, maxBudget, q, includeClaimed } = filters

  const conditions = includeClaimed ? [] : [eq(tasks.status, 'open')]

  if (maxBudget) {
    conditions.push(lte(tasks.budget, maxBudget))
  }

  if (skillTags && skillTags.length > 0) {
    // Correctly format the array overlap operator for PostgreSQL using native ARRAY[...] syntax
    const arrayElements = skillTags.map(t => sql`${t}`)
    conditions.push(sql`${tasks.skillTags} && ARRAY[${sql.join(arrayElements, sql`, `)}]::text[]`)
  }

  if (q) {
    const searchPattern = `%${q}%`
    const searchCondition = or(
      ilike(tasks.title, searchPattern),
      ilike(tasks.description, searchPattern)
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  const claimantAlias = alias(users, 'claimant')

  const result = await db
    .select({
      task: tasks,
      clientName: users.name,
      claimantName: claimantAlias.name,
      claimantUsername: claimantAlias.username,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.clientId, users.id))
    .leftJoin(claimantAlias, eq(tasks.claimantId, claimantAlias.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))

  return result
}

export async function getTaskById(id: string) {
  const claimantAlias = alias(users, 'claimant')
  
  const result = await db
    .select({
      task: tasks,
      clientName: users.name,
      claimantName: claimantAlias.name,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.clientId, users.id))
    .leftJoin(claimantAlias, eq(tasks.claimantId, claimantAlias.id))
    .where(eq(tasks.id, id))
    .limit(1)

  return result[0] || null
}

export async function getTasksByClaimant(userId: string) {
  const result = await db
    .select({
      task: tasks,
      clientName: users.name,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.clientId, users.id))
    .where(eq(tasks.claimantId, userId))
    .orderBy(desc(tasks.createdAt))

  return result
}

export async function getTasksPendingReview(clientId: string) {
  const result = await db
    .select({
      task: tasks,
      claimantName: users.name,
      submission: submissions,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.claimantId, users.id))
    .innerJoin(submissions, and(
      eq(submissions.taskId, tasks.id),
      eq(submissions.status, 'pending')
    ))
    .where(and(
      eq(tasks.clientId, clientId),
      eq(tasks.status, 'submitted')
    ))
    .orderBy(desc(submissions.createdAt))

  return result
}

export async function getSubmissionsByDeveloper(userId: string) {
  const result = await db
    .select({
      submission: submissions,
      taskTitle: tasks.title,
      taskBudget: tasks.budget,
      clientName: users.name,
    })
    .from(submissions)
    .innerJoin(tasks, eq(submissions.taskId, tasks.id))
    .innerJoin(users, eq(tasks.clientId, users.id))
    .where(eq(submissions.developerId, userId))
    .orderBy(desc(submissions.createdAt))

  return result
}

export async function getLatestRevisionRequest(taskId: string) {
  const result = await db
    .select()
    .from(revisionRequests)
    .where(eq(revisionRequests.taskId, taskId))
    .orderBy(desc(revisionRequests.createdAt))
    .limit(1)

  return result[0] || null
}
