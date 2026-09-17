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
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || (isProd ? 'admin.forke.space' : 'localhost:3002')
  const proto = request.headers.get('x-forwarded-proto') || (isProd ? 'https' : 'http')
  const redirectUrl = new URL('/login', `${proto}://${host}`)
  const response = NextResponse.redirect(redirectUrl)

  const cookieNames = ['admin_token', 'forke_role', 'forke_access_token', 'forke_username']
  const domains: (string | undefined)[] = isProd ? ['.forke.space', undefined] : [undefined]

  for (const name of cookieNames) {
    for (const domain of domains) {
      if (name.startsWith('__Host-') && domain) continue

      let cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; SameSite=Lax`
      if (domain) cookie += `; Domain=${domain}`
      if (isProd) cookie += '; Secure'
      if (name === 'admin_token') cookie += '; HttpOnly'

      response.headers.append('Set-Cookie', cookie)
    }
  }

  return response
}
