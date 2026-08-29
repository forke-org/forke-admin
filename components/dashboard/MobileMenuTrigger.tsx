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

import { Menu } from 'lucide-react'
import { useDashboard } from './DashboardContext'

export default function MobileMenuTrigger() {
  const { setIsMobileOpen } = useDashboard()

  return (
    <button 
      onClick={() => setIsMobileOpen(true)}
      className="md:hidden absolute top-2.5 left-4 z-40 w-9 h-9 rounded-xl flex items-center justify-center bg-[#0c0c0f]/60 backdrop-blur-xl border border-white/[0.08] text-white/60 hover:text-accent hover:border-accent/40 active:scale-95 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer"
      aria-label="Open menu"
    >
      <Menu className="w-4.5 h-4.5" />
    </button>
  )
}
