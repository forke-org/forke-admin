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

import { db } from './db'
import { blogs } from './db/schema'
import { eq, desc, sql, and, ne, inArray } from 'drizzle-orm'
import { isAdminAuthenticated, getCurrentAdmin } from './admin-actions'
import { logAudit } from './actions/audit-actions'
import { revalidatePath } from 'next/cache'
import { unlink, readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { deleteFileByUrl } from './r2'
import { sendBlogPublishedBroadcast } from './email'

async function ensureAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized')
  }
}

/**
 * Fire the new-blog email to all subscribers, fail-soft. Never throws — a Resend
 * outage or a subscriber-query error must not roll back or block a publish.
 */
async function announceBlogToSubscribers(blog: {
  id?: string
  title: string
  slug: string
  excerpt?: string | null
  coverImage?: string | null
  authorName?: string | null
  readingMinutes?: number | null
  publishedAt?: Date | null
}) {
  try {
    const { success, sentCount, broadcastId, error } = await sendBlogPublishedBroadcast(blog)
    // Record the TRUE outcome — a silent "sent" entry on a failed send is what
    // previously hid a broadcast stuck in Resend's "draft" state.
    await logAudit({
      category: 'system',
      action: success ? 'blog.broadcast_sent' : 'blog.broadcast_failed',
      target: blog.title,
      metadata: { success, sentCount, broadcastId, error },
    })
    if (!success) {
      console.error('Blog broadcast did not send:', { broadcastId, error })
    }
  } catch (err) {
    console.error('Failed to broadcast new blog to subscribers:', err)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

/** URL-safe slug from a title (e.g. "My First Post!" -> "my-first-post"). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // strip punctuation
    .replace(/[\s_-]+/g, '-')   // collapse whitespace/underscores to single dash
    .replace(/^-+|-+$/g, '')    // trim leading/trailing dashes
    .slice(0, 80) || 'untitled'
}

/** Ensure slug uniqueness by appending -2, -3… ignoring the post's own row. */
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  let candidate = base
  let n = 1
  // Loop until no other row owns the candidate slug.
  // Bounded in practice — titles rarely collide more than a handful of times.
  while (true) {
    const existing = await db
      .select({ id: blogs.id })
      .from(blogs)
      .where(
        ignoreId
          ? and(eq(blogs.slug, candidate), ne(blogs.id, ignoreId))
          : eq(blogs.slug, candidate)
      )
      .limit(1)
    if (existing.length === 0) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}

/**
 * Walk a Tiptap JSON doc and concatenate text content, then estimate reading
 * time at ~200 wpm (min 1). Kept dependency-free so it works server-side.
 */
function estimateReadingMinutes(content: unknown): number {
  let words = 0
  let plain: unknown = content
  try {
    plain = content == null ? null : JSON.parse(JSON.stringify(content))
  } catch {
    plain = null
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; content?: unknown }
    if (typeof n.text === 'string') {
      words += n.text.trim().split(/\s+/).filter(Boolean).length
    }
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(plain)
  return Math.max(1, Math.ceil(words / 200))
}

// Helper to determine if an image URL was uploaded by Forke's system (local or R2)
function isUploadedBlogUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  
  // Local storage upload prefix
  if (url.startsWith('/uploads/blogs/')) return true
  
  // Cloudflare R2 public URL check
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || ''
  if (publicUrl && url.startsWith(publicUrl) && url.includes('/blogs/')) {
    return true
  }
  
  // Direct Vercel / Cloudflare default dev domain check
  if (url.includes('.r2.dev/blogs/')) return true
  
  return false
}

/** Collect every locally/R2-uploaded image URL referenced by a post (cover + body). */
function collectLocalImages(content: unknown, coverImage?: string | null): Set<string> {
  const urls = new Set<string>()
  const add = (u: unknown) => {
    if (isUploadedBlogUrl(u)) urls.add(u as string)
  }
  add(coverImage)

  // Normalize to plain JSON first. Content handed in from a client component is
  // a "temporary client reference" — dotting into its nested props on the server
  // throws. A JSON round-trip yields a plain, safely-walkable object.
  let plain: unknown = content
  try {
    plain = content == null ? null : JSON.parse(JSON.stringify(content))
  } catch {
    plain = null
  }

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { attrs?: Record<string, unknown>; content?: unknown }
    if (n.attrs) {
      // image node uses `src`; embeds may reference uploaded preview images too.
      add(n.attrs.src)
      add(n.attrs.image)
    }
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(plain)
  return urls
}

/**
 * Collect locally/R2-uploaded image URLs from an HTML string.
 * This is safer than walking Tiptap JSON across server action boundaries where
 * complex objects can be mangled during serialization.
 */
function collectLocalImagesFromHtml(html: string | null, coverImage?: string | null): Set<string> {
  const urls = new Set<string>()
  if (isUploadedBlogUrl(coverImage)) {
    urls.add(coverImage as string)
  }
  if (!html) return urls
  // Match any src attribute in HTML and check if it matches our uploads
  const re = /src=["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (isUploadedBlogUrl(m[1])) {
      urls.add(m[1])
    }
  }
  return urls
}

