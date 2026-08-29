'use client'

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
 * Blog admin panel — list view + Medium-style editor view.
 *
 * Self-contained like the other admin panels (DatabaseConsole etc.): it owns its
 * own data fetching via blog-actions and switches between a posts table and the
 * BlogEditor. The heavy Tiptap editor is dynamically imported so it doesn't ship
 * in the admin bundle until a post is opened.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  getBlogs,
  getBlog,
  createBlog,
  updateBlog,
  setBlogStatus,
  deleteBlog,
  bulkDeleteBlogs,
  bulkSetBlogStatus,
  cleanupSessionUploads,
  getBlogViewCounts,
} from '@/lib/blog-actions'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/components/shared/Toast'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'
import { cn } from '@/lib/utils/cn'
import {
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  FileText,
  Clock,
  Globe,
  CircleDot,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Users,
} from 'lucide-react'
import type { BlogEditorValue } from './blog/BlogEditor'

// Editor is client-only + heavy (Tiptap) — load on demand.
const BlogEditor = dynamic(() => import('./blog/BlogEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-24 text-sm text-[var(--color-text-muted)]">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading editor…
    </div>
  ),
})

type BlogRow = Awaited<ReturnType<typeof getBlogs>>['data'][number]

type View = { mode: 'list' } | { mode: 'edit'; id: string | null }

export default function BlogPanel() {
  const [view, setView] = useState<View>({ mode: 'list' })

  if (view.mode === 'list') {
    return <BlogList onOpen={(id) => setView({ mode: 'edit', id })} />
  }
  return <BlogEditorView id={view.id} onBack={() => setView({ mode: 'list' })} />
}

// ── list view (tabular: search · filter · multi-select · bulk actions) ──────

const PER_PAGE = 10
type StatusFilter = 'all' | 'published' | 'draft'

