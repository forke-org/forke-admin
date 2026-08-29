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

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCookieConsent } from '../providers/CookieConsentProvider'
import { Button } from './Button'
import { ShieldCheck, Cookie } from 'lucide-react'

export function CookieConsentBanner() {
  const { consent, acceptConsent, declineConsent } = useCookieConsent()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (consent === null) {
      // Trigger slide-up animation after a short delay
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [consent])

  if (!mounted || consent !== null) {
    return null
  }

  return (
    <div
      className={`fixed bottom-6 right-6 left-6 md:left-auto md:max-w-md z-50 transition-all duration-500 transform ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
      }`}
    >
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d0d0f]/90 backdrop-blur-xl p-5 shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-accent">
            <Cookie className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-white flex items-center gap-1.5">
              We respect your privacy
            </h3>
            <p className="text-xs text-white/65 leading-relaxed">
              We use analytics and marketing cookies to optimize your platform experience, track visitor referrals, and measure performance.
            </p>
            <p className="text-[10px] text-white/60 leading-normal">
              By clicking <span className="text-white/70 font-semibold">Accept All</span>, you consent to our use of these technologies. You can read details in our{' '}
              <Link href="/privacy" className="text-accent hover:underline focus:outline-hidden font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={declineConsent}
            className="text-xs text-white/40 hover:text-white border border-transparent hover:border-white/[0.06] rounded-lg transition-all"
          >
            Decline
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={acceptConsent}
            className="text-xs font-semibold px-4 py-2 flex items-center gap-1.5 rounded-lg active:scale-95 transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Accept All
          </Button>
        </div>
      </div>
    </div>
  )
}
