import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sandboxOwners, sandboxDevelopers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const role = searchParams.get('state') || 'developer'

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=No code received from GitHub', request.url)
    )
  }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  const redirectUri = process.env.GITHUB_REDIRECT_URI

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
      return NextResponse.redirect(
        new URL(
          `/?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
          request.url
        )
      )
    }

    const accessToken = tokenData.access_token

    // 2. Fetch user information from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
      },
    })

    const userData = await userResponse.json()

    if (!userData.login) {
      return NextResponse.redirect(
        new URL('/?error=Failed to retrieve GitHub user details', request.url)
      )
    }

    const githubUsername = userData.login
    const githubId = userData.id

    let dbSaved = false

    // 3. Save to database depending on role
    if (role === 'owner') {
      const existingOwners = await db
        .select()
        .from(sandboxOwners)
        .where(eq(sandboxOwners.githubId, githubId))

      if (existingOwners.length > 0) {
        await db
          .update(sandboxOwners)
          .set({
            username: githubUsername,
            accessToken,
          })
          .where(eq(sandboxOwners.githubId, githubId))
      } else {
        await db.insert(sandboxOwners).values({
          githubId,
          username: githubUsername,
          accessToken,
        })
      }
      dbSaved = true
    } else if (role === 'developer') {
      const existingDevelopers = await db
        .select()
        .from(sandboxDevelopers)
        .where(eq(sandboxDevelopers.githubId, githubId))

      if (existingDevelopers.length > 0) {
        await db
          .update(sandboxDevelopers)
          .set({
            username: githubUsername,
            accessToken,
          })
          .where(eq(sandboxDevelopers.githubId, githubId))
      } else {
        await db.insert(sandboxDevelopers).values({
          githubId,
          username: githubUsername,
          accessToken,
        })
      }
      dbSaved = true
    }

    // Redirect to respective page with success status
    const targetUrl = new URL(role === 'owner' ? '/post-task' : '/dashboard', request.url)
    targetUrl.searchParams.set('success', 'true')
    targetUrl.searchParams.set('github_id', githubUsername)
    targetUrl.searchParams.set('role', role)
    if (role === 'owner' || role === 'developer') {
      targetUrl.searchParams.set('db_saved', dbSaved ? 'true' : 'false')
    }

    const response = NextResponse.redirect(targetUrl)
    
    // Set HTTP-only and generic authentication cookies
    response.cookies.set('forke_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })
    response.cookies.set('forke_role', role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    response.cookies.set('forke_username', githubUsername, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    console.error('OAuth Callback Error:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown authentication error'
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
