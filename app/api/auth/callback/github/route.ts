import { NextResponse } from 'next/server'
import { handlers } from '@/auth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const state = searchParams.get('state') || ''

  // If state is 'owner' or 'developer', this is the sandbox OAuth flow
  if (state === 'owner' || state === 'developer') {
    return handleSandboxCallback(request, state)
  }

  // Otherwise delegate to NextAuth's built-in GitHub callback handler
  return handlers.GET(request)
}

async function handleSandboxCallback(request: Request, role: string) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/?error=No+code+received+from+GitHub', request.url))
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const redirectUri = process.env.GITHUB_SANDBOX_REDIRECT_URI

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/?error=GitHub+OAuth+not+configured', request.url))
  }

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      const msg = encodeURIComponent(tokenData.error_description || tokenData.error)
      return NextResponse.redirect(new URL(`/?error=${msg}`, request.url))
    }

    const accessToken = tokenData.access_token
    if (!accessToken) {
      return NextResponse.redirect(new URL('/?error=No+access+token+returned', request.url))
    }

    // 2. Fetch GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Forke-Sandbox/1.0' },
    })

    const userData = await userResponse.json()
    if (!userData.login) {
      return NextResponse.redirect(new URL('/?error=Failed+to+get+GitHub+user', request.url))
    }

    const githubUsername = userData.login
    const githubId = userData.id

    // 3. Save to DB — non-blocking, never fails the login
    try {
      const { db } = await import('@/lib/db')
      const { sandboxOwners, sandboxDevelopers } = await import('@/lib/db/schema')
      const { eq } = await import('drizzle-orm')

      if (role === 'owner') {
        const existing = await db.select().from(sandboxOwners).where(eq(sandboxOwners.githubId, githubId))
        if (existing.length > 0) {
          await db.update(sandboxOwners).set({ username: githubUsername, accessToken }).where(eq(sandboxOwners.githubId, githubId))
        } else {
          await db.insert(sandboxOwners).values({ githubId, username: githubUsername, accessToken })
        }
      } else {
        const existing = await db.select().from(sandboxDevelopers).where(eq(sandboxDevelopers.githubId, githubId))
        if (existing.length > 0) {
          await db.update(sandboxDevelopers).set({ username: githubUsername, accessToken }).where(eq(sandboxDevelopers.githubId, githubId))
        } else {
          await db.insert(sandboxDevelopers).values({ githubId, username: githubUsername, accessToken })
        }
      }
    } catch (dbErr) {
      console.warn('[Sandbox OAuth] DB save skipped (DB unavailable):', dbErr)
    }

    // 4. Redirect to sandbox page with session info in URL params
    const targetPath = role === 'owner' ? '/sandbox-post-task' : '/sandbox-dashboard'
    const targetUrl = new URL(targetPath, request.url)
    targetUrl.searchParams.set('success', 'true')
    targetUrl.searchParams.set('github_id', githubUsername)
    targetUrl.searchParams.set('role', role)

    const response = NextResponse.redirect(targetUrl)

    const cookieOpts = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    }
    response.cookies.set('forke_access_token', accessToken, { ...cookieOpts, httpOnly: true })
    response.cookies.set('forke_role', role, { ...cookieOpts, httpOnly: false })
    response.cookies.set('forke_username', githubUsername, { ...cookieOpts, httpOnly: false })

    return response
  } catch (error) {
    console.error('[Sandbox OAuth] Callback error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(msg)}`, request.url))
  }
}
