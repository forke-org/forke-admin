import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const { auth } = NextAuth(authConfig)

const ATTRIBUTION_COOKIE = 'forke_attribution'

// Edge-safe copy of normalizeSource (middleware can't import next/headers from the shared util).
function normalizeSource(raw?: string | null): string {
  if (!raw) return 'direct'
  const cleaned = raw.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 32)
  return cleaned || 'direct'
}

function cleanField(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.toLowerCase().trim().replace(/[^a-z0-9_\- ]/g, '').slice(0, 64)
  return cleaned || undefined
}

// Query params we capture then strip from the visible URL.
const TRACKING_PARAMS = ['source', 'utm_source', 'ref', 'utm_medium', 'utm_campaign']

/**
 * Compute first-touch attribution from the request, or null if there's nothing to record
 * (cookie already set, or no tracking signal at all). Pure — does not mutate anything.
 *
 * First-touch wins: once the cookie exists we never recompute, so a signup days later
 * (even via OAuth) is still credited to the original channel.
 */
function computeAttribution(req: NextRequest) {
  if (req.cookies.get(ATTRIBUTION_COOKIE)) return null

  const params = req.nextUrl.searchParams
  const rawSource = params.get('source') || params.get('utm_source') || params.get('ref')
  const medium = params.get('utm_medium')
  const campaign = params.get('utm_campaign')

  const referrerHeader = req.headers.get('referer') || ''
  let externalReferrer: string | undefined
  if (referrerHeader) {
    try {
      const refHost = new URL(referrerHeader).host
      if (refHost && refHost !== req.nextUrl.host) externalReferrer = referrerHeader.slice(0, 255)
    } catch {
      // ignore malformed referrer
    }
  }

  // Only record when there's a real signal — otherwise let "direct" stay the honest default.
  if (!rawSource && !medium && !campaign && !externalReferrer) return null

  return {
    source: normalizeSource(rawSource),
    medium: cleanField(medium),
    campaign: cleanField(campaign),
    referrer: externalReferrer,
    landingPage: req.nextUrl.pathname.slice(0, 255),
    firstSeenAt: new Date().toISOString(),
  }
}

/** Write the attribution cookie onto a response (90-day, first-party). */
function setAttributionCookie(res: NextResponse, attribution: object) {
  res.cookies.set(ATTRIBUTION_COOKIE, encodeURIComponent(JSON.stringify(attribution)), {
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 days
    sameSite: 'lax',
  })
}

async function fetchWaitlistStatus(origin: string): Promise<boolean> {
  const url = new URL('/api/waitlist/status', origin)
  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1'
  }
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    return data.enabled
  } catch (e) {
    console.error('Failed to fetch waitlist status in middleware:', e)
    return true // Safe fallback
  }
}

