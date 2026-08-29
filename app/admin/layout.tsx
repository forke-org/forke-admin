/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { redirect } from 'next/navigation'
import { isAdminAuthenticated } from '@/lib/admin-actions'
import { Metadata } from 'next'

// Admin routes read cookies (admin_token) for auth, so they must be rendered
// per-request. Without this, Next.js attempts static prerendering at build time
// and logs DYNAMIC_SERVER_USAGE errors from getCurrentAdmin's cookies() call.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin Control Unit',
  description: 'Forke administrative dashboard.',
  robots: {
    index: false,
    follow: false,
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authenticated = await isAdminAuthenticated()

  // Simple path check to avoid redirect loop
  if (!authenticated) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-bg">
      {children}
    </div>
  )
}
