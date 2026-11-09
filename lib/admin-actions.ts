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

import { cookies } from 'next/headers'
import { adminFromSessionCookie, createAdminSession, deleteAdminSession } from './admin-sessions'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { admins } from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'
import { logAudit } from '@/lib/actions/audit-actions'

export async function adminLogin(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { success: false, error: 'Please supply a username and password.' }
  }

  const input = username.trim().toLowerCase()

  // Query by username, primary email, or alternative email
  let admin = await db
    .select()
    .from(admins)
    .where(
      or(
        eq(admins.username, input),
        eq(admins.email, input),
        eq(admins.alternativeEmail, input)
      )
    )
    .limit(1)
    .then((rows) => rows[0])

  // Verify account is not disabled
  if (admin && admin.isDisabled) {
    return { success: false, error: 'This administrative account has been disabled.' }
  }

  if (admin && admin.passwordHash && await bcrypt.compare(password, admin.passwordHash)) {
    // Record login timing
    await db
      .update(admins)
      .set({ lastLoginAt: new Date() })
      .where(eq(admins.id, admin.id))

    try {
      const cookieStore = await cookies()
      cookieStore.set('admin_token', `forke_admin_session:${await createAdminSession(admin.id)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.forke.space' : undefined,
        maxAge: 60 * 60 * 24 // 24 hours
      })
    } catch (e) {
      console.warn('Warning: Could not set admin_token cookie (running outside Next.js request scope).')
    }

    // Record admin login event in the audit trail
    await logAudit({
      category: 'admin',
      action: 'admin.login',
      target: admin.name,
      actorId: admin.id,
      actorName: admin.name
    })

    return { success: true }
  }

  return { success: false, error: 'Invalid credentials' }
}

export async function adminLogout() {
  try {
    const admin = await getCurrentAdmin().catch(() => null)
    if (admin) {
      await logAudit({
        category: 'admin',
        action: 'admin.logout',
        target: admin.name,
        actorId: admin.id,
        actorName: admin.name
      })
    }
  } catch (err) {
    console.error('Failed to log admin logout:', err)
  }
  const cookieStore = await cookies()
  await deleteAdminSession(cookieStore.get('admin_token')?.value)
  const isProd = process.env.NODE_ENV === 'production'
  
  if (isProd) {
    cookieStore.set('admin_token', '', {
      path: '/',
      domain: '.forke.space',
      maxAge: 0,
      expires: new Date(0),
    })
  }
  cookieStore.set('admin_token', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })
  return { success: true }
}

export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies()
    return await adminFromSessionCookie(cookieStore.get('admin_token')?.value)
  } catch (error) {
    console.error('Error in getCurrentAdmin:', error)
    return null
  }
}

export async function isAdminAuthenticated() {
  const admin = await getCurrentAdmin()
  return !!admin
}

