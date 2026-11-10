'use client'

import React, { useEffect, useRef } from 'react'
import { mountAsciiUser } from '@/lib/ascii-user'

export function AsciiUser() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => (canvas.current ? mountAsciiUser(canvas.current) : undefined), [])
  return <canvas ref={canvas} aria-hidden className="absolute inset-0 block h-full w-full" />
}
