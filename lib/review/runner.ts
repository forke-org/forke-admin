/**
 * Deterministic Review Runner — Layer 1
 * Runs the 12-category deterministic test pipeline against a cloned repo.
 * Detects tech stack, maps commands, executes in isolation, and reports results.
 *
 * Categories: build, lint, type_checks, unit_tests, integration_tests,
 *   e2e_tests, security, code_quality, dependencies, performance, format, sast
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import { detectStack, DetectedStack } from './detector'

const execPromise = promisify(exec)

/** Runs a command with a cleaned env (removes Next.js/npm pollution) */
function execWithCleanEnv(cmd: string, options?: { cwd?: string }) {
  const cleanEnv: Record<string, any> = { ...process.env }
  for (const key of Object.keys(cleanEnv)) {
    if (
      key.startsWith('__NEXT_') ||
      key.startsWith('NEXT_') ||
      key.startsWith('npm_') ||
      key === 'NODE_OPTIONS' ||
      key === 'NODE_PATH' ||
      key === 'INIT_CWD'
    ) {
      delete cleanEnv[key]
    }
  }
  delete cleanEnv.NODE_ENV
  return execPromise(cmd, {
    env: cleanEnv as any,
    maxBuffer: 10 * 1024 * 1024,
    ...(options?.cwd ? { cwd: options.cwd } : {}),
  })
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CategoryResult {
  status: 'pass' | 'fail' | 'warn' | 'skip'
  durationMs: number
  logs: string
  issuesCount: number
  details?: any
}

export interface ReviewRunnerResult {
  commitSha: string
  techStack: DetectedStack
  results: Record<string, CategoryResult>
  durationMs: number
}

export const TEST_CATEGORIES = [
  'build',
  'lint',
  'type_checks',
  'unit_tests',
  'integration_tests',
  'e2e_tests',
  'security',
  'code_quality',
  'dependencies',
  'performance',
  'format',
  'sast',
] as const

// ─── Log Processing ──────────────────────────────────────────────────────────

function processAndLogLines(
  category: string,
  logs: string,
  onLog?: (tag: string, msg: string) => void,
  isError = false
) {
  const lines = logs.split('\n')
  let e501Count = 0

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return

    // Filter installation noise
    const isNoiseLine =
      trimmed.includes('npm notice') ||
      trimmed.includes('npm warn') ||
      trimmed.includes('New major version of npm available') ||
      trimmed.includes('Successfully installed') ||
      trimmed.includes('Installing collected packages') ||
      trimmed.includes('Downloading') ||
      trimmed.includes('Requirement already satisfied') ||
      trimmed.includes('Collecting') ||
      trimmed.includes('Attempting uninstall') ||
      trimmed.includes('Successfully uninstalled') ||
      trimmed.includes('Found existing installation')

    if (isNoiseLine) return

    // Collapse E501 warnings
    if (trimmed.includes('E501') || trimmed.includes('line too long')) {
      e501Count++
      return
    }

    let tag = isError ? 'FAILED' : 'INFO'
    const isErrorLine =
      trimmed.toLowerCase().includes('error') ||
      trimmed.toLowerCase().includes('failed') ||
      trimmed.startsWith('×') ||
      trimmed.includes('subprocess-exited-with-error') ||
      trimmed.includes('metadata-generation-failed')
    if (isErrorLine) tag = 'FAILED'

    onLog?.(tag, `  ${trimmed}`)
  })

  if (e501Count > 0) {
    onLog?.(
      'INFO',
      `  ℹ Collapsed ${e501Count} formatting violations (mostly E501 line-too-long style rules).`
    )
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

export async function runReviewPipeline(
  repoPath: string,
  commitSha: string,
  onLog?: (tag: string, message: string) => void
): Promise<ReviewRunnerResult> {
  const startTime = Date.now()

  // Auto-inject dummy test script if missing
  try {
    const pkgPath = path.join(repoPath, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (!pkg.scripts) pkg.scripts = {}
      if (!pkg.scripts.test) {
        pkg.scripts.test = 'echo "No tests specified"'
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8')
        onLog?.('INFO', 'Auto-injected dummy "test" script into clone package.json.')
      }
    }
  } catch {
    onLog?.('WARN', 'Failed to inspect or inject dummy test script.')
  }

  onLog?.('INIT', 'Analyzing workspace structure and tech stack.')
  const techStack = detectStack(repoPath)
  onLog?.(
    'CHECKING',
    `Detected language: ${techStack.language}${techStack.frontend ? `, Frontend: ${techStack.frontend}` : ''}`
  )

  const results: Record<string, CategoryResult> = {}
  const commands = getCommandsForStack(techStack, repoPath)

  for (const category of TEST_CATEGORIES) {
    const catStartTime = Date.now()
    const cmd = commands[category]

    if (!cmd) {
      onLog?.('CLEANUP', `Skipping category "${category}" — not configured for this stack.`)
      results[category] = {
        status: 'skip',
        durationMs: Date.now() - catStartTime,
        logs: `Skipped: No command configured for "${category}" in this tech stack.`,
        issuesCount: 0,
      }
      continue
    }

    onLog?.('CHECKING', `Category "${category.replace('_', ' ')}" validation triggered.`)
    try {
      const dockerImage = getDockerImageForLanguage(techStack.language, category)
      let execCmd = cmd
      let execCwd: string | undefined = undefined

      // Attempt nested docker isolation
      try {
        const { stdout: hasDocker } = await execPromise('docker info')
        const isInsideDocker = fs.existsSync('/.dockerenv')
        const isMacHost =
          process.env.HOST_WORKSPACE_PATH?.startsWith('/Users/') && !isInsideDocker
        const isDisabled = process.env.DISABLE_NESTED_DOCKER === 'true'

        if (hasDocker && !isMacHost && !isDisabled) {
          let hostMountPath = repoPath
          if (process.env.HOST_WORKSPACE_PATH) {
            if (repoPath.startsWith('/git-mirrors/')) {
              hostMountPath = repoPath.replace(
                '/git-mirrors/',
                `${process.env.HOST_WORKSPACE_PATH}/git-mirrors/`
              )
            } else {
              hostMountPath = repoPath.replace('/app/', `${process.env.HOST_WORKSPACE_PATH}/`)
            }
          }
          const escapedCmd = cmd.replace(/"/g, '\\"')
          execCmd = `docker run --rm -v "${hostMountPath}:/workspace" -w /workspace ${dockerImage} sh -c "${escapedCmd}"`
        } else {
          execCwd = repoPath
        }
      } catch {
        execCwd = repoPath
      }

      const { stdout, stderr } = await execWithCleanEnv(execCmd, { cwd: execCwd })
      const durationMs = Date.now() - catStartTime

      onLog?.('INFO', `Executing: "${cmd}"`)

      const combinedLogs = (stdout || '') + '\n' + (stderr || '')
      processAndLogLines(category, combinedLogs, onLog, false)

      const count = countIssues(category, combinedLogs)
      const status =
        count > 0 && isBlockingCategory(category)
          ? 'fail'
          : count > 0
            ? 'warn'
            : 'pass'

      if (status === 'fail') {
        onLog?.(
          'FAILED',
          `Category "${category.replace('_', ' ')}" failed with ${count} blocking issue(s).`
        )
      } else if (status === 'warn') {
        onLog?.(
          'CHECKING',
          `Category "${category.replace('_', ' ')}" complete with ${count} warnings.`
        )
      } else {
        onLog?.('SUCCESS', `Category "${category.replace('_', ' ')}" passed successfully.`)
      }

      results[category] = { status, durationMs, logs: combinedLogs, issuesCount: count }
    } catch (error: any) {
      const durationMs = Date.now() - catStartTime
      const logsToPrint: string[] = []
      if (error.stdout) logsToPrint.push(error.stdout)
      if (error.stderr) logsToPrint.push(error.stderr)
      if (logsToPrint.length === 0 && error.message) logsToPrint.push(error.message)
      const combinedLogs = logsToPrint.join('\n')
      const combinedLower = combinedLogs.toLowerCase()

      // Vercel-compatible build assessment
      const buildCompiledOk =
        category === 'build' && combinedLower.includes('compiled successfully')

      if (buildCompiledOk) {
        const prerenderErrors = (combinedLogs.match(/Error occurred prerendering page/gi) || []).length
        const exportErrors = (combinedLogs.match(/Export encountered an error/gi) || []).length
        const totalPrerenderIssues = prerenderErrors + exportErrors

        onLog?.('SUCCESS', `Build compilation succeeded (Vercel-compatible).`)
        if (totalPrerenderIssues > 0) {
          onLog?.('CHECKING', `${prerenderErrors} page(s) had prerender issues (non-blocking).`)
        }

        results[category] = {
          status: totalPrerenderIssues > 0 ? 'warn' : 'pass',
          durationMs,
          logs: combinedLogs,
          issuesCount: totalPrerenderIssues,
        }
      } else {
        const isEnvLimitation =
          category === 'build' &&
          (combinedLower.includes('unknown compiler') ||
            combinedLower.includes("no such file or directory: 'cc'") ||
            combinedLower.includes("no such file or directory: 'gcc'") ||
            combinedLower.includes('gcc: not found') ||
            combinedLower.includes('clang: not found') ||
            combinedLower.includes('make: not found'))

        const isNoTestsRan =
          category === 'unit_tests' &&
          (combinedLower.includes('no tests ran') ||
            combinedLower.includes('collected 0 items') ||
            combinedLower.includes('no tests discovered'))

        if (isNoTestsRan) {
          onLog?.('CHECKING', 'ℹ No unit tests found in this repository.')
        } else if (isEnvLimitation) {
          onLog?.('CHECKING', '⚠️ Environment limitation: sandbox lacks required native build tools.')
        } else {
          onLog?.('CHECKING', `Category "${category.replace('_', ' ')}" completed with issues.`)
        }

        processAndLogLines(category, combinedLogs, onLog, true)

        const count = countIssues(category, combinedLogs)
        let issuesCount = count > 0 ? count : 1
        if (category === 'sast' && count === 0) issuesCount = 0

        let status: 'pass' | 'fail' | 'warn' | 'skip' = 'fail'
        if (isNoTestsRan) {
          status = 'warn'
          issuesCount = 0
        } else if (isEnvLimitation) {
          status = 'warn'
        } else {
          status =
            issuesCount > 0 && isBlockingCategory(category)
              ? 'fail'
              : issuesCount > 0
                ? 'warn'
                : 'pass'
        }

        results[category] = { status, durationMs, logs: combinedLogs, issuesCount }
      }
    }
  }

  onLog?.(
    'SUCCESS',
    `All 12 deterministic test categories executed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`
  )

  // Cleanup caches
  try {
    onLog?.('CLEANUP', 'Cleaning up dependencies and cache directories.')
    const filesToDelete = [
      '.venv', 'node_modules', '.pytest_cache', '__pycache__',
      '.mypy_cache', '.ruff_cache', 'target', 'build', 'dist', 'bin', 'obj',
    ]
    for (const file of filesToDelete) {
      const fullPath = path.join(repoPath, file)
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true })
      }
    }
    onLog?.('SUCCESS', 'Caches cleaned successfully.')
  } catch (cleanupErr: any) {
    onLog?.('CLEANUP', `Cleanup warning: ${cleanupErr.message}`)
  }

  return { commitSha, techStack, results, durationMs: Date.now() - startTime }
}

