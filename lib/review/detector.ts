import fs from 'fs'
import path from 'path'

export interface DetectedStack {
  frontend: string | null
  backend: string | null
  language: string
  packageManager: string | null
  testFramework: string | null
  hasDocker: boolean
  hasGithubActions: boolean
  hasMake: boolean
  isStaticSite: boolean
  isMonorepo?: boolean
  monorepoType?: 'turborepo' | 'nx' | 'workspaces' | null
}

export function detectStack(repoDir: string): DetectedStack {
  const result: DetectedStack = {
    frontend: null,
    backend: null,
    language: 'JavaScript', // Default fallback
    packageManager: null,
    testFramework: null,
    hasDocker: false,
    hasGithubActions: false,
    hasMake: false,
    isStaticSite: false,
  }

  // Helper check (depth 0 and depth 1)
  const exists = (relPath: string) => {
    if (fs.existsSync(path.join(repoDir, relPath))) return true
    try {
      const subdirs = fs.readdirSync(repoDir)
      for (const subdir of subdirs) {
        if (subdir === 'node_modules' || subdir === '.git' || subdir === 'venv' || subdir === '.venv') continue
        const subPath = path.join(repoDir, subdir)
        if (fs.statSync(subPath).isDirectory()) {
          if (fs.existsSync(path.join(subPath, relPath))) return true
        }
      }
    } catch {}
    return false
  }

  const read = (relPath: string) => {
    try {
      const rootPath = path.join(repoDir, relPath)
      if (fs.existsSync(rootPath)) {
        return fs.readFileSync(rootPath, 'utf8')
      }
      const subdirs = fs.readdirSync(repoDir)
      for (const subdir of subdirs) {
        if (subdir === 'node_modules' || subdir === '.git' || subdir === 'venv' || subdir === '.venv') continue
        const subPath = path.join(repoDir, subdir)
        if (fs.statSync(subPath).isDirectory()) {
          const targetPath = path.join(subPath, relPath)
          if (fs.existsSync(targetPath)) {
            return fs.readFileSync(targetPath, 'utf8')
          }
        }
      }
    } catch {}
    return ''
  }

  // 1. Tooling / Config Files
  result.hasDocker = exists('Dockerfile') || exists('docker-compose.yml')
  result.hasGithubActions = exists('.github/workflows')
  result.hasMake = exists('Makefile')

  // Recursive extension scanner to count file types
  let pyCount = 0
  let jsCount = 0
  let tsCount = 0
  let goCount = 0
  let rsCount = 0
  let javaCount = 0
  let rbCount = 0
  let phpCount = 0
  let cppCount = 0
  let cCount = 0
  let csCount = 0
  let luaCount = 0
  let htmlCount = 0
  let cssCount = 0

  const scanDir = (dir: string, depth = 0) => {
    if (depth > 10) return
    try {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const lowerFile = file.toLowerCase()
        if (
          lowerFile === 'node_modules' ||
          lowerFile === '.git' ||
          lowerFile === '.next' ||
          lowerFile === 'venv' ||
          lowerFile === '.venv' ||
          lowerFile === 'dist' ||
          lowerFile === 'build' ||
          lowerFile === 'out' ||
          lowerFile === '.cache' ||
          lowerFile === 'target' ||
          lowerFile === 'bin' ||
          lowerFile === 'obj' ||
          lowerFile === 'vendor' ||
          lowerFile === 'doc' ||
          lowerFile === 'docs' ||
          lowerFile === 'website' ||
          lowerFile === 'site'
        ) {
          continue
        }
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          scanDir(fullPath, depth + 1)
        } else if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase()
          const isConfig = lowerFile.includes('config') || lowerFile.startsWith('.')

          if (ext === '.py') pyCount++
          else if (ext === '.js' || ext === '.jsx') {
            if (!isConfig) jsCount++
          }
          else if (ext === '.ts' || ext === '.tsx') {
            if (!lowerFile.endsWith('.d.ts') && !isConfig) {
              tsCount++
            }
          }
          else if (ext === '.go') goCount++
          else if (ext === '.rs') rsCount++
          else if (ext === '.java') javaCount++
          else if (ext === '.rb') rbCount++
          else if (ext === '.php') phpCount++
          else if (ext === '.cpp' || ext === '.cc' || ext === '.hpp') cppCount++
          else if (ext === '.h') {
            cCount++
            cppCount++
          }
          else if (ext === '.c') cCount++
          else if (ext === '.cs') csCount++
          else if (ext === '.lua') luaCount++
          else if (ext === '.vue' || ext === '.svelte' || ext === '.astro') {
            jsCount++
          }
          else if (ext === '.html' || ext === '.htm') htmlCount++
          else if (ext === '.css') cssCount++
        }
      }
    } catch {}
  }
  
  scanDir(repoDir)

  // Rank counts
  const counts = [
    { lang: 'Python', count: pyCount },
    { lang: 'JavaScript', count: jsCount },
    { lang: 'TypeScript', count: tsCount },
    { lang: 'Go', count: goCount },
    { lang: 'Rust', count: rsCount },
    { lang: 'Java', count: javaCount },
    { lang: 'Ruby', count: rbCount },
    { lang: 'PHP', count: phpCount },
    { lang: 'C++', count: cppCount },
    { lang: 'C', count: cCount },
    { lang: 'C#', count: csCount },
    { lang: 'Lua', count: luaCount },
    { lang: 'HTML/CSS/JS', count: htmlCount + cssCount }
  ]

  counts.sort((a, b) => b.count - a.count)
  const maxLang = counts[0]

  if (maxLang && maxLang.count > 0) {
    result.language = maxLang.lang
  }

  // Strong config-file overrides
  if (exists('go.mod')) {
    result.language = 'Go'
  } else if (exists('Cargo.toml')) {
    result.language = 'Rust'
  } else if (exists('pom.xml') || exists('build.gradle')) {
    result.language = 'Java'
  } else if (exists('Gemfile')) {
    result.language = 'Ruby'
  } else if (exists('CMakeLists.txt')) {
    result.language = cppCount > cCount ? 'C++' : 'C'
  } else if (exists('tsconfig.json') && tsCount > 0 && tsCount >= jsCount) {
    result.language = 'TypeScript'
  } else if (exists('package.json') && (tsCount === 0 || jsCount > tsCount) && pyCount === 0) {
    result.language = 'JavaScript'
  } else if (exists('composer.json') && phpCount > 0) {
    result.language = 'PHP'
  } else if ((exists('main.lua') || luaCount > 0) && luaCount >= jsCount) {
    result.language = 'Lua'
  }

  // Static site detection override:
  if ((result.language === 'JavaScript' || result.language === 'TypeScript' || result.language === 'HTML/CSS/JS') &&
      !exists('package.json') && (htmlCount > 0 || cssCount > 0)) {
    result.language = 'HTML/CSS/JS'
    result.isStaticSite = true
  }

  // Package Managers
  if (result.language === 'JavaScript' || result.language === 'TypeScript') {
    if (exists('package-lock.json')) result.packageManager = 'npm'
    else if (exists('yarn.lock')) result.packageManager = 'yarn'
    else if (exists('pnpm-lock.yaml')) result.packageManager = 'pnpm'
    else if (exists('bun.lockb')) result.packageManager = 'bun'
    else if (exists('package.json')) result.packageManager = 'npm'
  } else if (result.language === 'Python') {
    if (exists('requirements.txt') || exists('Install_Packages.txt')) result.packageManager = 'pip'
    else if (exists('Pipfile')) result.packageManager = 'pipenv'
    else if (exists('pyproject.toml')) result.packageManager = 'poetry'
    else result.packageManager = 'pip'
  } else if (result.language === 'Java') {
    if (exists('pom.xml')) result.packageManager = 'maven'
    else if (exists('build.gradle')) result.packageManager = 'gradle'
  } else if (result.language === 'Go') {
    if (exists('go.mod')) result.packageManager = 'go mod'
  } else if (result.language === 'Rust') {
    if (exists('Cargo.toml')) result.packageManager = 'cargo'
  } else if (result.language === 'Ruby') {
    if (exists('Gemfile')) result.packageManager = 'bundler'
  } else if (result.language === 'PHP') {
    if (exists('composer.json')) result.packageManager = 'composer'
  }

  // Monorepo Detection
  if (exists('turbo.json')) {
    result.isMonorepo = true
    result.monorepoType = 'turborepo'
  } else if (exists('nx.json')) {
    result.isMonorepo = true
    result.monorepoType = 'nx'
  } else if (exists('package.json')) {
    const pkg = JSON.parse(read('package.json') || '{}')
    if (pkg.workspaces) {
      result.isMonorepo = true
      result.monorepoType = 'workspaces'
    }
  }

  // Frameworks & Libraries
  if (result.language === 'JavaScript' || result.language === 'TypeScript' || result.language === 'HTML/CSS/JS') {
    if (exists('package.json')) {
      const getMergedNodeDeps = () => {
        const deps: Record<string, string> = {}
        const paths = []
        if (fs.existsSync(path.join(repoDir, 'package.json'))) {
          paths.push(path.join(repoDir, 'package.json'))
        }
        try {
          const subdirs = fs.readdirSync(repoDir)
          for (const subdir of subdirs) {
            const subPath = path.join(repoDir, subdir, 'package.json')
            if (fs.existsSync(subPath) && fs.statSync(path.join(repoDir, subdir)).isDirectory()) {
              paths.push(subPath)
            }
          }
        } catch {}

        for (const p of paths) {
          try {
            const pkg = JSON.parse(fs.readFileSync(p, 'utf8') || '{}')
            Object.assign(deps, pkg.dependencies || {}, pkg.devDependencies || {})
          } catch {}
        }
        return deps
      }

      const deps = getMergedNodeDeps()

      if (exists('next.config.js') || exists('next.config.ts') || deps['next']) {
        result.frontend = 'Next.js'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      } else if (exists('astro.config.mjs') || exists('astro.config.js') || exists('astro.config.ts') || deps['astro']) {
        result.frontend = 'Astro'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      } else if (deps['expo']) {
        result.frontend = 'Expo (React Native)'
        if (result.language === 'HTML/CSS/JS') {
          result.language = 'JavaScript'
          result.isStaticSite = false
        }
      } else if (deps['react-native']) {
        result.frontend = 'React Native'
        if (result.language === 'HTML/CSS/JS') {
          result.language = 'JavaScript'
          result.isStaticSite = false
        }
      } else if (deps['react']) {
        result.frontend = 'React'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      } else if (deps['nuxt'] || exists('nuxt.config.js') || exists('nuxt.config.ts')) {
        result.frontend = 'Nuxt.js'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      } else if (deps['vue']) {
        result.frontend = 'Vue.js'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      } else if (exists('angular.json') || deps['@angular/core']) {
        result.frontend = 'Angular'
        result.language = 'TypeScript'
        result.isStaticSite = false
      } else if (exists('svelte.config.js') || deps['svelte']) {
        result.frontend = 'Svelte'
        if (result.language === 'HTML/CSS/JS') {
          result.language = tsCount >= jsCount ? 'TypeScript' : 'JavaScript'
          result.isStaticSite = false
        }
      }

      if (deps['express']) result.backend = 'Express.js'
      else if (deps['fastify']) result.backend = 'Fastify'
      else if (deps['@nestjs/core'] || exists('nest-cli.json')) result.backend = 'NestJS'

      if (exists('vitest.config.ts') || exists('vitest.config.js') || deps['vitest']) {
        result.testFramework = 'Vitest'
      } else if (exists('jest.config.js') || exists('jest.config.ts') || deps['jest']) {
        result.testFramework = 'Jest'
      } else if (deps['mocha']) {
        result.testFramework = 'Mocha'
      } else if (exists('playwright.config.ts') || exists('playwright.config.js')) {
        result.testFramework = 'Playwright'
      } else if (exists('cypress.config.ts') || exists('cypress.config.js')) {
        result.testFramework = 'Cypress'
      }
    }
  } else if (result.language === 'Python') {
    let reqsContent = ''
    if (exists('requirements.txt')) reqsContent = read('requirements.txt')
    else if (exists('Install_Packages.txt')) reqsContent = read('Install_Packages.txt')
    else if (exists('Install_Packages_gpu.txt')) reqsContent = read('Install_Packages_gpu.txt')
    else if (exists('pyproject.toml')) reqsContent = read('pyproject.toml')
    else if (exists('Pipfile')) reqsContent = read('Pipfile')

    const lowerReqs = reqsContent.toLowerCase()
    if (lowerReqs.includes('django')) result.backend = 'Django'
    else if (lowerReqs.includes('fastapi')) result.backend = 'FastAPI'
    else if (lowerReqs.includes('flask')) result.backend = 'Flask'

    if (lowerReqs.includes('pytest')) result.testFramework = 'pytest'
    else result.testFramework = 'unittest'
  } else if (result.language === 'Go') {
    result.backend = 'Go'
    result.testFramework = 'go test'
  } else if (result.language === 'Rust') {
    result.backend = 'Rust'
    result.testFramework = 'cargo test'
  } else if (result.language === 'Java') {
    const pomContent = read('pom.xml')
    const gradleContent = read('build.gradle') + '\n' + read('build.gradle.kts')
    const isSpringBoot = pomContent.includes('spring-boot') || gradleContent.includes('org.springframework.boot')
    if (isSpringBoot) {
      result.backend = 'Spring Boot'
      result.testFramework = 'JUnit'
    }
  } else if (result.language === 'PHP') {
    const compContent = read('composer.json')
    const isLaravel = compContent.includes('laravel/framework') || exists('artisan')
    if (isLaravel) {
      result.backend = 'Laravel'
      result.testFramework = 'PHPUnit'
    } else {
      result.testFramework = 'PHPUnit'
    }
  }

  return result
}
