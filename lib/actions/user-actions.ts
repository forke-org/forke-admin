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

import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users, owners } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Safely deletes the currently authenticated user IF they are an incomplete owner.
 * This is used during the onboarding flow if they click "Switch Account"
 * before submitting the final owner registration form.
 */
export async function deleteCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Not authenticated' }

  const userId = session.user.id

  // Extremely critical safety check: NEVER delete a developer
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  })

  if (!dbUser || dbUser.role === 'developer') {
    return { success: false, error: 'Cannot delete developer accounts' }
  }

  // Only allow deletion if the user hasn't finished the owner flow
  // (We don't want them deleting fully established accounts accidentally)
  const existingOwner = await db.query.owners.findFirst({
    where: eq(owners.id, userId),
  })

  if (existingOwner) {
    return { success: false, error: 'Account is already fully established' }
  }

  try {
    // Delete the user. Because of onDelete: 'cascade', this also cleans up
    // their sessions and oauth account links.
    await db.delete(users).where(eq(users.id, userId))
    return { success: true }
  } catch (error) {
    console.error('Failed to delete incomplete user:', error)
    return { success: false, error: 'Failed to delete account' }
  }
}
