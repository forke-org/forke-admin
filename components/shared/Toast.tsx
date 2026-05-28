'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastListeners: Array<(toast: ToastMessage) => void> = []

export function toast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const newToast: ToastMessage = {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type
  }
  toastListeners.forEach(listener => listener(newToast))
}

function QueryToastHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const toastType = searchParams.get('toast')
    if (toastType) {
      if (toastType === 'created' || toastType === 'posted') {
        toast('Mission launched successfully!', 'success')
      } else if (toastType === 'claimed') {
        toast('Mission claimed successfully! Good luck.', 'success')
      } else if (toastType === 'approved') {
        toast('Submission approved! Bounty disbursed.', 'success')
      } else if (toastType === 'deleted') {
        toast('Mission deleted successfully.', 'success')
      }

      // Clear search param cleanly
      const params = new URLSearchParams(searchParams.toString())
      params.delete('toast')
      const newQuery = params.toString()
      const newUrl = pathname + (newQuery ? `?${newQuery}` : '')
      router.replace(newUrl)
    }
  }, [searchParams, router, pathname])

  return null
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handleNewToast = (newToast: ToastMessage) => {
      setToasts((prev) => [...prev, newToast])
      
      // Auto-remove after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id))
      }, 4000)
    }

    toastListeners.push(handleNewToast)
    return () => {
      toastListeners = toastListeners.filter(listener => listener !== handleNewToast)
    }
  }, [])

  return (
    <div className="fixed top-28 left-1/2 -translate-x-1/2 z-[99999] flex flex-col items-center gap-4 w-full max-w-lg pointer-events-none px-4">
      <Suspense fallback={null}>
        <QueryToastHandler />
      </Suspense>

      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center justify-between gap-4 px-6 py-4 rounded-2xl backdrop-blur-xl border text-xs font-mono font-medium animate-in fade-in slide-in-from-top-8 zoom-in-95 duration-500 w-full select-none shadow-2xl transition-all duration-300",
            t.type === 'success' && "border-emerald-500/30 bg-[#080f0c]/95 text-emerald-400 shadow-[0_12px_40px_rgba(16,185,129,0.08)]",
            t.type === 'error' && "border-rose-500/30 bg-[#120709]/95 text-rose-400 shadow-[0_12px_40px_rgba(244,63,94,0.08)]",
            t.type === 'info' && "border-accent/30 bg-[#0f0b07]/95 text-accent shadow-[0_12px_40px_rgba(255,122,0,0.08)]"
          )}
        >
          <div className="flex items-center gap-3.5">
            {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-450 shrink-0" />}
            {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            {t.type === 'info' && <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />}
            <span className="text-white text-[13px] font-sans font-medium tracking-wide leading-normal">{t.message}</span>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            className="text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 shrink-0"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