/**
 * Delete session-uploaded files that are no longer referenced in the saved
 * document.  Accepts `contentHtml` (a plain string) rather than the Tiptap JSON
 * tree because server-action serialisation can mangle the nested JSON and cause
 * `collectLocalImages` to miss URLs — which was the root cause of images being
 * deleted on every save.
 */
export async function cleanupSessionUploads(sessionUrls: string[], contentHtml: string | null, currentCoverImage: string | null) {
  try {
    await ensureAdmin()
    const currentImages = collectLocalImagesFromHtml(contentHtml, currentCoverImage)
    const dir = join(process.cwd(), 'public', 'uploads', 'blogs')
    
    await Promise.all(
      sessionUrls.map(async (url) => {
        // If it's still in the current document, keep it
        if (currentImages.has(url)) return
        try {
          await deleteFileByUrl(url)
        } catch {
          // ignore if missing / deleted
        }
      })
    )
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}


// New uploads younger than this are never swept — protects an image that's been
// uploaded but whose post hasn't saved yet (upload → edit → save race).
const ORPHAN_GRACE_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Delete every /uploads/blogs file that no blog references anymore.
 *
 * This is a global sweep rather than a per-post diff: it's the only reliable way
 * to catch files orphaned by any path (deleted post, replaced cover, removed
 * inline image, or an upload that was discarded before the post ever saved).
 * Files newer than ORPHAN_GRACE_MS are skipped so in-flight edits are safe.
 *
 * Best-effort and self-contained; never throws into the caller.
 */
async function sweepOrphanedImages() {
  try {
    const dir = join(process.cwd(), 'public', 'uploads', 'blogs')
    const files = await readdir(dir).catch(() => [] as string[])
    if (files.length === 0) return

    // Every filename still referenced by some blog (cover or body content).
    const rows = await db
      .select({ content: blogs.content, coverImage: blogs.coverImage })
      .from(blogs)
    const referenced = new Set<string>()
    for (const r of rows) {
      for (const url of collectLocalImages(r.content, r.coverImage)) {
        referenced.add(basename(url))
      }
    }

    const now = Date.now()
    await Promise.all(
      files.map(async (file) => {
        if (referenced.has(file)) return
        const full = join(dir, file)
        try {
          const info = await stat(full)
          if (now - info.mtimeMs < ORPHAN_GRACE_MS) return // too new — keep
          await unlink(full)
        } catch {
          /* gone already / unreadable — ignore */
        }
      })
    )
  } catch {
    /* never block a save on cleanup */
  }
}

// ── types ─────────────────────────────────────────────────────────────────

export interface BlogInput {
  title: string
  authorName?: string | null
  excerpt?: string | null
  coverImage?: string | null
  content?: unknown          // Tiptap JSON — sent as a JSON *string* (see normalizeContent)
  contentHtml?: string | null
}

/**
 * Normalize the incoming `content` into a plain Tiptap JSON object.
 *
 * The editor sends `content` as a JSON **string** on purpose: passing the raw
 * Tiptap object across the React Server Component boundary is lossy — node
 * `attrs` (heading `level`, image `src`, embed `embedType`/`embedSrc`, …) get
 * silently dropped in the prod build, corrupting the stored document while the
 * HTML snapshot still looks fine. A string round-trips losslessly, so we parse
 * it back here. We still accept a plain object for backward compatibility.
 */
function normalizeContent(content: unknown): unknown {
  if (content == null) return null
  if (typeof content === 'string') {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  // Already an object (legacy callers / server-side use): deep-clone to a plain
  // object so any client-reference wrappers are stripped before we persist it.
  try {
    return JSON.parse(JSON.stringify(content))
  } catch {
    return null
  }
}

// ── reads ─────────────────────────────────────────────────────────────────

export async function getBlogs() {
  await ensureAdmin()
  const rows = await db
    .select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      excerpt: blogs.excerpt,
      coverImage: blogs.coverImage,
      status: blogs.status,
      authorName: blogs.authorName,
      readingMinutes: blogs.readingMinutes,
      publishedAt: blogs.publishedAt,
      createdAt: blogs.createdAt,
      updatedAt: blogs.updatedAt,
    })
    .from(blogs)
    .orderBy(desc(blogs.createdAt))
  return { success: true as const, data: rows }
}

