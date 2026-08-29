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

import { db } from './db'
import { users, owners, subscribers } from './db/schema'
import { auth } from '@/auth'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logAudit } from './actions/audit-actions'
import { readAttributionCookie } from './utils/attribution'

export async function submitOwnerApplication(formData: any) {
  const session = await auth()
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  const userId = session.user.id

  try {
    // 1. Verify user exists and isn't already a developer
    let existingUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    })

    if (!existingUser) {
      if (!session.user.email) {
        return { success: false, error: 'User account not found in database and email is missing from session. Please log out and sign in again.' }
      }
      const [insertedUser] = await db.insert(users).values({
        id: userId,
        email: session.user.email,
        name: session.user.name || session.user.email.split('@')[0] || 'User',
        image: session.user.image || null,
        role: 'owner',
        isApproved: false,
      }).returning()
      existingUser = insertedUser
    }

    if (existingUser.role === 'developer') {
      return { success: false, error: 'Cannot register a Developer account as an Owner.' }
    }

    // Preserve first-touch attribution; just tag the conversion role as 'owner'.
    // Backfill source from the cookie only if the user had none recorded at original signup.
    const existingAttribution = (existingUser?.attribution as Record<string, any> | null) || null
    const cookieAttribution = await readAttributionCookie()
    const mergedAttribution = {
      ...(existingAttribution && Object.keys(existingAttribution).length > 0
        ? existingAttribution
        : {
            source: cookieAttribution.source,
            medium: cookieAttribution.medium,
            campaign: cookieAttribution.campaign,
            referrer: cookieAttribution.referrer,
            landingPage: cookieAttribution.landingPage,
          }),
      signupRole: 'owner',
    }

    // 2. Update user role and status
    await db.update(users).set({
      role: 'owner',
      isApproved: false,
      attribution: mergedAttribution,
    }).where(eq(users.id, userId))

    // 2. Save application data to owners table
    await db.insert(owners).values({
      id: userId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      contactNumber: formData.contactNumber,
      contactEmail: formData.contactEmail,
      companyName: formData.companyName,
      companyWebsite: formData.companyWebsite || null,
      personalLinkedIn: formData.personalLinkedIn,
      companyLinkedIn: formData.companyLinkedIn,
      designation: formData.designation,
      otherLinks: formData.otherLinks || null,
      message: formData.message || null,
    }).onConflictDoUpdate({
      target: owners.id,
      set: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactNumber: formData.contactNumber,
        contactEmail: formData.contactEmail,
        companyName: formData.companyName,
        companyWebsite: formData.companyWebsite || null,
        personalLinkedIn: formData.personalLinkedIn,
        companyLinkedIn: formData.companyLinkedIn,
        designation: formData.designation,
        otherLinks: formData.otherLinks || null,
        message: formData.message || null,
      }
    })

    // Add to subscribers if receivePromotions is checked
    if (formData.receivePromotions && formData.contactEmail) {
      try {
        await db.insert(subscribers).values({
          email: formData.contactEmail,
          source: cookieAttribution.source,
          attribution: {
            medium: cookieAttribution.medium,
            campaign: cookieAttribution.campaign,
            referrer: cookieAttribution.referrer,
            landingPage: cookieAttribution.landingPage,
          },
          createdAt: new Date()
        }).onConflictDoNothing()
      } catch (e) {
        console.error('Failed to add owner to subscribers:', e)
      }
    }

    revalidatePath('/dashboard')

    // Log the event explicitly for the activity feed
    await logAudit({
      category: 'owner',
      action: 'owner.applied',
      target: `${formData.firstName} ${formData.lastName}`,
      actorId: userId,
      actorName: `${formData.firstName} ${formData.lastName}`
    })

    return { success: true }
  } catch (error: any) {
    console.error('FULL SUBMISSION ERROR:', error)
    return { success: false, error: 'Failed to submit application. Please try again or contact support.' }
  }
}
