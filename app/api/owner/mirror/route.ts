import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { sandboxOwners, sandboxRepos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { activeJobs } from '@/lib/jobs'
import { runMirrorJob } from '@/lib/github/mirror'

export async function POST(request: Request) {
  try {
    const { 
      username, 
      sourceRepo, 
      targetOrg,
      taskTitle,
      taskDescription,
      frontendStack,
      backendStack,
      allowedPaths,
      restrictedPaths,
      acceptanceCriteria
    } = await request.json()

    if (!username || !sourceRepo || !targetOrg) {
      return NextResponse.json({ error: 'Missing required parameters: username, sourceRepo, targetOrg' }, { status: 400 })
    }

    const cookieStore = await cookies()
    let token = cookieStore.get('forke_access_token')?.value

    let ownerId: string | null = null

    // 1. Fetch token & database ID for owner
    const existing = await db
      .select()
      .from(sandboxOwners)
      .where(eq(sandboxOwners.username, username))

    if (existing.length > 0) {
      ownerId = existing[0].id
      if (!token) {
        token = existing[0].accessToken
      }
    }

    if (!token) {
      return NextResponse.json({ error: 'GitHub access token not found. Please log in again.' }, { status: 401 })
    }

    if (!ownerId) {
      return NextResponse.json({ error: 'Owner record not found in database.' }, { status: 404 })
    }

    // 2. Determine target space (defaults to targetOrg or always forke-sandbox)
    const targetSpace = 'forke-sandbox'

    // 3. Extract repository base name and generate target name
    const repoBasename = sourceRepo.split('/')[1] || sourceRepo
    let targetRepoName = `sandbox-${repoBasename}`

    // Let's query existing mirrored repos to find conflicts and avoid duplicate creations
    const existingMirrors = await db.select().from(sandboxRepos)
    const existingNames = new Set(existingMirrors.map(m => m.sandboxRepo.toLowerCase()))

    let count = 1
    let uniqueTargetRepoName = targetRepoName
    while (existingNames.has(`${targetSpace}/${uniqueTargetRepoName}`.toLowerCase())) {
      uniqueTargetRepoName = `${targetRepoName}-${count}`
      count++
    }

    targetRepoName = uniqueTargetRepoName
    const fullTargetRepoPath = `${targetSpace}/${targetRepoName}`

    // 4. Initialize job in memory
    const jobId = `${username}-${repoBasename}-${Date.now()}`
    
    activeJobs.set(jobId, {
      id: jobId,
      status: 'running',
      progress: 0,
      logs: ['[INIT] Mirrored workspace setup queued.']
    })

    // Start background mirroring process
    runMirrorJob({
      jobId,
      token,
      ownerId,
      sourceRepo,
      targetSpace,
      targetRepoName,
      taskTitle,
      taskDescription,
      frontendStack,
      backendStack,
      allowedPaths,
      restrictedPaths,
      acceptanceCriteria
    }).catch(err => {
      console.error(`[MirrorRoute] Background mirror job failed for ${jobId}:`, err)
    })

    return NextResponse.json({ jobId, sandboxRepo: fullTargetRepoPath })
  } catch (error: any) {
    console.error('Mirror pipeline trigger error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
