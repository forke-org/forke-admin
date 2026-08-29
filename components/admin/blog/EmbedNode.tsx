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
 * Custom "Embed" block — paste any link and it renders stylishly based on type:
 *   • video  → YouTube / Vimeo iframe player
 *   • tweet  → X/Twitter post (loaded via the platform widget script)
 *   • iframe → generic site embedded in an iframe
 *   • card   → rich link-preview card (OG title/description/thumbnail)
 *
 * Like images, embeds are resizable (drag handle) and alignable (left/center/
 * right). Persisted attributes keep the embed type, source URL, sizing, and the
 * scraped preview metadata so saved posts re-render without re-fetching.
 */

import { Node, mergeAttributes } from '@tiptap/core'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ExternalLink,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type EmbedType = 'video' | 'tweet' | 'iframe' | 'card'

const MIN_WIDTH = 180

// ── URL classification ───────────────────────────────────────────────────────

/** Decide how a pasted URL should be embedded, plus a normalized player src. */
export function classifyEmbed(raw: string): { type: EmbedType; embedSrc: string } {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { type: 'card', embedSrc: raw }
  }
  const host = url.hostname.replace(/^www\./, '')

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.searchParams.get('v')
    if (id) return { type: 'video', embedSrc: `https://www.youtube.com/embed/${id}` }
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1)
    if (id) return { type: 'video', embedSrc: `https://www.youtube.com/embed/${id}` }
  }
  // Vimeo
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0]
    if (id && /^\d+$/.test(id))
      return { type: 'video', embedSrc: `https://player.vimeo.com/video/${id}` }
  }
  // Twitter / X
  if (host === 'twitter.com' || host === 'x.com') {
    return { type: 'tweet', embedSrc: url.toString() }
  }

  // Everything else → start as a preview card (safer than iframing arbitrary
  // sites, many of which block framing). User can switch to iframe in the toolbar.
  return { type: 'card', embedSrc: url.toString() }
}

// ── node view ────────────────────────────────────────────────────────────────

interface EmbedAttrs {
  src: string
  embedType: EmbedType
  embedSrc: string
  width: number | null
  align: 'left' | 'center' | 'right'
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

function EmbedView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as EmbedAttrs
  const { src, embedType, embedSrc, width, align } = attrs
  const containerRef = useRef<HTMLDivElement>(null)
  const [resizing, setResizing] = useState(false)
  const editable = editor.isEditable

  // Clicking anywhere on the embed selects the node so its toolbar/handles show.
  const selectNode = useCallback(() => {
    if (!editable || typeof getPos !== 'function') return
    const pos = getPos()
    if (typeof pos === 'number') {
      editor.chain().setNodeSelection(pos).run()
    }
  }, [editable, getPos, editor])

  const startResize = useCallback(
    (e: React.PointerEvent, side: 'left' | 'right') => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startWidth = containerRef.current?.offsetWidth ?? 0
      const max =
        containerRef.current?.parentElement?.parentElement?.offsetWidth ?? Infinity
      setResizing(true)
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        // Left handle grows when dragged outward (leftward), so flip the sign.
        const next = side === 'right' ? startWidth + delta : startWidth - delta
        updateAttributes({ width: Math.round(Math.max(MIN_WIDTH, Math.min(next, max))) })
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [updateAttributes]
  )

