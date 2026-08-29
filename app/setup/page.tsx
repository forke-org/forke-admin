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
import { useRouter, useSearchParams } from 'next/navigation'
import { validateInviteToken, setupAdminCredentials } from '@/lib/admin-dashboard-actions'
import { Button } from '@/components/ui/Button'
import { User, ShieldAlert, KeyRound, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'

function SetupFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isValidating, setIsValidating] = useState(true)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [inviteDetails, setInviteDetails] = useState<{ email: string; name: string } | null>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setValidationError('Invitation token is missing in the URL.')
      setIsValidating(false)
      return
    }

    async function checkToken() {
      try {
        const res = await validateInviteToken(token!)
        if (res.success) {
          setInviteDetails({ email: res.email!, name: res.name! })
        } else {
          setValidationError(res.error || 'Invalid or expired invitation token.')
        }
      } catch (err) {
        console.error('Validation error:', err)
        setValidationError('Failed to verify token. Please try again.')
      } finally {
        setIsValidating(false)
      }
    }

    checkToken()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!token) return

    if (!username.trim() || username.length < 3) {
      setSubmitError('Username must be at least 3 characters long.')
      return
    }

    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await setupAdminCredentials(token, username.trim(), password)
      if (res.success) {
        setIsSuccess(true)
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setSubmitError(res.error || 'Failed to complete credentials setup.')
      }
    } catch (err) {
      console.error('Setup error:', err)
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-xs text-[var(--color-text-muted)]">Verifying invitation token...</p>
      </div>
    )
  }

  if (validationError) {
    return (
      <div className="p-6 rounded-xl bg-white/[0.018] border border-[var(--color-border)] space-y-5 text-center max-w-md w-full">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-medium text-white tracking-[-0.03em]">Verification Failed</h2>
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{validationError}</p>
        </div>
        <Button 
          onClick={() => router.push('/login')}
          className="w-full h-10 text-[13px] font-medium rounded-lg ui-btn-secondary transition-colors"
        >
          Return to Login
        </Button>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="p-6 rounded-xl bg-white/[0.018] border border-[var(--color-border)] space-y-5 text-center max-w-md w-full animate-in zoom-in-95 duration-500">
        <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
          <Check className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-medium text-emerald-400 tracking-[-0.03em]">Setup Completed</h2>
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
            Your administrator account credentials have been successfully configured. Redirecting to login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="p-6 rounded-xl bg-white/[0.018] border border-[var(--color-border)] space-y-5 text-left max-w-md w-full"
    >
      <div className="border-b border-[var(--color-border)] pb-3">
        <h2 className="text-xl font-medium text-white tracking-[-0.03em] leading-[1.1]">
          Activate <span className="font-serif italic font-normal text-accent">credentials</span>
        </h2>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5">Choose your username and password</p>
      </div>

      <div className="p-3 rounded-lg bg-white/[0.02] border border-[var(--color-border)] space-y-0.5">
        <p className="text-[11px] text-[var(--color-text-muted)] font-medium">Invited User</p>
        <p className="text-[13px] font-medium text-white leading-tight">{inviteDetails?.name}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{inviteDetails?.email}</p>
      </div>

      {submitError && (
        <div className="p-3 rounded-lg bg-red-500/[0.07] border border-red-500/20 text-red-400 text-[13px] text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <User className="w-4 h-4" />
            </span>
            <input 
              required 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              autoComplete="off"
              className="w-full h-10 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-3 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-colors" 
              placeholder="e.g. your_name_123" 
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5">
            Password (min 8 chars)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <KeyRound className="w-4 h-4" />
            </span>
            <input 
              required 
              type={showPassword ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-10 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-colors" 
              placeholder="••••••••" 
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-muted)] ml-0.5">
            Confirm Password
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <KeyRound className="w-4 h-4" />
            </span>
            <input 
              required 
              type={showConfirmPassword ? "text" : "password"} 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 bg-white/[0.02] border border-[var(--color-border)] rounded-lg pl-9 pr-10 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-accent transition-colors" 
              placeholder="••••••••" 
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors p-1"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <Button 
        disabled={isSubmitting}
        className="w-full h-10 text-[13px] font-medium rounded-lg ui-btn-primary transition-colors"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            <span>Activating...</span>
          </div>
        ) : (
          'Activate Account'
        )}
      </Button>
    </form>
  )
}

export default function AdminSetupPage() {
  return (
    <div className="min-h-screen bg-[#070709] flex items-center justify-center p-6 relative overflow-hidden select-none">
      <div className="w-full max-w-[440px] space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-1000 flex flex-col items-center">
        {/* Logo and Identity */}
        <div className="text-center space-y-2">
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
              forke<span className="text-accent">*</span> <span className="font-serif italic font-normal text-accent">admin setup</span>
            </h1>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-white/55">
              Complete administrator account configuration
            </div>
          </div>
        </div>

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="w-6 h-6 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
            <p className="text-xs text-[var(--color-text-muted)]">Loading setup form...</p>
          </div>
        }>
          <SetupFormContent />
        </Suspense>

      </div>
    </div>
  )
}
