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
 * Medium-style blog editor.
 *
 * Layout mirrors Medium's writing surface: a wide cover-image strip, a large
 * serif title field, then a centered prose column. Formatting happens through a
 * floating bubble menu on text selection and a "/" slash command for blocks —
 * no persistent top toolbar, matching Medium's minimal feel.
 *
 * Content is held as Tiptap JSON; on save we also serialize HTML so the future
 * public reader can render without re-parsing JSON. Image uploads are stubbed
 * (paste-URL only) until R2 is connected — see uploadImage.ts.
 */

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link2,
  Heading1,
  Heading2,
  Quote,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  X,
} from 'lucide-react'
import { ResizableImage } from './ResizableImage'
import { EmbedExtension, classifyEmbed } from './EmbedNode'
import { createSlashCommand } from './SlashCommand'
import { uploadImage } from './uploadImage'
import ImageCropper from './ImageCropper'
import { getLinkPreview } from '@/lib/embed-actions'
import { toast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils/cn'
import { instrumentSerif } from '@/app/fonts'

export interface BlogEditorValue {
  title: string
  authorName: string
  coverImage: string | null
  content: unknown
  contentHtml: string
}

interface BlogEditorProps {
  initialTitle?: string
  initialAuthorName?: string
  initialCoverImage?: string | null
  initialContent?: unknown
  /** Called (debounced by parent if desired) whenever content changes. */
  onChange?: (value: BlogEditorValue) => void
  onImageUpload?: (url: string) => void
}

export interface BlogEditorHandle {
  getValue: () => BlogEditorValue
}

export default function BlogEditor({
  initialTitle = '',
  initialAuthorName = '',
  initialCoverImage = null,
  initialContent,
  onChange,
  onImageUpload,
}: BlogEditorProps) {
  const [title, setTitle] = useState(initialTitle)
  const [authorName, setAuthorName] = useState(initialAuthorName)
  const [coverImage, setCoverImage] = useState<string | null>(initialCoverImage)

  // Embed-insert prompt (paste a video / tweet / any link).
  const [embedPromptOpen, setEmbedPromptOpen] = useState(false)
  const [embedUrl, setEmbedUrl] = useState('')

  // Cover prompt lets the user choose between uploading or pasting a link.
  const [coverPromptOpen, setCoverPromptOpen] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')

  // Body-image prompt — same upload-or-link choice as the cover chooser.
  const [imagePromptOpen, setImagePromptOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState('')

  // Hidden file inputs drive image uploads; picked files open the cropper first.
  const bodyFileRef = useRef<HTMLInputElement>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const gifFileRef = useRef<HTMLInputElement>(null)

  // Crop target: which slot the cropped/uploaded image should fill.
  const [cropFile, setCropFile] = useState<{ file: File; target: 'body' | 'cover' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isGif, setIsGif] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Open the chooser (upload or paste a link) rather than jumping straight to
  // the file dialog — mirrors how the cover image is added.
  const openImagePicker = useCallback(() => {
    setImageUrl('')
    setImagePromptOpen(true)
  }, [])

  const openEmbedPrompt = useCallback(() => {
    setEmbedUrl('')
    setEmbedPromptOpen(true)
  }, [])

  // GIFs skip the chooser/cropper entirely (cropping would flatten the
  // animation) — go straight to the GIF-only file dialog, then upload as-is.
  const openGifPicker = useCallback(() => {
    gifFileRef.current?.click()
  }, [])

  const editor = useEditor({
    immediatelyRender: false, // SSR-safe (Next.js)
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'blog-code-block' } },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'blog-link', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? 'Heading'
            : "Tell your story… (type '/' for blocks)",
        showOnlyWhenEditable: true,
      }),
      // allowBase64 lets uploaded images persist inside the content JSON until
      // R2 is connected — this fixes images vanishing on save/publish.
      ResizableImage.configure({ inline: false, allowBase64: true }),
      EmbedExtension,
      createSlashCommand(openImagePicker, openEmbedPrompt, openGifPicker),
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'blog-prose focus:outline-none',
        spellcheck: 'true',
      },
    },
  })

  // Bubble: track link href so the link prompt prefills the current value.
  const [linkPromptOpen, setLinkPromptOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')

  const emitChange = useCallback(
    (nextTitle = title, nextCover = coverImage, nextAuthor = authorName) => {
      if (!editor || !onChange) return
      onChange({
        title: nextTitle,
        authorName: nextAuthor,
        coverImage: nextCover,
        content: editor.getJSON(),
        contentHtml: editor.getHTML(),
      })
    },
    [editor, onChange, title, coverImage, authorName]
  )

  useEffect(() => {
    if (!editor) return
    const handler = () => emitChange()
    editor.on('update', handler)
    return () => {
      editor.off('update', handler)
    }
  }, [editor, emitChange])

  // A picked file opens the cropper first (every upload is croppable) — except
  // GIFs, which the cropper would flatten to a single static frame (canvas crop
  // strips animation). GIFs upload verbatim so they keep looping.
  const handleImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'body' | 'cover'
  ) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', 'error')
      return
    }
    if (file.type === 'image/gif') {
      // Skip the cropper so the animation survives — upload + place as-is.
      void uploadAndPlace(file, target, file.name)
      return
    }
    setCropFile({ file, target })
  }

  // Dedicated GIF input (from the "/" GIF block). Always body, never cropped,
  // so the animation/loop is preserved.
  const handleGifFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    if (file.type !== 'image/gif') {
      toast('Please choose a GIF file.', 'error')
      return
    }
    void uploadAndPlace(file, 'body', file.name)
  }

  // Upload a blob, then insert into the body / set as cover. Shared by the
  // cropper (still-image path) and the GIF path (bypasses the cropper).
  // The post stores the returned URL (not the bytes), so autosave stays small.
  const uploadAndPlace = async (
    blob: Blob,
    target: 'body' | 'cover',
    filename: string
  ) => {
    if (!editor) return
    const isGifFile = blob.type === 'image/gif' || filename.toLowerCase().endsWith('.gif')
    setIsGif(isGifFile)
    setUploading(true)
    setUploadProgress(0)
    try {
      const { url } = await uploadImage(blob, filename, (percent) => {
        setUploadProgress(percent)
      })
      if (onImageUpload) {
        onImageUpload(url)
      }
      if (target === 'body') {
        editor.chain().focus().setImage({ src: url }).run()
      } else {
        setCoverImage(url)
        emitChange(title, url)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add image.', 'error')
    } finally {
      setUploading(false)
      setIsGif(false)
      setUploadProgress(0)
    }
  }

  // Cropper confirmed → upload the chosen blob, then insert / set as cover.
  const handleCropConfirm = (blob: Blob, filename: string) => {
    const target = cropFile?.target ?? 'body'
    setCropFile(null)
    void uploadAndPlace(blob, target, filename)
  }

  // Insert a pasted image link into the body, then close the chooser.
  const insertImageLink = () => {
    const url = imageUrl.trim()
    setImagePromptOpen(false)
    if (!url || !editor) return
    if (onImageUpload) onImageUpload(url)
    editor.chain().focus().setImage({ src: url }).run()
  }

  const insertEmbed = async () => {
    const raw = embedUrl.trim()
    setEmbedPromptOpen(false)
    if (!raw || !editor) return
    const { type, embedSrc } = classifyEmbed(raw)
    // For preview cards, fetch OG metadata so the card looks rich.
    let meta = {}
    if (type === 'card') {
      try {
        const p = await getLinkPreview(raw)
        meta = {
          title: p.title,
          description: p.description,
          image: p.image,
          siteName: p.siteName,
          favicon: p.favicon,
        }
      } catch {
        /* fall back to a bare card */
      }
    }
    editor
      .chain()
      .focus()
      .setEmbed({ src: raw, embedType: type, embedSrc, ...meta })
      .run()
  }

  const applyLink = () => {
    if (!editor) return
    const raw = linkValue.trim()
    if (raw) {
      // Normalize so bare domains (forke.space) become absolute links rather
      // than being treated as a same-site relative path.
      const href = /^(https?:\/\/|mailto:|tel:|\/)/i.test(raw) ? raw : `https://${raw}`
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkPromptOpen(false)
    setLinkValue('')
  }

  const titleRef = useRef<HTMLTextAreaElement>(null)
  // Auto-grow the title textarea.
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  if (!editor) return null

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* ── Cover image (shown at its original size, not force-cropped) ── */}
      {coverImage ? (
        <div className="group relative mb-8 overflow-hidden rounded-xl border border-[var(--color-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImage} alt="Cover" className="block h-auto w-full" />
          <button
            type="button"
            onClick={() => {
              setCoverImage(null)
              emitChange(title, null)
            }}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 group-hover:opacity-100"
            title="Remove cover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCoverUrl('')
            setCoverPromptOpen(true)
          }}
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-white/20 hover:text-white"
        >
          <ImagePlus className="h-4 w-4" />
          Add cover image
        </button>
      )}

      {/* Hidden file inputs — drive image uploads (upload only, no URL). */}
      <input
        ref={bodyFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile(e, 'body')}
      />
      <input
        ref={coverFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleImageFile(e, 'cover')}
      />
      <input
        ref={gifFileRef}
        type="file"
        accept="image/gif"
        className="hidden"
        onChange={handleGifFile}
      />

      {/* ── Title ─────────────────────────────────────────────────── */}
      <textarea
        ref={titleRef}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          emitChange(e.target.value)
        }}
        onKeyDown={(e) => {
          // Enter from the title drops focus into the body.
          if (e.key === 'Enter') {
            e.preventDefault()
            editor.commands.focus('start')
          }
        }}
        rows={1}
        placeholder="Title"
        className={cn(
          instrumentSerif.className,
          'mb-4 w-full resize-none overflow-hidden bg-transparent text-4xl leading-tight text-white outline-none placeholder:text-white/25 sm:text-5xl'
        )}
      />

      {/* ── Author byline ─────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span className="shrink-0">By</span>
        <input
          value={authorName}
          onChange={(e) => {
            setAuthorName(e.target.value)
            emitChange(title, coverImage, e.target.value)
          }}
          placeholder="The Forke Team"
          className="w-full max-w-xs bg-transparent text-white outline-none placeholder:text-white/25"
        />
      </div>

      {/* ── Bubble menu (inline formatting on selection) ──────────── */}
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top', offset: 8 }}
        shouldShow={({ editor: ed, from, to }) =>
          from !== to && !ed.isActive('image') && !ed.isActive('embed')
        }
        className="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[#0b0b0e] p-1 shadow-2xl shadow-black/50"
      >
        {linkPromptOpen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              applyLink()
            }}
            className="flex items-center gap-1 px-1"
          >
            <input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="Paste a link…"
              className="w-48 bg-transparent px-2 py-1 text-[13px] text-white outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10"
            >
              Apply
            </button>
          </form>
        ) : (
          <>
            <BubbleBtn
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              icon={<Bold className="h-4 w-4" />}
              label="Bold"
            />
            <BubbleBtn
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              icon={<Italic className="h-4 w-4" />}
              label="Italic"
            />
            <BubbleBtn
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              icon={<UnderlineIcon className="h-4 w-4" />}
              label="Underline"
            />
            <BubbleBtn
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              icon={<Strikethrough className="h-4 w-4" />}
              label="Strikethrough"
            />
            <BubbleBtn
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
              icon={<Code className="h-4 w-4" />}
              label="Code"
            />
            <Divider />
            <BubbleBtn
              active={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              icon={<Heading1 className="h-4 w-4" />}
              label="Heading 1"
            />
            <BubbleBtn
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              icon={<Heading2 className="h-4 w-4" />}
              label="Heading 2"
            />
            <BubbleBtn
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              icon={<Quote className="h-4 w-4" />}
              label="Quote"
            />
            <Divider />
            <BubbleBtn
              active={editor.isActive('link')}
              onClick={() => {
                setLinkValue(editor.getAttributes('link').href || '')
                setLinkPromptOpen(true)
              }}
              icon={<Link2 className="h-4 w-4" />}
              label="Link"
            />
            <Divider />
            <BubbleBtn
              active={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              icon={<AlignLeft className="h-4 w-4" />}
              label="Align left"
            />
            <BubbleBtn
              active={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              icon={<AlignCenter className="h-4 w-4" />}
              label="Align center"
            />
            <BubbleBtn
              active={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              icon={<AlignRight className="h-4 w-4" />}
              label="Align right"
            />
          </>
        )}
      </BubbleMenu>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <EditorContent editor={editor} />

      {/* ── Embed URL prompt ──────────────────────────────────────── */}
      {embedPromptOpen && (
        <UrlPrompt
          label="Embed a link"
          hint="Paste a YouTube/Vimeo video, a tweet, or any website link."
          placeholder="https://…"
          value={embedUrl}
          onChange={setEmbedUrl}
          onCancel={() => setEmbedPromptOpen(false)}
          onSubmit={insertEmbed}
        />
      )}

      {/* ── Cover chooser: upload (croppable) OR paste a link ───────── */}
      {coverPromptOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setCoverPromptOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-5 shadow-2xl shadow-black/60"
          >
            <h3 className="mb-1 text-sm font-medium text-white">Add cover image</h3>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">
              Upload an image (you can crop it) or paste an image link.
            </p>
            <button
              type="button"
              onClick={() => {
                setCoverPromptOpen(false)
                coverFileRef.current?.click()
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <ImagePlus className="h-4 w-4" /> Upload from device
            </button>
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
              <span className="h-px flex-grow bg-[var(--color-border)]" /> or paste a link{' '}
              <span className="h-px flex-grow bg-[var(--color-border)]" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const url = coverUrl.trim()
                if (url) {
                  setCoverImage(url)
                  emitChange(title, url)
                }
                setCoverPromptOpen(false)
              }}
            >
              <input
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://…/cover.jpg"
                className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/25"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCoverPromptOpen(false)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.05]"
                >
                  Use link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Body image chooser: upload (croppable) OR paste a link ──── */}
      {imagePromptOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setImagePromptOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-5 shadow-2xl shadow-black/60"
          >
            <h3 className="mb-1 text-sm font-medium text-white">Add image</h3>
            <p className="mb-4 text-xs text-[var(--color-text-muted)]">
              Upload an image (you can crop it) or paste an image link.
            </p>
            <button
              type="button"
              onClick={() => {
                setImagePromptOpen(false)
                bodyFileRef.current?.click()
              }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <ImagePlus className="h-4 w-4" /> Upload from device
            </button>
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
              <span className="h-px flex-grow bg-[var(--color-border)]" /> or paste a link{' '}
              <span className="h-px flex-grow bg-[var(--color-border)]" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                insertImageLink()
              }}
            >
              <input
                autoFocus
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/image.jpg"
                className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/25"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImagePromptOpen(false)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/[0.05]"
                >
                  Use link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image cropper (every uploaded image passes through here) ── */}
      {cropFile && (
        <ImageCropper
          file={cropFile.file}
          defaultAspect={cropFile.target === 'cover' ? '16:9' : 'free'}
          onCancel={() => setCropFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      {/* Full-screen uploading veil with progress bar */}
      {uploading && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-72 rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-5 shadow-2xl shadow-black/60">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-white">
                {isGif ? 'Uploading GIF…' : 'Uploading image…'}
              </span>
              <span className="font-mono text-[11px] text-accent">{uploadProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── small building blocks ─────────────────────────────────────────────────

function BubbleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {icon}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />
}

/** Centered modal for entering a URL (embed). */
function UrlPrompt({
  label,
  hint,
  placeholder,
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  label: string
  hint?: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-5 shadow-2xl shadow-black/60"
      >
        <h3 className="mb-1 text-sm font-medium text-white">{label}</h3>
        {hint && (
          <p className="mb-4 text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white/[0.02] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-accent/40 placeholder:text-white/25"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Insert
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
