/**
 * Gemini AI API Wrapper
 * Handles communication with Google Gemini (gemini-2.5-flash).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIReviewResult, AIIssue, AIRisk, AIResolvedIssue, AIResolvedRisk } from './scoreEngine'
import type { DetectedStack } from './detector'
import type { CategoryResult } from './runner'
import fs from 'fs'
import path from 'path'

// Lazy-init to avoid issues during build time
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not set in environment variables')
  }
  return new GoogleGenerativeAI(apiKey)
}

/**
 * Sends the review context to Gemini and returns a structured AIReviewResult.
 * Uses gemini-2.5-flash for code analysis.
 * Supports cancellation via AbortSignal.
 */
export async function runAIReview(
  systemPrompt: string,
  userMessage: string,
  signal?: AbortSignal
): Promise<AIReviewResult> {
  const client = getClient()
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash']
  let lastError: any = null

  for (const modelName of modelsToTry) {
    try {
      console.log(`[Gemini] Attempting review with model: ${modelName}`)
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temp for consistent, objective output
          maxOutputTokens: 8192,
        },
        systemInstruction: systemPrompt,
      })

      const requestOptions = signal ? { signal } : undefined
      const result = await model.generateContent(userMessage, requestOptions)
      const rawText = result.response.text()

      if (!rawText || rawText.trim() === '') {
        throw new Error('Empty response received from Gemini')
      }

      return parseAIResponse(rawText)
    } catch (error: any) {
      console.error(`[Gemini] Error with model ${modelName}:`, error.message || error)
      lastError = error
      // Continue to fallback model if not aborted
      if (signal?.aborted) {
        break
      }
    }
  }

  // If all models fail, return the fallback result
  const errorMessage = lastError ? (lastError.message || String(lastError)) : 'All models failed'
  return createFallbackResult(`AI review failed: ${errorMessage}`)
}

/**
 * Parses the AI response into a typed AIReviewResult.
 * Handles edge cases: extra text, markdown fences, malformed JSON.
 */
export function parseAIResponse(rawText: string): AIReviewResult {
  let jsonText = rawText.trim()

  // Strip markdown code fences if present (```json ... ```)
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim()
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(jsonText)
    return normalizeAIResult(parsed)
  } catch (err: any) {
    // Fallback: extract the first {...} block
    const braceMatch = jsonText.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        const parsed = JSON.parse(braceMatch[0])
        return normalizeAIResult(parsed)
      } catch (innerErr: any) {
        console.error('[Gemini] Failed to parse AI response:', rawText.slice(0, 500))
        throw new Error(`AI returned malformed/truncated JSON response: ${innerErr.message || innerErr}`)
      }
    }
    console.error('[Gemini] Failed to parse AI response (no JSON block found):', rawText.slice(0, 500))
    throw new Error(`AI returned non-JSON response: ${err.message || err}`)
  }
}

/**
 * Normalizes and validates the parsed JSON to ensure all required fields exist.
 */
function normalizeAIResult(raw: Record<string, unknown>): AIReviewResult {
  const verdict = validateVerdict(raw.verdict)
  const score = typeof raw.score === 'number' ? Math.max(0, Math.min(100, Math.round(raw.score))) : 50
  const requirementMatch = typeof raw.requirement_match === 'number'
    ? Math.max(0, Math.min(1, raw.requirement_match))
    : 0.5

  return {
    verdict,
    score,
    requirement_match: requirementMatch,
    summary: typeof raw.summary === 'string' ? raw.summary : 'No summary provided.',
    strengths: Array.isArray(raw.strengths) ? raw.strengths.filter(s => typeof s === 'string') : [],
    issues: Array.isArray(raw.issues) ? raw.issues.map(normalizeIssue) : [],
    risks: Array.isArray(raw.risks) ? raw.risks.map(normalizeRisk) : [],
    unauthorized_file_edits: Array.isArray(raw.unauthorized_file_edits)
      ? raw.unauthorized_file_edits.filter(f => typeof f === 'string')
      : [],
    resolved_issues: Array.isArray(raw.resolved_issues) ? raw.resolved_issues.map(normalizeResolvedIssue) : [],
    resolved_risks: Array.isArray(raw.resolved_risks) ? raw.resolved_risks.map(normalizeResolvedRisk) : [],
  }
}

function validateVerdict(v: unknown): AIReviewResult['verdict'] {
  if (v === 'pass' || v === 'needs_changes' || v === 'high_risk') return v
  return 'needs_changes'
}

