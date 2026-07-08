/**
 * Gemini AI API Wrapper
 * Handles communication with Google Gemini (gemini-2.5-flash).
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { BASELINE_SYSTEM_PROMPT } from './prompt'
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

function getMockReviewResult(userMessage?: string): AIReviewResult {
  let changedFiles: string[] = []
  if (userMessage) {
    try {
      const parsed = JSON.parse(userMessage)
      if (parsed.changedFiles && Array.isArray(parsed.changedFiles)) {
        changedFiles = parsed.changedFiles
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  const strengths = [
    'Clean component architecture with proper separation of concerns.',
    'Responsive design works correctly across both desktop and mobile resolutions.',
    'Type safety is maintained throughout the new modules with interface definitions.'
  ]

  const issues: AIIssue[] = []
  const risks: AIRisk[] = []

  if (changedFiles.length > 0) {
    issues.push({
      file: changedFiles[0],
      line: 12,
      severity: 'medium',
      message: 'Consider optimizing re-renders by memoizing callback handlers or wrapping event handlers in useCallback.',
      suggestion: 'Wrap the handler in useCallback(() => { ... }, []) to avoid unnecessary component re-renders.',
      status: 'new'
    })
  } else {
    issues.push({
      file: 'components/Navbar.tsx',
      line: 25,
      severity: 'low',
      message: 'Minor warning: avoid using inline style objects inside loops to optimize rendering performance.',
      suggestion: 'Move the inline styles to a Tailwind class or custom styled component.',
      status: 'new'
    })
  }

  return {
    verdict: 'pass',
    score: 88,
    requirement_match: 0.9,
    summary: '⚠️ [MOCK MODE] GEMINI_API_KEY is not set. Showing simulated pull request review results.\n\nThe submission looks solid. Component styling, layout responsiveness, and state handling are properly implemented.',
    strengths,
    issues,
    risks,
    unauthorized_file_edits: [],
    resolved_issues: [],
    resolved_risks: []
  }
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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('[Gemini] GEMINI_API_KEY is not set. Generating mock/simulated AI review report.')
    return getMockReviewResult(userMessage)
  }

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
  
  let scoreValue = 50
  let scoreBreakdown: AIReviewResult['scoreBreakdown'] | undefined = undefined

  const parseBreakdown = (b: any) => {
    const parseSubScore = (sub: any, defaultMax: number) => {
      if (!sub || typeof sub !== 'object') {
        return { score: defaultMax, deductions: [] }
      }
      const score = typeof sub.score === 'number' ? sub.score : defaultMax
      const deductions = Array.isArray(sub.deductions)
        ? sub.deductions.map((d: any) => ({
            points: typeof d.points === 'number' ? d.points : 0,
            reason: typeof d.reason === 'string' ? d.reason : 'Unspecified deduction'
          }))
        : []
      return { score, deductions }
    }

    return {
      requirementFulfillment: parseSubScore(b.requirementFulfillment, 40),
      techStackAdherence: parseSubScore(b.techStackAdherence, 20),
      codeCleanliness: parseSubScore(b.codeCleanliness, 15),
      executionSafety: parseSubScore(b.executionSafety, 25)
    }
  }

  if (raw.score && typeof raw.score === 'object') {
    const rawScoreObj = raw.score as Record<string, any>
    scoreValue = typeof rawScoreObj.value === 'number' ? Math.max(0, Math.min(100, Math.round(rawScoreObj.value))) : 50
    if (rawScoreObj.breakdown && typeof rawScoreObj.breakdown === 'object') {
      scoreBreakdown = parseBreakdown(rawScoreObj.breakdown)
    }
  } else if (typeof raw.score === 'number') {
    scoreValue = Math.max(0, Math.min(100, Math.round(raw.score)))
  }

  // Fallback for baseline prompt reviewScore format
  if (raw.reviewScore && typeof raw.reviewScore === 'object') {
    const rawScoreObj = raw.reviewScore as Record<string, any>
    scoreValue = typeof rawScoreObj.value === 'number' ? Math.max(0, Math.min(100, Math.round(rawScoreObj.value))) : scoreValue
    if (rawScoreObj.breakdown && typeof rawScoreObj.breakdown === 'object') {
      scoreBreakdown = parseBreakdown(rawScoreObj.breakdown)
    }
  }

  const requirementMatch = typeof raw.requirement_match === 'number'
    ? Math.max(0, Math.min(1, raw.requirement_match))
    : 0.5

  return {
    verdict,
    score: scoreValue,
    scoreBreakdown,
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
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    onLog?.('AI', '⚠️ [MOCK MODE] GEMINI_API_KEY is not set. Generating mock/simulated baseline diagnostic report.')
    return {
      overallHealth: 'healthy',
      summary: '⚠️ [MOCK MODE] GEMINI_API_KEY is not set. Showing simulated baseline diagnostics.\n\nThe codebase is in healthy condition. The package configuration and setup checks pass successfully.',
      categoryDiagnostics: [
        {
          category: 'TypeScript',
          rootCause: 'Type checking passed with 0 compile errors.',
          isFalsePositive: false,
          adjustedStatus: 'pass'
        },
        {
          category: 'Lint',
          rootCause: 'ESLint finished with clean output.',
          isFalsePositive: false,
          adjustedStatus: 'pass'
        }
      ],
      model: 'mock-gemini-model',
      analyzedAt: new Date().toISOString()
    }
  }

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

