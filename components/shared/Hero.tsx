'use client'

import React, { useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { Zap, Flame, Star } from 'lucide-react'
import DotField from './DotField'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

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
    // 1. Entrance timeline
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    
    tl.fromTo('.gsap-hero-title', 
      { y: 50, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.2, delay: 0.2 }
    )
    .fromTo('.gsap-hero-subtitle',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1 },
      '-=0.8'
    )
    .fromTo('.gsap-hero-btn',
      { scale: 0.9, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'back.out(1.5)' },
      '-=0.6'
    )
    .fromTo('.gsap-hero-mascot',
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.5, ease: 'elastic.out(1, 0.75)' },
      '-=1.2'
    )
    .fromTo('.gsap-hero-badge',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1, stagger: 0.12, ease: 'back.out(1.7)' },
      '-=1'
    )

    // 2. Slow floating/breathing animation for badges
    gsap.utils.toArray<HTMLElement>('.gsap-hero-badge').forEach((badge, index) => {
      const yOffset = 12 + (index % 3) * 4
      const duration = 4 + (index % 2) * 1.5
      const delay = index * 0.3
      
      gsap.to(badge, {
        y: `+=${yOffset}`,
        rotation: index % 2 === 0 ? '+=2' : '-=2',
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
    <section ref={containerRef} className="relative pt-32 pb-14 overflow-hidden bg-bg min-h-dvh flex items-center">
      {/* Grain overlay — fixed, pointer-events-none, GPU-safe */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
      {/* Animated Background Components */}
      <div 
        className="absolute inset-0 z-[1] pointer-events-none opacity-50"
        style={{
          maskImage: 'radial-gradient(circle at 80% 50%, transparent 10%, black 40%)',
          WebkitMaskImage: 'radial-gradient(circle at 80% 50%, transparent 10%, black 40%)',
        }}
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

 
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-12 relative z-30">
            <div className="space-y-6">
              <h1 className="gsap-hero-title font-serif text-5xl sm:text-6xl md:text-8xl text-white leading-[1.1] tracking-tight opacity-0">
                Ship real work. <br />
                Earn XP. <span className="text-accent text-glow">Get paid.</span>
              </h1>

              <p className="gsap-hero-subtitle text-lg sm:text-xl md:text-2xl text-white/50 max-w-xl leading-relaxed font-light opacity-0">
                Micro-task marketplace for developers. Claim bounties, build reputation and cash out instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-5 pt-6">
              {showWaitlisterView ? (
                <Button 
                  size="lg" 
                  className="gsap-hero-btn gap-2 text-lg px-8 py-5 rounded-xl bg-gradient-to-b from-accent to-[#d97706] border-b-2 border-black/30 shadow-[0_4px_0_rgb(180,83,9)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgb(180,83,9)] active:translate-y-[4px] active:shadow-none transition-all duration-75 text-bg font-bold tracking-tight opacity-0"
                  onClick={() => router.push('/')}
                >
                  Coming Soon
                </Button>
              ) : (
                <>
                  <Button 
                    size="lg" 
                    className="gsap-hero-btn gap-2 text-lg px-8 py-5 rounded-xl bg-gradient-to-b from-accent to-[#d97706] border-b-2 border-black/30 shadow-[0_4px_0_rgb(180,83,9)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgb(180,83,9)] active:translate-y-[4px] active:shadow-none transition-all duration-75 text-bg font-bold tracking-tight opacity-0"
                    onClick={() => router.push('/register?role=developer')}
                  >
                    Start Grinding <Zap className="w-5 h-5 fill-current" />
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="gsap-hero-btn text-lg px-8 py-5 rounded-xl border-2 border-accent/20 text-accent hover:bg-accent/5 transition-all font-bold opacity-0"
                    onClick={() => router.push('/register?role=owner')}
                  >
                    Post a Task
                  </Button>
                </>
              )}
            </div>

          </div>

          {/* Hero Visual Area - Orbital Layout (desktop only — too wide for phones) */}
          <div className="hidden lg:block absolute right-[-300px] top-1/2 -translate-y-1/2 w-[1200px] h-[1200px] pointer-events-none">
            
            {/* Connecting Lines SVG Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible opacity-20">
              <defs>
                <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="var(--color-accent)" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path d="M 300 450 Q 450 500 600 600" stroke="url(#line-grad)" strokeWidth="1" fill="transparent" className="animate-pulse" />
              <path d="M 900 350 Q 800 450 650 600" stroke="url(#line-grad)" strokeWidth="1" fill="transparent" className="animate-pulse" />
            </svg>

            {/* The Mascot */}
            <div 
              className="gsap-hero-mascot absolute inset-0 flex items-center justify-center z-10 opacity-0"
              style={{
                maskImage: 'radial-gradient(circle, black 70%, transparent 95%)',
                WebkitMaskImage: 'radial-gradient(circle, black 70%, transparent 95%)',
              }}
            >
               <Image 
                 src="/forke-assets/landing-assets/hero-image-forky.png" 
                 alt="Forky Mascot" 
                 fill
                 className="object-contain"
                 priority
               />
            </div>

            {/* Floating Rupees */}
            <div 
              className="gsap-hero-badge absolute top-[45%] left-[25%] w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xl font-bold z-0 rotate-[-5deg] opacity-0"
              data-speed="0.07"
            >
              ₹
            </div>
            <div 
              className="gsap-hero-badge absolute top-[58%] right-[25%] w-12 h-12 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-lg font-bold z-0 rotate-[9deg] opacity-0"
              data-speed="0.06"
            >
              ₹
            </div>

            {/* Floating Task Cards */}
            <div 
              className="gsap-hero-badge absolute top-[28%] left-[26%] glass p-3 rounded-xl shadow-glow z-0 pointer-events-auto transition-transform opacity-0"
              data-speed="0.04"
            >
              <div className="flex items-center justify-between gap-6 mb-1">
                <span className="text-xs font-medium text-white">Fix navbar overflow</span>
                <span className="text-accent font-bold text-xs">₹300</span>
              </div>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold tracking-wider uppercase">Bug Fix</span>
            </div>

            <div 
              className="gsap-hero-badge absolute top-[42%] right-[19.5%] glass p-3 rounded-xl shadow-glow z-20 pointer-events-none transition-transform opacity-0"
              data-speed="0.05"
            >
              <div className="flex items-center justify-between gap-6 mb-1">
                <span className="text-xs font-medium text-white">Add dark mode</span>
                <span className="text-accent font-bold text-xs">₹600</span>
              </div>
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold tracking-wider uppercase">React</span>
            </div>

            {/* Streak Badge - Horizontal Pill */}
            <div 
              className="gsap-hero-badge absolute top-[24%] right-[42%] glass-orange px-4 py-2 rounded-full flex items-center gap-3 shadow-[0_0_30px_rgba(255,122,0,0.2)] z-20 border border-white/20 pointer-events-none hover:scale-105 transition-transform opacity-0"
              data-speed="0.03"
            >
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Flame className="w-5 h-5 text-accent fill-accent" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-lg leading-none">7</span>
                <span className="text-[8px] text-accent uppercase font-bold tracking-widest">Day Streak</span>
              </div>
            </div>

            {/* XP Badge - Tucked behind right ear tip */}
            <div 
              className="gsap-hero-badge absolute top-[27%] right-[30%] glass px-3 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl z-10 pointer-events-none rotate-[7deg] opacity-0"
              data-speed="0.02"
            >
              <Star className="w-4 h-4 text-accent fill-accent" />
              <span className="text-accent font-bold text-sm">+250 XP</span>
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}
