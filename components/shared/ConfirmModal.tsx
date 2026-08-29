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

import React, { useState } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'default'
  onConfirm: () => void | Promise<void>
}

/**
 * Reusable in-app confirmation modal — replaces native window.confirm().
 * Render <ConfirmModal state={...} onClose={...} /> once per screen and drive it
 * with a single piece of state. Matches the admin glass-modal styling.
 */
export default function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmOptions | null
  onClose: () => void
}) {
  const [isWorking, setIsWorking] = useState(false)

  if (!state) return null

  async function run() {
    if (!state) return
    setIsWorking(true)
    try {
      await state.onConfirm()
      onClose()
    } catch (err) {
      console.error('Confirm action failed:', err)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-[#0c0c0e] border border-[var(--color-border)] rounded-xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <div className="space-y-4 text-left">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h3 className="text-base font-medium text-white">{state.title}</h3>
          </div>
          <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)] whitespace-pre-line">
            {state.message}
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={isWorking}
              className="h-8 px-3 rounded-lg text-xs font-medium transition-colors border border-[var(--color-border)] hover:bg-white/[0.05] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={run}
              disabled={isWorking}
              className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                state.tone === 'danger'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'
                  : 'bg-accent text-black'
              }`}
            >
              {isWorking ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                  <span>Working...</span>
                </>
              ) : (
                <span>{state.confirmLabel || 'Confirm'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