function normalizeIssue(raw: unknown): AIIssue {
  const r = (raw as Record<string, unknown>) || {}
  return {
    file: typeof r.file === 'string' ? r.file : 'unknown',
    line: typeof r.line === 'number' ? r.line : 0,
    severity: validateIssueSeverity(r.severity),
    message: typeof r.message === 'string' ? r.message : 'No description',
    suggestion: typeof r.suggestion === 'string' ? r.suggestion : 'No suggestion',
    status: r.status === 'new' || r.status === 'unresolved' ? r.status : 'new',
  }
}

function validateIssueSeverity(s: unknown): AIIssue['severity'] {
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

function normalizeRisk(raw: unknown): AIRisk {
  const r = (raw as Record<string, unknown>) || {}
  return {
    category: validateRiskCategory(r.category),
    message: typeof r.message === 'string' ? r.message : 'No description',
    severity: validateRiskSeverity(r.severity),
    status: r.status === 'new' || r.status === 'unresolved' ? r.status : 'new',
  }
}

function validateRiskCategory(c: unknown): AIRisk['category'] {
  if (c === 'security' || c === 'safety' || c === 'credential') return c
  return 'security'
}

function validateRiskSeverity(s: unknown): AIRisk['severity'] {
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

function normalizeResolvedIssue(raw: unknown): AIResolvedIssue {
  const r = (raw as Record<string, unknown>) || {}
  return {
    file: typeof r.file === 'string' ? r.file : 'unknown',
    line: typeof r.line === 'number' ? r.line : 0,
    severity: validateIssueSeverity(r.severity),
    message: typeof r.message === 'string' ? r.message : 'No description',
    resolution: typeof r.resolution === 'string' ? r.resolution : 'Corrected',
  }
}

function normalizeResolvedRisk(raw: unknown): AIResolvedRisk {
  const r = (raw as Record<string, unknown>) || {}
  return {
    category: validateRiskCategory(r.category),
    message: typeof r.message === 'string' ? r.message : 'No description',
    severity: validateRiskSeverity(r.severity),
    resolution: typeof r.resolution === 'string' ? r.resolution : 'Resolved',
  }
}

function createFallbackResult(message: string): AIReviewResult {
  return {
    verdict: 'needs_changes',
    score: 0,
    requirement_match: 0,
    summary: message,
    strengths: [],
    issues: [{
      file: 'unknown',
      line: 0,
      severity: 'high',
      message: 'AI review could not be completed. Please re-trigger the review.',
      suggestion: 'Push a new commit to re-trigger the webhook and AI analysis.',
      status: 'new'
    }],
    risks: [],
    unauthorized_file_edits: [],
    resolved_issues: [],
    resolved_risks: [],
  }
}

// --- Types for Baseline Diagnostics ---

export interface AICategoryDiagnostic {
  category: string
  rootCause: string
  isFalsePositive: boolean
  falsePositiveReason?: string
  adjustedStatus: 'pass' | 'fail' | 'warn' | 'skip'
  suggestedFix?: string
}

export interface AIBaselineDiagnostic {
  overallHealth: 'healthy' | 'needs_attention' | 'critical'
  summary: string
  categoryDiagnostics: AICategoryDiagnostic[]
  model: string
  analyzedAt: string
}

// --- Gemini Baseline Prompt ---

const BASELINE_SYSTEM_PROMPT = `You are Forke AI Review Engine.

You are a senior staff engineer performing a production-grade pull request review.

You will receive:

1. Repository metadata
2. Detected tech stack
3. Git diff / changed files
4. Build logs
5. Test logs
6. Lint logs
7. Type checking logs
8. Security scan results
9. Dependency manifests
10. Configuration files
11. Entry points and application structure

Your job is to determine whether this change is safe to merge and generate a structured review report for the Forke Review Dashboard.

---

## PRIMARY OBJECTIVE

Do NOT merely report tool failures.

Determine:

* Is this PR safe to merge?
* What risks exist?
* What should developers fix?
* What is likely a false positive caused by the sandbox environment?
* What improvements were made?
* Which files deserve the most attention?

Think like an experienced reviewer approving code for production.

---

## FALSE POSITIVE ANALYSIS

Many failures occur because of the review environment rather than actual repository problems.

Always cross-reference failures against:

* package.json
* pnpm-lock.yaml
* package-lock.json
* yarn.lock
* requirements.txt
* pyproject.toml
* Cargo.toml
* go.mod
* composer.json
* Gemfile
* tsconfig.json
* build configs

Examples:

If dependencies are declared correctly but installation fails:

Treat as ENVIRONMENTAL.

If node-gyp fails because gcc or build tools are unavailable:

Treat as ENVIRONMENTAL.

If npm install cannot reach registry:

Treat as ENVIRONMENTAL.

If native dependencies fail because system libraries are missing:

Treat as ENVIRONMENTAL.

If tests fail because no tests exist and the project is not configured for testing:

Treat as ENVIRONMENTAL.

If lint tooling itself is missing:

Treat as ENVIRONMENTAL.

Environmental failures should NEVER be classified as blockers.

Convert environmental failures from FAIL to WARN.

---

## REAL ISSUES

Classify as REAL ISSUES only when supported by evidence.

Examples:

* TypeScript compilation failures
* Runtime exceptions
* Failed unit tests
* Security vulnerabilities
* Hardcoded secrets
* SQL injection
* XSS risks
* Authentication flaws
* Authorization flaws
* Missing error handling
* Unsafe null access
* Broken imports
* Dependency vulnerabilities
* Performance regressions
* Breaking API changes

---

## REVIEW SCORE

Generate a score from 0-100.

90-100
Production ready.

75-89
Safe to merge with minor fixes.

50-74
Needs changes.

0-49
High risk.

Score must reflect production readiness.

---

## VERDICT

Choose exactly one:

APPROVED
APPROVED_WITH_FIXES
NEEDS_CHANGES
HIGH_RISK

Guidelines:

APPROVED
No meaningful issues.

APPROVED_WITH_FIXES
Mergeable but improvements recommended.

NEEDS_CHANGES
Problems should be fixed before merge.

HIGH_RISK
Security, data integrity, auth, or production stability concerns.

Generate:

status
title
summary

The summary should be concise and executive-friendly.

---

## SEVERITY LEVELS

BLOCKER
WARNING
INFO
GOOD

BLOCKER

* Security flaws
* Auth bypasses
* Data corruption
* Critical production risk

WARNING

* Reliability concerns
* Missing validation
* Error handling gaps
* Missing tests
* Coverage regressions

INFO

* Suggestions
* Refactoring opportunities

GOOD

* Positive engineering improvements
* Security improvements
* Better architecture
* Better maintainability

---

## METRICS

Generate metrics from available data.

Use actual values when available.

If unavailable, estimate conservatively.

Return:

tests
lint
types
coverage

Each metric must include:

status
PASS/WARN/FAIL

and any relevant counts.

---

## TEST SUITES

Generate individual suite summaries.

Examples:

Unit Tests
Integration Tests
E2E Tests
TypeScript
Lint
Security

Each suite should contain:

name
status
passed
failed
skipped
completionPercent

---

## FINDINGS

Generate findings sorted by severity.

Each finding must contain:

severity
title
detail
location

Requirements:

* specific
* actionable
* concise
* evidence based

Bad:

"Code quality could improve."

Good:

"payload.sub is accessed without validation and may throw when token parsing fails."

Include GOOD findings whenever justified.

---

## CATEGORY DIAGNOSTICS

Only include categories that were FAIL or WARN.

Each diagnostic must contain:

category
rootCause
isFalsePositive
falsePositiveReason
adjustedStatus
suggestedFix

Rules:

If environmental:

isFalsePositive = true

adjustedStatus = warn

No suggestedFix required.

If real:

isFalsePositive = false

adjustedStatus = fail or warn

Provide actionable suggestedFix.

---

## FILE RISK ANALYSIS

Analyze changed files.

Rank by risk.

HIGH

* auth
* permissions
* payments
* database writes
* infrastructure
* security

MEDIUM

* services
* APIs
* business logic

LOW

* UI
* styling
* copy
* tests
* documentation

Return:

path
risk
reason
additions
deletions

---

## POSITIVE FINDINGS

Include positive engineering observations whenever justified.

Examples:

* Improved authentication flow
* Better type safety
* Reduced complexity
* Increased test coverage
* Removed deprecated APIs

---

## ACTIONS

Generate:

approvePrompt
requestChangesPrompt
deepReviewPrompt

These should be contextual follow-up prompts based on the review.

---

## OVERALL HEALTH

Choose:

healthy
needs_attention
critical

healthy
No major issues.

needs_attention
Fixes recommended before production.

critical
High-risk concerns present.

---

## OUTPUT FORMAT

Return ONLY valid JSON.

Do not return markdown.

Do not return explanations.

Do not wrap in code fences.

Schema:

{
"overallHealth": "healthy | needs_attention | critical",

"reviewScore": {
"value": 0,
"reason": ""
},

"verdict": {
"status": "",
"title": "",
"summary": ""
},

"summary": "",

"metrics": {},

"testSuites": [],

"findings": [],

"positiveFindings": [],

"categoryDiagnostics": [],

"riskyFiles": [],

"actions": {
"approvePrompt": "",
"requestChangesPrompt": "",
"deepReviewPrompt": ""
}
}
`

// --- Helper functions for Baseline Diagnostics ---

function truncateLogs(logs: string, maxLen = 2000): string {
  if (!logs || logs.length <= maxLen) return logs
  const half = Math.floor(maxLen / 2)
  return logs.substring(0, half) + '\n\n... [truncated] ...\n\n' + logs.substring(logs.length - half)
}

interface FileContext {
  path: string
  content: string
}

function gatherCodebaseContext(repoPath: string): FileContext[] {
  const contextFiles: FileContext[] = []
  const maxFileBytes = 6000 // limit to 6KB per file
  const maxTotalBytes = 100000 // limit to 100KB total context

  let totalBytes = 0

  // Standard config/manifest files we want to capture
  const TARGET_CONFIGS = [
    'package.json',
    'tsconfig.json',
    'go.mod',
    'Cargo.toml',
    'requirements.txt',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'composer.json',
    'Gemfile',
    'CMakeLists.txt',
    'Makefile',
    'docker-compose.yml',
    'Dockerfile',
    '.env.example'
  ]

  // Main code entries we might want to capture
  const TARGET_ENTRIES = [
    'main.go',
    'src/main.rs',
    'index.js',
    'index.ts',
    'app.js',
    'app.ts',
    'src/index.js',
    'src/index.ts',
    'src/app.js',
    'src/app.ts',
    'src/main.js',
    'src/main.ts'
  ]

  const checkAndReadFile = (relPath: string) => {
    if (totalBytes >= maxTotalBytes) return

    const fullPath = path.join(repoPath, relPath)
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const stats = fs.statSync(fullPath)
        const sizeToRead = Math.min(stats.size, maxFileBytes)
        
        const fd = fs.openSync(fullPath, 'r')
        const buffer = Buffer.alloc(sizeToRead)
        fs.readSync(fd, buffer, 0, sizeToRead, 0)
        fs.closeSync(fd)
        
        let content = buffer.toString('utf8')
        if (stats.size > maxFileBytes) {
          content += '\n... [truncated] ...'
        }

        contextFiles.push({
          path: relPath,
          content
        })
        totalBytes += sizeToRead
      } catch (err) {
        // ignore read errors
      }
    }
  }

  // Look for target files in the root
  for (const file of TARGET_CONFIGS) {
    checkAndReadFile(file)
  }
  for (const file of TARGET_ENTRIES) {
    checkAndReadFile(file)
  }

  // Also check immediate subfolders (depth-1) for monorepos or nested apps
  try {
    const rootChildren = fs.readdirSync(repoPath)
    for (const child of rootChildren) {
      const childPath = path.join(repoPath, child)
      if (fs.statSync(childPath).isDirectory() && !child.startsWith('.') && child !== 'node_modules' && child !== '.tools') {
        for (const file of TARGET_CONFIGS) {
          checkAndReadFile(path.join(child, file))
        }
        for (const file of TARGET_ENTRIES) {
          checkAndReadFile(path.join(child, file))
        }
      }
    }
  } catch {
    // ignore readdir errors
  }

  return contextFiles
}

