import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Skip static files & Next.js internals
  if (
    pathname.includes('.') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/uploads') ||
    pathname.endsWith('/opengraph-image')
  ) {
    return NextResponse.next()
  }

  // Handle legacy /admin path redirects
  if (pathname === '/admin') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }
  if (pathname === '/admin/login') {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  }
  if (pathname === '/admin/setup') {
    const redirectUrl = new URL('/setup', req.nextUrl.origin)
    redirectUrl.search = req.nextUrl.search
    return NextResponse.redirect(redirectUrl)
  }

  const adminToken = req.cookies.get('admin_token')?.value
  const isAuthenticated = adminToken && adminToken.startsWith('forke_admin_session:')

  const isPublicPage = pathname === '/login' || pathname === '/setup'

  // If unauthenticated and trying to access dashboard or private pages -> redirect to /login
  if (!isAuthenticated && !isPublicPage) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated and visiting login page -> redirect to dashboard /
  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.nextUrl.origin))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
