/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateDatabaseBackupAction } from '@/lib/db-client-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check CRON_SECRET for security
  const authHeader = request.headers.get('authorization')
  const searchParams = request.nextUrl.searchParams
  const secretParam = searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  // Allow authorization header (e.g. "Bearer <secret>") or query parameter "?secret=<secret>"
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : secretParam

  // Validate request. Vercel Cron requests include a specific header (which we can check if CRON_SECRET is configured)
  const isVercelCron = request.headers.get('x-vercel-cron') === 'true'
  
  if (cronSecret && token !== cronSecret && !isVercelCron) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateDatabaseBackupAction()
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Database backup cron completed successfully' })
  } catch (error: any) {
    console.error('Database backup cron route error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Backup failed' }, { status: 500 })
  }
}
