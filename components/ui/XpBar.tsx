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

import { getLevelFromXp, getLevelProgress, getXpForNextLevel } from '@/lib/utils/xp'
import { cn } from '@/lib/utils/cn'

interface XpBarProps {
  totalXp: number
  className?: string
  compact?: boolean // compact = sidebar mode, full = profile page mode
}

export function XpBar({ totalXp, className, compact = false }: XpBarProps) {
  const level = getLevelFromXp(totalXp)
  const progress = getLevelProgress(totalXp)
  const xpToNext = getXpForNextLevel(level)

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {!compact && (
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-mono text-muted">
            {totalXp.toLocaleString()} XP total
          </span>
          {xpToNext !== null && (
            <span className="text-xs text-muted">
              {xpToNext.toLocaleString()} to LVL {level + 1}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div className="relative h-1.5 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {compact && (
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-muted">{progress}%</span>
          {xpToNext !== null && (
            <span className="text-[10px] text-muted">{xpToNext - totalXp} xp left</span>
          )}
        </div>
      )}
    </div>
  )
}
