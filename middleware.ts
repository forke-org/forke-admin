import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

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

export default auth(async (req) => {
  // ===== WAITLIST GATE =====
  // Block all routes unless the user has the site_access cookie.
  // Only /waitlist, /checkout, /admin, and their API routes are allowed through.
  const siteAccess = req.cookies.get('site_access')?.value
  const pathname = req.nextUrl.pathname

  const isWaitlistAllowed = 
    pathname === '/waitlist' ||
    pathname === '/checkout' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/waitlist') ||
    pathname.startsWith('/api/checkout') ||
    pathname.startsWith('/api/auth')

  if (!siteAccess && !isWaitlistAllowed) {
    // Dynamically check if the waitlist is enabled (force fresh state check)
    const waitlistEnabled = await fetchWaitlistStatus(req.nextUrl.origin)

    if (waitlistEnabled) {
      return NextResponse.redirect(new URL('/waitlist', req.nextUrl.origin))
    }
  }

  // If user HAS access (or waitlist is disabled) and tries to visit /waitlist, redirect them
  if (pathname === '/waitlist') {
    const waitlistEnabled = await fetchWaitlistStatus(req.nextUrl.origin)

    if (!waitlistEnabled || siteAccess) {
      return NextResponse.redirect(new URL('/', req.nextUrl.origin))
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
     return NextResponse.redirect(errorUrl)
  }

  // Admin protection
  if (isAdminPage && !isAdminLogin && !isAdminSetup) {
    const adminToken = req.cookies.get('admin_token')?.value
    if (!adminToken || !adminToken.startsWith('forke_admin_session:')) {
      return NextResponse.redirect(new URL('/admin/login', req.nextUrl.origin))
    }
  }

  if (isAppPage && !isLoggedIn) {
    const loginUrl = new URL('/', req.nextUrl.origin)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect logged in users from root to dashboard
  if (isLoggedIn && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin))
  }

  // Onboarding redirection for developers without githubUrl or username
  const role = (req.auth?.user as any)?.role
  const githubUrl = (req.auth?.user as any)?.githubUrl
  const username = (req.auth?.user as any)?.username
  const isOnboardingPage = req.nextUrl.pathname === '/onboarding'

  const needsOnboarding = role === 'developer' && (!githubUrl || !username)

  if (isLoggedIn && needsOnboarding && !isOnboardingPage && isAppPage) {
    return NextResponse.redirect(new URL('/onboarding', req.nextUrl.origin))
  }

  // Prevent users who don't need onboarding from accessing it
  if (isLoggedIn && !needsOnboarding && isOnboardingPage) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl.origin))
  }
  
  const response = NextResponse.next()

  // Disable browser caching for all page routes to make waitlist activation instant on reload
  if (!pathname.startsWith('/_next') && !pathname.startsWith('/api') && pathname !== '/favicon.ico') {
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
  }

  return response
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