export async function getBlog(id: string) {
  await ensureAdmin()
  const row = await db.select().from(blogs).where(eq(blogs.id, id)).limit(1)
  if (row.length === 0) return { success: false as const, error: 'Post not found' }
  return { success: true as const, data: row[0] }
}

// ── public reads (no admin gate) ────────────────────────────────────────────

/** All published posts, newest first — for the public /blog list. */
export async function getPublishedBlogs() {
  return db
    .select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      excerpt: blogs.excerpt,
      coverImage: blogs.coverImage,
      authorName: blogs.authorName,
      readingMinutes: blogs.readingMinutes,
      publishedAt: blogs.publishedAt,
    })
    .from(blogs)
    .where(eq(blogs.status, 'published'))
    .orderBy(desc(blogs.createdAt))
}

/** A single published post by slug — for /blog/[slug]. Drafts return null. */
export async function getPublishedBlogBySlug(slug: string) {
  const row = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.slug, slug), eq(blogs.status, 'published')))
    .limit(1)
  return row[0] ?? null
}

/** Slugs + timestamps of published posts — for the sitemap. */
export async function getPublishedBlogSlugs() {
  return db
    .select({ slug: blogs.slug, updatedAt: blogs.updatedAt, publishedAt: blogs.publishedAt })
    .from(blogs)
    .where(eq(blogs.status, 'published'))
}

// ── writes ────────────────────────────────────────────────────────────────

export async function createBlog(input: BlogInput) {
  await ensureAdmin()
  const admin = await getCurrentAdmin()
  const title = input.title?.trim() || 'Untitled'
  const slug = await uniqueSlug(slugify(title))
  const content = normalizeContent(input.content)

  const [created] = await db
    .insert(blogs)
    .values({
      authorId: admin?.id ?? null,
      authorName: input.authorName?.trim() || admin?.name || null,
      title,
      slug,
      excerpt: input.excerpt?.trim() || null,
      coverImage: input.coverImage?.trim() || null,
      content,
      contentHtml: input.contentHtml ?? null,
      status: 'draft',
      readingMinutes: estimateReadingMinutes(content),
    })
    .returning({ id: blogs.id, slug: blogs.slug })

  await logAudit({ category: 'admin', action: 'blog.created', target: title })
  revalidatePath('/admin')
  return { success: true as const, id: created.id, slug: created.slug }
}

