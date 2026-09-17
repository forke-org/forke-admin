/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin-actions'
import { logAudit } from '@/lib/actions/audit-actions'

export async function GET(request: Request) {
  return handleLogout(request)
}

export async function POST(request: Request) {
  return handleLogout(request)
}

async function handleLogout(request: Request) {
  try {
    const admin = await getCurrentAdmin().catch(() => null)
    if (admin) {
      await logAudit({
        category: 'admin',
        action: 'admin.logout',
        target: admin.name,
        actorId: admin.id,
        actorName: admin.name,
      })
    }
  } catch (err) {
    console.error('Failed to log admin logout in /api/auth/logout:', err)
  }

  const isProd = process.env.NODE_ENV === 'production'
  const redirectUrl = new URL('/login', request.url)
  const response = NextResponse.redirect(redirectUrl)

  const domains = isProd ? ['.forke.space', undefined] : [undefined]

  for (const domain of domains) {
    response.cookies.set('admin_token', '', {
      path: '/',
      domain,
      maxAge: 0,
      expires: new Date(0),
      secure: isProd,
      sameSite: 'lax',
      httpOnly: true,
    })
  }

  return response
}
