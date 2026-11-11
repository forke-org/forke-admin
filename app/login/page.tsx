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
import { AsciiUser } from '@/components/admin/AsciiUser'
import { useRouter } from 'next/navigation'
import { User, ShieldAlert, KeyRound, Eye, EyeOff } from 'lucide-react'

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
        <p className="text-xs text-[#5f5c5a]">© 2026 forke — all rights reserved</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[radial-gradient(70%_60%_at_50%_48%,#1d1310_0%,#120c0a_55%,#0d0908_100%)] lg:block">
        <AsciiUser />
        <span aria-hidden className="rail-y pointer-events-none absolute inset-y-0 left-0 w-px" />
      </div>
    </div>
  )
}
