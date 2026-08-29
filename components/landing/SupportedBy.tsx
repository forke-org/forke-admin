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

import React from 'react'

export default function SupportedBy() {
  return (
    <section className="py-12 bg-bg flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
          supported by
        </p>
        <a
          href="https://20rev.com/?source=forke.space"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-all duration-300 opacity-40 hover:opacity-100 hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/partners/20Rev.svg"
            alt="20Rev Logo"
            className="h-10 w-auto invert"
          />
        </a>
      </div>
    </section>
  )
}
