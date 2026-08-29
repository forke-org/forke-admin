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

import React, { useState, useRef, useEffect } from 'react'
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
  /** Extra classes for the trigger button */
  className?: string
  /** Visual density */
  size?: 'sm' | 'md'
  /** Horizontal alignment of the dropdown menu */
  align?: 'left' | 'right'
  /** Whether the menu opens upward (use near the bottom of a clipped container) */
  placement?: 'top' | 'bottom'
  'aria-label'?: string
}

/**
 * A styled, accessible dropdown that replaces the native <select> so menus
 * match the app's dark/glass aesthetic instead of the OS default list.
 */
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] text-white transition-colors hover:border-white/15 focus:border-accent/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
          size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-9 px-3 text-xs',
          className
        )}
      >
        <span className={cn('truncate', !selected && 'text-white/30')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 shrink-0 text-white/40 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 min-w-full w-max max-w-[280px] rounded-xl border border-white/[0.08] bg-[#0c0c0e]/95 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden',
            align === 'right' ? 'right-0' : 'left-0',
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          )}
        >
          <div
            role="listbox"
            className="max-h-64 overflow-y-auto p-1"
          >
            {options.map((opt) => {
              const isSel = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                    isSel ? 'bg-accent/10 text-accent' : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
