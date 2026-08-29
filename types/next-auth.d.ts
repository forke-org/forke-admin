/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'developer' | 'owner'
      xp: number
      level: number
      currentStreak: number
      isApproved: boolean
      isBanned: boolean
      githubUrl?: string | null
      username?: string | null
      isGithubConnected?: boolean
    } & DefaultSession['user']
  }

  interface User {
    role?: 'developer' | 'owner'
    xp?: number
    level?: number
    currentStreak?: number
    isApproved?: boolean
    isBanned?: boolean
    githubUrl?: string | null
    username?: string | null
    isGithubConnected?: boolean
  }
}
