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
 * Free, hand-rolled replacement for Tiptap's paid Pro image extension.
 *
 * Extends the base @tiptap/extension-image with two persisted attributes —
 * `width` (px, rendered as a style) and `align` (left | center | right) — and
 * a React NodeView that provides drag-to-resize handles plus an alignment
 * toolbar on selection. No Pro license required; the produced HTML is a plain
 * <img> with inline styles so it renders identically on the public reader.
 */

import Image from '@tiptap/extension-image'
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react'
import { useRef, useState, useCallback } from 'react'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const MIN_WIDTH = 80

function ImageNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string
    alt?: string
    width?: number | null
    align?: 'left' | 'center' | 'right'
  }
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizing, setResizing] = useState(false)
  const editable = editor.isEditable

  // Pointer-driven resize from either side handle.
  const startResize = useCallback(
    (e: React.PointerEvent, side: 'left' | 'right') => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startWidth = imgRef.current?.offsetWidth ?? 0
      const containerWidth =
        imgRef.current?.parentElement?.parentElement?.offsetWidth ?? Infinity
      setResizing(true)

      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        // Dragging the left handle inward shrinks; mirror the sign per side.
        const next = side === 'right' ? startWidth + delta : startWidth - delta
        const clamped = Math.max(MIN_WIDTH, Math.min(next, containerWidth))
        updateAttributes({ width: Math.round(clamped) })
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

  const alignClass =
    align === 'left'
      ? 'mr-auto'
      : align === 'right'
        ? 'ml-auto'
        : 'mx-auto'

  return (
    <NodeViewWrapper
      className={cn('my-4 flex w-full', resizing && 'select-none')}
      data-align={align || 'center'}
    >
      <div
        className={cn(
          'group relative inline-block max-w-full',
          alignClass,
          selected && editable && 'outline outline-2 outline-accent rounded-sm'
        )}
        style={{ width: width ? `${width}px` : 'auto' }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          draggable={false}
          className="block w-full h-auto rounded-md"
        />

        {editable && (
          <>
            {/* Resize handles (visible on hover/selection) */}
            <span
              onPointerDown={(e) => startResize(e, 'left')}
              className={cn(
                'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-1.5 rounded-full bg-accent cursor-ew-resize',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                selected && 'opacity-100'
              )}
            />
            <span
              onPointerDown={(e) => startResize(e, 'right')}
              className={cn(
                'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-10 w-1.5 rounded-full bg-accent cursor-ew-resize',
                'opacity-0 group-hover:opacity-100 transition-opacity',
                selected && 'opacity-100'
              )}
            />

            {/* Alignment toolbar (only while this image is selected) */}
            {selected && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[#0b0b0e] p-1 shadow-xl shadow-black/40">
                {(
                  [
                    ['left', AlignLeft],
                    ['center', AlignCenter],
                    ['right', AlignRight],
                  ] as const
                ).map(([value, Icon]) => (
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).style.width || el.getAttribute('width')
          return w ? parseInt(w, 10) || null : null
        },
        renderHTML: (attrs) =>
          attrs.width ? { style: `width: ${attrs.width}px` } : {},
      },
      align: {
        default: 'center',
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align || 'center' }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
