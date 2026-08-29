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

import { db } from '@/lib/db'
import { supportEnquiries } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { logAudit } from './audit-actions'

export async function submitEnquiry(formData: any) {
  const { firstName, lastName, contactNumber, contactEmail, message, relevantLinks, errorType } = formData

  if (!firstName || !lastName || !contactNumber || !contactEmail || !message) {
    return { success: false, error: 'Please fill out all required fields.' }
  }

  try {
    await db.insert(supportEnquiries).values({
      firstName,
      lastName,
      contactNumber,
      contactEmail,
      message,
      relevantLinks: relevantLinks || null,
      errorType: errorType || null,
    })

    // Log the event explicitly for the activity feed
    await logAudit({
      category: 'support',
      action: 'support.enquiry',
      target: errorType ? `${contactEmail} · ${errorType}` : contactEmail,
      actorName: `${firstName} ${lastName}`
    })

    return { success: true }
  } catch (error) {
    console.error('Error submitting enquiry:', error)
    return { success: false, error: 'Failed to submit enquiry. Please try again later.' }
  }
}

export async function getEnquiries() {
  try {
    const data = await db.query.supportEnquiries.findMany({
      orderBy: [desc(supportEnquiries.createdAt)],
    })
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching enquiries:', error)
    return { success: false, error: 'Failed to fetch enquiries.' }
  }
}
