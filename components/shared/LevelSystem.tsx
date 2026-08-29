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

import React, { useRef, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import CardSwap, { Card } from './CardSwap'
import { Eyebrow } from '@/components/landing/primitives'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// Single Source of Truth for the Component Data
const LEVELS = [
  { 
    lvl: '1–5', 
    label: 'Early Game', 
    title: 'Newcomer to Stack Explorer',
    tasks: 'HTML/CSS, Basic Bug Fixes', 
    range: '₹200 - ₹500', 
    xpMultiplier: '1.0x XP',
    perks: ['Unlock basic bounties', 'Public profile URL (LVL 3)', 'Team task applications (LVL 5)'],
    image: '/forke-assets/landing-assets/newcomer_forky.webp',
    imgClass: 'scale-[0.98] -translate-y-2'
  },
  { 
    lvl: '6–10', 
    label: 'Mid Game', 
    title: 'Code Runner to Sprint Soldier',
    tasks: 'React Components, CSS Logic', 
    range: '₹500 - ₹1200', 
    xpMultiplier: '1.2x XP',
    perks: ['Intermediate payout tiers', 'XP streak multipliers (LVL 10)', 'Warm standby queue access'],
    image: '/forke-assets/landing-assets/apprentice_forky.webp',
    imgClass: 'scale-[1.12] -translate-y-1'
  },
  { 
    lvl: '11–15', 
    label: 'Skilled Tier', 
    title: 'Merge Specialist to Feature Shipper',
    tasks: 'API Hooks, Full-stack Features', 
    range: '₹1200 - ₹3000', 
    xpMultiplier: '1.5x XP',
    perks: ['Priority task queue (LVL 12)', 'Elite bounty eligibility (LVL 15)', 'Reviewer pathway entry'],
    image: '/forke-assets/landing-assets/builder_forky.webp',
    imgClass: '[transform:scale(-1,1)] -translate-y-1 translate-x-2'
  },
  { 
    lvl: '16–20', 
    label: 'Elite Tier', 
    title: 'Runtime Knight to Production Slayer',
    tasks: 'System Architecture, Database Fixes', 
    range: '₹3000 - ₹8000', 
    xpMultiplier: '2.0x XP',
    perks: ['Team lead eligibility (LVL 18)', 'Mentor access (LVL 20)', 'Advanced security clearance'],
    image: '/forke-assets/landing-assets/expert_forky.webp',
    imgClass: 'scale-[1.05] -translate-y-1.5'
  },
  { 
    lvl: '21–25', 
    label: 'Legend Tier', 
    title: 'Silicon Phantom to Forke Legend',
    tasks: 'Performance at Scale, Cloud DevOps', 
    range: '₹8000+', 
    xpMultiplier: '2.5x XP',
    perks: ['Private invite-only projects', 'Prestige reset options', 'Commit Warlord status badge'],
    image: '/forke-assets/landing-assets/architect_forky.webp',
    imgClass: '[transform:scale(-1,1)] -translate-y-1 translate-x-2'
  },
]

export default function LevelSystem() {
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState(0)

  useGSAP(() => {
    // Scroll Entrance
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      }
    })

    tl.fromTo('.gsap-lvl-content > *',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power2.out' }
    )
    .fromTo('.gsap-lvl-stack',
      { x: 50, opacity: 0 },
      { x: 0, opacity: 1, duration: 1, ease: 'power3.out' },
      '-=0.6'
    )
  }, { scope: containerRef })


  return (
    <section ref={containerRef} id="levels" className="py-16 md:py-24 px-5 md:px-10 bg-bg relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--color-accent-muted)_0%,_transparent_70%)] opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center min-[1920px]:max-w-[1920px]">

        {/* Left Column: Content */}
        <div className="gsap-lvl-content space-y-8 max-w-xl mx-auto lg:mx-0">
          <div className="space-y-4">
            <Eyebrow n="005" label="progression" />
            <h2 className="text-4xl md:text-[3.25rem] font-medium text-white tracking-[-0.035em] leading-[1.06]">
              Script kiddie to <span className="font-serif italic font-normal text-accent">legend.</span>
            </h2>
            <p className="text-white/60 text-base md:text-lg font-light leading-relaxed">
              Completing tasks earns XP. XP increases your level. Higher levels unlock larger bounties, better opportunities, and exclusive platform privileges. Consistency is rewarded—the more you ship, the faster you ascend.
            </p>
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              onClick={() => router.push('/levels')}
              className="group gap-2 h-12 px-7 py-0 rounded-lg bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[15px] font-semibold tracking-tight shadow-none transition-colors"
            >
              Explore all 25 levels <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>

        {/* Right Column: Stacked Cards */}
        <div className="gsap-lvl-stack relative hidden sm:flex h-[360px] sm:h-[460px] lg:h-[580px] w-full items-center justify-center lg:justify-start lg:pl-4 pr-0 lg:pr-0">
          <CardSwap
            width={780}
            height={420}
            cardDistance={60}
            verticalDistance={70}
            delay={3500}
            pauseOnHover={false}
            skewAmount={6}
            easing="linear"
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
          >
            {LEVELS.map((item, i) => {
              const isActive = i === activeIndex
              return (
                <Card
                  key={item.lvl}
                  className={cn(
                    "w-full h-full rounded-2xl border p-6 md:p-8 text-left flex flex-col md:flex-row items-stretch md:items-center justify-between group overflow-hidden transition-colors duration-500",
                    isActive
                      ? "bg-[#0c0c0f] border-accent/40 shadow-[0_20px_50px_rgba(255,122,0,0.15),_inset_0_1px_0_rgba(255,122,0,0.15)]"
                      : "bg-[#0c0c0f] border-white/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.7)]"
                  )}
                >
                  {/* Internal Card Glow for active */}
                  <div className={cn("absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,_rgba(255,122,0,0.1)_0%,_transparent_60%)] pointer-events-none transition-opacity duration-700", isActive ? "opacity-100" : "opacity-0")} />

                  {/* Left Column: Text Info */}
                  <div className="flex-1 w-full md:max-w-[420px] flex flex-col justify-between h-full md:pr-4 relative z-10">
                    {/* Header */}
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-accent border border-accent/30 bg-accent/5 px-2.5 py-0.5 rounded-md uppercase font-bold tracking-wider">
                          LVL {item.lvl}
                        </span>
                        <span className="text-[10px] font-mono text-white/50 border border-white/10 bg-white/5 px-2 py-0.5 rounded-md font-bold">
                          {item.xpMultiplier}
                        </span>
                      </div>
                      <h3 className="text-3xl text-white tracking-[-0.02em] mt-3 font-semibold">{item.label}</h3>
                      <p className="text-xs font-mono text-white/40 mt-1">{item.title}</p>
                    </div>

                    {/* Unlocks / Perks */}
                    <div className="my-4 space-y-2">
                      <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest">Platform Unlocks</p>
                      <ul className="space-y-1.5">
                        {item.perks.map((perk, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs text-white/70">
                            <span className="text-accent text-xs">✦</span>
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Footer Info */}
                    <div className="flex items-baseline gap-6 border-t border-white/[0.04] pt-3">
                      <div>
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-0.5">Focus</p>
                        <p className="text-xs text-white/70 font-mono font-semibold max-w-[190px] truncate">{item.tasks}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/30 uppercase font-bold tracking-widest mb-0.5">Bounty Range</p>
                        <p className="text-xl font-bold font-mono text-accent leading-none">{item.range}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Mascot Image (desktop+tablet — mobile uses the top mascot above).
                      Tablet (md): the whole card is visible, so hug the right edge instead of
                      sitting centered. Desktop (lg): pull in so Forky isn't clipped off-screen. */}
                  <div className="hidden md:flex w-[480px] h-full absolute top-0 right-2 lg:right-40 pointer-events-none overflow-visible select-none items-center justify-end lg:justify-center z-20">
                    <div className={cn(
                      "relative w-full h-[90%] transition-transform duration-500",
                      item.imgClass
                    )}>
                      <Image
                        src={item.image}
                        alt={item.label}
                        fill
                        className="object-contain object-center drop-shadow-[0_20px_30px_rgba(0,0,0,0.85)]"
                        sizes="350px"
                        priority={isActive}
                      />
                    </div>
                  </div>
                </Card>
              )
            })}
          </CardSwap>
        </div>

      </div>
    </section>
  )
}
