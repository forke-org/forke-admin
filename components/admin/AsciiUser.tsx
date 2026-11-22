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

import React, { useEffect, useRef } from 'react'
import { mountAsciiUser } from '@/lib/ascii-user'

export function AsciiUser() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => (canvas.current ? mountAsciiUser(canvas.current) : undefined), [])
  return <canvas ref={canvas} aria-hidden className="absolute inset-0 block h-full w-full" />
}
