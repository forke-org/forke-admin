'use client'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { useCookieConsent } from './CookieConsentProvider'
import { GoogleAnalytics } from '@next/third-parties/google'

export function GoogleAnalyticsWrapper({ gaId }: { gaId?: string }) {
  const { consent } = useCookieConsent()

  if (!gaId || consent !== 'accepted') {
    return null
  }

  return <GoogleAnalytics gaId={gaId} />
}
