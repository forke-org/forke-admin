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
 * Notion/Medium-style "/" slash command menu.
 *
 * Typing "/" on an empty line opens a filterable list of block actions
 * (headings, lists, quote, divider, image). Built on @tiptap/suggestion with a
 * lightweight React popup rendered via Tiptap's ReactRenderer.
 */

import { Extension } from '@tiptap/core'
import Suggestion, {
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from '@tiptap/suggestion'
import { ReactRenderer, type Editor } from '@tiptap/react'
import type { Range } from '@tiptap/core'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code2,
  ImageIcon,
  FileImage,
  Type,
  Code,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SlashItem {
  title: string
  description: string
  icon: ReactNode
  /** Match against typed query. */
  keywords: string[]
  command: (props: { editor: Editor; range: Range }) => void
}

const ICON = 'h-4 w-4'

function buildItems(onImage: () => void, onEmbed: () => void, onGif: () => void): SlashItem[] {
  return [
    {
      title: 'Text',
      description: 'Plain paragraph',
      icon: <Type className={ICON} />,
      keywords: ['text', 'paragraph', 'p'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      title: 'Heading 1',
      description: 'Large section title',
      icon: <Heading1 className={ICON} />,
      keywords: ['h1', 'title', 'heading'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      description: 'Medium section title',
      icon: <Heading2 className={ICON} />,
      keywords: ['h2', 'subtitle', 'heading'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      description: 'Small section title',
      icon: <Heading3 className={ICON} />,
      keywords: ['h3', 'heading'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: <List className={ICON} />,
      keywords: ['bullet', 'list', 'ul', 'unordered'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: 'Numbered List',
      description: 'Ordered list',
      icon: <ListOrdered className={ICON} />,
      keywords: ['number', 'ordered', 'list', 'ol'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: 'Quote',
      description: 'Blockquote',
      icon: <Quote className={ICON} />,
      keywords: ['quote', 'blockquote', 'citation'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: 'Code Block',
      description: 'Monospaced code',
      icon: <Code2 className={ICON} />,
      keywords: ['code', 'snippet', 'pre'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: 'Divider',
      description: 'Horizontal rule',
      icon: <Minus className={ICON} />,
      keywords: ['divider', 'hr', 'rule', 'separator'],
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: 'Image',
      description: 'Upload from your device',
      icon: <ImageIcon className={ICON} />,
      keywords: ['image', 'picture', 'photo', 'img', 'upload'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        onImage()
      },
    },
    {
      title: 'GIF',
      description: 'Animated, plays on loop',
      icon: <FileImage className={ICON} />,
      keywords: ['gif', 'animated', 'animation', 'meme', 'loop'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        onGif()
      },
    },
    {
      title: 'Embed',
      description: 'Video, tweet, or any link',
      icon: <Code className={ICON} />,
      keywords: ['embed', 'video', 'youtube', 'vimeo', 'tweet', 'link', 'iframe', 'website'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run()
        onEmbed()
      },
    },
  ]
}

// ── popup component ─────────────────────────────────────────────────────────

interface ListProps {
  items: SlashItem[]
  command: (item: SlashItem) => void
}

const SlashList = forwardRef<{ onKeyDown: (p: { event: KeyboardEvent }) => boolean }, ListProps>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0)
    // Mirror selected into a ref so the imperative onKeyDown always reads the
    // current index (the handle's closure would otherwise capture a stale one).
    const selectedRef = useRef(0)
    selectedRef.current = selected

    useEffect(() => setSelected(0), [items])

    // Rebuild the handle whenever items change so length math stays correct.
    useImperativeHandle(
      ref,
      () => ({
        onKeyDown: ({ event }) => {
          if (items.length === 0) return false
          if (event.key === 'ArrowUp') {
            setSelected((s) => (s + items.length - 1) % items.length)
            return true
          }
          if (event.key === 'ArrowDown') {
            setSelected((s) => (s + 1) % items.length)
            return true
          }
          if (event.key === 'Enter') {
            const item = items[selectedRef.current]
            if (item) command(item)
            return true
          }
          return false
        },
      }),
      [items, command]
    )

    // Keep the highlighted row scrolled into view as you arrow through.
    const listRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const el = listRef.current?.children[selected] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }, [selected])

    if (items.length === 0) {
      return (
        <div className="w-72 rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-3 text-xs text-[var(--color-text-muted)] shadow-2xl shadow-black/50">
          No matching blocks
        </div>
      )
    }

    return (
      <div
        ref={listRef}
        className="w-72 max-h-80 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] p-1.5 shadow-2xl shadow-black/50"
      >
        {items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onMouseEnter={() => setSelected(i)}
            onMouseDown={(e) => {
              e.preventDefault()
              command(item)
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
              i === selected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                i === selected
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-[var(--color-border)] bg-white/[0.02] text-[var(--color-text-muted)]'
              )}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-white">{item.title}</span>
              <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                {item.description}
              </span>
            </span>
          </button>
        ))}
      </div>
    )
  }
)
SlashList.displayName = 'SlashList'

// ── extension ───────────────────────────────────────────────────────────────

/**
 * Minimal fixed positioner: anchors the popup to the caret's client rect.
 * Avoids pulling in a positioning lib; good enough for a single popup.
 */
function makePopup() {
  const el = document.createElement('div')
  el.style.position = 'absolute'
  el.style.zIndex = '60'
  el.style.top = '0'
  el.style.left = '0'
  document.body.appendChild(el)
  return el
}

export function createSlashCommand(onImage: () => void, onEmbed: () => void, onGif: () => void) {
  return Extension.create({
    name: 'slashCommand',

    addOptions() {
      return {
        suggestion: {
          char: '/',
          startOfLine: false,
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor
            range: Range
            props: SlashItem
          }) => props.command({ editor, range }),
        },
      }
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
          items: ({ query }: { query: string }) => {
            const q = query.toLowerCase()
            return buildItems(onImage, onEmbed, onGif).filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                item.keywords.some((k) => k.includes(q))
            )
          },
          render: () => {
            let component: ReactRenderer | null = null
            let popup: HTMLElement | null = null

            const position = (rect: DOMRect | null) => {
              if (!popup || !rect) return
              const menuH = popup.offsetHeight || 320
              const spaceBelow = window.innerHeight - rect.bottom
              // Flip above the caret when there isn't room below — keeps the
              // block list reachable at the bottom of the screen.
              const openUp = spaceBelow < menuH + 16
              popup.style.left = `${rect.left + window.scrollX}px`
              popup.style.top = openUp
                ? `${rect.top + window.scrollY - menuH - 6}px`
                : `${rect.bottom + window.scrollY + 6}px`
            }

            return {
              onStart: (props: SuggestionProps<SlashItem>) => {
                component = new ReactRenderer(SlashList, {
                  props,
                  editor: props.editor,
                })
                popup = makePopup()
                popup.appendChild(component.element)
                position(props.clientRect?.() ?? null)
              },
              onUpdate: (props: SuggestionProps<SlashItem>) => {
                component?.updateProps(props)
                position(props.clientRect?.() ?? null)
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  popup?.remove()
                  return true
                }
                const ref = component?.ref as { onKeyDown: (p: SuggestionKeyDownProps) => boolean } | null
                return ref?.onKeyDown(props) ?? false
              },
              onExit: () => {
                popup?.remove()
                component?.destroy()
                popup = null
                component = null
              },
            }
          },
        }),
      ]
    },
  })
}
