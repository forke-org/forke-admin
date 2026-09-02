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

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Search, Edit3, Pencil, Trash2, Globe, Eye, EyeOff, Sparkles,
  CheckCircle2, Upload, Video, Image as ImageIcon, X, ExternalLink,
  Calendar, Tag, ArrowUpRight, RefreshCw, FileText, Check, Clock,
  ChevronLeft, ChevronRight, ArrowLeft, Loader2, CircleDot, Layers,
  Copy, Mail, Maximize2
} from 'lucide-react'
import {
  getChangelogsAdmin,
  createChangelogAction,
  updateChangelogAction,
  deleteChangelogAction,
  deleteChangelogMediaAction,
  toggleChangelogPublishAction,
  bulkDeleteChangelogsAction,
  bulkSetChangelogPublishAction,
  type ChangelogInput
} from '@/lib/admin-changelog-actions'
import { getBroadcastEmailPreviewHtmlAction } from '@/lib/actions/broadcast-actions'
import EmailSneakPeekModal from '@/components/shared/EmailSneakPeekModal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/components/shared/Toast'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'
import { TableLoadingRows } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

interface ChangelogRow {
  id: string
  title: string
  slug: string
  tag: string
  description: string
  improvements: string[]
  fixes: string[]
  mediaType: 'none' | 'image' | 'video'
  mediaUrl: string | null
  isPublished: boolean
  publishedAt: string
  createdAt: string
  updatedAt: string
}

const TAG_PRESETS = ['FEATURE', 'FIX', 'POLISH', 'UPDATE', 'IMPROVEMENT']
const PER_PAGE = 10

type View = { mode: 'list' } | { mode: 'edit'; id: string | null }
type StatusFilter = 'all' | 'published' | 'draft'

function parseDate(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null
  const d = iso instanceof Date ? iso : new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function formatLocalDateTime(iso: string | Date | null | undefined): string {
  const d = parseDate(iso)
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      hour12: true,
    }).format(d)
  } catch {
    return String(iso)
  }
}

