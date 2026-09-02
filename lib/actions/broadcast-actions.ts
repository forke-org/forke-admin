'use server'

/**
 * @fileoverview Forke Platform - Broadcast Email Approvals
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 */

import { db } from '@/lib/db'
import { broadcastApprovals, subscribers } from '@/lib/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { isAdminAuthenticated, getCurrentAdmin } from '@/lib/admin-actions'
import { logAudit } from './audit-actions'
import { sendBlogPublishedBroadcast, sendChangelogPublishedBroadcast } from '@/lib/email'
import { revalidatePath } from 'next/cache'

async function ensureAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized')
  }
}

export interface BroadcastApprovalItem {
  id: string
  type: 'blog' | 'changelog'
  contentId: string
  title: string
  slug: string
  tag?: string | null
  excerpt?: string | null
  description?: string | null
  coverImage?: string | null
  mediaUrl?: string | null
  mediaType?: string | null
  authorName?: string | null
  readingMinutes?: number | null
  improvements?: string[] | null
  fixes?: string[] | null
  status: 'pending' | 'approved' | 'dismissed' | 'failed'
  broadcastId?: string | null
  sentCount?: number | null
  error?: string | null
  approvedAt?: Date | null
  approvedBy?: string | null
  createdAt: Date
}

/**
 * Ensures the broadcast_approvals table exists in PostgreSQL.
 */
export async function ensureBroadcastApprovalsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS public.broadcast_approvals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        content_id UUID NOT NULL,
        title TEXT NOT NULL,
        slug TEXT NOT NULL,
        tag TEXT,
        excerpt TEXT,
        description TEXT,
        cover_image TEXT,
        media_url TEXT,
        media_type TEXT DEFAULT 'none',
        author_name TEXT,
        reading_minutes INTEGER,
        improvements JSONB DEFAULT '[]'::jsonb,
        fixes JSONB DEFAULT '[]'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        broadcast_id TEXT,
        sent_count INTEGER DEFAULT 0,
        error TEXT,
        approved_at TIMESTAMP WITH TIME ZONE,
        approved_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_broadcast_approvals_status ON public.broadcast_approvals (status);
      CREATE INDEX IF NOT EXISTS idx_broadcast_approvals_content_id ON public.broadcast_approvals (content_id);
    `)
  } catch (err) {
    console.error('Failed to ensure broadcast_approvals table:', err)
  }
}

/**
 * Fetch all pending broadcast approvals along with total audience count.
 */
export async function getPendingBroadcastApprovalsAction(): Promise<{
  success: boolean
  approvals: BroadcastApprovalItem[]
  subscriberCount: number
  error?: string
}> {
  try {
    await ensureAdmin()
    await ensureBroadcastApprovalsTable()

    const [approvalRows, subRows] = await Promise.all([
      db
        .select()
        .from(broadcastApprovals)
        .where(eq(broadcastApprovals.status, 'pending'))
        .orderBy(desc(broadcastApprovals.createdAt)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscribers),
    ])

    const subscriberCount = subRows[0]?.count || 0

    return {
      success: true,
      approvals: approvalRows as BroadcastApprovalItem[],
      subscriberCount,
    }
  } catch (err) {
    console.error('Failed to fetch broadcast approvals:', err)
    return {
      success: false,
      approvals: [],
      subscriberCount: 0,
      error: err instanceof Error ? err.message : 'Failed to fetch broadcast approvals',
    }
  }
}

/**
 * Create a new broadcast approval request (deduplicated per contentId).
 */
export async function createBroadcastApprovalAction(data: {
  type: 'blog' | 'changelog'
  contentId: string
  title: string
  slug: string
  tag?: string | null
  excerpt?: string | null
  description?: string | null
  coverImage?: string | null
  mediaUrl?: string | null
  mediaType?: 'none' | 'image' | 'video'
  authorName?: string | null
  readingMinutes?: number | null
  improvements?: string[] | null
  fixes?: string[] | null
}): Promise<{ success: boolean; id?: string }> {
  try {
    await ensureAdmin()
    await ensureBroadcastApprovalsTable()

    // Deduplicate: check if an active pending or approved entry exists for this content
    const existing = await db
      .select({ id: broadcastApprovals.id, status: broadcastApprovals.status })
      .from(broadcastApprovals)
      .where(
        and(
          eq(broadcastApprovals.contentId, data.contentId),
          sql`${broadcastApprovals.status} IN ('pending', 'approved')`
        )
      )
      .limit(1)

    if (existing.length > 0) {
      // Already has a pending request or already sent
      return { success: true, id: existing[0].id }
    }

    const [inserted] = await db
      .insert(broadcastApprovals)
      .values({
        type: data.type,
        contentId: data.contentId,
        title: data.title.trim(),
        slug: data.slug.trim(),
        tag: data.tag?.trim() || null,
        excerpt: data.excerpt?.trim() || null,
        description: data.description?.trim() || null,
        coverImage: data.coverImage?.trim() || null,
        mediaUrl: data.mediaUrl?.trim() || null,
        mediaType: data.mediaType || 'none',
        authorName: data.authorName?.trim() || null,
        readingMinutes: data.readingMinutes || null,
        improvements: data.improvements?.filter(Boolean) || [],
        fixes: data.fixes?.filter(Boolean) || [],
        status: 'pending',
      })
      .returning({ id: broadcastApprovals.id })

    await logAudit({
      category: 'content',
      action: 'broadcast.approval_requested',
      target: `${data.type.toUpperCase()}: ${data.title}`,
      metadata: { contentId: data.contentId, type: data.type },
    })

    revalidatePath('/admin')
    return { success: true, id: inserted.id }
  } catch (err) {
    console.error('Failed to create broadcast approval:', err)
    return { success: false }
  }
}

/**
 * Approve a broadcast request and trigger the bulk email to Resend audience.
 */
export async function approveBroadcastAction(id: string): Promise<{
  success: boolean
  sentCount?: number
  broadcastId?: string
  error?: string
}> {
  try {
    await ensureAdmin()
    const admin = await getCurrentAdmin()

    const [row] = await db
      .select()
      .from(broadcastApprovals)
      .where(eq(broadcastApprovals.id, id))
      .limit(1)

    if (!row) {
      return { success: false, error: 'Approval request not found.' }
    }

    if (row.status === 'approved') {
      return { success: false, error: 'This broadcast has already been approved and sent.' }
    }

    let broadcastResult: { success: boolean; sentCount: number; broadcastId?: string; error?: string }

    if (row.type === 'blog') {
      broadcastResult = await sendBlogPublishedBroadcast({
        id: row.contentId,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        coverImage: row.coverImage,
        authorName: row.authorName,
        readingMinutes: row.readingMinutes,
      })
    } else {
      broadcastResult = await sendChangelogPublishedBroadcast({
        id: row.contentId,
        title: row.title,
        slug: row.slug,
        tag: row.tag || 'FEATURE',
        description: row.description || '',
        improvements: (row.improvements as string[]) || [],
        fixes: (row.fixes as string[]) || [],
        mediaUrl: row.mediaUrl,
        mediaType: (row.mediaType as any) || 'none',
      })
    }

    if (!broadcastResult.success) {
      await db
        .update(broadcastApprovals)
        .set({
          error: broadcastResult.error || 'Failed to dispatch broadcast',
          updatedAt: new Date(),
        })
        .where(eq(broadcastApprovals.id, id))

      await logAudit({
        category: 'system',
        action: 'broadcast.failed',
        target: `${row.type.toUpperCase()}: ${row.title}`,
        metadata: { error: broadcastResult.error },
      })

      return {
        success: false,
        error: broadcastResult.error || 'Failed to send broadcast via Resend.',
      }
    }

    await db
      .update(broadcastApprovals)
      .set({
        status: 'approved',
        broadcastId: broadcastResult.broadcastId || null,
        sentCount: broadcastResult.sentCount || 0,
        approvedAt: new Date(),
        approvedBy: admin?.email || admin?.name || 'Admin',
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(broadcastApprovals.id, id))

    await logAudit({
      category: 'content',
      action: 'broadcast.approved',
      target: `${row.type.toUpperCase()}: ${row.title}`,
      metadata: {
        sentCount: broadcastResult.sentCount,
        broadcastId: broadcastResult.broadcastId,
      },
    })

    revalidatePath('/admin')
    return {
      success: true,
      sentCount: broadcastResult.sentCount,
      broadcastId: broadcastResult.broadcastId,
    }
  } catch (err) {
    console.error('Failed to approve broadcast:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown approval error',
    }
  }
}

/**
 * Dismiss / reject a broadcast approval request without sending an email.
 */
export async function dismissBroadcastAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureAdmin()
    const [row] = await db
      .select({ id: broadcastApprovals.id, title: broadcastApprovals.title, type: broadcastApprovals.type })
      .from(broadcastApprovals)
      .where(eq(broadcastApprovals.id, id))
      .limit(1)

    if (!row) {
      return { success: false, error: 'Approval request not found.' }
    }

    await db
      .update(broadcastApprovals)
      .set({
        status: 'dismissed',
        updatedAt: new Date(),
      })
      .where(eq(broadcastApprovals.id, id))

    await logAudit({
      category: 'content',
      action: 'broadcast.dismissed',
      target: `${row.type.toUpperCase()}: ${row.title}`,
    })

    revalidatePath('/admin')
    return { success: true }
  } catch (err) {
    console.error('Failed to dismiss broadcast:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to dismiss broadcast',
    }
  }
}
