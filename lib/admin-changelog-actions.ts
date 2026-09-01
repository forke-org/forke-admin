'use server'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { changelogs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getCurrentAdmin } from '@/lib/admin-actions'
import { logAudit } from '@/lib/actions/audit-actions'

async function ensureAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) {
    throw new Error('Unauthorized')
  }
  return admin
}

export interface ChangelogInput {
  title: string
  slug: string
  tag: string
  description: string
  improvements: string[]
  fixes: string[]
  mediaType: 'none' | 'image' | 'video'
  mediaUrl: string | null
  isPublished: boolean
  publishedAt?: string
}

export async function getChangelogsAdmin() {
  await ensureAdmin()
  try {
    const list = await db
      .select()
      .from(changelogs)
      .orderBy(desc(changelogs.publishedAt))

    const serialized = list.map((item) => ({
      ...item,
      improvements: (Array.isArray(item.improvements) ? item.improvements : []) as string[],
      fixes: (Array.isArray(item.fixes) ? item.fixes : []) as string[],
      mediaType: (item.mediaType as 'none' | 'image' | 'video') || 'none',
      publishedAt: item.publishedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))

    return { success: true, data: serialized }
  } catch (error) {
    console.error('Failed to get changelogs admin:', error)
    return { success: false, error: 'Database query failed' }
  }
}

export async function createChangelogAction(input: ChangelogInput) {
  const admin = await ensureAdmin()
  try {
    const title = input.title.trim()
    const slug = (input.slug || input.title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    if (!title || !slug) {
      return { success: false, error: 'Title and slug are required.' }
    }

    const [inserted] = await db
      .insert(changelogs)
      .values({
        title,
        slug,
        tag: input.tag.trim().toUpperCase() || 'CORE',
        description: input.description.trim(),
        improvements: input.improvements.filter(Boolean),
        fixes: input.fixes.filter(Boolean),
        mediaType: input.mediaType,
        mediaUrl: input.mediaUrl?.trim() || null,
        isPublished: input.isPublished,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
      })
      .returning()

    await logAudit({
      category: 'content',
      action: 'changelog.created',
      target: `${inserted.title} (${inserted.slug})`,
    })

    revalidatePath('/changelog')
    return { success: true, id: inserted.id }
  } catch (error: any) {
    console.error('Failed to create changelog:', error)
    if (error.code === '23505') {
      return { success: false, error: 'A changelog with this slug already exists.' }
    }
    return { success: false, error: 'Database insertion failed.' }
  }
}

export async function updateChangelogAction(id: string, input: Partial<ChangelogInput>) {
  const admin = await ensureAdmin()
  try {
    const updates: any = {
      updatedAt: new Date(),
    }

    if (input.title !== undefined) updates.title = input.title.trim()
    if (input.slug !== undefined) {
      updates.slug = input.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }
    if (input.tag !== undefined) updates.tag = input.tag.trim().toUpperCase() || 'CORE'
    if (input.description !== undefined) updates.description = input.description.trim()
    if (input.improvements !== undefined) updates.improvements = input.improvements.filter(Boolean)
    if (input.fixes !== undefined) updates.fixes = input.fixes.filter(Boolean)
    if (input.mediaType !== undefined) updates.mediaType = input.mediaType
    if (input.mediaUrl !== undefined) updates.mediaUrl = input.mediaUrl?.trim() || null
    if (input.isPublished !== undefined) updates.isPublished = input.isPublished

    // Fetch existing record to preserve publishedAt date
    const [existing] = await db.select().from(changelogs).where(eq(changelogs.id, id)).limit(1)
    if (existing) {
      if (existing.isPublished && existing.publishedAt) {
        // Once published, never overwrite publishedAt date on edits
        delete updates.publishedAt
      } else if (input.isPublished && !existing.isPublished) {
        // First time publishing this draft
        updates.publishedAt = input.publishedAt ? new Date(input.publishedAt) : new Date()
      }
    }

    const [updated] = await db
      .update(changelogs)
      .set(updates)
      .where(eq(changelogs.id, id))
      .returning()

    await logAudit({
      category: 'content',
      action: 'changelog.updated',
      target: `${updated.title} (${updated.slug})`,
    })

    revalidatePath('/changelog')
    revalidatePath(`/changelog/${updated.slug}`)
    return { success: true }
  } catch (error: any) {
    console.error('Failed to update changelog:', error)
    if (error.code === '23505') {
      return { success: false, error: 'A changelog with this slug already exists.' }
    }
    return { success: false, error: 'Database update failed.' }
  }
}

export async function deleteChangelogMediaAction(mediaUrl: string) {
  await ensureAdmin()
  try {
    if (!mediaUrl) return { success: true }
    const { deleteFileByUrl } = await import('@/lib/r2')
    const deleted = await deleteFileByUrl(mediaUrl)
    return { success: true, deleted }
  } catch (err: any) {
    console.error('Failed to delete media from R2:', err)
    return { success: false, error: err.message || 'Delete failed' }
  }
}

export async function deleteChangelogAction(id: string) {
  await ensureAdmin()
  try {
    const [existing] = await db.select().from(changelogs).where(eq(changelogs.id, id)).limit(1)
    if (existing?.mediaUrl) {
      const { deleteFileByUrl } = await import('@/lib/r2')
      await deleteFileByUrl(existing.mediaUrl).catch((err) => {
        console.error('Failed to delete media from R2 upon changelog deletion:', err)
      })
    }

    await db.delete(changelogs).where(eq(changelogs.id, id))

    await logAudit({
      category: 'content',
      action: 'changelog.deleted',
      target: `${existing?.title || id}`,
    })

    revalidatePath('/changelog')
    return { success: true }
  } catch (error: any) {
    console.error('Failed to delete changelog:', error)
    return { success: false, error: error?.message || 'Database deletion failed.' }
  }
}

export async function toggleChangelogPublishAction(id: string, isPublished: boolean) {
  await ensureAdmin()
  try {
    const [updated] = await db
      .update(changelogs)
      .set({ isPublished, updatedAt: new Date() })
      .where(eq(changelogs.id, id))
      .returning()

    await logAudit({
      category: 'content',
      action: isPublished ? 'changelog.published' : 'changelog.drafted',
      target: `${updated.title} (${updated.slug})`,
    })

    revalidatePath('/changelog')
    return { success: true }
  } catch (error) {
    console.error('Failed to toggle changelog publish:', error)
    return { success: false, error: 'Database update failed.' }
  }
}
