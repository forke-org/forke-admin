/**
 * GET /api/owner/repo-tree?username=X&repo=owner/repo
 *
 * Returns a recursive flat list of file/folder paths for the given repo
 * using the GitHub Git Trees API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sandboxOwners } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')
  const repo = searchParams.get('repo') // e.g. "owner/repo-name"

  if (!username || !repo) {
    return NextResponse.json({ error: 'Missing username or repo parameter' }, { status: 400 })
  }

  // Get token from DB
  let token: string | undefined
  try {
    const rows = await db
      .select()
      .from(sandboxOwners)
      .where(eq(sandboxOwners.username, username))
      .limit(1)
    if (rows.length > 0) token = rows[0].accessToken
  } catch {
    // fall through — will 401 below
  }

  if (!token) {
    return NextResponse.json({ error: 'GitHub token not found. Please log in again.' }, { status: 401 })
  }

  try {
    // 1. Get default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Forke-Sandbox/1.0',
      },
    })
    if (!repoRes.ok) {
      const err = await repoRes.json()
      return NextResponse.json({ error: err.message || 'Failed to fetch repo info' }, { status: repoRes.status })
    }
    const repoData = await repoRes.json()
    const defaultBranch: string = repoData.default_branch || 'main'

    // 2. Get full recursive tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Forke-Sandbox/1.0',
        },
      }
    )
    if (!treeRes.ok) {
      const err = await treeRes.json()
      return NextResponse.json({ error: err.message || 'Failed to fetch tree' }, { status: treeRes.status })
    }
    const treeData = await treeRes.json()

    // 3. Filter out .git internals, return paths with type (blob=file, tree=dir)
    const SKIP = new Set([
      'node_modules', '.next', '.git', '__pycache__', '.venv', 'venv',
      'dist', 'build', 'out', '.cache', 'coverage', '.nyc_output',
    ])

    const items: { path: string; type: 'file' | 'dir' }[] = (treeData.tree || [])
      .filter((node: any) => {
        const topLevel = node.path.split('/')[0]
        return !SKIP.has(topLevel)
      })
      .map((node: any) => ({
        path: node.path as string,
        type: node.type === 'tree' ? 'dir' : 'file',
      }))

    return NextResponse.json({ items, branch: defaultBranch, truncated: treeData.truncated ?? false })
  } catch (err: any) {
    console.error('[repo-tree] Error:', err)
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
  }
}
