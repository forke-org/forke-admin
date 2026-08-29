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
import { ArrowRight } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function CTA() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
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
    // 1. Scroll-triggered entrance animations
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      }
    })

    tl.fromTo('.gsap-cta-card',
      { scale: 0.95, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1, ease: 'power3.out' }
    )
    .fromTo('.gsap-cta-title',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
      '-=0.6'
    )
    .fromTo('.gsap-cta-text',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      '-=0.6'
    )
    .fromTo(buttonRef.current,
      { y: 10, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
      '-=0.4'
    )
    .fromTo('.gsap-cta-mascot',
      { x: 150, opacity: 0 },
      { x: 0, opacity: 1, duration: 1.5, ease: 'power4.out' },
      '-=1'
    )

    // 2. Slow particle floating animation
    gsap.utils.toArray<HTMLElement>('.gsap-cta-particle').forEach((particle, index) => {
      const yOffset = 15 + (index % 3) * 5
      const xOffset = 10 + (index % 2) * 5
      const duration = 4 + (index % 2) * 2
      
      gsap.to(particle, {
        x: `+=${xOffset}`,
        y: `+=${yOffset}`,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: index * 0.4
      })
    })

    // 3. Magnetic Button Effect
    const btn = buttonRef.current
    if (!btn) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      
      // Pull button towards cursor
      gsap.to(btn, {
        x: x * 0.35,
        y: y * 0.35,
        duration: 0.3,
        ease: 'power2.out'
      })
    }

    const handleMouseLeave = () => {
      // Snap button back to original position
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)'
      })
    }

    btn.addEventListener('mousemove', handleMouseMove)
    btn.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      btn.removeEventListener('mousemove', handleMouseMove)
      btn.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, { scope: containerRef })

  return (
    <section ref={containerRef} className="py-16 sm:py-24 bg-bg relative overflow-hidden">
      {/* ===== PHONE-ONLY CTA — clean centered card (matches /levels styling) ===== */}
      <div className="md:hidden max-w-7xl mx-auto px-4 relative z-10 min-[1920px]:max-w-[1920px]">
        <div className="gsap-cta-card p-8 rounded-[2.5rem] bg-[#0a0a0a] border border-white/[0.04] shadow-2xl relative overflow-hidden text-center opacity-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,122,0,0.06)_0%,_transparent_55%)] pointer-events-none" />
          <div className="space-y-6 relative z-10">
            <h2 className="gsap-cta-title text-3xl font-medium text-white leading-tight tracking-[-0.03em] opacity-0">
              Ready to <span className="font-serif italic font-normal text-accent">ship?</span>
            </h2>
            <p className="gsap-cta-text text-white/50 text-sm leading-relaxed font-light opacity-0">
              Join Forke and start earning while you code.
            </p>
            <div className="flex justify-center opacity-0 gsap-cta-text">
              <Button
                size="lg"
                className="rounded-full px-7 py-3 h-auto text-xs font-bold uppercase tracking-wider bg-[#FF7A00] hover:bg-[#FF8B1F] text-black transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 group/btn shadow-[0_4px_20px_rgba(255,122,0,0.15)]"
                onClick={() => router.push(showWaitlisterView ? '/waitlist' : '/signin')}
              >
                {showWaitlisterView ? 'Join the waitlist' : 'Join the movement'}
                <span className="ml-1 w-6 h-6 rounded-full bg-black/10 flex items-center justify-center transition-transform duration-300 group-hover/btn:translate-x-0.5 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
                </span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TABLET + DESKTOP CTA — original "Ready to ship?" + Forky layout ===== */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 relative z-10 min-[1920px]:max-w-[1920px]">
        {/* CTA Card */}
        <div
          className="gsap-cta-card relative rounded-[1.5rem] sm:rounded-[2.5rem] overflow-x-clip overflow-y-visible border border-white/[0.06] min-h-[200px] md:min-h-[320px] opacity-0"
          style={{
            background: 'linear-gradient(135deg, #0a0a0a 0%, #111 30%, #1a1208 60%, #1f1510 80%, #1a1008 100%)'
          }}
        >
          {/* Warm ambient glow behind the mascot */}
          <div className="absolute top-0 right-0 w-[60%] h-full bg-[radial-gradient(ellipse_at_70%_50%,_rgba(255,122,0,0.1)_0%,_transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-0 right-[20%] w-[400px] h-[200px] bg-[radial-gradient(ellipse_at_center,_rgba(255,122,0,0.06)_0%,_transparent_70%)] pointer-events-none" />
          
          {/* Floating particles */}
          <div className="gsap-cta-particle absolute top-[20%] right-[30%] w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse" />
          <div className="gsap-cta-particle absolute top-[35%] right-[48%] w-1 h-1 rounded-full bg-accent/30 animate-pulse [animation-delay:1s]" />
          <div className="gsap-cta-particle absolute bottom-[30%] right-[40%] w-1.5 h-1.5 rounded-full bg-accent/20 animate-pulse [animation-delay:0.5s]" />

          <div className="relative z-10 flex items-center min-h-[460px] md:min-h-[320px]">
            {/* Left side — Text + CTA */}
            <div className="flex-1 p-8 sm:p-12 md:p-10 lg:p-16 space-y-6 text-center md:text-left">
              <span className="gsap-cta-text ui-eyebrow block opacity-0">{'//'} your first merge is waiting</span>
              <h2 className="gsap-cta-title text-4xl md:text-5xl lg:text-6xl font-medium text-white tracking-[-0.03em] leading-[1.05] opacity-0">
                Ready to <span className="font-serif italic font-normal text-accent">ship?</span>
              </h2>
              <p className="gsap-cta-text text-base md:text-base lg:text-lg text-white/50 font-light max-w-md mx-auto md:mx-0 opacity-0">
                Join Forke and start earning while you code.
              </p>
              <Button
                ref={buttonRef}
                size="lg"
                variant="primary"
                className="h-12 px-7 py-0 gap-2 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] font-semibold tracking-tight shadow-none opacity-0 active:scale-[0.98] transition-transform mx-auto md:mx-0"
                onClick={() => {
                  if (showWaitlisterView) {
                    router.push('/waitlist')
                  } else {
                    router.push('/signin')
                  }
                }}
              >
                {showWaitlisterView ? <>Join the waitlist <ArrowRight className="w-4 h-4" /></> : <>Start earning <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </div>

            {/* Code snippet — positioned closer to the mascot */}
            <div className="hidden lg:block absolute right-[37%] top-1/3 -translate-y-1/2 opacity-[0.12]">
              <pre className="font-mono text-sm text-accent leading-relaxed">
{`const hustle = () => {
  ship();
  earn();
  repeat();
};`}
              </pre>
            </div>
          </div>

          {/* Right side — Chilling Forky Mascot (massive, overflows card). Mobile: centered at the bottom of the card. */}
          <div className="gsap-cta-mascot absolute opacity-0 pointer-events-none
            bottom-0 left-1/2 -translate-x-1/2 w-[420px] max-w-[95%] h-[260px]
            md:bottom-[-3rem] md:left-auto md:translate-x-0 md:right-2 md:w-[520px] md:max-w-none md:h-[360px]
            lg:bottom-[-4.5rem] lg:right-4 lg:w-[750px] lg:h-[520px]">
            <Image
              src="/forke-assets/landing-assets/chilling_forky.webp"
              alt="Chilling Forky"
              fill
              sizes="(max-width: 768px) 420px, (max-width: 1024px) 520px, 750px"
              loading="lazy"
              className="object-contain object-bottom"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
