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

export async function POST(request: Request) {
  try {
    const { token, role } = await request.json()

    if (!token || !role) {
      return NextResponse.json({ error: 'Token and role are required' }, { status: 400 })
    }

    // Validate the PAT by calling GitHub API
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Forke-Sandbox/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    })

    if (!userResponse.ok) {
      const err = await userResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.message || 'Invalid GitHub token. Make sure the token has the required scopes.' },
        { status: 401 }
      )
    }

    const userData = await userResponse.json()
    const githubUsername = userData.login
    const githubId = userData.id

    if (!githubUsername) {
      return NextResponse.json({ error: 'Could not retrieve GitHub username' }, { status: 400 })
    }

    // Save to database (non-blocking — sandbox still works if DB is down)
    try {
      const { db } = await import('@/lib/db')
      const { sandboxUsers } = await import('@/lib/db/schema')
      const { eq } = await import('drizzle-orm')

      if (role === 'owner' || role === 'developer') {
        const existing = await db.select().from(sandboxUsers).where(eq(sandboxUsers.githubId, githubId))
        if (existing.length > 0) {
          await db.update(sandboxUsers).set({ username: githubUsername, accessToken: token, role }).where(eq(sandboxUsers.githubId, githubId))
        } else {
          await db.insert(sandboxUsers).values({ githubId, username: githubUsername, accessToken: token, role })
        }
      }
    } catch (dbErr) {
      console.warn('[Sandbox PAT] DB save skipped:', dbErr)
    }

    // Build response with session cookies
    const res = NextResponse.json({
      success: true,
      username: githubUsername,
      role,
      avatarUrl: userData.avatar_url,
      name: userData.name,
    })

    const cookieOpts = {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    }

    res.cookies.set('forke_access_token', token, { ...cookieOpts, httpOnly: true })
    res.cookies.set('forke_role', role, { ...cookieOpts, httpOnly: false })
    res.cookies.set('forke_username', githubUsername, { ...cookieOpts, httpOnly: false })

    return res
  } catch (err) {
    console.error('[Sandbox PAT] Error:', err)
    return NextResponse.json({ error: 'Server error validating token' }, { status: 500 })
  }
}