function BlogList({ onOpen }: { onOpen: (id: string | null) => void }) {
  const [rows, setRows] = useState<BlogRow[]>([])
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, counts] = await Promise.all([getBlogs(), getBlogViewCounts()])
      if (res.success) setRows(res.data)
      setViewCounts(counts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Filter by search + status (rows already arrive newest-first from the server).
  const filtered = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      r.title.toLowerCase().includes(q) ||
      (r.excerpt?.toLowerCase().includes(q) ?? false) ||
      (r.authorName?.toLowerCase().includes(q) ?? false)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])
  const visibleRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Selection helpers operate over the current filtered set.
  const filteredIds = filtered.map((r) => r.id)
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredIds.forEach((id) => next.delete(id))
      else filteredIds.forEach((id) => next.add(id))
      return next
    })
  const clearSelection = () => setSelected(new Set())

  const handleDelete = (id: string, title: string) => {
    setConfirm({
      title: 'Delete Post',
      message: `"${title}" will be permanently deleted. Continue?`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        const res = await deleteBlog(id)
        if (res.success) {
          toast('Post deleted.', 'success')
          setSelected((p) => {
            const n = new Set(p)
            n.delete(id)
            return n
          })
          load()
        } else {
          toast(res.error || 'Failed to delete post.', 'error')
        }
      },
    })
  }

  const togglePublish = async (row: BlogRow) => {
    const next = row.status === 'published' ? 'draft' : 'published'
    const res = await setBlogStatus(row.id, next)
    if (res.success) {
      toast(next === 'published' ? 'Post published.' : 'Moved to draft.', 'success')
      load()
    } else {
      toast(res.error || 'Failed to update status.', 'error')
    }
  }

  // ── bulk actions over the selected ids ──
  const runBulkStatus = async (status: 'published' | 'draft') => {
    const ids = [...selected]
    setBulkBusy(true)
    try {
      const res = await bulkSetBlogStatus(ids, status)
      if (res.success) {
        toast(`${ids.length} post${ids.length > 1 ? 's' : ''} ${status === 'published' ? 'published' : 'moved to draft'}.`, 'success')
        clearSelection()
        load()
      } else {
        toast('Bulk action failed.', 'error')
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const runBulkDelete = () => {
    const ids = [...selected]
    setConfirm({
      title: `Delete ${ids.length} Post${ids.length > 1 ? 's' : ''}`,
      message: `${ids.length} selected post${ids.length > 1 ? 's' : ''} will be permanently deleted. Continue?`,
      confirmLabel: 'Delete All',
      tone: 'danger',
      onConfirm: async () => {
        setBulkBusy(true)
        try {
          const res = await bulkDeleteBlogs(ids)
          if (res.success) {
            toast(`${ids.length} post${ids.length > 1 ? 's' : ''} deleted.`, 'success')
            clearSelection()
            load()
          } else {
            toast('Bulk delete failed.', 'error')
          }
        } finally {
          setBulkBusy(false)
        }
      },
    })
  }

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-white">Blog</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Write and publish posts with the editor.
          </p>
        </div>
        <Button size="sm" onClick={() => onOpen(null)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Post
        </Button>
      </div>

      {/* Toolbar: search + status filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-grow sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] pl-8 pr-3 text-[13px] text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/30"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          size="sm"
          className="w-36"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
      </div>

      {/* Bulk action bar — appears when rows are selected */}
      {someSelected && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2">
          <span className="text-xs font-medium text-white">
            {selected.size} selected
          </span>
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
          <button
            disabled={bulkBusy}
            onClick={() => runBulkStatus('published')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.07] disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" /> Publish
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => runBulkStatus('draft')}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.07] disabled:opacity-50"
          >
            <CircleDot className="h-3.5 w-3.5" /> Unpublish
          </button>
          <button
            disabled={bulkBusy}
            onClick={runBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-white"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-grow overflow-auto rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading posts…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="mb-3 h-8 w-8 text-white/15" />
            <p className="text-sm font-medium text-white">
              {rows.length === 0 ? 'No posts yet' : 'No posts match your filters'}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {rows.length === 0 ? 'Create your first post to get started.' : 'Try a different search or status.'}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35">
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="Select all" />
                </th>
                <th className="px-2 py-2.5 font-medium">Title</th>
                <th className="hidden px-2 py-2.5 font-medium md:table-cell">Status</th>
                <th className="hidden px-2 py-2.5 font-medium lg:table-cell">Author</th>
                <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Readers</th>
                <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Updated</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'group transition-colors hover:bg-white/[0.015]',
                    selected.has(row.id) && 'bg-accent/[0.04]'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`Select ${row.title}`}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => onOpen(row.id)} className="flex items-center gap-3 text-left">
                      <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-white/[0.02]">
                        {row.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.coverImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FileText className="h-3.5 w-3.5 text-white/15" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-white group-hover:text-accent">
                          {row.title}
                        </p>
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                          <Clock className="h-2.5 w-2.5" /> {row.readingMinutes} min
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="hidden px-2 py-2.5 lg:table-cell">
                    <span className="text-[12px] text-[var(--color-text-muted)]">
                      {row.authorName || '—'}
                    </span>
                  </td>
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                      <Users className="h-3 w-3" />
                      {(viewCounts[row.id] ?? 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePublish(row)}
                        title={row.status === 'published' ? 'Unpublish' : 'Publish'}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {row.status === 'published' ? (
                          <CircleDot className="h-3.5 w-3.5" />
                        ) : (
                          <Globe className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpen(row.id)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id, row.title)}
                        title="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — 10 posts per page */}
      {!loading && filtered.length > PER_PAGE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Showing <span className="text-white">{(page - 1) * PER_PAGE + 1}</span>–
            <span className="text-white">{Math.min(page * PER_PAGE, filtered.length)}</span> of{' '}
            <span className="text-white">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-white select-none">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none"
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

/** Compact dark checkbox matching the admin aesthetic. */
function Checkbox({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: () => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-accent bg-accent text-white'
          : 'border-[var(--color-border)] bg-white/[0.02] hover:border-white/30'
      )}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  )
}

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] lowercase leading-none text-white/60">
      {status}
    </span>
  )
}

// ── editor view ──────────────────────────────────────────────────────────────