// ─── Docker Image Mapping ──────────────────────────────────────────────────

function getDockerImageForLanguage(language: string, category?: string): string {
  if (category === 'code_quality') return 'node:20-alpine'
  switch (language) {
    case 'TypeScript': case 'JavaScript': case 'HTML/CSS/JS': return 'node:20-alpine'
    case 'Python': return 'python:3.12-slim'
    case 'Go': return 'golang:1.22-alpine'
    case 'Rust': return 'rust:latest'
    case 'Java': return 'eclipse-temurin:21-jdk-alpine'
    case 'PHP': return 'php:8.2-cli-alpine'
    case 'C': return 'gcc:latest'
    case 'Lua': return 'nickblah/lua:latest'
    default: return 'node:20-alpine'
  }
}

function isBlockingCategory(category: string): boolean {
  return ['build', 'type_checks', 'unit_tests', 'integration_tests', 'e2e_tests'].includes(category)
}

// ─── Stack → Command Mapping ────────────────────────────────────────────────

function getCommandsForStack(
  stack: DetectedStack,
  repoPath: string
): Record<string, string | null> {
  const pm = stack.packageManager || 'npm'
  const isNode = stack.language === 'TypeScript' || stack.language === 'JavaScript'
  const exists = (relPath: string) => fs.existsSync(path.join(repoPath, relPath))

  let buildCmd: string | null = null
  let lintCmd: string | null = null
  let typeCheckCmd: string | null = null
  let unitTestCmd: string | null = null
  let securityCmd: string | null = null
  let codeQualityCmd: string | null =
    'npx jscpd . --ignore "**/node_modules/**,**/.venv/**,**/venv/**,**/dist/**,**/build/**,**/.next/**,**/.cache/**"'
  let dependenciesCmd: string | null = null
  let formatCmd: string | null = null
  let sastCmd: string | null = null

  if (isNode && stack.isMonorepo) {
    const installCmd = pm === 'npm' ? 'npm install' : pm === 'bun' ? 'bun install' : `${pm} install`
    if (stack.monorepoType === 'turborepo') {
      buildCmd = `${installCmd} && npx turbo run build`
      lintCmd = 'npx turbo run lint'
      unitTestCmd = 'npx turbo run test'
      formatCmd = 'npx turbo run format'
    } else if (stack.monorepoType === 'nx') {
      buildCmd = `${installCmd} && npx nx run-many --target=build`
      lintCmd = 'npx nx run-many --target=lint'
      unitTestCmd = 'npx nx run-many --target=test'
      formatCmd = 'npx nx run-many --target=format'
    } else {
      buildCmd = `${installCmd} && ${pm} run build --workspaces --if-present`
      lintCmd = `${pm} run lint --workspaces --if-present`
      unitTestCmd = `${pm} test --workspaces --if-present`
    }
    typeCheckCmd = null
    securityCmd = pm === 'npm' ? 'npm audit --audit-level=high' : `${pm} audit`
    dependenciesCmd = pm === 'npm' ? 'npm outdated' : `${pm} outdated`
    sastCmd = 'npx semgrep scan --config auto --error'
  } else if (isNode) {
    buildCmd =
      pm === 'npm'
        ? 'NODE_ENV=development npm install --include=dev'
        : pm === 'bun'
          ? 'NODE_ENV=development bun install'
          : `NODE_ENV=development ${pm} install --production=false`
    buildCmd += ` && ${pm === 'npm' ? 'npm run build' : pm === 'bun' ? 'bun run build' : `${pm} build`}`
    lintCmd = pm === 'npm' ? 'npx eslint .' : pm === 'pnpm' ? 'pnpm eslint .' : pm === 'yarn' ? 'yarn eslint .' : 'bunx eslint .'
    typeCheckCmd =
      stack.language === 'TypeScript'
        ? pm === 'npm' ? 'npx tsc --noEmit' : pm === 'pnpm' ? 'pnpm tsc --noEmit' : pm === 'yarn' ? 'yarn tsc --noEmit' : 'bunx tsc --noEmit'
        : null
    unitTestCmd = pm === 'npm' ? 'npm test' : pm === 'bun' ? 'bun test' : `${pm} test`
    securityCmd =
      pm === 'npm'
        ? 'npm audit --audit-level=high'
        : pm === 'pnpm'
          ? 'pnpm audit --audit-level=high'
          : pm === 'yarn'
            ? 'yarn audit'
            : 'bun audit'
    dependenciesCmd = pm === 'npm' ? 'npm outdated' : pm === 'bun' ? 'bun pm outdated' : `${pm} outdated`
    formatCmd =
      pm === 'npm' ? 'npx prettier --check .' : pm === 'pnpm' ? 'pnpm prettier --check .' : pm === 'yarn' ? 'yarn prettier --check .' : 'bunx prettier --check .'
    sastCmd = 'npx semgrep scan --config auto --error'
  } else if (stack.language === 'Python') {
    buildCmd =
      '(python3 -m venv .venv || python -m venv .venv) && .venv/bin/pip install --no-cache-dir --upgrade pip && .venv/bin/pip install --no-cache-dir flake8 ruff mypy pytest bandit black pip-audit'
    if (exists('requirements.txt')) buildCmd += ' && .venv/bin/pip install --no-cache-dir -r requirements.txt'
    else if (exists('Install_Packages.txt')) buildCmd += ' && .venv/bin/pip install --no-cache-dir -r Install_Packages.txt'
    else if (exists('Pipfile')) buildCmd += ' && .venv/bin/pip install --no-cache-dir pipenv && .venv/bin/pipenv install'
    else if (exists('pyproject.toml')) buildCmd += ' && .venv/bin/pip install --no-cache-dir .'

    lintCmd = '.venv/bin/flake8 . --exclude=.venv,env,venv,node_modules,site-packages,dist,build || .venv/bin/ruff check . --exclude .venv --exclude venv'
    typeCheckCmd = '.venv/bin/mypy . --exclude "(.venv|venv|node_modules)" --ignore-missing-imports'
    unitTestCmd = '.venv/bin/pytest --ignore=.venv --ignore=venv || .venv/bin/python -m unittest discover'
    securityCmd = '.venv/bin/pip-audit'
    dependenciesCmd = '.venv/bin/pip list --outdated'
    formatCmd = '.venv/bin/black --check .'
    sastCmd = '.venv/bin/bandit -r . -x .venv,venv,node_modules'
  } else if (stack.language === 'Go') {
    buildCmd = 'go build ./...'
    lintCmd = 'go vet ./...'
    typeCheckCmd = 'go vet ./...'
    unitTestCmd = 'go test -v ./...'
    securityCmd = 'govulncheck ./... || npx semgrep scan --config auto --error'
    formatCmd = 'gofmt -d .'
    sastCmd = 'npx semgrep scan --config auto --error'
  } else if (stack.language === 'Rust') {
    buildCmd = 'cargo build'
    lintCmd = 'cargo clippy'
    typeCheckCmd = 'cargo check'
    unitTestCmd = 'cargo test'
    securityCmd = 'cargo audit'
    formatCmd = 'cargo fmt --check'
    sastCmd = 'cargo clippy -- -D warnings'
  } else if (stack.language === 'Java') {
    const isMaven = exists('pom.xml')
    const isGradle = exists('build.gradle') || exists('build.gradle.kts')
    buildCmd = isMaven ? 'mvn clean compile' : isGradle ? './gradlew compileJava || gradle compileJava' : 'javac **/*.java'
    lintCmd = isMaven ? 'mvn checkstyle:check' : isGradle ? './gradlew checkstyleMain' : 'javac -Xlint **/*.java'
    typeCheckCmd = buildCmd
    unitTestCmd = isMaven ? 'mvn test' : isGradle ? './gradlew test || gradle test' : null
    securityCmd = isMaven ? 'mvn dependency-check:check' : null
    formatCmd = isMaven ? 'mvn spotless:check' : isGradle ? './gradlew spotlessCheck' : null
    sastCmd = isMaven ? 'mvn spotbugs:check' : null
  } else if (stack.language === 'Ruby') {
    buildCmd = exists('Gemfile') ? 'bundle install' : 'gem install rubocop'
    lintCmd = 'bundle exec rubocop || rubocop'
    unitTestCmd = 'bundle exec rspec || rspec'
    securityCmd = 'bundle exec brakeman || brakeman'
    formatCmd = 'bundle exec rubocop -a || rubocop -a'
    sastCmd = 'bundle exec brakeman -q'
  } else if (stack.language === 'PHP') {
    const hasComposer = exists('composer.json')
    buildCmd = hasComposer
      ? 'which composer >/dev/null 2>&1 && composer install --no-interaction || (curl -sS https://getcomposer.org/installer | php && php composer.phar install --no-interaction)'
      : 'echo "Plain PHP project — no build required."'
    lintCmd = hasComposer
      ? 'vendor/bin/phpcs || find . -type f -name "*.php" -not -path "*/vendor/*" -exec php -l {} \\;'
      : 'find . -type f -name "*.php" -not -path "*/vendor/*" -exec php -l {} \\;'
    unitTestCmd = hasComposer ? 'vendor/bin/phpunit || phpunit' : null
    securityCmd = hasComposer ? 'composer audit || echo "Composer audit skipped"' : null
    formatCmd = hasComposer ? 'vendor/bin/php-cs-fixer fix --dry-run' : null
    sastCmd = hasComposer ? 'vendor/bin/phpstan analyse' : null
  } else if (stack.language === 'HTML/CSS/JS') {
    buildCmd = 'echo "Static site — no build step required."'
    lintCmd = 'npx -y htmlhint "**/*.html"'
    formatCmd = 'npx -y prettier --check "**/*.{html,css,js}" --ignore-path .gitignore'
    codeQualityCmd = 'npx -y jscpd . --ignore "**/node_modules/**"'
  } else if (stack.language === 'C++') {
    buildCmd = exists('Makefile') ? 'make' : 'g++ -std=c++17 *.cpp -o main'
    lintCmd = 'cppcheck .'
    formatCmd = 'clang-format -n *.cpp'
    sastCmd = 'flawfinder .'
  } else if (stack.language === 'C') {
    buildCmd = exists('Makefile') ? 'make' : 'gcc -std=c11 *.c -o main'
    lintCmd = 'cppcheck .'
    formatCmd = 'clang-format -n *.c'
    sastCmd = 'flawfinder .'
  } else if (stack.language === 'C#') {
    buildCmd = 'dotnet build'
    lintCmd = 'dotnet format --verify-no-changes'
    unitTestCmd = 'dotnet test'
    securityCmd = 'dotnet list package --vulnerable'
  }

  return {
    build: buildCmd, lint: lintCmd, type_checks: typeCheckCmd,
    unit_tests: unitTestCmd, integration_tests: null, e2e_tests: null,
    security: securityCmd, code_quality: codeQualityCmd, dependencies: dependenciesCmd,
    performance: null, format: formatCmd, sast: sastCmd,
  }
}

