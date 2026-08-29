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

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  const cookieOpts = {
    path: '/',
    maxAge: 0,
  }
  
  response.cookies.set('forke_access_token', '', cookieOpts)
  response.cookies.set('forke_role', '', cookieOpts)
  response.cookies.set('forke_username', '', cookieOpts)
  
  return response
}
