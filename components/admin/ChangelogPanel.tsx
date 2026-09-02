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
  Plus, Search, Edit3, Trash2, Globe, Eye, EyeOff, Sparkles,
  CheckCircle2, Upload, Video, Image as ImageIcon, X, ExternalLink,
  Calendar, Tag, ArrowUpRight, RefreshCw, FileText, Check, Clock,
  ChevronLeft, ChevronRight, ArrowLeft, Loader2, CircleDot, Layers
} from 'lucide-react'
import {
  getChangelogsAdmin,
  createChangelogAction,
  updateChangelogAction,
  deleteChangelogAction,
  deleteChangelogMediaAction,
  toggleChangelogPublishAction,
  type ChangelogInput
} from '@/lib/admin-changelog-actions'
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
  if (iso instanceof Date) return isNaN(iso.getTime()) ? null : iso
  let str = String(iso).trim()
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z'
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function formatLocalDateTime(iso: string | null | undefined): string {
  const d = parseDate(iso)
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
        isPublished
          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border border-amber-500/30 bg-amber-500/10 text-amber-400'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isPublished ? 'bg-emerald-400' : 'bg-amber-400')} />
      {isPublished ? 'Published' : 'Draft'}
    </span>
  )
}

export default function ChangelogPanel() {
  const [view, setView] = useState<View>({ mode: 'list' })

  if (view.mode === 'list') {
    return <ChangelogListView onOpen={(id) => setView({ mode: 'edit', id })} />
  }

  return (
    <ChangelogEditorView
      id={view.id}
      onBack={() => setView({ mode: 'list' })}
      onSaved={() => setView({ mode: 'list' })}
    />
  )
}

// ─── LIST VIEW (Matches BlogPanel Table & Pagination) ───────────────────────