function isPublicProfilePath(pathname: string): boolean {
  if (pathname.includes('.') || pathname.startsWith('/_next') || pathname.startsWith('/uploads')) {
    return false
  }
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 1) return false
  
  const reservedNames = [
    'waitlist', 'checkout', 'admin', 'api', 'signin', 'register', 'onboarding',
    'dashboard', 'profile', 'tasks', 'submissions', 'earnings', 'settings',
    'analytics', 'developers', 'escrow', 'messages', 'notifications', 'post-task',
    'support', 'auth-error', 'whats-forke', 'levels', 'contact', 'terms', 'privacy',
    'refund', 'blogs', 'changelog', 'docs',
    // Workspace routes (sandbox feature)
    'owner', 'developer'
  ]
  return !reservedNames.includes(segments[0])
}

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname

  // Bypass all static files and system assets containing a dot (like .glb, .svg, .png, etc.)
  // and Next.js internal /_next paths or custom /uploads paths.
  if (
    pathname.includes('.') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    pathname.endsWith('/opengraph-image')
  ) {
    return NextResponse.next()
  }

  // Redirect /@username to /username
  if (pathname.startsWith('/@')) {
    const targetPath = pathname.replace('/@', '/')
    const redirectUrl = new URL(targetPath, req.nextUrl.origin)
    redirectUrl.search = req.nextUrl.search
    return NextResponse.redirect(redirectUrl)
  }

  // ===== ATTRIBUTION CAPTURE + CLEAN-URL REDIRECT =====
  // If the visitor arrived with tracking params (?source=, utm_*, ?ref=), capture them into the
  // first-touch cookie, then redirect to the same URL WITHOUT those params. This keeps the address
  // bar clean — so if the visitor later shares the page from their browser, they share a plain link
  // and don't accidentally pass their own attribution on to the next person.
  const hasTrackingParams = TRACKING_PARAMS.some((p) => req.nextUrl.searchParams.has(p))
  if (hasTrackingParams) {
    const cleanUrl = new URL(req.nextUrl.pathname, req.nextUrl.origin)
    // Preserve any non-tracking query params the page may legitimately use (e.g. ?email=).
    req.nextUrl.searchParams.forEach((value, key) => {
      if (!TRACKING_PARAMS.includes(key)) cleanUrl.searchParams.set(key, value)
    })
    const redirect = NextResponse.redirect(cleanUrl)
    const attribution = computeAttribution(req)
    if (attribution) setAttributionCookie(redirect, attribution)
    return redirect
  }

  const siteAccess = req.cookies.get('site_access')?.value
  const waitlistJoined = req.cookies.get('waitlist_joined')?.value
  const waitlistEnabled = await fetchWaitlistStatus(req.nextUrl.origin)

  // Helper function to append tracking cookies and disable page cache
  const withCookies = (res: NextResponse) => {
    res.cookies.set('site_access_public', siteAccess ? 'true' : 'false', { path: '/' })
    res.cookies.set('waitlist_active', waitlistEnabled ? 'true' : 'false', { path: '/' })
    // Capture attribution for requests that aren't being redirected to a clean URL below
    // (e.g. an external referrer with no UTM tags — nothing to strip from the address bar).
    const attribution = computeAttribution(req)
    if (attribution && !TRACKING_PARAMS.some((p) => req.nextUrl.searchParams.has(p))) {
      setAttributionCookie(res, attribution)
    }
    if (!pathname.startsWith('/_next') && !pathname.startsWith('/api') && pathname !== '/favicon.ico') {
      res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    }
    return res
  }

  // ===== WAITLIST GATE =====
  const isWaitlistAllowed =
    pathname === '/waitlist' ||
    pathname === '/checkout' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/waitlist') ||
    pathname.startsWith('/api/checkout') ||
    pathname.startsWith('/api/auth') ||
    pathname.endsWith('/opengraph-image') ||
    // Workspace routes — always accessible (sandbox OAuth feature)
    pathname === '/owner' ||
    pathname === '/developer' ||
    // The blog is a public, indexable surface — readable even during the
    // waitlist gate so posts can be shared and crawled.
    pathname === '/blogs' ||
    pathname.startsWith('/blogs/') ||
    // The changelog is public for the same reason — proof of shipping velocity.
    pathname === '/changelog' ||
    // Docs are a public, indexable surface — readable during the waitlist gate
    // so the product can be understood and the pages can be crawled/shared.
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    isPublicProfilePath(pathname)

  // If waitlist is active and the user doesn't have site_access
  if (waitlistEnabled && !siteAccess && !isWaitlistAllowed) {
    if (waitlistJoined) {
      // Waitlisters can view marketing/policy pages
      const isMarketingPage =
        pathname === '/' ||
        pathname === '/whats-forke' ||
        pathname === '/levels' ||
        pathname === '/contact' ||
        pathname === '/terms' ||
        pathname === '/privacy' ||
        pathname === '/refund'

      if (!isMarketingPage) {
        // Redirect dashboard and real site pages to landing page
        const redirectUrl = new URL('/', req.nextUrl.origin)
        redirectUrl.search = req.nextUrl.search
        return withCookies(NextResponse.redirect(redirectUrl))
      }
    } else {
      // Redirect users who haven't joined to waitlist
      const redirectUrl = new URL('/waitlist', req.nextUrl.origin)
      redirectUrl.search = req.nextUrl.search
      return withCookies(NextResponse.redirect(redirectUrl))
    }
  }

  // If user HAS access (or waitlist is disabled, or already joined) and tries to visit /waitlist, redirect them to /
  if (pathname === '/waitlist') {
    if (!waitlistEnabled || siteAccess || waitlistJoined) {
      const redirectUrl = new URL('/', req.nextUrl.origin)
      redirectUrl.search = req.nextUrl.search
      return withCookies(NextResponse.redirect(redirectUrl))
    }
  }

  // ===== EXISTING AUTH LOGIC =====
  const isLoggedIn = !!req.auth
  const isBanned = (req.auth?.user as any)?.isBanned
  const isAppPage = req.nextUrl.pathname.startsWith('/dashboard') || 
                    req.nextUrl.pathname.startsWith('/tasks') ||
                    req.nextUrl.pathname.startsWith('/profile') ||
                    req.nextUrl.pathname.startsWith('/submissions') ||
                    req.nextUrl.pathname.startsWith('/earnings')
  
  const isAdminPage = req.nextUrl.pathname.startsWith('/admin')
  const isAdminLogin = req.nextUrl.pathname === '/admin/login'
  const isAdminSetup = req.nextUrl.pathname === '/admin/setup'

  // Block banned users
  if (isLoggedIn && isBanned && !isAdminPage && !req.nextUrl.pathname.startsWith('/auth-error')) {
     const errorUrl = new URL('/auth-error?error=AccessDenied', req.nextUrl.origin)
     return withCookies(NextResponse.redirect(errorUrl))
  }

  // Admin protection
  if (isAdminPage && !isAdminLogin && !isAdminSetup) {
    const adminToken = req.cookies.get('admin_token')?.value
    if (!adminToken || !adminToken.startsWith('forke_admin_session:')) {
      return withCookies(NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin)))
    }
  }

  if (isAppPage && !isLoggedIn) {
    const loginUrl = new URL('/', req.nextUrl.origin)
    return withCookies(NextResponse.redirect(loginUrl))
  }

  // Redirect logged in users from root to dashboard (only if waitlist is disabled or they have site access)
  if (isLoggedIn && req.nextUrl.pathname === '/' && (!waitlistEnabled || siteAccess)) {
    return withCookies(NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin)))
  }

  // Onboarding redirection for developers without username
  const role = (req.auth?.user as any)?.role
  const username = (req.auth?.user as any)?.username
  const isOnboardingPage = req.nextUrl.pathname === '/onboarding'

  const needsOnboarding = role === 'developer' && !username

  if (isLoggedIn && needsOnboarding && !isOnboardingPage && isAppPage) {
    return withCookies(NextResponse.redirect(new URL('/onboarding', req.nextUrl.origin)))
  }

  // Prevent users who don't need onboarding from accessing it
  if (isLoggedIn && !needsOnboarding && isOnboardingPage) {
    return withCookies(NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin)))
  }
  
  return withCookies(NextResponse.next())
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|glb|gltf|svg|jpg|jpeg|gif|webp|ico|css|js|woff2?|json)$|.*\\/opengraph-image$).*)'],
}
