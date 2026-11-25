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

import React, { useEffect, useRef, useState } from 'react'
import { adminLogin } from '@/lib/admin-actions'
import { LAND_MASK } from '@/lib/globe-land'
import { mountMailGlobe } from '@/lib/mail-globe'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, Loader2, XCircle } from 'lucide-react'

/** Same look as the Forke Mail login: the form on the left, the ASCII mail globe on the right. */

const fieldClass =
  'h-10 w-full rounded-[6px] border border-[rgba(240,227,222,0.16)] bg-[color-mix(in_srgb,#f4f4f5_3%,#1a1919)] px-3 text-sm text-[#f4f4f5] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#5f5c5a] hover:border-[color-mix(in_srgb,#f4f4f5_22%,transparent)] focus:border-accent focus:ring-3 focus:ring-accent/15'

function Globe() {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => (canvas.current ? mountMailGlobe(canvas.current, LAND_MASK) : undefined), [])
  return <canvas ref={canvas} aria-hidden className="absolute inset-0 block h-full w-full" />
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const username = (formData.get('username') as string)?.trim()
    const password = (formData.get('password') as string) || ''

    if (!username || !password) {
      setError('Please enter your username and password.')
      return
    }

    setIsLoading(true)
    const result = await adminLogin(formData)

    if (result.success) {
      router.push('/')
      router.refresh()
    } else {
      setError(result.error || 'Failed to authenticate')
      setIsLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-[#151414] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex flex-col px-6 py-6 sm:px-10">
        <span className="flex items-baseline gap-1.5 text-[18px] tracking-[-0.04em]">
          <span className="font-semibold text-[#f4f4f5]">forke<span className="text-accent">*</span></span>
          <span className="font-normal text-[#8e8e93]">admin</span>
        </span>
        <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-12">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[#8e8e93]">
            <span className="h-1.5 w-1.5 rounded-[1.5px] bg-accent" />Admin console
          </div>
          <h1 className="text-[30px] font-medium leading-tight tracking-[-0.035em] text-[#f4f4f5]">Log in to Forke admin</h1>
          <p className="mt-2 text-sm text-[#8e8e93]">Enter your admin username or email and password.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[#c9c7c5]">Username or email</span>
              <input name="username" required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus className={fieldClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[#c9c7c5]">Password</span>
              <span className="relative">
                <input name="password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`${fieldClass} pr-10`} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-[#8e8e93] transition-colors hover:bg-white/[0.06] hover:text-[#f4f4f5]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-[rgba(248,113,113,0.1)] px-3 py-2.5 text-[13px] text-[#f87171]">
                <XCircle className="mt-px h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-accent px-3.5 text-sm font-medium text-[#1a0a00] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.2),0_2px_10px_-4px_rgba(255,122,0,0.45)] transition-colors hover:bg-[#ff8c24] disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Logging in…</> : <>Log in<ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        </div>
        <p className="text-xs text-[#5f5c5a]">
          © 2026 forke &middot; staff only &middot;{' '}
          <a href="https://status.forke.space" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#f4f4f5]">Status</a>
        </p>
      </div>
      <div className="relative hidden overflow-hidden bg-[radial-gradient(120%_90%_at_0%_50%,#1d1310_0%,#120c0a_45%,#0d0908_100%)] lg:block">
        <Globe />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-px [background-image:linear-gradient(rgba(240,227,222,0.16)_50%,transparent_50%)] [background-size:1px_32px]" />
      </div>
    </div>
  )
}