function toLocalInputString(iso: string | null | undefined): string {
  const d = parseDate(iso) || new Date()
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${y}-${m}-${day}T${h}:${min}`
}

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] lowercase leading-none text-white/60">
      {isPublished ? 'published' : 'draft'}
    </span>
  )
}

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
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={cn(
        'flex h-4 w-4 items-center justify-center rounded border transition-colors cursor-pointer',
        checked
          ? 'border-accent bg-accent text-black'
          : 'border-[var(--color-border)] bg-white/[0.02] hover:border-white/30'
      )}
    >
      {checked && <Check className="h-3 w-3 stroke-[3]" />}
    </button>
  )
}

export default function ChangelogPanel() {
  const [listPage, setListPage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('p')
      return p ? Math.max(1, parseInt(p, 10) || 1) : 1
    }
    return 1
  })
  const [view, setView] = useState<View>(() => {
    if (typeof window !== 'undefined') {
      const editId = new URLSearchParams(window.location.search).get('edit')
      if (editId) return { mode: 'edit', id: editId === 'new' ? null : editId }
    }
    return { mode: 'list' }
  })
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const openEditor = (id: string | null) => {
    setView({ mode: 'edit', id })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('edit', id || 'new')
      if (listPage > 1) url.searchParams.set('p', String(listPage))
      window.history.pushState({}, '', url.pathname + url.search)
    }
  }

  const closeEditor = () => {
    setView({ mode: 'list' })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('edit')
      if (listPage > 1) url.searchParams.set('p', String(listPage))
      else url.searchParams.delete('p')
      window.history.pushState({}, '', url.pathname + url.search)
    }
  }

  const handleSaved = () => {
    setRefreshTrigger((prev) => prev + 1)
    closeEditor()
  }

  return (
    <>
      <div className={cn("h-full w-full flex flex-col min-h-0", view.mode !== 'list' && 'hidden')}>
        <ChangelogListView
          initialPage={listPage}
          onPageChange={(p) => {
            setListPage(p)
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              if (p > 1) url.searchParams.set('p', String(p))
              else url.searchParams.delete('p')
              window.history.replaceState({}, '', url.pathname + url.search)
            }
          }}
          onOpen={openEditor}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {view.mode === 'edit' && (
        <ChangelogEditorView
          id={view.id}
          onBack={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </>
  )
}

// ── list view (tabular: search · filter · status toggle · delete) ───────────

function ChangelogListView({
  initialPage = 1,
  onPageChange,
  onOpen,
  refreshTrigger = 0,
}: {
  initialPage?: number
  onPageChange?: (page: number) => void
  onOpen: (id: string | null) => void
  refreshTrigger?: number
}) {
  const [rows, setRows] = useState<ChangelogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [page, setPage] = useState(initialPage)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tagFilter, setTagFilter] = useState('all')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('')
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('')
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)

  const handlePreviewEmail = async (row: ChangelogRow) => {
    setEmailPreviewOpen(true)
    setEmailPreviewLoading(true)
    try {
      const res = await getBroadcastEmailPreviewHtmlAction({
        type: 'changelog',
        title: row.title,
        slug: row.slug,
        tag: row.tag,
        description: row.description,
        improvements: row.improvements,
        fixes: row.fixes,
        mediaUrl: row.mediaUrl,
        mediaType: row.mediaType,
      })
      if (res.success) {
        setEmailPreviewHtml(res.html)
        setEmailPreviewSubject(res.subject)
      } else {
        toast(res.error || 'Failed to generate email preview.', 'error')
      }
    } catch {
      toast('Failed to load email preview.', 'error')
    } finally {
      setEmailPreviewLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getChangelogsAdmin()
      if (res.success && res.data) {
        setRows(res.data as ChangelogRow[])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshTrigger])

  useEffect(() => {
    if (initialPage > 0) {
      setPage(initialPage)
    }
  }, [initialPage])

  const filtered = rows.filter((r) => {
    if (statusFilter === 'published' && !r.isPublished) return false
    if (statusFilter === 'draft' && r.isPublished) return false
    if (tagFilter !== 'all' && r.tag !== tagFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      r.title.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      r.tag.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setPage(1)
    onPageChange?.(1)
  }, [query, statusFilter, tagFilter])

  useEffect(() => {
    if (!loading && rows.length > 0) {
      setPage((p) => Math.min(Math.max(1, p), totalPages))
    }
  }, [loading, rows.length, totalPages])

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
      title: 'Delete Changelog Post',
      message: `"${title}" will be permanently deleted. Continue?`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        const res = await deleteChangelogAction(id)
        if (res.success) {
          toast('Changelog post deleted.', 'success')
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

  const togglePublish = async (row: ChangelogRow) => {
    const next = !row.isPublished
    const res = await toggleChangelogPublishAction(row.id, next)
    if (res.success) {
      toast(next ? 'Changelog published.' : 'Moved to draft.', 'success')
      load()
    } else {
      toast('Failed to update status.', 'error')
    }
  }

  const runBulkStatus = async (isPublished: boolean) => {
    const ids = [...selected]
    setBulkBusy(true)
    try {
      const res = await bulkSetChangelogPublishAction(ids, isPublished)
      if (res.success) {
        toast(`${ids.length} changelog${ids.length > 1 ? 's' : ''} ${isPublished ? 'published' : 'moved to draft'}.`, 'success')
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
      title: `Delete ${ids.length} Changelog${ids.length > 1 ? 's' : ''}`,
      message: `${ids.length} selected changelog${ids.length > 1 ? 's' : ''} will be permanently deleted. Continue?`,
      confirmLabel: 'Delete All',
      tone: 'danger',
      onConfirm: async () => {
        setBulkBusy(true)
        try {
          const res = await bulkDeleteChangelogsAction(ids)
          if (res.success) {
            toast(`${ids.length} changelog${ids.length > 1 ? 's' : ''} deleted.`, 'success')
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
          <h2 className="text-base font-medium text-white">Changelog</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Write and publish updates with the editor.
          </p>
        </div>
        <Button size="sm" onClick={() => onOpen(null)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Changelog
        </Button>
      </div>

      {/* Toolbar: search + status + tag filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-grow sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changelogs…"
            className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-white/[0.02] pl-8 pr-3 text-[13px] text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/30"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          className="w-36"
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
        <Select
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(v) => setTagFilter(v)}
          className="w-36"
          options={[
            { value: 'all', label: 'All tags' },
            ...TAG_PRESETS.map((t) => ({ value: t, label: t })),
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
            onClick={() => runBulkStatus(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.07] disabled:opacity-50 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5" /> Publish
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => runBulkStatus(false)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.07] disabled:opacity-50 cursor-pointer"
          >
            <CircleDot className="h-3.5 w-3.5" /> Unpublish
          </button>
          <button
            disabled={bulkBusy}
            onClick={runBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-grow overflow-auto rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35">
              <th className="w-10 px-3 py-2.5">
                <Checkbox checked={allFilteredSelected} onChange={toggleAllFiltered} aria-label="Select all" />
              </th>
              <th className="px-2 py-2.5 font-medium">Title</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Status</th>
              <th className="hidden px-2 py-2.5 font-medium lg:table-cell">Category</th>
              <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Updated</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <TableLoadingRows cols={6} rows={6} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="mb-3 h-8 w-8 text-white/15" />
                    <p className="text-sm font-medium text-white">
                      {rows.length === 0 ? 'No changelog posts yet' : 'No posts match your filters'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {rows.length === 0 ? 'Create your first changelog update to get started.' : 'Try a different search or filter.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
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
                      {row.mediaUrl ? (
                        <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-white/[0.02]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.mediaUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-white group-hover:text-accent">
                          {row.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--color-text-muted)]">
                            <Clock className="h-2.5 w-2.5" /> {formatLocalDateTime(row.publishedAt)}
                          </span>
                          <span className="inline-flex lg:hidden items-center rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.2 font-mono text-[9px] text-white/70 uppercase">
                            {row.tag || 'CORE'}
                          </span>
                          <span className="inline-flex md:hidden items-center rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.2 font-mono text-[9px] text-white/50 lowercase">
                            {row.isPublished ? 'published' : 'draft'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </td>
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <StatusBadge isPublished={row.isPublished} />
                  </td>
                  <td className="hidden px-2 py-2.5 lg:table-cell">
                    <span className="text-[12px] text-[var(--color-text-muted)] font-mono">
                      {row.tag || 'CORE'}
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
                        title={row.isPublished ? 'Unpublish' : 'Publish'}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                      >
                        {row.isPublished ? (
                          <CircleDot className="h-3.5 w-3.5" />
                        ) : (
                          <Globe className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpen(row.id)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id, row.title)}
                        title="Delete"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
              onClick={() => {
                const next = Math.max(1, page - 1)
                setPage(next)
                onPageChange?.(next)
              }}
              disabled={page === 1}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-white select-none">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => {
                const next = Math.min(totalPages, page + 1)
                setPage(next)
                onPageChange?.(next)
              }}
              disabled={page === totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Email Sneak Peek Modal */}
      <EmailSneakPeekModal
        isOpen={emailPreviewOpen}
        onClose={() => setEmailPreviewOpen(false)}
        subject={emailPreviewSubject}
        html={emailPreviewHtml}
        loading={emailPreviewLoading}
      />

      {confirm && <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}

interface EditorProps {
  id: string | null
  onBack: () => void
  onSaved: () => void
}

function ChangelogEditorView({ id, onBack, onSaved }: EditorProps) {
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [tag, setTag] = useState('FEATURE')
  const [customTag, setCustomTag] = useState('')
  const [description, setDescription] = useState('')
  const [improvements, setImprovements] = useState<string[]>([''])
  const [fixes, setFixes] = useState<string[]>([''])
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none')
  const [mediaUrl, setMediaUrl] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [isPublished, setIsPublished] = useState(true)

  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('')
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('')
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const handleOpenEmailPreview = async () => {
    setEmailPreviewOpen(true)
    setEmailPreviewLoading(true)
    try {
      const res = await getBroadcastEmailPreviewHtmlAction({
        type: 'changelog',
        title: title || 'Untitled Release',
        slug: slug || '',
        tag: customTag.trim() || tag || 'FEATURE',
        description: description || '',
        improvements: improvements.filter((s) => s.trim()),
        fixes: fixes.filter((s) => s.trim()),
        mediaUrl: mediaUrl.trim() || null,
        mediaType: (mediaType as any) || 'none',
      })
      if (res.success) {
        setEmailPreviewHtml(res.html)
        setEmailPreviewSubject(res.subject)
      } else {
        toast(res.error || 'Failed to generate email preview.', 'error')
      }
    } catch {
      toast('Failed to generate email preview.', 'error')
    } finally {
      setEmailPreviewLoading(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) {
      setPublishedAt(toLocalInputString(new Date().toISOString()))
      return
    }
    const loadItem = async () => {
      setLoading(true)
      const res = await getChangelogsAdmin()
      if (res.success && res.data) {
        const item = (res.data as ChangelogRow[]).find((c) => c.id === id)
        if (item) {
          setTitle(item.title)
          setSlug(item.slug)
          setTag(item.tag || 'CORE')
          setCustomTag(TAG_PRESETS.includes(item.tag) ? '' : item.tag)
          setDescription(item.description)
          setImprovements(item.improvements?.length ? item.improvements : [''])
          setFixes(item.fixes?.length ? item.fixes : [''])
          setMediaType(item.mediaType || 'none')
          setMediaUrl(item.mediaUrl || '')
          setPublishedAt(toLocalInputString(item.publishedAt))
          setIsPublished(item.isPublished)
        }
      }
      setLoading(false)
    }
    loadItem()
  }, [id])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)
    if (!id) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generated)
    }
  }

  const compressImageToWebP = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const maxDim = 1920
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(file)
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else resolve(file)
          },
          'image/webp',
          0.88
        )
      }
      img.onerror = () => resolve(file)
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()

    if (file.type.startsWith('image/')) {
      const compressed = await compressImageToWebP(file)
      formData.append('file', compressed, `${file.name.replace(/\.[^.]+$/, '')}.webp`)
    } else {
      formData.append('file', file)
    }

    try {
      const res = await fetch('/api/changelog-upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (res.ok && data.url) {
        setMediaUrl(data.url)
        setMediaType(data.mediaType || (file.type.startsWith('video/') ? 'video' : 'image'))
        toast('Media uploaded to R2.', 'success')
      } else {
        toast(data.error || 'Upload failed.', 'error')
      }
    } catch {
      toast('Upload network error.', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleClearMedia = () => {
    if (mediaUrl) {
      const urlToDelete = mediaUrl
      setMediaUrl('')
      setMediaType('none')
      deleteChangelogMediaAction(urlToDelete).catch((err) => {
        console.error('Failed to delete media from R2:', err)
      })
      toast('Media cleared and removed from R2.', 'info')
    }
  }

  const handleSave = async (publishImmediate = isPublished) => {
    const finalSlug =
      slug.trim() ||
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      `release-${Date.now()}`

    if (!title.trim() || !description.trim()) {
      toast('Title and overview description are required.', 'error')
      return
    }

    setSaving(true)
    const finalTag = customTag.trim().toUpperCase() || tag.trim().toUpperCase() || 'CORE'
    const payload: ChangelogInput = {
      title: title.trim(),
      slug: finalSlug,
      tag: finalTag,
      description: description.trim(),
      improvements: improvements.map((s) => s.trim()).filter(Boolean),
      fixes: fixes.map((s) => s.trim()).filter(Boolean),
      mediaType,
      mediaUrl: mediaUrl.trim() || null,
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
      isPublished: publishImmediate,
    }

    if (id) {
      const res = await updateChangelogAction(id, payload)
      if (res.success) {
        toast('Changelog updated.', 'success')
        onSaved()
      } else {
        toast(res.error || 'Failed to update changelog.', 'error')
      }
    } else {
      const res = await createChangelogAction(payload)
      if (res.success) {
        toast('Changelog created.', 'success')
        onSaved()
      } else {
        toast(res.error || 'Failed to create changelog.', 'error')
      }
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-[var(--color-text-muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading post…
      </div>
    )
  }

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      {/* Top action header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-white transition-colors" />
          <span>Change logs</span>
        </button>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {id && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setConfirm({
                  title: 'Delete Changelog Post',
                  message: `"${title}" will be permanently deleted. Continue?`,
                  confirmLabel: 'Delete',
                  tone: 'danger',
                  onConfirm: async () => {
                    const res = await deleteChangelogAction(id)
                    if (res.success) {
                      toast('Changelog post deleted.', 'success')
                      onSaved()
                    } else {
                      toast(res.error || 'Failed to delete post.', 'error')
                    }
                  },
                })
              }}
              className="h-9 px-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenEmailPreview}
            className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            title="Preview how the email will look"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview Email</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(false)}
            className="h-9 px-4 rounded-xl border border-white/10 bg-white/[0.03] text-white text-xs font-medium hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex items-center justify-center min-w-[95px]"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="h-9 px-4 rounded-xl bg-accent text-black text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm min-w-[95px]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Globe className="h-3.5 w-3.5" />
            )}
            <span>{id ? 'Save Changes' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {/* Form Body: On phone, a single continuous scrolling page; on desktop, 2-column layout */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pr-0 sm:pr-1 pb-16 lg:pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-full">
          {/* Main Editor Canvas (8 cols on desktop) */}
          <div className="lg:col-span-8 lg:overflow-y-auto pr-0 lg:pr-2 space-y-4">
            {/* Card 1: Title */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-white/70">
                  Release Title <span className="text-accent">*</span>
                </label>
                <span className="text-[11px] font-mono text-white/30">
                {title.length}/120
              </span>
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. High-Performance Go Backend Engine & Oracle Cloud VM Deployment"
              className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3.5 text-base font-medium text-white outline-none transition-colors focus:border-accent/50 placeholder:text-white/20"
            />
          </div>

          {/* Card 2: Overview Description */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-white/70">
                Overview &amp; Release Summary <span className="text-accent">*</span>
              </label>
              <span className="text-[11px] font-mono text-white/30">
                {description.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a comprehensive summary of what shipped, architectural context, and impacts..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3.5 text-sm text-white leading-relaxed outline-none transition-colors focus:border-accent/50 placeholder:text-white/20 resize-y"
            />
          </div>

          {/* Card 3: Release Bullet Highlights (Side-by-Side Improvements & Fixes) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div>
                <h4 className="text-xs font-mono font-medium uppercase tracking-wider text-white">
                  Release Highlights
                </h4>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Categorized bullet lists rendered in changelog and email broadcasts
                </p>
              </div>
              <span className="text-[11px] font-mono text-white/40">
                {improvements.filter((s) => s.trim()).length} improvements · {fixes.filter((s) => s.trim()).length} fixes
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Column 1: Improvements */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-xs font-semibold text-white/90">Improvements</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImprovements([...improvements, ''])}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-accent hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add bullet
                  </button>
                </div>

                <div className="space-y-2">
                  {improvements.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent/80 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...improvements]
                          next[idx] = e.target.value
                          setImprovements(next)
                        }}
                        placeholder={`Improvement #${idx + 1}`}
                        className="h-8.5 flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs text-white outline-none focus:border-accent/50 placeholder:text-white/20"
                      />
                      {improvements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setImprovements(improvements.filter((_, i) => i !== idx))}
                          className="p-1 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Fixes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-white/90">Fixes &amp; Patches</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFixes([...fixes, ''])}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add bullet
                  </button>
                </div>

                <div className="space-y-2">
                  {fixes.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shrink-0" />
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...fixes]
                          next[idx] = e.target.value
                          setFixes(next)
                        }}
                        placeholder={`Fix #${idx + 1}`}
                        className="h-8.5 flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs text-white outline-none focus:border-emerald-400/50 placeholder:text-white/20"
                      />
                      {fixes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFixes(fixes.filter((_, i) => i !== idx))}
                          className="p-1 text-white/30 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Category Tag (Moved below Release Highlights) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-white/70">
                Category Tag
              </label>
              <span className="text-[11px] font-mono text-accent font-semibold px-2 py-0.5 rounded bg-accent/10 border border-accent/25">
                {customTag.trim() || tag}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {TAG_PRESETS.map((t) => {
                const active = tag === t && !customTag
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTag(t)
                      setCustomTag('')
                    }}
                    className={cn(
                      'rounded-lg px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer',
                      active
                        ? 'border border-accent/40 bg-accent text-black font-bold shadow-sm'
                        : 'border border-[var(--color-border)] bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    {t}
                  </button>
                )
              })}
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value.toUpperCase())}
                placeholder="+ CUSTOM"
                className="h-8 w-28 rounded-lg border border-dashed border-white/20 bg-transparent px-2.5 font-mono text-xs text-white uppercase outline-none focus:border-accent placeholder:text-white/30"
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar: Media Mockup & Publication Inspector (4 cols on desktop) */}
        <div className="lg:col-span-4 lg:overflow-y-auto space-y-4">
          {/* Top Card: Release Media Mockup Frame & Direct Uploader */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">
                Media Banner Mockup
              </span>
              {mediaUrl ? (
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="text-[11px] font-mono text-red-400 hover:underline cursor-pointer"
                >
                  Clear Media
                </button>
              ) : (
                <span className="text-[10px] font-mono text-white/30">16:9 Frame</span>
              )}
            </div>

            {/* 16:9 Mockup Frame */}
            <div 
              className={cn(
                'relative aspect-video w-full rounded-lg border border-[var(--color-border)] bg-black/40 overflow-hidden flex items-center justify-center',
                mediaUrl && 'group cursor-pointer'
              )}
              onClick={() => mediaUrl && setLightboxOpen(true)}
            >
              {mediaUrl ? (
                mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={mediaUrl} controls className="w-full h-full object-cover" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl} alt="Release Preview" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 select-none">
                  <div className="h-9 w-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/25 mb-1.5">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium text-white/40">16:9 Mockup Frame</span>
                  <span className="text-[10px] font-mono text-white/20 mt-0.5">No media attached</span>
                </div>
              )}

              {/* ENLARGE badge on bottom right: only visible on hover */}
              {mediaUrl && (
                <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 border border-white/20 text-[9px] font-mono font-bold tracking-widest text-white/90 uppercase backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <Maximize2 className="w-2.5 h-2.5 text-accent" />
                  <span>ENLARGE</span>
                </div>
              )}
            </div>

            {/* Direct Upload / Change Banner Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                onChange={handleFileUpload}
                className="hidden"
                id="media-uploader-input"
              />
              <label
                htmlFor="media-uploader-input"
                className={cn(
                  'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-white/[0.02] px-3 text-xs font-medium text-white/80 transition-colors hover:border-accent hover:text-white cursor-pointer',
                  uploading && 'opacity-50 pointer-events-none'
                )}
              >
                <Upload className="h-3.5 w-3.5 text-accent" />
                <span>
                  {uploading
                    ? 'Uploading to R2…'
                    : mediaUrl
                    ? 'Change Banner (Cloudflare R2)'
                    : 'Upload Image / Video (Cloudflare R2)'}
                </span>
              </label>
            </div>
          </div>

          {/* Card 2: Publication Status & Date */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">Status</span>
              <div className="flex items-center rounded-lg border border-[var(--color-border)] p-0.5 bg-black/40">
                <button
                  type="button"
                  onClick={() => setIsPublished(false)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer',
                    !isPublished
                      ? 'bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/25'
                      : 'text-white/40 hover:text-white'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', !isPublished ? 'bg-amber-400' : 'bg-white/20')} />
                  Draft
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublished(true)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors flex items-center gap-1.5 cursor-pointer',
                    isPublished
                      ? 'bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/25'
                      : 'text-white/40 hover:text-white'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isPublished ? 'bg-emerald-400' : 'bg-white/20')} />
                  Published
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-white/50">
                Publication Timestamp
              </label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 font-mono text-xs text-white outline-none focus:border-accent/40"
              />
            </div>
          </div>

          {/* Card 4: Release Metrics */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4 sm:p-5 space-y-2.5 text-xs font-mono">
            <span className="block text-[11px] uppercase tracking-wider text-white/50 border-b border-[var(--color-border)] pb-2">
              Release Metrics
            </span>
            <div className="flex items-center justify-between py-1 border-b border-white/[0.04] text-white/60">
              <span>Est. Read Time</span>
              <span className="text-white font-medium">~1 min</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-white/[0.04] text-white/60">
              <span>Word Count</span>
              <span className="text-white font-medium">
                {description.split(/\s+/).filter(Boolean).length}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 text-white/60">
              <span>Total Bullets</span>
              <span className="text-white font-medium">
                {improvements.filter((s) => s.trim()).length + fixes.filter((s) => s.trim()).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Email Sneak Peek Modal */}
    <EmailSneakPeekModal
      isOpen={emailPreviewOpen}
      onClose={() => setEmailPreviewOpen(false)}
      subject={emailPreviewSubject}
      html={emailPreviewHtml}
      loading={emailPreviewLoading}
    />

    {/* Fullscreen Lightbox Modal */}
    {lightboxOpen && mediaUrl && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-200"
        onClick={() => setLightboxOpen(false)}
      >
        <div
          className="relative max-w-5xl w-full max-h-[92vh] flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative inline-block max-w-full max-h-[85vh]">
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 z-30 flex items-center justify-center h-8 w-8 rounded-full bg-black/60 hover:bg-black/85 border border-white/25 text-white/80 hover:text-white backdrop-blur-md transition-all cursor-pointer shadow-lg"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
              <video
                src={mediaUrl}
                controls
                autoPlay
                className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-xl border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.9)] block"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaUrl}
                alt="Enlarged Media"
                className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-xl border border-white/15 shadow-[0_25px_70px_rgba(0,0,0,0.9)] block"
              />
            )}
          </div>
        </div>
      </div>
    )}

    {confirm && <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}
