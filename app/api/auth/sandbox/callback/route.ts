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
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const role = searchParams.get('state') || 'developer'

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=No+code+received+from+GitHub', request.url)
    )
  }

  const clientId = process.env.GITHUB_CLIENT_ID || process.env.AUTH_GITHUB_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || process.env.AUTH_GITHUB_SECRET
  const redirectUri = process.env.GITHUB_SANDBOX_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/callback/github`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/?error=GitHub+OAuth+not+configured', request.url)
    )
  }

  try {
    // 1. Exchange authorization code for access token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      }
    )

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      const msg = encodeURIComponent(tokenData.error_description || tokenData.error)
      return NextResponse.redirect(new URL(`/?error=${msg}`, request.url))
    }

    const accessToken = tokenData.access_token

    if (!accessToken) {
      return NextResponse.redirect(
        new URL('/?error=No+access+token+returned+from+GitHub', request.url)
      )
    }

    // 2. Fetch user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Forke-Sandbox/1.0',
      },
    })

    const userData = await userResponse.json()

    if (!userData.login) {
      return NextResponse.redirect(
        new URL('/?error=Failed+to+retrieve+GitHub+user', request.url)
      )
    }

    const githubUsername = userData.login
    const githubId = userData.id

    // 3. Save to database — non-blocking, never fail login because of DB issues
    try {
      const { db } = await import('@/lib/db')
      const { sandboxUsers } = await import('@/lib/db/schema')
      const { eq } = await import('drizzle-orm')

      if (role === 'owner' || role === 'developer') {
        const existing = await db
          .select()
          .from(sandboxUsers)
          .where(eq(sandboxUsers.githubId, githubId))

        if (existing.length > 0) {
          await db
            .update(sandboxUsers)
            .set({ username: githubUsername, accessToken, role })
            .where(eq(sandboxUsers.githubId, githubId))
        } else {
          await db.insert(sandboxUsers).values({ githubId, username: githubUsername, accessToken, role })
        }
      }
    } catch (dbErr) {
      // DB save failed — log but continue. User can still use the sandbox.
      console.warn('[Sandbox OAuth] DB save skipped (DB unavailable):', dbErr)
    }

    // 4. Redirect to sandbox page with session params
    const targetPath = role === 'owner' ? '/sandbox-post-task' : '/sandbox-dashboard'
    const targetUrl = new URL(targetPath, request.url)
    targetUrl.searchParams.set('success', 'true')
    targetUrl.searchParams.set('github_id', githubUsername)
    targetUrl.searchParams.set('role', role)

    const response = NextResponse.redirect(targetUrl)

    // Set cookies for session persistence
    const cookieOpts = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    }

    response.cookies.set('forke_access_token', accessToken, { ...cookieOpts, httpOnly: true })
    response.cookies.set('forke_role', role, { ...cookieOpts, httpOnly: false })
    response.cookies.set('forke_username', githubUsername, { ...cookieOpts, httpOnly: false })

    return response
  } catch (error) {
    console.error('[Sandbox OAuth] Callback error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown+auth+error'
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(msg)}`, request.url)
    )
  }
}
