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

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { adminLogin } from '@/lib/admin-actions'
import { useRouter } from 'next/navigation'
import { User, ShieldAlert, KeyRound, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

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
    <div className="grid min-h-screen bg-[var(--color-bg)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2">
          <Image src="/forke-assets/forke_logo.png" alt="" width={24} height={24} className="h-6 w-6 scale-[2] object-contain" draggable={false} />
          <span className="flex items-baseline gap-1.5 text-[18px] tracking-[-0.04em]">
            <span className="font-semibold text-white">forke<span className="text-accent">*</span></span>
            <span className="font-normal text-[var(--color-text-muted)]">admin</span>
          </span>
        </div>
        <form onSubmit={handleSubmit} noValidate className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center py-12">
          <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-[1.5px] bg-accent" />Admin console
          </div>
          <h1 className="text-[30px] font-medium leading-tight tracking-[-0.035em] text-white">Sign in to Forke admin</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Use your admin username or email and password.</p>

          <div className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[#c9c7c5]">Username or email</span>
              <span className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input name="username" required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus className="app-field h-10 w-full pl-9 pr-3 text-sm placeholder:text-white/25" />
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[#c9c7c5]">Password</span>
              <span className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input name="password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="app-field h-10 w-full pl-9 pr-10 text-sm placeholder:text-white/25" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-[var(--color-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-[6px] bg-red-500/[0.08] px-3 py-2.5 text-[13px] text-red-400 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.18)]">
                <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button disabled={isLoading} className="ui-btn-primary mt-1 h-10 w-full text-sm">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </Button>
          </div>
        </form>
        <p className="text-xs text-[#5f5c5a]">Access is restricted to Forke administrators.</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[#0b0604] lg:block">
        <span aria-hidden className="rail-y pointer-events-none absolute inset-y-0 left-0 w-px" />
        <div className="absolute inset-0 [background-image:radial-gradient(rgba(240,227,222,0.07)_1px,transparent_1px)] [background-size:14px_14px] [mask-image:linear-gradient(180deg,#000,transparent_75%)]" />
        <div className="absolute inset-x-[-20%] bottom-[-55%] h-[110%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,177,92,0.9),rgba(255,122,0,0.65)_35%,rgba(107,38,4,0.45)_65%,transparent)] blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-[repeating-linear-gradient(0deg,rgba(11,6,4,0.35)_0_2px,transparent_2px_6px)]" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="inline-flex w-fit items-center gap-2 rounded-[5px] border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-white/70 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-[1.5px] bg-[#4ade80]" />Operations console
          </div>
          <div>
            <h2 className="max-w-md text-[44px] font-medium leading-[1.04] tracking-[-0.04em] text-white">
              Run Forke from one place<span className="text-accent">*</span>
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
              Approvals, users, broadcasts, content and infrastructure, all in one console.
            </p>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-white/50">Users · Broadcasts · Database · Infra</div>
        </div>
      </div>
    </div>
  )
}
