'use client'

import React, { useRef } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

const LEVELS = [
  { 
    lvl: '1–5', 
    label: 'Early', 
    tasks: 'HTML/CSS, Basic Bug Fixes', 
    range: '₹200 - ₹500', 
    image: '/forke-assets/landing-assets/newcomer_forky.png',
    imgClass: 'scale-[0.94] -translate-y-2'
  },
  { 
    lvl: '6–10', 
    label: 'Mid', 
    tasks: 'React Components, CSS Logic', 
    range: '₹500 - ₹1200', 
    image: '/forke-assets/landing-assets/apprentice_forky.png',
    imgClass: 'scale-[1.08] -translate-y-1'
  },
  { 
    lvl: '11–15', 
    label: 'Skilled', 
    tasks: 'API Hooks, Full-stack Features', 
    range: '₹1200 - ₹3000', 
    isActive: true,
    image: '/forke-assets/landing-assets/builder_forky.png',
    imgClass: 'scale-x-[-0.92] scale-y-[0.92] -translate-y-1 translate-x-2.5'
  },
  { 
    lvl: '16–20', 
    label: 'Elite', 
    tasks: 'System Architecture, Database Fixes', 
    range: '₹3000 - ₹8000', 
    image: '/forke-assets/landing-assets/expert_forky.png',
    imgClass: 'scale-[1.0] -translate-y-1.5'
  },
  { 
    lvl: '21–25', 
    label: 'Legend', 
    tasks: 'Performance at Scale, Cloud DevOps', 
    range: '₹8000+', 
    image: '/forke-assets/landing-assets/architect_forky.png',
    imgClass: 'scale-x-[-0.92] scale-y-[0.92] -translate-y-1 translate-x-2.5'
  },
]

export default function LevelSystem() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // 1. Level System Main ScrollTrigger Timeline
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      }
    })

    // Header animate
    tl.fromTo('.gsap-lvl-title',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' }
    )
    .fromTo('.gsap-lvl-desc',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 },
      '-=0.6'
    )
    // Progress line animate (scale from left)
    .fromTo('.gsap-lvl-line',
      { scaleX: 0 },
      { scaleX: 1, duration: 1.2, ease: 'power3.inOut' },
      '-=0.4'
    )
    // Progress nodes animate
    .fromTo('.gsap-lvl-node',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(2)' },
      '-=0.8'
    )
    // Level cards stagger in
    .fromTo('.gsap-lvl-card',
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out' },
      '-=0.6'
    )


  }, { scope: containerRef })

  return (
    <section ref={containerRef} id="levels" className="py-32 px-4 bg-bg relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--color-accent-muted)_0%,_transparent_70%)] opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto text-center relative z-10">
        {/* Header */}
        <div className="space-y-4 mb-16">
          <h2 className="gsap-lvl-title font-serif text-5xl md:text-7xl text-white flex items-center justify-center gap-3 opacity-0">
            The Level System <span className="text-accent text-3xl">✦</span>
          </h2>
          <p className="gsap-lvl-desc text-muted text-lg max-w-2xl mx-auto font-light leading-relaxed opacity-0">
            The more you ship, the faster you level up. <br />
            Higher levels unlock bigger task budgets and exclusive bounties.
          </p>
        </div>

        {/* Progress Indicator Row */}
        <div className="relative flex items-center justify-between max-w-4xl mx-auto mb-16 px-8">
          {/* Base Connecting Line */}
          <div className="absolute top-1/2 left-8 right-8 h-[2px] bg-white/5 -translate-y-1/2" />
          
          {/* Glowing Progress Line - Radiating from 3 */}
          <div className="gsap-lvl-line absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-60 shadow-[0_0_15px_rgba(255,122,0,0.5)] origin-center" />
          
          {LEVELS.map((item) => (
            <div 
              key={item.lvl}
              className={cn(
                "gsap-lvl-node relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-mono font-bold text-[10px] tracking-tighter transition-all duration-300 opacity-0 scale-50",
                item.isActive 
                  ? "bg-accent text-bg w-14 h-14 shadow-[0_0_30px_rgba(255,122,0,0.6)] border-2 border-accent text-xs" 
                  : "bg-[#1a1a1a] text-white/40 border border-white/10"
              )}
            >
              {item.lvl}
              {item.isActive && (
                <div className="absolute inset-0 rounded-full bg-accent/20 blur-md -z-10 animate-pulse" />
              )}
            </div>
          ))}
        </div>

        {/* Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {LEVELS.map((item, index) => (
            <div 
              key={index} 
              className={cn(
                "gsap-lvl-card relative rounded-2xl border p-6 pt-7 pb-8 text-left flex flex-col group overflow-visible min-h-[420px] opacity-0",
                item.isActive 
                  ? "bg-[#111] border-accent/70 shadow-[0_0_60px_rgba(255,122,0,0.15),_0_0_20px_rgba(255,122,0,0.08),_inset_0_1px_0_rgba(255,122,0,0.15)]" 
                  : "bg-gradient-to-b from-[#151515] to-[#0d0d0d] border-white/[0.06]"
              )}
            >
              {/* Internal Card Glow for active */}
              {item.isActive && (
                <>
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,_rgba(255,122,0,0.12)_0%,_transparent_60%)] pointer-events-none" />
                  <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_100%,_rgba(255,122,0,0.06)_0%,_transparent_50%)] pointer-events-none" />
                  <div className="absolute -inset-px rounded-2xl border border-accent/30 pointer-events-none" />
                </>
              )}

              {/* Card Header */}
              <div className="flex flex-col mb-4 relative z-10 w-full text-left">
                <div className="flex items-center justify-between w-full">
                  <h4 className="font-bold text-xl text-white tracking-tight">{item.label}</h4>
                  {item.isActive && (
                    <span className="text-[8px] border border-accent/50 text-accent px-2.5 py-0.5 rounded-md uppercase font-black tracking-wider bg-accent/10 shrink-0">
                      Active Tier
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-accent uppercase tracking-widest mt-1">LVL {item.lvl}</span>
              </div>

              {/* Unlocks */}
              <div className="mb-4 relative z-10">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-1">Unlocks</p>
                <p className="text-sm text-white/80 leading-relaxed font-medium">{item.tasks}</p>
              </div>

              {/* Bounty Range */}
              <div className="mb-4 relative z-10">
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Bounty Range</p>
                <p className="text-xl font-bold text-accent">{item.range}</p>
              </div>

              {/* Mascot Image — Absolutely positioned to break out of the card width */}
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[160%] h-72 pointer-events-none overflow-visible">
                <div className={cn(
                  "gsap-lvl-mascot relative w-full h-full transition-transform duration-500",
                  item.imgClass
                )}>
                  <Image 
                    src={item.image} 
                    alt={item.label} 
                    fill
                    className="object-contain object-bottom"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>


      </div>
    </section>
  )
}