export async function updateBlog(id: string, input: BlogInput) {
  await ensureAdmin()
  const existing = await db
    .select({ title: blogs.title, slug: blogs.slug })
    .from(blogs)
    .where(eq(blogs.id, id))
    .limit(1)
  if (existing.length === 0) return { success: false as const, error: 'Post not found' }

  const title = input.title?.trim() || 'Untitled'
  // Re-slug only when the title actually changed, preserving published URLs otherwise.
  const slug =
    title !== existing[0].title
      ? await uniqueSlug(slugify(title), id)
      : existing[0].slug

  const newCover = input.coverImage?.trim() || null
  const content = normalizeContent(input.content)
  await db
    .update(blogs)
    .set({
      title,
      slug,
      // Only overwrite the byline when one was supplied — an empty field must
      // not clobber an existing author name.
      ...(input.authorName !== undefined
        ? { authorName: input.authorName?.trim() || null }
        : {}),
      excerpt: input.excerpt?.trim() || null,
      coverImage: newCover,
      content,
      contentHtml: input.contentHtml ?? null,
      readingMinutes: estimateReadingMinutes(content),
      updatedAt: new Date(),
    })
    .where(eq(blogs.id, id))

  // Reclaim any uploaded image no blog references anymore (replaced cover,
  // deleted inline image, or a discarded upload).
  await sweepOrphanedImages()

  await logAudit({ category: 'admin', action: 'blog.updated', target: title })
  revalidatePath('/admin')
  return { success: true as const, slug }
}

export async function setBlogStatus(id: string, status: 'draft' | 'published') {
  await ensureAdmin()
  const row = await db
    .select({
      id: blogs.id,
      title: blogs.title,
      slug: blogs.slug,
      excerpt: blogs.excerpt,
      coverImage: blogs.coverImage,
      authorName: blogs.authorName,
      readingMinutes: blogs.readingMinutes,
      publishedAt: blogs.publishedAt,
    })
    .from(blogs)
    .where(eq(blogs.id, id))
    .limit(1)
  if (row.length === 0) return { success: false as const, error: 'Post not found' }

  // First-publish = going live while it has never been published before. Only
  // then do we announce it to subscribers — re-publishing a post never re-sends.
  const isFirstPublish = status === 'published' && row[0].publishedAt == null
  const publishedAt = status === 'published' ? row[0].publishedAt ?? new Date() : row[0].publishedAt

  await db
    .update(blogs)
    .set({
      status,
      // Stamp publishedAt the first time it goes live; keep it on re-publish.
      publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(blogs.id, id))

  await logAudit({
    category: 'admin',
    action: status === 'published' ? 'blog.published' : 'blog.unpublished',
    target: row[0].title,
  })

  if (isFirstPublish) {
    await announceBlogToSubscribers({ ...row[0], publishedAt })
  }

  revalidatePath('/admin')
  return { success: true as const }
}

export async function deleteBlog(id: string) {
  await ensureAdmin()
  const row = await db
    .select({ title: blogs.title, content: blogs.content, contentHtml: blogs.contentHtml, coverImage: blogs.coverImage })
    .from(blogs)
    .where(eq(blogs.id, id))
    .limit(1)
  if (row.length === 0) return { success: false as const, error: 'Post not found' }

  await db.delete(blogs).where(eq(blogs.id, id))
  // Collect images from both JSON and HTML for maximum coverage.
  const dir = join(process.cwd(), 'public', 'uploads', 'blogs')
  const fromJson = collectLocalImages(row[0].content, row[0].coverImage)
  const fromHtml = collectLocalImagesFromHtml(row[0].contentHtml, row[0].coverImage)
  const allImages = new Set([...fromJson, ...fromHtml])
  await Promise.all(
    [...allImages].map((u) =>
      deleteFileByUrl(u).catch(() => {})
    )
  )
  await sweepOrphanedImages()
  await logAudit({ category: 'admin', action: 'blog.deleted', target: row[0].title })
  revalidatePath('/admin')
  return { success: true as const }
}

// ── bulk actions ────────────────────────────────────────────────────────────

/** Delete several posts at once. */
export async function bulkDeleteBlogs(ids: string[]) {
  await ensureAdmin()
  if (ids.length === 0) return { success: true as const, count: 0 }

  const rows = await db
    .select({ content: blogs.content, contentHtml: blogs.contentHtml, coverImage: blogs.coverImage })
    .from(blogs)
    .where(inArray(blogs.id, ids))

  await db.delete(blogs).where(inArray(blogs.id, ids))

  // Collect images from both JSON and HTML for maximum coverage, then delete.
  const dir = join(process.cwd(), 'public', 'uploads', 'blogs')
  const owned = new Set<string>()
  for (const r of rows) {
    for (const u of collectLocalImages(r.content, r.coverImage)) owned.add(u)
    for (const u of collectLocalImagesFromHtml(r.contentHtml, r.coverImage)) owned.add(u)
  }
  await Promise.all([...owned].map((u) => deleteFileByUrl(u).catch(() => {})))
  await sweepOrphanedImages()

  await logAudit({ category: 'admin', action: 'blog.bulk_deleted', target: `${ids.length} posts` })
  revalidatePath('/admin')
  return { success: true as const, count: ids.length }
}

/** Publish or unpublish several posts at once. */
export async function bulkSetBlogStatus(ids: string[], status: 'draft' | 'published') {
  await ensureAdmin()
  if (ids.length === 0) return { success: true as const, count: 0 }

  // Snapshot which of these will be first-time publishes (never published before),
  // grabbing the fields the announcement email needs, before we mutate the rows.
  const firstPublishes =
    status === 'published'
      ? await db
          .select({
            id: blogs.id,
            title: blogs.title,
            slug: blogs.slug,
            excerpt: blogs.excerpt,
            coverImage: blogs.coverImage,
            authorName: blogs.authorName,
            readingMinutes: blogs.readingMinutes,
          })
          .from(blogs)
          .where(and(inArray(blogs.id, ids), sql`${blogs.publishedAt} IS NULL`))
      : []

  await db
    .update(blogs)
    .set({
      status,
      // Stamp publishedAt on first publish; leave it otherwise.
      ...(status === 'published'
        ? { publishedAt: sql`COALESCE(${blogs.publishedAt}, now())` }
        : {}),
      updatedAt: new Date(),
    })
    .where(inArray(blogs.id, ids))

  await logAudit({
    category: 'admin',
    action: status === 'published' ? 'blog.bulk_published' : 'blog.bulk_unpublished',
    target: `${ids.length} posts`,
  })

  // Announce each newly-published post to subscribers (fail-soft, sequential).
  for (const blog of firstPublishes) {
    await announceBlogToSubscribers({ ...blog, publishedAt: new Date() })
  }

  revalidatePath('/admin')
  return { success: true as const, count: ids.length }
}

/** Sidebar badge count — total posts. Best-effort, never throws upward. */
export async function getBlogCount() {
  try {
    await ensureAdmin()
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogs)
    return { success: true as const, count }
  } catch {
    return { success: false as const, count: 0 }
  }
}

