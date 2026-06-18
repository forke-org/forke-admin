import fs from 'fs'
import path from 'path'

/**
 * Converts a glob pattern to a RegExp.
 * Handles:
 *   - Exact match: `src/components/Navbar.tsx`
 *   - Directory glob: `src/components/` → matches everything under it
 *   - Wildcard: `src/components/*` → matches direct children
 *   - Recursive: `src/components/**` → matches all descendants
 *   - Extension: `*.css` → matches any CSS file in root
 */
function globToRegex(pattern: string): RegExp {
  let normalized = pattern
  if (normalized.endsWith('/')) {
    normalized = normalized + '**'
  }

  let regexStr = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special characters
    .replace(/\\\*/g, '__STAR__') // temporarily protect escaped stars
    .replace(/\*\*/g, '__DOUBLE_STAR__') // mark ** before converting *
    .replace(/\*/g, '[^/]+') // single * = match one path segment (no slashes)
    .replace(/__DOUBLE_STAR__/g, '.*') // ** = match anything including slashes
    .replace(/__STAR__/g, '\\*') // restore escaped stars

  return new RegExp(`^${regexStr}$`)
}

/**
 * Validates whether changed files are within the allowed paths.
 * If no allowed paths are defined, everything is allowed by default.
 *
 * @param changedFiles - List of file paths changed in the PR
 * @param allowedPaths - List of glob patterns the developer is allowed to modify
 * @returns Array of unauthorized file paths (empty = all good)
 */
export function validateFileBoundaries(
  changedFiles: string[],
  allowedPaths: string[] | null | undefined
): string[] {
  if (!allowedPaths || allowedPaths.length === 0) {
    return []
  }

  const patterns = allowedPaths
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => globToRegex(p))

  const unauthorizedFiles: string[] = []

  for (const file of changedFiles) {
    // Exclude metadata/informational files like FORKE_SUBMISSION.md from being marked unauthorized
    if (file === 'FORKE_SUBMISSION.md') {
      continue
    }

    const isAllowed = patterns.some(pattern => pattern.test(file))
    if (!isAllowed) {
      unauthorizedFiles.push(file)
    }
  }

  return unauthorizedFiles
}

/**
 * Parses a raw allowed-paths string from the DB (newline or comma-separated)
 * into a clean array of glob patterns.
 */
export function parsePathList(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,]/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
}

/**
 * Scans a file or string for hardcoded secrets/credentials.
 */
export interface SecretFinding {
  line: number
  type: string
  pattern: string
}

export function scanForSecrets(content: string): SecretFinding[] {
  const rules = [
    { type: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
    { type: 'AWS Secret Access Key', regex: /[^A-Za-z0-9/+=]([A-Za-z0-9/+=]{40})[^A-Za-z0-9/+=]/g }, // generic but useful
    { type: 'GitHub Personal Access Token', regex: /gh[opru]_[a-zA-Z0-9]{36,255}/g },
    { type: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{20}T3BlbkFJ[a-zA-Z0-9]{20}/g },
    { type: 'Generic API/Secret Key', regex: /(?:secret|passwd|password|api_key|apikey|private_key|token)\s*[:=]\s*["']([a-zA-Z0-9\-_{}]{16,})["']/gi },
    { type: 'Private Key Block', regex: /-----BEGIN\s+([A-Z\s]+)\s+PRIVATE\s+KEY-----/g }
  ]

  const findings: SecretFinding[] = []
  const lines = content.split('\n')

  for (let idx = 0; idx < lines.length; idx++) {
    const lineContent = lines[idx]
    
    // Skip if it looks like environment variable template placeholder
    if (lineContent.includes('your_') || lineContent.includes('<your-')) {
      continue
    }

    for (const rule of rules) {
      rule.regex.lastIndex = 0 // Reset regex state
      const matches = lineContent.match(rule.regex)
      if (matches) {
        for (const match of matches) {
          findings.push({
            line: idx + 1,
            type: rule.type,
            pattern: match.substring(0, Math.min(10, match.length)) + '...'
          })
        }
      }
    }
  }

  return findings
}

/**
 * Scans all modified files inside the checkout directory for secrets.
 */
export async function scanPRSecrets(
  checkoutDir: string,
  changedFiles: string[]
): Promise<Array<{ file: string; line: number; type: string }>> {
  const results: Array<{ file: string; line: number; type: string }> = []

  for (const relPath of changedFiles) {
    const fullPath = path.join(checkoutDir, relPath)
    if (!fs.existsSync(fullPath)) continue
    
    try {
      const stats = fs.statSync(fullPath)
      if (!stats.isFile()) continue
      
      // Skip binary or massive files
      if (stats.size > 1024 * 1024) continue 

      const content = fs.readFileSync(fullPath, 'utf8')
      const secrets = scanForSecrets(content)
      for (const s of secrets) {
        results.push({
          file: relPath,
          line: s.line,
          type: s.type
        })
      }
    } catch (e) {
      console.error(`[ScopeValidator] Failed to scan file ${relPath} for secrets:`, e)
    }
  }

  return results
}

/**
 * Checks if the developer modified any package dependency/manifest files.
 */
export function checkDependencyChanges(changedFiles: string[]): string[] {
  const manifestFiles = [
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'requirements.txt',
    'Pipfile',
    'Pipfile.lock',
    'go.mod',
    'go.sum',
    'Cargo.toml',
    'Cargo.lock',
    'Gemfile',
    'Gemfile.lock'
  ]

  return changedFiles.filter(file => {
    const base = path.basename(file)
    return manifestFiles.includes(base)
  })
}

/**
 * Checks if FORKE_SUBMISSION.md exists in checkoutDir, and is non-empty.
 */
export interface SubmissionValidation {
  exists: boolean
  valid: boolean
  content?: string
  error?: string
}

export function validateForkeSubmission(checkoutDir: string): SubmissionValidation {
  const targetPath = path.join(checkoutDir, 'FORKE_SUBMISSION.md')
  if (!fs.existsSync(targetPath)) {
    return { exists: false, valid: false, error: 'FORKE_SUBMISSION.md is missing from the repository root.' }
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf8').trim()
    if (content.length < 50) {
      return { exists: true, valid: false, content, error: 'FORKE_SUBMISSION.md is too short or empty.' }
    }
    return { exists: true, valid: true, content }
  } catch (e: any) {
    return { exists: true, valid: false, error: `Could not read FORKE_SUBMISSION.md: ${e.message}` }
  }
}
