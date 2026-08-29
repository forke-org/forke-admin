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

import React, { useEffect, useState } from 'react'
import { getLevelTitle } from '@/lib/utils/xp'
import { cn } from '@/lib/utils/cn'

interface LevelUpModalProps {
  newLevel: number | null   // null = not levelled up, truthy = show modal
  onClose: () => void
}

export function LevelUpModal({ newLevel, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (newLevel) {
      const timeout = setTimeout(() => {
        setVisible(true)
        // Slight delay so the CSS transition fires
        setTimeout(() => setAnimating(true), 10)
      }, 0)
      return () => clearTimeout(timeout)
    }
  }, [newLevel])

  function handleClose() {
    setAnimating(false)
    setTimeout(() => {
      setVisible(false)
      onClose()
    }, 300)
  }

  if (!visible || !newLevel) return null

  return (
    // Backdrop
    <div
      className={cn(
        'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-500',
        animating ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleClose}
    >
      {/* Modal card */}
      <div
        className={cn(
          'relative bg-white rounded-[2.5rem] p-10 max-w-sm w-full mx-4 text-center border-2 border-accent/20 shadow-2xl transition-all duration-500 ease-out-back',
          animating ? 'scale-100 translate-y-0 opacity-100' : 'scale-90 translate-y-10 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated rings */}
        <div className="relative flex items-center justify-center mb-8">
          <div className="absolute w-32 h-32 rounded-full border-2 border-accent/20 animate-[ping_3s_infinite]" />
          <div className="absolute w-28 h-28 rounded-full border-2 border-accent/30 animate-[spin_10s_linear_infinite]" />
          <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center shadow-lg shadow-accent/40 relative z-10 scale-125">
            <span className="font-mono font-black text-white text-3xl">
              {newLevel}
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-8">
          <p className="text-[10px] font-mono font-bold text-accent uppercase tracking-[0.3em]">
            rank up
          </p>
          <h2 className="font-serif text-4xl text-[var(--color-text-primary)] tracking-tight">
            Level {newLevel}
          </h2>
          <p className="text-lg font-medium text-amber-900/80 italic">
            &ldquo;{getLevelTitle(newLevel)}&rdquo;
          </p>
          <p className="text-sm text-muted leading-relaxed font-medium pt-2">
            Higher value tasks and complex bounties are now within your reach. Keep shipping.
          </p>
        </div>

        <button
          onClick={handleClose}
          className="w-full bg-accent text-white rounded-2xl py-4 font-bold text-sm tracking-widest uppercase hover:bg-accent/90 active:scale-95 transition-all shadow-lg shadow-accent/20"
        >
          LET&apos;S GO →
        </button>
      </div>
    </div>
  )
}