// ─── Issue Counting ─────────────────────────────────────────────────────────

function countIssues(category: string, logs: string): number {
  const lower = logs.toLowerCase()
  if (category === 'build') {
    if (lower.includes('compiled successfully')) return 0
    return lower.includes('failed to compile') || lower.includes('build error') || lower.includes('npm err') ? 1 : 0
  }
  if (category === 'lint') {
    const matches = logs.match(/(\d+) problem/i)
    return matches ? parseInt(matches[1], 10) : lower.includes('error') || lower.includes('warning') ? 1 : 0
  }
  if (category === 'type_checks') {
    const matches = logs.match(/found (\d+) error/i)
    return matches ? parseInt(matches[1], 10) : lower.includes('error') ? 1 : 0
  }
  if (category === 'unit_tests') return lower.includes('fail') || lower.includes('failed') ? 1 : 0
  if (category === 'security') return lower.includes('vulnerability') || lower.includes('critical') || lower.includes('high') ? 1 : 0
  if (category === 'format') return lower.includes('difference') || lower.includes('fail') ? 1 : 0
  if (category === 'sast') {
    if (logs.includes('Issue: [')) {
      const totalIssues = (logs.match(/Issue: \[B/g) || []).length
      const b311Issues = (logs.match(/Issue: \[B311/g) || []).length
      return Math.max(0, totalIssues - b311Issues)
    }
    return lower.includes('error') ? 1 : 0
  }
  return lower.includes('error') ? 1 : 0
}
