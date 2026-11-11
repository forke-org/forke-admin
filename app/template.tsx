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
import { usePathname } from 'next/navigation'
import { ForkyLoader, useLoaderMinimum } from '@/components/ui/ForkyLoader'
import { useAppReady } from '@/lib/app-ready'

let booted = false

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showLoader, setShowLoader] = useState(() => !booted)
  const minimum = useLoaderMinimum()
  const ready = useAppReady(pathname === '/')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    booted = true
    window.scrollTo(0, 0)
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="relative min-h-[100dvh]">
      <div className={visible ? 'opacity-100 transition-opacity duration-300' : 'opacity-0'}>{children}</div>
      {showLoader ? <ForkyLoader fullScreen exiting={minimum && ready} onExited={() => setShowLoader(false)} /> : null}
    </div>
  )
}
