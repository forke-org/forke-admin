/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

export const SKILL_TAGS = [
  'HTML/CSS',
  'JavaScript',
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Python',
  'UI/UX',
  'REST API',
  'Bug Fix',
  'Database',
  'DevOps',
] as const

// XP awarded based on task budget (stored in paise)
export const XP_BY_BUDGET: { maxPaise: number; xp: number }[] = [
  { maxPaise: 39900, xp: 50 }, // ₹100–₹399
  { maxPaise: 89900, xp: 100 }, // ₹400–₹899
  { maxPaise: 249900, xp: 200 }, // ₹900–₹2,499
  { maxPaise: Infinity, xp: 350 }, // ₹2,500+
]

// XP for actions beyond task completion
export const XP_CLAIM_TASK = 5 // just for claiming (effort signal)
export const XP_BONUS_SPEED = 25 // submitted in first 50% of deadline window
export const XP_BONUS_5_STAR = 30
export const XP_BONUS_4_STAR = 10
export const XP_PENALTY_REVISION = 20

// Streak XP — awarded on login
export const XP_STREAK: Record<number, number> = {
  2: 10, // 2-day streak
  3: 15,
  5: 25,
  7: 40, // one week
  14: 60,
  30: 100, // one month
}
// Default daily login XP (day 1 or non-milestone days)
export const XP_DAILY_LOGIN = 5

// Cumulative XP thresholds — source of truth for levels
// Level is ALWAYS derived from totalXp, never stored independently
export const LEVEL_THRESHOLDS: { level: number; xpRequired: number }[] = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 200 }, // ~3 tasks or 2 weeks of logins
  { level: 3, xpRequired: 500 },
  { level: 4, xpRequired: 1000 },
  { level: 5, xpRequired: 1800 },
  { level: 6, xpRequired: 2800 },
  { level: 7, xpRequired: 4000 },
  { level: 8, xpRequired: 5500 },
  { level: 9, xpRequired: 7200 },
  { level: 10, xpRequired: 9200 },
  { level: 11, xpRequired: 11500 },
  { level: 12, xpRequired: 14200 },
  { level: 13, xpRequired: 17500 },
  { level: 14, xpRequired: 21500 },
  { level: 15, xpRequired: 26000 },
]

// Level titles shown in UI
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Newcomer',
  2: 'Apprentice',
  3: 'Contributor',
  4: 'Builder',
  5: 'Craftsman',
  6: 'Engineer',
  7: 'Senior Dev',
  8: 'Specialist',
  9: 'Architect',
  10: 'Expert',
  11: 'Principal',
  12: 'Staff Dev',
  13: 'Elite',
  14: 'Legend',
  15: 'Verified Pro',
}

// Minimum level to claim a task — derived from skill tags
export const SKILL_TIER: Record<string, number> = {
  'HTML/CSS': 1,
  'JavaScript': 1,
  'Bug Fix': 1,
  'UI/UX': 2,
  'React': 3,
  'Node.js': 3,
  'REST API': 3,
  'Python': 3,
  'TypeScript': 4,
  'Next.js': 4,
  'Database': 5,
  'DevOps': 6,
}

export const TASK_STATUS = {
  OPEN: 'open',
  CLAIMED: 'claimed',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  DISPUTED: 'disputed',
} as const
