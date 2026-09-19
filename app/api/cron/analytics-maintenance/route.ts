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
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { logAudit } from '@/lib/actions/audit-actions'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const searchParams = request.nextUrl.searchParams
  const secretParam = searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : secretParam
  const isForkeCron = request.headers.get('x-forke-cron') === 'true'
  const isLocalhost = request.nextUrl.hostname === '127.0.0.1' || request.nextUrl.hostname === 'localhost'

  if (cronSecret && token !== cronSecret && !isForkeCron && !isLocalhost) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 1. Roll up recent visits into analytics_daily_rollups
    await db.execute(sql`
      INSERT INTO analytics_daily_rollups (date, page_group, source, country, is_bot, bot_category, bot_name, visit_count, unique_sessions)
      SELECT 
        DATE(created_at) as date,
        CASE 
          WHEN landing_path = '/' THEN 'home'
          WHEN landing_path LIKE '/docs%' THEN 'docs'
          WHEN landing_path LIKE '/pricing%' THEN 'pricing'
          WHEN landing_path LIKE '/checkout%' THEN 'checkout'
          WHEN landing_path LIKE '/blog%' THEN 'blog'
          WHEN bot_category = 'malicious_scanner' THEN 'scanner_probe'
          WHEN landing_path LIKE '/robots.txt%' OR landing_path LIKE '/sitemap%' THEN 'meta'
          ELSE 'profile'
        END as page_group,
        COALESCE(source, 'direct') as source,
        COALESCE(country, 'XX') as country,
        is_bot,
        bot_category,
        bot_name,
        COUNT(*) as visit_count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM page_visits
      WHERE created_at >= NOW() - INTERVAL '3 days'
      GROUP BY 1, 2, 3, 4, 5, 6, 7
      ON CONFLICT (date, page_group, source, country, is_bot, bot_category, bot_name)
      DO UPDATE SET 
        visit_count = EXCLUDED.visit_count,
        unique_sessions = EXCLUDED.unique_sessions;
    `)

    // 2. Purge raw bot visits older than 14 days
    const botPurge = await db.execute(sql`
      DELETE FROM page_visits 
      WHERE is_bot = true AND created_at < NOW() - INTERVAL '14 days'
    `)

    // 3. Purge raw human visits older than 90 days
    const humanPurge = await db.execute(sql`
      DELETE FROM page_visits 
      WHERE is_bot = false AND created_at < NOW() - INTERVAL '90 days'
    `)

    await logAudit({
      category: 'system',
      action: 'system.analytics_maintenance_cron',
      target: 'Rolled up recent visits into analytics_daily_rollups and enforced tiered retention (14-day bots, 90-day humans)',
    })

    return NextResponse.json({
      success: true,
      message: 'Analytics maintenance executed: rollups refreshed and tiered retention applied.',
    })
  } catch (error: any) {
    console.error('Analytics maintenance error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Maintenance failed' }, { status: 500 })
  }
}