  // Hostname helper that never throws on a malformed/partial URL.
  const safeHost = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '')
    } catch {
      return u
    }
  }

  // Load the X/Twitter widget script once when a tweet embed is present.
  useEffect(() => {
    if (embedType !== 'tweet') return
    const w = window as unknown as { twttr?: { widgets: { load: (el?: HTMLElement) => void } } }
    const run = () => w.twttr?.widgets.load(containerRef.current ?? undefined)
    if (w.twttr) {
      run()
    } else if (!document.getElementById('twitter-wjs')) {
      const s = document.createElement('script')
      s.id = 'twitter-wjs'
      s.src = 'https://platform.twitter.com/widgets.js'
      s.async = true
      s.onload = run
      document.body.appendChild(s)
    } else {
      const t = setTimeout(run, 800)
      return () => clearTimeout(t)
    }
  }, [embedType, embedSrc])

  const alignClass = align === 'left' ? 'mr-auto' : align === 'right' ? 'ml-auto' : 'mx-auto'

  return (
    <NodeViewWrapper
      className={cn('my-5 flex w-full', resizing && 'select-none')}
      data-align={align || 'center'}
    >
      <div
        ref={containerRef}
        className={cn(
          'group relative inline-block max-w-full',
          alignClass,
          selected && editable && 'outline outline-2 outline-accent rounded-lg'
        )}
        style={{ width: width ? `${width}px` : '100%' }}
      >
        {/* In the editor, embeds are completely inert: this layer swallows all
            clicks/scroll so iframes don't capture focus and links don't open —
            you interact with the block (select/resize/align) instead. */}
        <div className={cn(editable && 'pointer-events-none')}>
        {/* ── renderers per type ── */}
        {embedType === 'video' && (
          <div className="relative w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-black" style={{ aspectRatio: '16 / 9' }}>
            <iframe
              src={embedSrc}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Embedded video"
            />
          </div>
        )}

        {embedType === 'iframe' && (
          <div className="relative w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#0e0e12]" style={{ aspectRatio: '16 / 10' }}>
            <iframe
              src={embedSrc}
              className="absolute inset-0 h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title="Embedded page"
            />
          </div>
        )}

        {embedType === 'tweet' && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#0e0e12] p-2">
            <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
              <a href={embedSrc}>{embedSrc}</a>
            </blockquote>
          </div>
        )}

        {embedType === 'card' && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => editable && e.preventDefault()}
            className="flex overflow-hidden rounded-xl border border-[var(--color-border)] bg-white/[0.018] transition-colors hover:border-white/20"
          >
            {attrs.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attrs.image} alt="" className="h-auto w-40 shrink-0 object-cover" />
            )}
            <div className="min-w-0 flex-grow p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                {attrs.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attrs.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
                <span className="truncate">{attrs.siteName || safeHost(src)}</span>
              </div>
              <p className="line-clamp-2 text-sm font-medium text-white">
                {attrs.title || src}
              </p>
              {attrs.description && (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                  {attrs.description}
                </p>
              )}
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent">
                <ExternalLink className="h-3 w-3" /> {safeHost(src)}
              </span>
            </div>
          </a>
        )}
        </div>

        {/* ── editing controls ── */}
        {editable && (
          <>
            {/* Transparent click-catcher: selects the node (showing its toolbar/
                handles) without letting the click reach the inert content. */}
            <div
              className="absolute inset-0 z-[1] cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault()
                selectNode()
              }}
            />
            {/* Resize handles (both edges) */}
            <span
              onPointerDown={(e) => startResize(e, 'left')}
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-12 w-1.5 rounded-full bg-accent cursor-ew-resize z-10',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                selected && 'opacity-100'
              )}
            />
            <span
              onPointerDown={(e) => startResize(e, 'right')}
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-12 w-1.5 rounded-full bg-accent cursor-ew-resize z-10',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                selected && 'opacity-100'
              )}
            />

            {/* Toolbar: alignment + iframe/card toggle for generic links */}
            {selected && (
              <div className="absolute -top-10 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[#0b0b0e] p-1 shadow-xl shadow-black/40">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(
                  ([value, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        updateAttributes({ align: value })
                      }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                        (align || 'center') === value
                          ? 'bg-accent/15 text-accent'
                          : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white'
                      )}
                      title={`Align ${value}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
                {(embedType === 'card' || embedType === 'iframe') && (
                  <>
                    <span className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        updateAttributes({
                          embedType: embedType === 'card' ? 'iframe' : 'card',
                        })
                      }}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                      title="Toggle between preview card and full embed"
                    >
                      {embedType === 'card' ? 'Embed' : 'Card'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ── extension ────────────────────────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attrs: Partial<EmbedAttrs> & { src: string }) => ReturnType
    }
  }
}

export const EmbedExtension = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    // Every attribute round-trips through a data-* attribute so the node
    // survives both JSON and HTML serialization (and re-parsing on reload).
    const dataAttr = (name: string, fallback: unknown = null) => ({
      default: fallback,
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
      renderHTML: (attrs: Record<string, unknown>) =>
        attrs[name] != null ? { [`data-${name}`]: String(attrs[name]) } : {},
    })
    return {
      src: dataAttr('src', ''),
      embedType: dataAttr('embed-type', 'card'),
      embedSrc: dataAttr('embed-src', ''),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('data-width')
          return w ? parseInt(w, 10) || null : null
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width != null ? { 'data-width': String(attrs.width) } : {},
      },
      align: dataAttr('align', 'center'),
      title: dataAttr('title'),
      description: dataAttr('description'),
      image: dataAttr('image'),
      siteName: dataAttr('site-name'),
      favicon: dataAttr('favicon'),
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    // Serialize to real, self-contained markup so the static public reader
    // (which injects contentHtml) shows the embed without re-hydration.
    // The data-* attributes are also kept so a richer client renderer could
    // upgrade these later if desired.
    const a = node.attrs as EmbedAttrs
    const alignStyle =
      a.align === 'left'
        ? 'margin-right:auto'
        : a.align === 'right'
          ? 'margin-left:auto'
          : 'margin-left:auto;margin-right:auto'
    const widthStyle = a.width ? `width:${a.width}px` : 'width:100%'
    // HTMLAttributes already carries every data-* attr from addAttributes().
    const wrapAttrs = mergeAttributes(HTMLAttributes, {
      'data-embed': '',
      class: 'blog-embed',
      style: `${widthStyle};${alignStyle};max-width:100%`,
    })

    if (a.embedType === 'video') {
      return [
        'div',
        wrapAttrs,
        [
          'div',
          { class: 'blog-embed-frame' },
          [
            'iframe',
            {
              src: a.embedSrc,
              allowfullscreen: 'true',
              allow:
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
              loading: 'lazy',
            },
          ],
        ],
      ]
    }

    if (a.embedType === 'iframe') {
      return [
        'div',
        wrapAttrs,
        ['div', { class: 'blog-embed-frame' }, ['iframe', { src: a.embedSrc, loading: 'lazy' }]],
      ]
    }

    // tweet + card both degrade to a clickable preview/link card.
    return [
      'div',
      wrapAttrs,
      [
        'a',
        { href: a.src, target: '_blank', rel: 'noopener noreferrer', class: 'blog-embed-card' },
        ...(a.image ? [['img', { src: a.image, alt: '' }] as const] : []),
        [
          'span',
          { class: 'blog-embed-card-body' },
          ['span', { class: 'blog-embed-card-site' }, a.siteName || a.src],
          ['span', { class: 'blog-embed-card-title' }, a.title || a.src],
          ...(a.description
            ? [['span', { class: 'blog-embed-card-desc' }, a.description] as const]
            : []),
        ],
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView)
  },

  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})
