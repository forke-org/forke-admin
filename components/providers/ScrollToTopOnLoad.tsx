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

import { useEffect } from 'react'

/**
 * Forces every page (re)load to start at the very top, overriding the
 * browser's default scroll-position restoration on reload/back-forward.
 */
export function ScrollToTopOnLoad() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Stop the browser from restoring the previous scroll position on reload.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    // Jump to the top once the page has mounted.
    window.scrollTo(0, 0)
  }, [])

  return null
}
