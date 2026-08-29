'use server'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { isConsecutiveDay, isAlreadyLoggedInToday } from '@/lib/utils/streak'
import { getStreakXp, getLevelFromXp } from '@/lib/utils/xp'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function processLoginStreak(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return

  const now = new Date()

  // Already logged in today — do nothing
  if (user.lastLoginAt && isAlreadyLoggedInToday(user.lastLoginAt, now)) return

  let newStreak = 1
  if (user.lastLoginAt && isConsecutiveDay(user.lastLoginAt, now)) {
    newStreak = (user.currentStreak ?? 0) + 1
  }

  const xpGained = getStreakXp(newStreak)
  const newTotalXp = (user.xp ?? 0) + xpGained
  const newLevel = getLevelFromXp(newTotalXp)

  await db
    .update(users)
    .set({
      lastLoginAt: now,
      currentStreak: newStreak,
      xp: newTotalXp,
      level: newLevel,
    })
    .where(eq(users.id, userId))

  // Return metadata so the client can show a streak toast if needed
  return { xpGained, newStreak, leveledUp: newLevel > (user.level ?? 1), newLevel }
}

export async function signOutAction() {
  // Helper for components that need a server action for signout
  // This is often used in Sidebar or Profile buttons
}

export async function saveGithubUrl(userId: string, url: string) {
  if (!url || !url.includes('github.com')) {
    return { success: false, error: 'Invalid GitHub URL' }
  }

  // Extract username to fetch basic stats
  try {
    const urlParts = url.replace(/\/$/, '').split('/')
    const username = urlParts[urlParts.length - 1]

    let githubStats = null;
    try {
      const res = await fetch(`https://api.github.com/users/${username}`)
      if (res.ok) {
        const githubData = await res.json()
        githubStats = {
          followers: githubData.followers,
          following: githubData.following,
          public_repos: githubData.public_repos,
          public_gists: githubData.public_gists,
          created_at: githubData.created_at,
          updated_at: githubData.updated_at
        }
      }
    } catch (e) {
      console.error('Failed to fetch github stats', e)
    }

    await db.update(users).set({ 
      githubUrl: url,
      ...(githubStats && { githubStats })
    }).where(eq(users.id, userId))

    return { success: true }
  } catch (error) {
    console.error('Failed to save github url', error)
    return { success: false, error: 'Internal server error' }
  }
}
