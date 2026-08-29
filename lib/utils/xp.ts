/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import {
  XP_BY_BUDGET,
  XP_BONUS_SPEED,
  XP_BONUS_5_STAR,
  XP_BONUS_4_STAR,
  XP_PENALTY_REVISION,
  LEVEL_THRESHOLDS,
  SKILL_TIER,
  LEVEL_TITLES,
  XP_STREAK,
  XP_DAILY_LOGIN,
} from '@/constants'

export function getLevelFromXp(totalXp: number): number {
  let level = 1
  for (const t of LEVEL_THRESHOLDS) {
    if (totalXp >= t.xpRequired) level = t.level
    else break
  }
  return level
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? 'Developer'
}

export function getXpForCurrentLevel(level: number): number {
  return LEVEL_THRESHOLDS.find((t) => t.level === level)?.xpRequired ?? 0
}

export function getXpForNextLevel(level: number): number | null {
  return LEVEL_THRESHOLDS.find((t) => t.level === level + 1)?.xpRequired ?? null
}

// Returns 0–100 percentage progress through current level
export function getLevelProgress(totalXp: number): number {
  const level = getLevelFromXp(totalXp)
  const currentLevelXp = getXpForCurrentLevel(level)
  const nextLevelXp = getXpForNextLevel(level)
  if (!nextLevelXp) return 100
  const progress = (totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)
  return Math.round(Math.min(progress * 100, 100))
}

export function getBaseXp(budgetPaise: number): number {
  for (const tier of XP_BY_BUDGET) {
    if (budgetPaise <= tier.maxPaise) return tier.xp
  }
  return 350
}

export function calculateXpAward({
  budgetPaise,
  taskCreatedAt,
  submittedAt,
  deadline,
  rating,
  hadRevision,
}: {
  budgetPaise: number
  taskCreatedAt: Date
  submittedAt: Date
  deadline: Date | null
  rating: number | null
  hadRevision: boolean
}): number {
  let xp = getBaseXp(budgetPaise)

  if (deadline) {
    const totalWindow = deadline.getTime() - taskCreatedAt.getTime()
    const elapsed = submittedAt.getTime() - taskCreatedAt.getTime()
    if (totalWindow > 0 && elapsed / totalWindow < 0.5) xp += XP_BONUS_SPEED
  }

  if (rating === 5) xp += XP_BONUS_5_STAR
  else if (rating === 4) xp += XP_BONUS_4_STAR

  if (hadRevision) xp -= XP_PENALTY_REVISION

  return Math.max(xp, 0)
}

export function getRequiredLevel(skillTags: string[]): number {
  if (!skillTags?.length) return 1
  return Math.max(...skillTags.map((tag) => SKILL_TIER[tag] ?? 1))
}

export function getStreakXp(streakDays: number): number {
  // Find the highest milestone at or below current streak
  const milestones = Object.keys(XP_STREAK)
    .map(Number)
    .sort((a, b) => b - a)
  const matched = milestones.find((m) => streakDays === m)
  return matched ? XP_STREAK[matched] : XP_DAILY_LOGIN
}
