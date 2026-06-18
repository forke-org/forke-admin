import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { developerForks, sandboxOwners, sandboxRepos, sandboxDevelopers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { username, sandboxRepo } = await request.json()

    if (!username || !sandboxRepo) {
      return NextResponse.json({ error: 'Missing required parameters: username, sandboxRepo' }, { status: 400 })
    }

    const repoName = sandboxRepo.split('/')[1] || sandboxRepo
    const forkUrl = `https://github.com/${username}/${repoName}`

    // 1. Grant Developer Access (Invite developer as collaborator using owner access token)
    try {
      // Find the specific owner token for this sandbox repo
      const sandboxRepoInfo = await db
        .select({
          accessToken: sandboxOwners.accessToken
        })
        .from(sandboxRepos)
        .innerJoin(sandboxOwners, eq(sandboxRepos.ownerId, sandboxOwners.id))
        .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))
        .limit(1)

      let ownerToken = sandboxRepoInfo[0]?.accessToken
      
      // Fallback to any active owner token in the database
      if (!ownerToken) {
        const fallbackOwner = await db
          .select({ accessToken: sandboxOwners.accessToken })
          .from(sandboxOwners)
          .limit(1)
        ownerToken = fallbackOwner[0]?.accessToken
      }

      if (ownerToken) {
        console.log(`Adding developer ${username} to private sandbox repo ${sandboxRepo}`)
        const addCollabResponse = await fetch(
          `https://api.github.com/repos/${sandboxRepo}/collaborators/${username}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${ownerToken}`,
              'User-Agent': 'Forke-Complete-Review-Engine/1.0',
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github+json',
            },
            body: JSON.stringify({
              permission: 'pull' // Grant read access so they can fork it
            })
          }
        )

        if (addCollabResponse.status === 201) {
          const invitationData = await addCollabResponse.json()
          const invitationId = invitationData.id

          // Retrieve developer's own access token
          const cookieStore = await cookies()
          let devToken = cookieStore.get('forke_access_token')?.value

          if (!devToken) {
            try {
              const devRecord = await db
                .select()
                .from(sandboxDevelopers)
                .where(eq(sandboxDevelopers.username, username))
                .limit(1)
              if (devRecord.length > 0) {
                devToken = devRecord[0].accessToken
              }
            } catch (dbErr) {
              console.error('Failed DB lookup for developer fork token:', dbErr)
            }
          }

          if (devToken && invitationId) {
            console.log(`Programmatically accepting invitation ${invitationId} for developer ${username}`)
            const acceptResponse = await fetch(
              `https://api.github.com/user/repository_invitations/${invitationId}`,
              {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${devToken}`,
                  'User-Agent': 'Forke-Complete-Review-Engine/1.0',
                  Accept: 'application/vnd.github+json',
                }
              }
            )

            if (acceptResponse.ok) {
              console.log(`Successfully auto-accepted repository invitation for developer ${username}`)
            } else {
              const acceptErr = await acceptResponse.json().catch(() => ({}))
              console.error('Failed to auto-accept invitation:', acceptErr)
            }
          }
        } else if (addCollabResponse.status === 204) {
          console.log(`Developer ${username} already has collaborator access to ${sandboxRepo}`)
        } else {
          const collabErr = await addCollabResponse.json().catch(() => ({}))
          console.error('GitHub collaborators API returned error:', collabErr)
        }
      }
    } catch (collabError) {
      console.error('Developer auto-collaboration logic encountered an error:', collabError)
    }

    // Check if record already exists in DB
    const existing = await db
      .select()
      .from(developerForks)
      .where(
        and(
          eq(developerForks.githubUsername, username),
          eq(developerForks.sandboxRepo, sandboxRepo)
        )
      )

    if (existing.length > 0) {
      await db
        .update(developerForks)
        .set({ forkUrl, createdAt: new Date() })
        .where(
          and(
            eq(developerForks.githubUsername, username),
            eq(developerForks.sandboxRepo, sandboxRepo)
          )
        )
    } else {
      await db.insert(developerForks).values({
        githubUsername: username,
        sandboxRepo,
        forkUrl
      })
    }

    // Return the standard GitHub fork page URL to open in a new tab
    const githubForkPage = `https://github.com/${sandboxRepo}/fork`

    return NextResponse.json({
      success: true,
      forkUrl,
      githubForkPage
    })
  } catch (error: any) {
    console.error('Developer fork register error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
