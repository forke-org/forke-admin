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
      } else if (toastType === 'deletion_scheduled') {
        toast('Your account has been scheduled for deletion in 30 days and you have been signed out.', 'info')
      } else if (toastType === 'deletion_cancelled') {
        toast('Your account deletion request has been cancelled! Welcome back.', 'success')
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

  const visibleToasts = toasts.slice(-4)

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end gap-3 w-full max-w-sm pointer-events-none px-4 md:px-0">
      <Suspense fallback={null}>
        <QueryToastHandler />
      </Suspense>

      {visibleToasts.map((t, idx) => {
        const isFourth = visibleToasts.length === 4 && idx === 0
        return (
          <div
            key={t.id}
            style={isFourth ? {
              maxHeight: '38px',
              maskImage: 'linear-gradient(to bottom, transparent, black 85%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 85%)',
              transform: 'scale(0.96) translateY(2px)',
            } : undefined}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-4 px-5 py-3 rounded-xl backdrop-blur-xl border text-xs font-mono font-medium animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-300 w-full select-none shadow-2xl transition-all",
              isFourth ? "opacity-35 select-none pointer-events-none" : "opacity-100",
              t.type === 'success' && "border-emerald-500/20 bg-[#070e0a]/95 text-emerald-400 shadow-[0_8px_30px_rgba(16,185,129,0.06)]",
              t.type === 'error' && "border-rose-500/20 bg-[#100608]/95 text-rose-400 shadow-[0_8px_30px_rgba(244,63,94,0.06)]",
              t.type === 'info' && "border-accent/25 bg-[#0e0a07]/95 text-accent shadow-[0_8px_30px_rgba(255,122,0,0.06)]"
            )}
          >
            <div className="flex items-center gap-3">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-450 shrink-0" />}
              {t.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              {t.type === 'info' && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
              <span className="text-white text-[12.5px] font-sans font-medium tracking-wide leading-normal">{t.message}</span>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5 shrink-0"
              aria-label="Close notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