export async function analyzeBaselineWithAI(
  repoPath: string,
  techStack: DetectedStack,
  results: Record<string, CategoryResult>,
  onLog?: (tag: string, msg: string) => void
): Promise<AIBaselineDiagnostic | null> {
  try {
    onLog?.('AI', 'Scanning codebase configuration and manifest structure for context...')
    const codebaseContext = gatherCodebaseContext(repoPath)
    onLog?.('AI', `Collected ${codebaseContext.length} configuration/manifest file(s) for comparison.`)

    onLog?.('AI', 'Running Gemini diagnostic analysis on baseline results...')
    
    const client = getClient()
    
    // Build the user message with structured data
    const categoryData = Object.entries(results).map(([category, result]) => ({
      category,
      status: result.status,
      issuesCount: result.issuesCount,
      durationMs: result.durationMs,
      logs: truncateLogs(result.logs)
    }))

    const userMessage = JSON.stringify({
      techStack: {
        language: techStack.language,
        frontend: techStack.frontend,
        backend: techStack.backend,
        packageManager: techStack.packageManager,
        testFramework: techStack.testFramework,
        isStaticSite: techStack.isStaticSite,
        isMonorepo: techStack.isMonorepo,
        monorepoType: techStack.monorepoType
      },
      categories: categoryData,
      codebaseContext
    }, null, 2)

    // Model cascade: try best model first, fall back to lighter model
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
    let lastError: Error | null = null
    let usedModel = ''

    for (const modelName of modelsToTry) {
      try {
        onLog?.('AI', `Attempting analysis with model: ${modelName}`)
        
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
          systemInstruction: BASELINE_SYSTEM_PROMPT,
        })

        const result = await model.generateContent(userMessage)
        const rawText = result.response.text()

        if (!rawText || rawText.trim() === '') {
          throw new Error('Empty response received from Gemini')
        }

        const parsed = parseAIDiagnostic(rawText)
        parsed.model = modelName
        parsed.analyzedAt = new Date().toISOString()
        usedModel = modelName

        onLog?.('AI', `Diagnostic analysis complete (${modelName}). Verdict: ${parsed.overallHealth}`)
        return parsed
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(`[AI] Error with model ${modelName}:`, err.message)
        lastError = err
        onLog?.('AI', `Model ${modelName} failed: ${err.message}. Trying fallback...`)
      }
    }

    // All models failed
    onLog?.('AI', `AI diagnostic unavailable: ${lastError?.message || 'All models failed'}`)
    return null
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[AI] Fatal error in AI diagnostic layer:', err.message)
    onLog?.('AI', `AI diagnostic skipped: ${err.message}`)
    return null
  }
}

