import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sandboxOwners } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')
  const org = searchParams.get('org')

  const cookieStore = await cookies()
  let token = cookieStore.get('forke_access_token')?.value

  if (!token && username) {
    try {
      const existing = await db
        .select()
        .from(sandboxOwners)
        .where(eq(sandboxOwners.username, username))
      if (existing.length > 0) {
        token = existing[0].accessToken
      }
    } catch (dbError) {
      console.error('Failed to query database for owner token:', dbError)
    }
  }

  // Auto-heal if token is present in cookie but owner is not registered in the database
  if (token && username) {
    try {
      const existing = await db
        .select()
        .from(sandboxOwners)
        .where(eq(sandboxOwners.username, username))
      if (existing.length === 0) {
        const userRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Forke-Sandbox-AutoHeal/1.0',
            Accept: 'application/vnd.github+json',
          },
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          if (userData && userData.id && userData.login && userData.login.toLowerCase() === username.toLowerCase()) {
            await db
              .insert(sandboxOwners)
              .values({
                githubId: userData.id,
                username: userData.login,
                accessToken: token,
              })
          }
        }
      }
    } catch (dbError) {
      console.error('Failed to auto-heal owner in repos fetch:', dbError)
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'GitHub access token not found. Please log in again.' }, { status: 401 })
  }

  try {
    // 1. Fetch user organizations
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
        Accept: 'application/vnd.github+json',
      },
    })
    const orgs = await orgsResponse.json()

    // 2. Fetch repos based on selected scope
    let reposUrl = 'https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member'
    if (org && org !== 'personal') {
      reposUrl = `https://api.github.com/orgs/${org}/repos?per_page=100`
    }

    const reposResponse = await fetch(reposUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'Forke-Complete-Review-Engine/1.0',
        Accept: 'application/vnd.github+json',
      },
    })
    let repos = await reposResponse.json()

    if (repos.error || orgs.error) {
      return NextResponse.json({
        error: repos.message || orgs.message || 'Error fetching details from GitHub'
      }, { status: 400 })
    }

    // 3. Filter repositories strictly by selected scope owner
    if (Array.isArray(repos)) {
      if (org && org !== 'personal') {
        repos = repos.filter(
          (repo: any) => repo.owner && repo.owner.login.toLowerCase() === org.toLowerCase()
        )
      } else if (username) {
        repos = repos.filter(
          (repo: any) => repo.owner && repo.owner.login.toLowerCase() === username.toLowerCase()
        )
      }
    }

    return NextResponse.json({
      repos: Array.isArray(repos) ? repos : [],
      organizations: Array.isArray(orgs) ? orgs : []
    })
  } catch (err: any) {
    console.error('Owner repos fetch error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