// ── blog view tracking ────────────────────────────────────────────────────────

/** Increment the views counter for a post by slug. No auth gate — public API route. */
export async function incrementBlogView(slug: string) {
  try {
    await db
      .update(blogs)
      .set({ views: sql`${blogs.views} + 1` })
      .where(and(eq(blogs.slug, slug), eq(blogs.status, 'published')))
    return { success: true as const }
  } catch {
    return { success: false as const }
  }
}

/** Views for a single post by id (public — no auth gate). */
export async function getBlogViewCount(blogId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ views: blogs.views })
      .from(blogs)
      .where(eq(blogs.id, blogId))
    return row?.views ?? 0
  } catch {
    return 0
  }
}

/**
 * Map of blogId → view count for ALL posts.
 * Used by the admin panel to show counts for every row in one query.
 */
export async function getBlogViewCounts(): Promise<Record<string, number>> {
  try {
    await ensureAdmin()
    const rows = await db.select({ id: blogs.id, views: blogs.views }).from(blogs)
    return Object.fromEntries(rows.map((r) => [r.id, r.views]))
  } catch {
    return {}
  }
}

/**
 * Map of slug → view count for ALL published posts.
 * Used by the public blog list to show counts without N+1 queries.
 */
export async function getPublishedBlogViewCounts(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({ slug: blogs.slug, views: blogs.views })
      .from(blogs)
      .where(eq(blogs.status, 'published'))
    return Object.fromEntries(rows.map((r) => [r.slug, r.views]))
  } catch {
    return {}
  }
}