function parseAIDiagnostic(rawText: string): AIBaselineDiagnostic {
  let jsonText = rawText.trim()

  // Strip markdown code fences if present
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim()
  }

  // Try direct parse first
  try {
    const parsed = JSON.parse(jsonText)
    return normalizeDiagnostic(parsed)
  } catch {
    // Fallback: extract the first {...} block
    const braceMatch = jsonText.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        const parsed = JSON.parse(braceMatch[0])
        return normalizeDiagnostic(parsed)
      } catch (innerErr: unknown) {
        const err = innerErr instanceof Error ? innerErr : new Error(String(innerErr))
        console.error('[AI] Failed to parse diagnostic response:', rawText.slice(0, 500))
        throw new Error(`AI returned malformed JSON: ${err.message}`)
      }
    }
    throw new Error('AI returned non-JSON response')
  }
}

function normalizeDiagnostic(raw: Record<string, unknown>): AIBaselineDiagnostic {
  const validHealth = ['healthy', 'needs_attention', 'critical']
  const overallHealth = validHealth.includes(raw.overallHealth as string)
    ? (raw.overallHealth as 'healthy' | 'needs_attention' | 'critical')
    : 'needs_attention'

  const categoryDiagnostics: AICategoryDiagnostic[] = Array.isArray(raw.categoryDiagnostics)
    ? (raw.categoryDiagnostics as Record<string, unknown>[]).map(normalizeCategoryDiagnostic)
    : []

  return {
    overallHealth,
    summary: typeof raw.summary === 'string' ? raw.summary : 'No summary provided.',
    categoryDiagnostics,
    model: '',
    analyzedAt: ''
  }
}

function normalizeCategoryDiagnostic(raw: Record<string, unknown>): AICategoryDiagnostic {
  const validStatuses = ['pass', 'fail', 'warn', 'skip']
  return {
    category: typeof raw.category === 'string' ? raw.category : 'unknown',
    rootCause: typeof raw.rootCause === 'string' ? raw.rootCause : 'No root cause identified.',
    isFalsePositive: typeof raw.isFalsePositive === 'boolean' ? raw.isFalsePositive : false,
    falsePositiveReason: typeof raw.falsePositiveReason === 'string' ? raw.falsePositiveReason : undefined,
    adjustedStatus: validStatuses.includes(raw.adjustedStatus as string)
      ? (raw.adjustedStatus as 'pass' | 'fail' | 'warn' | 'skip')
      : 'warn',
    suggestedFix: typeof raw.suggestedFix === 'string' ? raw.suggestedFix : undefined
  }
}

