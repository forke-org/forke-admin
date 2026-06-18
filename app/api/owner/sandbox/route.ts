import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sandboxOwners, sandboxRepos, developerForks, sandboxDevelopers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// POST/PUT to configure/update sandbox metadata
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      sandboxId, 
      taskTitle, 
      taskDescription, 
      frontendStack, 
      backendStack, 
      allowedPaths, 
      restrictedPaths, 
      acceptanceCriteria 
    } = body

    if (!sandboxId) {
      return NextResponse.json({ error: 'Missing sandboxId parameter' }, { status: 400 })
    }

    await db
      .update(sandboxRepos)
      .set({
        taskTitle,
        taskDescription,
        frontendStack,
        backendStack,
        allowedPaths,
        restrictedPaths,
        acceptanceCriteria,
        verificationStatus: 'idle' // reset status on edit
      })
      .where(eq(sandboxRepos.id, sandboxId))

    return NextResponse.json({ success: true, sandboxId })
  } catch (error: any) {
    console.error('Configure sandbox error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  return POST(request)
}

// DELETE to delete sandbox repository and DB records
export async function DELETE(request: Request) {
  try {
    const { username, sandboxRepo, force } = await request.json()

    if (!username || !sandboxRepo) {
      return NextResponse.json({ error: 'Missing required parameters: username, sandboxRepo' }, { status: 400 })
    }

    const cookieStore = await cookies()
    let token = cookieStore.get('forke_access_token')?.value

    // 1. Fetch token for owner to delete organization repo
    const existing = await db
      .select()
      .from(sandboxOwners)
      .where(eq(sandboxOwners.username, username))

    if (existing.length > 0 && !token) {
      token = existing[0].accessToken
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub access token not found. Please log in again.' }, { status: 401 })
    }

    // 2. Query developer forks for this repository to clean them up
    const forks = await db
      .select()
      .from(developerForks)
      .where(eq(developerForks.sandboxRepo, sandboxRepo))

    const forkBasename = sandboxRepo.split('/')[1] || sandboxRepo
    const deletedForksInfo: { username: string; deletedOnGitHub: boolean; error?: string }[] = []

    // 3. For each fork: attempt GitHub deletion and delete from DB
    for (const fork of forks) {
      const devUsername = fork.githubUsername
      let deletedOnGitHub = false
      let errorMsg = ''

      try {
        let devToken: string | undefined

        const devRecord = await db
          .select()
          .from(sandboxDevelopers)
          .where(eq(sandboxDevelopers.username, devUsername))
          .limit(1)

        if (devRecord.length > 0 && devRecord[0].accessToken) {
          devToken = devRecord[0].accessToken
        } else {
          // Look up developer's OAuth token in sandboxOwners table as a fallback
          const devOwnerRecord = await db
            .select()
            .from(sandboxOwners)
            .where(eq(sandboxOwners.username, devUsername))
            .limit(1)

          if (devOwnerRecord.length > 0 && devOwnerRecord[0].accessToken) {
            devToken = devOwnerRecord[0].accessToken
          }
        }

        if (devToken) {
          // GitHub DELETE /repos/{owner}/{repo}
          const githubDeleteResponse = await fetch(
            `https://api.github.com/repos/${devUsername}/${forkBasename}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${devToken}`,
                'User-Agent': 'Forke-Complete-Review-Engine/1.0',
                Accept: 'application/vnd.github+json',
              }
            }
          )

          if (githubDeleteResponse.ok || githubDeleteResponse.status === 404) {
            deletedOnGitHub = true
          } else {
            const errData = await githubDeleteResponse.json().catch(() => ({}))
            errorMsg = errData.message || `HTTP ${githubDeleteResponse.status}`
          }
        } else {
          errorMsg = 'Developer OAuth token not stored in database'
        }
      } catch (err: any) {
        errorMsg = err.message || 'Unknown network error'
      }

      // Delete the fork record from database regardless of GitHub deletion outcome
      await db
        .delete(developerForks)
        .where(
          and(
            eq(developerForks.githubUsername, devUsername),
            eq(developerForks.sandboxRepo, sandboxRepo)
          )
        )

      deletedForksInfo.push({
        username: devUsername,
        deletedOnGitHub,
        ...(errorMsg && !deletedOnGitHub ? { error: errorMsg } : {})
      })
    }

    // 4. Delete sandbox repository from GitHub
    let sandboxDeletedOnGitHub = false
    let sandboxDeleteError = ''
    try {
      const sandboxDeleteResponse = await fetch(
        `https://api.github.com/repos/${sandboxRepo}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Forke-Complete-Review-Engine/1.0',
            Accept: 'application/vnd.github+json',
          }
        }
      )

      if (sandboxDeleteResponse.ok || sandboxDeleteResponse.status === 404) {
        sandboxDeletedOnGitHub = true
      } else {
        const errData = await sandboxDeleteResponse.json().catch(() => ({}))
        sandboxDeleteError = errData.message || `HTTP ${sandboxDeleteResponse.status}`
      }
    } catch (err: any) {
      sandboxDeleteError = err.message || 'Unknown network error'
    }

    // 5. Delete sandbox repository record from DB
    if (!sandboxDeletedOnGitHub && !force) {
      return NextResponse.json({
        success: false,
        error: `Failed to clean up repository on GitHub: ${sandboxDeleteError || 'Unknown API issue'}.`,
        sandboxDeleteError,
        deletedForks: deletedForksInfo
      }, { status: 400 })
    }

    await db
      .delete(sandboxRepos)
      .where(eq(sandboxRepos.sandboxRepo, sandboxRepo))

    return NextResponse.json({
      success: true,
      sandboxRepo,
      sandboxDeletedOnGitHub,
      sandboxDeleteError,
      deletedForks: deletedForksInfo
    })
  } catch (error: any) {
    console.error('Delete sandbox error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
