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

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
  align?: 'left' | 'right'
  placement?: 'top' | 'bottom'
  'aria-label'?: string
}

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number }

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className,
  size = 'md',
  align = 'left',
  placement = 'bottom',
  'aria-label': ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<Place | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = options[selectedIndex]

  const measure = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 180)
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    const up = placement === 'top' ? above > 120 : below < 220 && above > below
    const left = align === 'right' ? r.right - width : r.left
    setPlace({
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      width,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.min(288, up ? above : below),
    })
  }, [align, placement])

  const show = () => {
    if (disabled) return
    measure()
    setActive(Math.max(0, selectedIndex))
    setOpen(true)
  }

  const choose = (opt: SelectOption) => {
    setOpen(false)
    trigger.current?.focus()
    if (opt.value !== value) onChange(opt.value)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false)
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', away)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', measure, true)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + options.length) % options.length) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]) }
    else if (e.key === 'Escape' || e.key === 'Tab') setOpen(false)
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
      if (i >= 0) setActive(i)
    }
  }

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={cn(
          'flex w-full cursor-pointer items-center justify-between gap-2 rounded-[6px] border border-[var(--color-border-strong)] bg-[rgba(240,227,222,0.03)] text-white transition-[border-color,box-shadow] hover:border-[rgba(240,227,222,0.24)] focus:outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-[13px]',
          open && 'border-accent shadow-[0_0_0_3px_rgba(255,122,0,0.15)]',
          className
        )}
      >
        <span className={cn('truncate', !selected && 'text-white/30')}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && place
        ? createPortal(
            <ul
              ref={list}
              id={id}
              role="listbox"
              aria-label={ariaLabel}
              style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
              className="no-scrollbar fixed z-[200] overflow-y-auto rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-1 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-150"
            >
              {options.map((opt, i) => {
                const isSel = opt.value === value
                return (
                  <li
                    key={opt.value}
                    id={`${id}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(opt)}
                    className={cn(
                      'flex h-8 cursor-pointer select-none items-center gap-2 rounded-[5px] px-2.5 text-[13px]',
                      i === active ? 'bg-white/[0.07] text-white' : 'text-[#c9c7c5]'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                  </li>
                )
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  )
}
