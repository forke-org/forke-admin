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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const role = searchParams.get('role') || 'developer'

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID
  const redirectUri = process.env.GITHUB_SANDBOX_REDIRECT_URI || `${origin}/api/auth/callback/github`

  if (!clientId) {
    return NextResponse.json(
      { error: 'GITHUB_CLIENT_ID or AUTH_GITHUB_ID is not configured in environment variables' },
      { status: 500 }
    )
  }

  const callbackUrl = searchParams.get('callbackUrl') || (role === 'owner' ? '/owner' : '/developer')
  const oauthState = `${role}:${callbackUrl}`
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,read:org,read:user,delete_repo&state=${encodeURIComponent(oauthState)}`

  return NextResponse.redirect(githubAuthUrl)
}