function ChangelogListView({ onOpen }: { onOpen: (id: string | null) => void }) {
  const [rows, setRows] = useState<ChangelogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [tagFilter, setTagFilter] = useState('all')

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
  }, [load])

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
  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, tagFilter])
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const visibleRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

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

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-white">Changelog</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Manage product releases, improvements, and fixes for the public site.
          </p>
        </div>
        <Button size="sm" onClick={() => onOpen(null)} className="gap-1.5 self-start sm:self-auto shrink-0">
          <Plus className="h-4 w-4" /> New Changelog
        </Button>
      </div>

      <div className="mb-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2.5">
        <div className="relative w-full">
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
          className="w-full sm:w-36"
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
          className="w-full sm:w-36"
          options={[
            { value: 'all', label: 'All tags' },
            ...TAG_PRESETS.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>

      <div className="flex-grow overflow-auto rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35">
              <th className="px-3 py-2.5 font-medium">Post</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Tag</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Status</th>
              <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Published (Local)</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <TableLoadingRows cols={5} rows={6} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="mb-3 h-8 w-8 text-white/15" />
                    <p className="text-sm font-medium text-white">
                      {rows.length === 0 ? 'No changelog posts yet' : 'No posts match your filters'}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {rows.length === 0 ? 'Create your first release notes post to get started.' : 'Try a different search or filter.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-white/[0.015]"
                >
                  <td className="px-3 py-2.5 min-w-[200px]">
                    <button onClick={() => onOpen(row.id)} className="flex flex-col text-left w-full">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-white group-hover:text-accent">
                          {row.title}
                        </p>
                        <span className="inline-flex md:hidden items-center rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white/70 uppercase shrink-0">
                          {row.tag || 'FEATURE'}
                        </span>
                        {!row.isPublished && (
                          <span className="inline-flex md:hidden items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 shrink-0">
                            DRAFT
                          </span>
                        )}
                      </div>
                    </button>
                  </td>

                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-semibold text-white/70 uppercase">
                      {row.tag || 'FEATURE'}
                    </span>
                  </td>

                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <StatusBadge isPublished={row.isPublished} />
                  </td>

                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                      {formatLocalDateTime(row.publishedAt)}
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`https://www.forke.space/changelog#${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View on Changelog"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={() => togglePublish(row)}
                        title={row.isPublished ? 'Unpublish to draft' : 'Publish'}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        {row.isPublished ? (
                          <CircleDot className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                      </button>
                      <button
                        onClick={() => onOpen(row.id)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
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
              ))
            )}
          </tbody>
        </table>
      </div>

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
    if (!title.trim() || !slug.trim() || !description.trim()) {
      toast('Title, slug, and overview description are required.', 'error')
      return
    }

    setSaving(true)
    const finalTag = customTag.trim().toUpperCase() || tag.trim().toUpperCase() || 'CORE'
    const payload: ChangelogInput = {
      title: title.trim(),
      slug: slug.trim(),
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

      {/* 2-Column Split: Form (Left Half) & Live Forke Email Newsletter Template (Right Half) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Left column: Editor Form (Scrollable) */}
        <div className="overflow-y-auto pr-1 sm:pr-2 space-y-4">
          {/* Section: Title & URL */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
                Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={handleTitleChange}
                placeholder="e.g. Interactive 3D Badge & Profile Preview"
                className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3.5 text-sm font-medium text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
                Slug (URL Permalink)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-1.5 sm:py-0 gap-1 sm:gap-0">
                <span className="font-mono text-[11px] sm:text-xs text-white/30 select-none break-all sm:break-normal shrink-0">
                  https://www.forke.space/changelog/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-8 sm:h-9 flex-1 bg-transparent px-0 sm:px-1 font-mono text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Category Tag */}
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Category Tag (Pill Selector)
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
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
                      'rounded px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors',
                      active
                        ? 'border border-accent/40 bg-accent text-black font-bold'
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
                placeholder="+ CUSTOM TAG"
                className="h-6 w-24 rounded border border-dashed border-white/20 bg-transparent px-2 font-mono text-[10px] text-white uppercase outline-none focus:border-accent placeholder:text-white/30"
              />
            </div>
          </div>

          {/* Section: Overview Description */}
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Overview Description
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a concise description of what was released and why it matters..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] p-3 text-[13px] text-white leading-relaxed outline-none transition-colors focus:border-accent/40 placeholder:text-white/20 resize-y"
            />
          </div>

          {/* Section: Media Attachment (R2) */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Media Attachment (Cloudflare R2)
              </label>
              {mediaUrl && (
                <button
                  type="button"
                  onClick={handleClearMedia}
                  className="text-[11px] font-mono text-red-400 hover:underline cursor-pointer"
                >
                  Clear Media
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
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
                    'flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] bg-white/[0.02] px-3 text-xs font-medium text-white/70 transition-colors hover:border-accent hover:text-white cursor-pointer',
                    uploading && 'opacity-50 pointer-events-none'
                  )}
                >
                  <Upload className="h-3.5 w-3.5 text-accent" />
                  <span>{uploading ? 'Uploading to R2…' : 'Upload Image / Video'}</span>
                </label>
              </div>

              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="Or paste media URL directly…"
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 font-mono text-xs text-white outline-none focus:border-accent/40 placeholder:text-white/20"
              />
            </div>

            {mediaUrl && (
              <div className="pt-1">
                <div className="rounded-lg border border-[var(--color-border)] bg-black/40 p-2">
                  {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={mediaUrl} controls className="max-h-36 rounded mx-auto" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={mediaUrl} alt="" className="max-h-36 rounded object-contain mx-auto" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: Improvements */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Improvements (Bullet Points)
              </label>
              <button
                type="button"
                onClick={() => setImprovements([...improvements, ''])}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
              >
                <Plus className="h-3 w-3" /> Add bullet
              </button>
            </div>

            <div className="space-y-2">
              {improvements.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...improvements]
                      next[idx] = e.target.value
                      setImprovements(next)
                    }}
                    placeholder={`Improvement item #${idx + 1}`}
                    className="h-8 flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs text-white outline-none focus:border-accent/40 placeholder:text-white/20"
                  />
                  {improvements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setImprovements(improvements.filter((_, i) => i !== idx))}
                      className="p-1 text-white/30 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section: Fixes */}
          <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                Fixes (Bullet Points)
              </label>
              <button
                type="button"
                onClick={() => setFixes([...fixes, ''])}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add bullet
              </button>
            </div>

            <div className="space-y-2">
              {fixes.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...fixes]
                      next[idx] = e.target.value
                      setFixes(next)
                    }}
                    placeholder={`Fix item #${idx + 1}`}
                    className="h-8 flex-1 rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 text-xs text-white outline-none focus:border-emerald-400/40 placeholder:text-white/20"
                  />
                  {fixes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setFixes(fixes.filter((_, i) => i !== idx))}
                      className="p-1 text-white/30 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Exact Forke Email Newsletter Template Preview (Matching Blog Email) */}
        <div className="hidden lg:block overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[#050505] p-4 sm:p-6" style={{ backgroundImage: 'radial-gradient(circle at 50% 6%, rgba(255,122,0,0.18) 0%, rgba(5,5,5,0) 52%)' }}>
          {/* Central Email Card Container */}
          <div className="max-w-[540px] w-full mx-auto rounded-[24px] border border-[rgba(255,122,0,0.16)] bg-[#0E0E10] shadow-[0_0_80px_rgba(255,122,0,0.07)] overflow-hidden text-left">
            {/* Header Bar */}
            <div className="px-8 py-5 border-b border-white/[0.08] flex items-center justify-between">
              <span className="font-sans text-[22px] font-semibold tracking-[-0.04em] text-white select-none">
                forke<span className="text-accent">*</span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-white/40 select-none">
                prove skill by shipping
              </span>
            </div>

            {/* Default Banner (as used in Readme & Official Forke Emails) */}
            <div className="w-full border-b border-white/[0.08] overflow-hidden bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/forke-assets/email-banners/main-banner.png"
                alt="Forke Banner"
                className="w-full h-auto block"
              />
            </div>

            {/* Featured Body (Apple-Newsroom / Forke Blog Style) */}
            <div className="px-8 py-7 text-center">
              <p className="font-mono text-[10.5px] tracking-[0.2em] uppercase text-accent mb-3.5 select-none">
                From the Forke changelog &middot; {customTag.trim() || tag || 'FEATURE'}
              </p>

              <h1 className="font-sans text-[26px] font-semibold tracking-[-0.035em] leading-[1.2] text-white mb-4">
                {title.trim() || 'Interactive 3D Badge & Profile Preview'}
              </h1>

              <p className="font-sans text-[15px] leading-[1.7] text-white/70 mb-3 text-left">
                {description.trim() || 'Here is an overview of what shipped today in Forke. Explore the latest updates, architectural improvements, and fixes across our platform.'}
              </p>

              <p className="font-mono text-[11px] text-white/35 mb-5 text-center select-none">
                {formatLocalDateTime(publishedAt)} &middot; Release Note
              </p>

              {/* Attached Media (Image / Video Preview) */}
              {mediaUrl && (
                <div className="my-5">
                  {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                    <div className="relative block w-full rounded-[14px] overflow-hidden border border-white/10 bg-black aspect-video">
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover opacity-90"
                      />
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={mediaUrl}
                      alt=""
                      className="w-full max-h-72 object-cover rounded-[14px] border border-white/10"
                    />
                  )}
                </div>
              )}

              {/* Architectural Sub-Panel for Improvements & Fixes */}
              {(improvements.some((s) => s.trim()) || fixes.some((s) => s.trim())) && (
                <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4 text-left">
                  <div
                    className={`grid grid-cols-1 ${
                      improvements.some((s) => s.trim()) && fixes.some((s) => s.trim())
                        ? 'sm:grid-cols-2 gap-5'
                        : 'gap-4'
                    }`}
                  >
                    {improvements.some((s) => s.trim()) && (
                      <div className="space-y-2.5">
                        <h5 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50 select-none">
                          Improvements
                        </h5>
                        <ul className="space-y-2">
                          {improvements.filter((s) => s.trim()).map((imp, i) => (
                            <li
                              key={i}
                              className="text-[13px] text-white/75 leading-relaxed font-light flex items-start"
                            >
                              <span className="text-white/30 mr-2 font-mono text-xs select-none mt-0.5 leading-none shrink-0">
                                –
                              </span>
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {fixes.some((s) => s.trim()) && (
                      <div className="space-y-2.5">
                        <h5 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50 select-none">
                          Fixes
                        </h5>
                        <ul className="space-y-2">
                          {fixes.filter((s) => s.trim()).map((fix, i) => (
                            <li
                              key={i}
                              className="text-[13px] text-white/75 leading-relaxed font-light flex items-start"
                            >
                              <span className="text-white/30 mr-2 font-mono text-xs select-none mt-0.5 leading-none shrink-0">
                                –
                              </span>
                              <span>{fix}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Changelog Page Link Button at Bottom */}
              <div className="mt-8 pt-6 border-t border-white/[0.08] text-center">
                <a
                  href="https://www.forke.space/changelog"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-accent text-black font-mono text-[11px] font-bold tracking-wider uppercase hover:bg-accent/90 transition-all shadow-[0_0_25px_rgba(255,122,0,0.3)]"
                >
                  View all releases on forke.space &rarr;
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-6 border-t border-white/[0.08] bg-black/20">
              <span className="font-sans text-[16px] font-semibold tracking-[-0.04em] text-white">
                forke<span className="text-accent">*</span>
              </span>
              <p className="font-sans text-[12px] leading-[1.6] text-white/40 mt-1.5 mb-4">
                The micro-task marketplace for developers.<br />
                <a href="mailto:support@forke.space" className="text-white/60 hover:text-white transition-colors">
                  support@forke.space
                </a>
              </p>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-white/20 select-none">
                &copy; 2026 Forke &nbsp;&middot;&nbsp; Changelog Release
              </p>
              <p className="font-sans text-[11px] leading-[1.6] text-white/35 mt-3">
                You&apos;re receiving this because you subscribed to Forke updates.{' '}
                <span className="text-white/60 underline cursor-pointer">Unsubscribe</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {confirm && <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}