function BlogEditorView({ id, onBack }: { id: string | null; onBack: () => void }) {
  const [loading, setLoading] = useState(id !== null)
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [initial, setInitial] = useState<{
    title: string
    authorName: string
    coverImage: string | null
    content: unknown
    contentHtml: string | null
  } | null>(id === null ? { title: '', authorName: '', coverImage: null, content: undefined, contentHtml: null } : null)

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  // Reactive "unsaved changes" flag — drives the primary toolbar button label.
  const [hasChanges, setHasChanges] = useState(false)
  // Latest editor value, kept in a ref so save doesn't re-render on every keystroke.
  const valueRef = useRef<BlogEditorValue | null>(null)
  // Refs that autosave/lifecycle handlers read without going stale across renders.
  const postIdRef = useRef<string | null>(id)
  const savingRef = useRef(false)        // guards against overlapping saves
  const dirtyRef = useRef(false)         // unsaved changes pending?

  const sessionUploadsRef = useRef<Set<string>>(new Set())
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)

  const handleImageUpload = useCallback((url: string) => {
    sessionUploadsRef.current.add(url)
  }, [])

  useEffect(() => {
    if (id === null) return
    ;(async () => {
      const res = await getBlog(id)
      if (res.success) {
        setInitial({
          title: res.data.title === 'Untitled' ? '' : res.data.title,
          authorName: res.data.authorName ?? '',
          coverImage: res.data.coverImage,
          content: res.data.content ?? undefined,
          contentHtml: res.data.contentHtml ?? null,
        })
        setStatus(res.data.status)
      } else {
        toast(res.error || 'Failed to load post.', 'error')
        onBack()
      }
      setLoading(false)
    })()
  }, [id, onBack])

  // Single save path used by manual save, publish, and unload.
  const persist = useCallback(async (silent = false): Promise<string | null> => {
    const v = valueRef.current
    if (!v) return postIdRef.current
    // Skip empty brand-new posts — don't litter the list with blank drafts.
    const isEmpty =
      !postIdRef.current &&
      !v.title.trim() &&
      deriveExcerpt(v.contentHtml).length === 0 &&
      !v.coverImage
    if (isEmpty) return null
    if (savingRef.current) return postIdRef.current // a save is already in flight

    savingRef.current = true
    dirtyRef.current = false
    if (!silent) setSaving(true)
    try {
      const payload = {
        title: v.title,
        authorName: v.authorName,
        excerpt: deriveExcerpt(v.contentHtml),
        coverImage: v.coverImage,
        // Serialize the Tiptap JSON to a string before it crosses the server-
        // action boundary. Passing the raw object is lossy in the prod build —
        // node attrs (heading level, image src, embed type) get dropped — so we
        // stringify here and JSON.parse it back in the action (normalizeContent).
        content: JSON.stringify(v.content ?? null),
        contentHtml: v.contentHtml,
      }
      let savedId: string
      if (postIdRef.current) {
        const res = await updateBlog(postIdRef.current, payload)
        if (!res.success) {
          if (!silent) toast(res.error || 'Failed to save.', 'error')
          dirtyRef.current = true
          return null
        }
        savedId = postIdRef.current
      } else {
        const res = await createBlog(payload)
        if (!res.success) {
          if (!silent) toast('Failed to create post.', 'error')
          dirtyRef.current = true
          return null
        }
        savedId = res.id
        postIdRef.current = res.id
      }

      // Clean up session uploads
      const sessionUrls = Array.from(sessionUploadsRef.current)
      if (sessionUrls.length > 0) {
        await cleanupSessionUploads(sessionUrls, v.contentHtml, v.coverImage)
        const contentHtml = v.contentHtml || ''
        const coverImage = v.coverImage || ''
        const nextSessionUrls = new Set<string>()
        sessionUploadsRef.current.forEach((url) => {
          if (contentHtml.includes(url) || coverImage === url) {
            nextSessionUrls.add(url)
          }
        })
        sessionUploadsRef.current = nextSessionUrls
      }

      setSavedAt(new Date())
      setHasChanges(false)
      return savedId
    } finally {
      savingRef.current = false
      if (!silent) setSaving(false)
    }
  }, [])

  // Called by the editor on every change → mark dirty.
  const handleEditorChange = useCallback(
    (v: BlogEditorValue) => {
      valueRef.current = v
      dirtyRef.current = true
      setHasChanges(true)
    },
    []
  )

  // Warn on tab close if there are unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const handleBack = () => {
    if (dirtyRef.current) {
      setConfirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave and discard them?',
        confirmLabel: 'Discard',
        tone: 'danger',
        onConfirm: async () => {
          // Clean up new uploads before exiting!
          const sessionUrls = Array.from(sessionUploadsRef.current)
          if (sessionUrls.length > 0) {
            await cleanupSessionUploads(sessionUrls, initial?.contentHtml ?? null, initial?.coverImage ?? null)
          }
          onBack()
        },
      })
    } else {
      onBack()
    }
  }

  const handleSave = async () => {
    const savedId = await persist()
    if (!savedId) return
    // "Save draft" always lands the post in draft state — if it was published,
    // saving a draft unpublishes it.
    if (status === 'published') {
      const res = await setBlogStatus(savedId, 'draft')
      if (res.success) {
        setStatus('draft')
        toast('Saved as draft — post unpublished.', 'success')
        return
      }
      toast(res.error || 'Saved, but failed to unpublish.', 'error')
      return
    }
    toast('Draft saved.', 'success')
  }

  const handlePublishToggle = async () => {
    // Ensure content is persisted before flipping status.
    const savedId = await persist()
    if (!savedId) return
    const next = status === 'published' ? 'draft' : 'published'
    const res = await setBlogStatus(savedId, next)
    if (res.success) {
      setStatus(next)
      toast(next === 'published' ? 'Post published.' : 'Moved to draft.', 'success')
    } else {
      toast(res.error || 'Failed to update status.', 'error')
    }
  }

  // Save edits to an already-published post WITHOUT unpublishing it.
  const handleSaveChanges = async () => {
    const savedId = await persist()
    if (savedId) toast('Changes saved.', 'success')
  }

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Posts
        </button>

        <div className="flex items-center gap-2.5">
          {savedAt && !saving && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
              <Check className="h-3 w-3 text-emerald-400" />
              Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {saving && (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          )}
          <StatusBadge status={status} />

          {/* Secondary "Save draft" button — only meaningful for unpublished
              posts (for a published post, the primary Save handles it). */}
          {status !== 'published' && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-9 min-w-[120px] items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 text-xs font-medium text-white transition-colors hover:bg-white/[0.05] disabled:opacity-50"
            >
              Save draft
            </button>
          )}

          {/* Primary button:
              · draft                       → Publish
              · published + unsaved changes → Save (keeps it published)
              · published + no changes      → Unpublish */}
          {status === 'published' && !hasChanges ? (
            <button
              onClick={handlePublishToggle}
              disabled={saving}
              className="inline-flex h-9 min-w-[120px] items-center justify-center gap-1.5 rounded-lg border border-orange-500/25 bg-orange-500/5 px-4 text-xs font-medium text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.04)] transition-colors hover:bg-orange-500/10 hover:border-orange-500/40 disabled:opacity-50"
            >
              <CircleDot className="h-3.5 w-3.5" /> Unpublish
            </button>
          ) : (
            <button
              onClick={status === 'published' ? handleSaveChanges : handlePublishToggle}
              disabled={saving}
              className="inline-flex h-9 min-w-[120px] items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {status === 'published' ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Save
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" /> Publish
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-grow overflow-y-auto py-8">
        {loading || !initial ? (
          <div className="flex items-center justify-center py-24 text-sm text-[var(--color-text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading post…
          </div>
        ) : (
          <BlogEditor
            initialTitle={initial.title}
            initialAuthorName={initial.authorName}
            initialCoverImage={initial.coverImage}
            initialContent={initial.content}
            onChange={handleEditorChange}
            onImageUpload={handleImageUpload}
          />
        )}
      </div>

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

/** First ~200 chars of plain text from rendered HTML, for the excerpt field. */
function deriveExcerpt(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 200)
}
