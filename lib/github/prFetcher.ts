/**
 * GitHub PR Data Fetcher
 * Fetches PR metadata, changed files, and git diff from GitHub REST API.
 * Uses native fetch — no Octokit dependency needed.
 */

export interface PRFileSummary {
  filename: string
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  additions: number
  deletions: number
  patch?: string // unified diff for this file
}

export interface PRMetadata {
  number: number
  title: string
  body: string
  state: string
  head: { sha: string; ref: string; label: string }
  base: { sha: string; ref: string; label: string }
  user: { login: string }
  html_url: string
  created_at: string
}

/**
 * Fetches the PR metadata from GitHub API.
 */
export async function fetchPRMetadata(
  repoFullName: string,
  prNumber: number,
  accessToken: string
): Promise<PRMetadata> {
  const url = `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`
  const response = await fetchGitHub(url, accessToken)
  return response as PRMetadata
}

/**
 * Fetches the list of changed files + their patches for a given PR.
 * GitHub paginates this at 30 per page; we fetch up to page 3 (90 files max).
 */
export async function fetchPRFiles(
  repoFullName: string,
  prNumber: number,
  accessToken: string
): Promise<PRFileSummary[]> {
  const files: PRFileSummary[] = []

  for (let page = 1; page <= 3; page++) {
    const url = `https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=30&page=${page}`
    const pageFiles = (await fetchGitHub(url, accessToken)) as PRFileSummary[]

    if (!Array.isArray(pageFiles) || pageFiles.length === 0) break
    files.push(...pageFiles)

    if (pageFiles.length < 30) break // last page
  }

  return files
}

/**
 * Builds a combined git diff string from the PR file patches.
 * Limits total size to avoid token overflow.
 */
export function buildGitDiff(files: PRFileSummary[], maxChars = 50000): string {
  let diff = ''

  for (const file of files) {
    if (!file.patch) continue

    const header = `\n--- a/${file.filename}\n+++ b/${file.filename}\n`
    const entry = header + file.patch + '\n'

    if (diff.length + entry.length > maxChars) {
      diff += `\n\n[... remaining ${files.length} files truncated due to size limits ...]`
      break
    }

    diff += entry
  }

  return diff || '(no diff patches available)'
}

/**
 * Fetches a simple directory structure of the repo (tree, top 2 levels).
 * Used for topological context in the AI prompt.
 */
export async function fetchRepoTree(
  repoFullName: string,
  sha: string,
  accessToken: string
): Promise<string> {
  try {
    const url = `https://api.github.com/repos/${repoFullName}/git/trees/${sha}?recursive=1`
    const data = await fetchGitHub(url, accessToken) as {
      tree: Array<{ path: string; type: string }>
      truncated: boolean
    }

    if (!data.tree) return ''

    // Filter to meaningful paths only (exclude deep node_modules, .git, build artifacts)
    const paths = data.tree
      .filter(item => {
        const p = item.path
        return !p.startsWith('node_modules/') &&
               !p.startsWith('.next/') &&
               !p.startsWith('dist/') &&
               !p.startsWith('build/') &&
               !p.startsWith('.git/')
      })
      .slice(0, 200) // cap at 200 entries
      .map(item => item.path)

    return paths.join('\n')
  } catch {
    return '' // non-critical, just skip if unavailable
  }
}

/**
 * Core GitHub API fetch with auth header and error handling.
 */
async function fetchGitHub(url: string, accessToken: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Forke-Complete-Review-Engine/1.0',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GitHub API error ${response.status}: ${body}`)
  }

  return response.json()
}
