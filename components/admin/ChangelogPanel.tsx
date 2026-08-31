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

const TAG_PRESETS = ['CORE', 'DEVELOPER', 'PLATFORM', 'PROFILE', 'AI', 'INFRA', 'WEB', 'PLUGINS']
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
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-white">Changelog</h2>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Manage product releases, improvements, and fixes for the public site.
          </p>
        </div>
        <Button size="sm" onClick={() => onOpen(null)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Changelog
        </Button>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-grow sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changelogs…"
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

        <Select
          aria-label="Filter by tag"
          value={tagFilter}
          onChange={(v) => setTagFilter(v)}
          size="sm"
          className="w-36"
          options={[
            { value: 'all', label: 'All tags' },
            ...TAG_PRESETS.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>

      {/* Table */}
      <div className="flex-grow overflow-auto rounded-xl border border-[var(--color-border)] bg-white/[0.018]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-white/35">
              <th className="px-3 py-2.5 font-medium">Post</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Tag</th>
              <th className="hidden px-2 py-2.5 font-medium md:table-cell">Status</th>
              <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Media</th>
              <th className="hidden px-2 py-2.5 font-medium sm:table-cell">Published (Local)</th>
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
                  {/* Post Title & Excerpt */}
                  <td className="px-3 py-2.5">
                    <button onClick={() => onOpen(row.id)} className="flex items-center gap-3 text-left">
                      <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-white/[0.02]">
                        {row.mediaType === 'image' && row.mediaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.mediaUrl} alt="" className="h-full w-full object-cover" />
                        ) : row.mediaType === 'video' ? (
                          <div className="flex h-full w-full items-center justify-center text-accent">
                            <Video className="h-3.5 w-3.5" />
                          </div>
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
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--color-text-muted)] truncate max-w-sm">
                          {row.slug}
                        </span>
                      </div>
                    </button>
                  </td>

                  {/* Tag */}
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <span className="inline-flex items-center rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-semibold text-white/70 uppercase">
                      {row.tag || 'CORE'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="hidden px-2 py-2.5 md:table-cell">
                    <StatusBadge isPublished={row.isPublished} />
                  </td>

                  {/* Media Type */}
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                      {row.mediaType !== 'none' ? row.mediaType : 'none'}
                    </span>
                  </td>

                  {/* Published Local Date */}
                  <td className="hidden px-2 py-2.5 sm:table-cell">
                    <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                      {formatLocalDateTime(row.publishedAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`https://www.forke.space/changelog/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="View Live"
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

      {/* Pagination */}
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

      {confirm && <ConfirmModal options={confirm} onClose={() => setConfirm(null)} />}
    </div>
  )
}

// ─── EDITOR VIEW (Clean 2-Column Inline Form with Zero Emojis) ───────────────

interface EditorProps {
  id: string | null
  onBack: () => void
  onSaved: () => void
}

function ChangelogEditorView({ id, onBack, onSaved }: EditorProps) {
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [tag, setTag] = useState('CORE')
  const [customTag, setCustomTag] = useState('')
  const [description, setDescription] = useState('')
  const [improvements, setImprovements] = useState<string[]>([''])
  const [fixes, setFixes] = useState<string[]>([''])
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'video'>('none')
  const [mediaUrl, setMediaUrl] = useState('')
  const [publishedAt, setPublishedAt] = useState('')
  const [isPublished, setIsPublished] = useState(true)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing post if editing
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

  // Client-side image compression to WebP
  const compressImageToWebP = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
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
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Changelogs
          </Button>
          <span className="text-sm font-medium text-white">
            {id ? 'Edit Changelog Post' : 'New Changelog Post'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => handleSave(true)}
            className="gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {id ? 'Save Changes' : 'Publish Post'}
          </Button>
        </div>
      </div>

      {/* Editor Content Form */}
      <div className="flex-grow overflow-y-auto pr-1">
        <div className="max-w-4xl space-y-6">
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
              <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3">
                <span className="font-mono text-xs text-white/30 select-none">
                  https://www.forke.space/changelog/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="h-9 flex-1 bg-transparent px-1 font-mono text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Tag & Published Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tag selector */}
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
                  placeholder="+ Custom Tag"
                  className="h-6 w-24 rounded border border-dashed border-white/20 bg-transparent px-2 font-mono text-[10px] text-white uppercase outline-none focus:border-accent placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Published Date (Local Time) */}
            <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
              <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                Published Date & Time (Local Timezone)
              </label>
              <input
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 font-mono text-xs text-white outline-none focus:border-accent/40"
              />
            </div>
          </div>

          {/* Section: Overview Description */}
          <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)]">
              Overview Description
            </label>
            <textarea
              rows={4}
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
                  onClick={() => {
                    setMediaUrl('')
                    setMediaType('none')
                  }}
                  className="text-[11px] font-mono text-red-400 hover:underline"
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
              <div className="pt-2">
                <div className="rounded-lg border border-[var(--color-border)] bg-black/40 p-2">
                  {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                    <video src={mediaUrl} controls className="max-h-48 rounded mx-auto" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={mediaUrl} alt="" className="max-h-48 rounded object-contain mx-auto" />
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

          {/* Section: Status Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-white/[0.015] p-4">
            <div>
              <p className="text-xs font-medium text-white">Publish Status</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {isPublished ? 'Post is visible on the public changelog.' : 'Post is saved as an unpublished draft.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                isPublished
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              )}
            >
              {isPublished ? <Globe className="h-3.5 w-3.5" /> : <CircleDot className="h-3.5 w-3.5" />}
              {isPublished ? 'Published' : 'Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
