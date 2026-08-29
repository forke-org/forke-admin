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

import React, { useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { ArrowRight, Flame, GitMerge } from 'lucide-react'
import DotField from './DotField'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import TechStackTicker from './TechStackTicker'

export default function Hero() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasSiteAccess, setHasSiteAccess] = React.useState(true)
  const [waitlistActive, setWaitlistActive] = React.useState(false)

  React.useEffect(() => {
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null
      return null
    }

    setHasSiteAccess(getCookie('site_access_public') === 'true')
    setWaitlistActive(getCookie('waitlist_active') === 'true')
  }, [])

  const showWaitlisterView = waitlistActive && !hasSiteAccess

  useGSAP(() => {
    // 1. Entrance timeline — fast, quiet, no bounce
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    tl.fromTo('.gsap-hero-eyebrow',
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, delay: 0.15 }
    )
    .fromTo('.gsap-hero-title',
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      '-=0.3'
    )
    .fromTo('.gsap-hero-subtitle',
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6 },
      '-=0.55'
    )
    .fromTo('.gsap-hero-btn',
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.08 },
      '-=0.4'
    )
    .fromTo('.gsap-hero-meta',
      { opacity: 0 },
      { opacity: 1, duration: 0.5 },
      '-=0.3'
    )
    .fromTo('.gsap-hero-mascot',
      { scale: 0.97, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.out' },
      '-=0.7'
    )
    .fromTo('.gsap-hero-badge',
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.09 },
      '-=0.6'
    )

    // 2. Slow drift on the badges — subtle, no rotation
    gsap.utils.toArray<HTMLElement>('.gsap-hero-badge').forEach((badge, index) => {
      const yOffset = 7 + (index % 3) * 3
      const duration = 5 + (index % 2) * 1.5
      const delay = index * 0.4

      gsap.to(badge, {
        y: `+=${yOffset}`,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: delay
      })
    })

    // 3. Mouse Parallax Effect
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const { clientX, clientY } = e
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2

      const moveX = clientX - centerX
      const moveY = clientY - centerY

      // Mascot Parallax
      gsap.to('.gsap-hero-mascot', {
        x: moveX * 0.015,
        y: moveY * 0.015,
        duration: 1.2,
        ease: 'power2.out',
        overwrite: 'auto'
      })

      // Badges Parallax
      gsap.utils.toArray<HTMLElement>('.gsap-hero-badge').forEach((badge) => {
        const speed = parseFloat(badge.getAttribute('data-speed') || '0.04')
        gsap.to(badge, {
          x: moveX * speed,
          y: moveY * speed,
          duration: 1,
          ease: 'power2.out',
          overwrite: 'auto'
        })
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="relative pt-32 pb-14 overflow-hidden bg-bg min-h-svh lg:min-h-dvh flex items-start lg:items-center">
      {/* Grain overlay — fixed, pointer-events-none, GPU-safe */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
      {/* Animated Background Components — clear circle follows Forky (center-low on mobile, right on desktop) */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none opacity-50
          [mask-image:radial-gradient(circle_at_50%_66%,transparent_8%,black_34%)]
          [-webkit-mask-image:radial-gradient(circle_at_50%_66%,transparent_8%,black_34%)]
          lg:[mask-image:radial-gradient(circle_at_80%_50%,transparent_10%,black_40%)]
          lg:[-webkit-mask-image:radial-gradient(circle_at_80%_50%,transparent_10%,black_40%)]"
      >
        <DotField
          dotRadius={1.2}
          dotSpacing={22}
          bulgeStrength={45}
          glowRadius={150}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={350}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#FF7A00"
          gradientTo="#E66E00"
          glowColor="#050505"
        />
      </div>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full min-[1920px]:max-w-[1920px]">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-10 relative z-30">
            <div className="space-y-6 text-center lg:text-left">
              {/* Terminal eyebrow */}
              <div className="gsap-hero-eyebrow inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] sm:text-xs text-white/55 opacity-0">
                <span>$ git push origin <span className="text-accent">payday</span></span>
                <span className="animate-caret text-accent -ml-1">▍</span>
              </div>

              <h1 className="gsap-hero-title text-[2.5rem] max-[420px]:text-[2.1rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.25rem] font-medium text-white leading-[1.04] tracking-[-0.04em] opacity-0">
                Ship real work. <br />
                Earn XP. <span className="font-serif italic font-normal text-accent">Get paid.</span>
              </h1>

              <p className="gsap-hero-subtitle text-base max-[420px]:text-sm sm:text-base md:text-lg text-white/50 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light opacity-0">
                Claim scoped bounties from real startups, ship the fix, and cash out to UPI the moment your PR merges. No resumes. No interviews.
              </p>
            </div>

            {/* CTA — flows under the text on desktop; on mobile it's lifted out (see below) so this is desktop-only here */}
            <div className="hidden lg:block space-y-5 pt-2">
              <div className="flex flex-col sm:flex-row gap-3">
                {showWaitlisterView ? (
                  <Button
                    size="lg"
                    className="gsap-hero-btn group h-12 px-7 py-0 gap-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] font-semibold tracking-tight shadow-none transition-colors opacity-0"
                    onClick={() => router.push('/waitlist')}
                  >
                    Join the waitlist <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="gsap-hero-btn group h-12 px-7 py-0 gap-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] font-semibold tracking-tight shadow-none transition-colors opacity-0"
                    onClick={() => router.push('/signin')}
                  >
                    Start earning <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                )}
                <a
                  href="#how-it-works"
                  className="gsap-hero-btn h-12 px-6 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 text-white/75 hover:text-white text-[15px] font-medium inline-flex items-center justify-center transition-colors opacity-0"
                >
                  See how it works
                </a>
              </div>
              <p className="gsap-hero-meta font-mono text-[11px] text-white/35 tracking-wide opacity-0">
                escrow protected&nbsp;&nbsp;·&nbsp;&nbsp;instant UPI payouts&nbsp;&nbsp;·&nbsp;&nbsp;25 levels to climb
              </p>
            </div>

          </div>

          {/* Hero Visual Area - Orbital Layout (Mobile: absolute overlay pinned to the lower half so it never pushes the ticker down; Desktop: absolute right) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-[44%] sm:top-[42%] w-[130%] max-[420px]:w-[120%] sm:w-[min(85%,56dvh)] md:w-[min(72%,60dvh)] aspect-square lg:top-1/2 lg:left-auto lg:translate-x-0 lg:-translate-y-1/2 lg:absolute lg:w-[1200px] lg:h-[1200px] lg:aspect-auto lg:right-[-300px] pointer-events-none z-0">

            {/* The Mascot */}
            <div
              className="gsap-hero-mascot absolute inset-0 flex items-center justify-center z-10 opacity-0"
              style={{
                maskImage: 'radial-gradient(circle, black 70%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 70%, transparent 95%)',
              }}
            >
               <Image
                 src="/forke-assets/landing-assets/hero-image-forky.webp"
                 alt="Forky Mascot"
                 fill
                 sizes="(max-width: 1024px) 130vw, 1200px"
                 className="object-contain"
                 priority
                 fetchPriority="high"
               />
            </div>

            {/* Floating task card — claim side */}
            <div
              className="gsap-hero-badge absolute top-[28%] left-[18%] lg:left-[24%] rounded-lg border border-white/10 bg-[#0c0c0f]/90 backdrop-blur-sm p-1.5 sm:p-2.5 lg:p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] z-20 pointer-events-auto opacity-0 md:hidden lg:block"
              data-speed="0.045"
            >
              <div className="flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
                <span className="font-mono text-[7px] sm:text-[10px] lg:text-xs text-white/80">fix-navbar-overflow</span>
                <span className="font-mono text-[7px] sm:text-[10px] lg:text-xs text-accent">₹300</span>
              </div>
              <div className="mt-1 lg:mt-1.5 flex items-center gap-1 lg:gap-1.5">
                <span className="rounded border border-white/10 bg-white/[0.04] px-1 lg:px-1.5 py-0.5 font-mono text-[5px] sm:text-[7px] lg:text-[9px] text-white/45">bug fix</span>
                <span className="rounded border border-white/10 bg-white/[0.04] px-1 lg:px-1.5 py-0.5 font-mono text-[5px] sm:text-[7px] lg:text-[9px] text-white/45">~1h</span>
              </div>
            </div>

            {/* Floating merged card — payout side */}
            <div
              className="gsap-hero-badge absolute top-[42%] right-[19%] rounded-lg border border-emerald-500/20 bg-[#0c0c0f]/90 backdrop-blur-sm p-1.5 sm:p-2.5 lg:p-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)] z-20 pointer-events-none opacity-0 md:hidden lg:block"
              data-speed="0.05"
            >
              <div className="flex items-center gap-1 lg:gap-1.5">
                <GitMerge className="w-2 h-2 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5 text-emerald-400" />
                <span className="font-mono text-[7px] sm:text-[10px] lg:text-xs text-white/80">pr #42 merged</span>
              </div>
              <p className="mt-1 lg:mt-1.5 font-mono text-[6px] sm:text-[9px] lg:text-[11px] text-emerald-400">payout sent → ₹800</p>
            </div>

            {/* Streak pill */}
            <div
              className="gsap-hero-badge absolute top-[24%] right-[42%] rounded-full border border-white/10 bg-[#0c0c0f]/90 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 lg:px-3.5 lg:py-2 flex md:hidden lg:flex items-center gap-1.5 lg:gap-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] z-20 pointer-events-none opacity-0"
              data-speed="0.03"
            >
              <Flame className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-accent fill-accent" />
              <span className="font-mono text-[7px] sm:text-[10px] lg:text-xs text-white/80">7-day streak</span>
            </div>

            {/* XP pill */}
            <div
              className="gsap-hero-badge absolute top-[58%] left-[28%] rounded-full border border-accent/25 bg-[#0c0c0f]/90 backdrop-blur-sm px-2 py-1 sm:px-2.5 sm:py-1.5 lg:px-3 lg:py-1.5 flex md:hidden lg:flex items-center z-10 pointer-events-none opacity-0 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
              data-speed="0.06"
            >
              <span className="font-mono text-[7px] sm:text-[10px] lg:text-xs text-accent">+250 xp</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only CTA — pinned below Forky, just above the ticker (anchored to the full-height section) */}
      <div className="lg:hidden absolute bottom-24 left-4 right-4 sm:left-6 sm:right-6 z-30 flex">
        {showWaitlisterView ? (
          <Button
            size="lg"
            className="gsap-hero-btn group w-full h-12 sm:h-14 py-0 gap-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] sm:text-base font-semibold tracking-tight shadow-none transition-colors opacity-0 flex items-center justify-center"
            onClick={() => router.push('/waitlist')}
          >
            Join the waitlist <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="gsap-hero-btn group w-full h-12 sm:h-14 py-0 gap-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] sm:text-base font-semibold tracking-tight shadow-none transition-colors opacity-0 flex items-center justify-center"
            onClick={() => router.push('/signin')}
          >
            Start earning <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        )}
      </div>

      {/* Supported Tech Stack Ticker at the bottom of Hero */}
      <div className="absolute bottom-0 left-0 w-full z-40">
        <TechStackTicker isHeroEmbedded />
      </div>

    </section>
  )
}
