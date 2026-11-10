'use client'

import { useEffect, useState } from 'react'

const READY_EVENT = 'forke:ready'

declare global {
  interface Window { __forkeReady?: boolean }
}

export function markAppReady() {
  window.__forkeReady = true
  window.dispatchEvent(new Event(READY_EVENT))
}

export function useAppReady(waitForApp: boolean) {
  const [ready, setReady] = useState(!waitForApp)
  useEffect(() => {
    if (!waitForApp || window.__forkeReady) { setReady(true); return }
    const on = () => setReady(true)
    window.addEventListener(READY_EVENT, on)
    return () => window.removeEventListener(READY_EVENT, on)
  }, [waitForApp])
  return ready
}
