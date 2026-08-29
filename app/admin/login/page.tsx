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
import { User, ShieldAlert, KeyRound, Eye, EyeOff, Terminal } from 'lucide-react'
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
      router.push('/admin')
      router.refresh()
    } else {
      setError(result.error || 'Failed to authenticate')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-[380px] space-y-6 animate-in fade-in zoom-in-95 duration-500">

        {/* Logo and Identity */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center h-20 relative mb-2">
            <div className="w-20 h-20 relative">
              <Image
                src="/forke-assets/forke_logo.png"
                alt="Logo"
                fill
                className="object-contain drop-shadow-[0_0_18px_rgba(255,122,0,0.3)] select-none pointer-events-none"
                draggable={false}
              />
            </div>
          </div>
          <div className="flex flex-col items-center space-y-3">
            <h1 className="text-3xl font-medium text-white tracking-[-0.04em] leading-[1.04]">
              forke<span className="text-accent">*</span> <span className="font-serif italic font-normal text-accent">Admin Panel</span>
            </h1>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-white/55">
              Secure Operations Interface
            </div>
          </div>
        </div>

        {/* Auth Console Card */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-8 rounded-3xl bg-[#0a0a0a]/80 border border-white/[0.06] space-y-6 shadow-[0_24px_64px_rgba(0,0,0,0.85)] backdrop-blur-3xl relative overflow-hidden group text-left"
        >
          {/* Subtle top edge glow border */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent pointer-events-none" />

          {/* Secure Access Badge */}
          <div className="flex items-center gap-2 bg-accent/[0.03] border border-accent/15 rounded-full px-3 py-1 w-fit">
            <Terminal className="w-3 h-3 text-accent animate-pulse" />
            <span className="text-[8px] text-accent font-black uppercase tracking-[0.18em] font-mono">Secure Node Access</span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/[0.07] border border-red-500/20 text-red-400 text-[13px] text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5 font-sans">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <User className="w-4 h-4" />
                </span>
                <input
                  name="username"
                  required
                  type="text"
                  autoComplete="off"
                  className="w-full h-10 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-colors font-sans"
                  placeholder="username or email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5 font-sans">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  className="w-full h-10 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-10 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-colors font-sans"
                  placeholder="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Authenticate Button */}
          <Button
            disabled={isLoading}
            className="w-full h-10 text-[13px] font-medium rounded-lg ui-btn-primary transition-colors font-sans"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>Signing in…</span>
              </div>
            ) : (
              'Sign in'
            )}
          </Button>

          {/* Institutional Disclaimer */}
          <div className="pt-5 border-t border-white/[0.04] text-center space-y-1.5">
            <p className="text-[8px] text-white/20 font-mono tracking-widest uppercase flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-red-500/30" /> Classified Environment
            </p>
            <p className="text-[7.5px] text-white/15 font-mono leading-normal max-w-[280px] mx-auto select-none">
              All interactions on this console are encrypted and recorded under system telemetry. Unauthorized entries are strictly prohibited.
            </p>
          </div>

        </form>
      </div>
    </div>
  )
}

