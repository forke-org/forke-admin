'use client'

import React, { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils/cn'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// Single Source of Truth for the Component Data
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
    image: '/forke-assets/landing-assets/builder_forky.png',
    imgClass: '[transform:scale(-0.92,0.92)] -translate-y-1 translate-x-2.5'
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
    imgClass: '[transform:scale(-0.92,0.92)] -translate-y-1 translate-x-2.5'
  },
]

export default function LevelSystem() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const router = useRouter()
  const isFirstRender = useRef(true)
  
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // Autoplay loop
  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      handleNext()
    }, 4000)
    return () => clearInterval(interval)
  }, [isPaused, activeIndex])

  // Resume autoplay after inactivity
  useEffect(() => {
    if (!isPaused) return
    const timeout = setTimeout(() => {
      setIsPaused(false)
    }, 6000)
    return () => clearTimeout(timeout)
  }, [isPaused, activeIndex])

  const handleNext = () => {
    if (isAnimating) return
    setActiveIndex(prev => (prev + 1) % LEVELS.length)
  }

  const handleManualInteraction = (index?: number) => {
    if (isAnimating) return
    setIsPaused(true)
    if (typeof index === 'number') {
      if (index !== activeIndex) {
        setActiveIndex(index)
      }
    } else {
      handleNext()
    }
  }

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

  // Stack Animation using GSAP
  useGSAP(() => {
    if (isFirstRender.current) {
       // Just set positions instantly on mount
       LEVELS.forEach((_, i) => {
         const card = cardsRef.current[i]
         if (!card) return
         const diff = (i - activeIndex + LEVELS.length) % LEVELS.length
         const isFront = diff === 0
         const isVisible = diff < 5
         
         const scale = isFront ? 1 : 1 - (diff * 0.04)
         const y = isFront ? 0 : diff * 16
         const x = isFront ? 0 : diff * 8
         const opacity = isFront ? 1 : isVisible ? 1 - (diff * 0.18) : 0
         const zIndex = LEVELS.length - diff

         gsap.set(card, {
          x,
          y,
          scale,
          opacity,
          rotationZ: diff * -1.5,
          zIndex
        })
       })
       isFirstRender.current = false
       return
    }

    setIsAnimating(true)
    
    LEVELS.forEach((_, i) => {
      const card = cardsRef.current[i]
      if (!card) return

      const diff = (i - activeIndex + LEVELS.length) % LEVELS.length
      const isFront = diff === 0
      const isVisible = diff < 5
      const isDropping = diff === LEVELS.length - 1 // The card that just moved to the back

      // Target properties for the "Reveal" phase (matching the user's tweaked resting values)
      const targetScale = isFront ? 1 : 1 - (diff * 0.04)
      const targetY = isFront ? 0 : diff * 16
      const targetX = isFront ? 0 : diff * 8
      const targetRotationZ = isFront ? 0 : diff * -1.5
      const targetOpacity = isFront ? 1 : isVisible ? 1 - (diff * 0.18) : 0
      const zIndex = LEVELS.length - diff

      // Apply zIndex immediately so the cards order correctly before animating
      gsap.set(card, { zIndex })

      if (isDropping) {
        // Phase 1 - Drop: Front card animates down with rotation, fade, and scale down.
        gsap.to(card, {
          y: 100, // drop down significantly
          x: -20, // slide slightly left while dropping
          scale: 0.92, // shrink a little
          opacity: 0, // fade to 0
          rotationZ: 8, // slight rotation for realism
          duration: 0.65, // faster drop
          ease: 'power2.in',
          onComplete: () => {
            // Reset to the very back of the stack invisibly
            const resetDiff = LEVELS.length - 1
            gsap.set(card, { 
              y: resetDiff * 16, 
              x: resetDiff * 8, 
              scale: 1 - (resetDiff * 0.04), 
              opacity: 0, 
              rotationZ: resetDiff * -1.5 
            })
          }
        })
      } else {
        // Phase 2 - Reveal: Next cards wait until drop phase begins, then slide up and scale into place.
        gsap.to(card, {
          y: targetY,
          x: targetX,
          scale: targetScale,
          opacity: targetOpacity,
          rotationZ: targetRotationZ,
          duration: 0.6,
          delay: 0.45, // wait for drop to get out of the way
          ease: 'power3.out',
          onComplete: () => {
            if (isFront) setIsAnimating(false)
          }
        })
      }
    })
  }, { dependencies: [activeIndex], scope: containerRef })


  return (
    <section ref={containerRef} id="levels" className="py-24 md:py-32 px-4 bg-bg relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--color-accent-muted)_0%,_transparent_70%)] opacity-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
        
        {/* Left Column: Content */}
        <div className="gsap-lvl-content space-y-8 max-w-xl mx-auto lg:mx-0">
          <div className="space-y-4">
            <h2 className="font-serif text-5xl md:text-6xl text-white tracking-tight">
              The Level System <span className="text-accent">✦</span>
            </h2>
            <p className="text-white/60 text-lg md:text-xl font-light leading-relaxed">
              Completing tasks earns XP. XP increases your level. Higher levels unlock larger bounties, better opportunities, and exclusive platform privileges. Consistency is rewarded—the more you ship, the faster you ascend.
            </p>
          </div>

          <div className="pt-2">
            <Button 
              size="lg" 
              onClick={() => router.push('/levels')}
              className="group gap-2 text-base px-8 py-6 rounded-xl bg-gradient-to-b from-accent to-[#d97706] border-b-2 border-black/30 shadow-[0_4px_0_rgb(180,83,9)] hover:translate-y-[1px] hover:shadow-[0_3px_0_rgb(180,83,9)] active:translate-y-[4px] active:shadow-none transition-all duration-75 text-bg font-bold tracking-tight"
            >
              Explore all 25 levels <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Progress Indicator Row - Option A (Glowing Progress Rail) */}
          <div className="pt-12 w-full max-w-md">
            <div className="relative flex items-center justify-between w-full">
              {/* Base Connecting Line (Muted) */}
              <div className="absolute top-1/2 left-4 right-4 h-[2px] bg-white/5 -translate-y-1/2" />
            
            {/* Active Connecting Line (Glowing Orange) */}
            <div 
              className="absolute top-1/2 left-4 h-[2px] bg-[#FF7A00] -translate-y-1/2 transition-all duration-[600ms] delay-200 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_0_30px_rgba(255,122,0,0.95)] origin-left z-0" 
              style={{ width: `calc(${activeIndex * (100 / (LEVELS.length - 1))}% - 16px)` }}
            />
            
            {LEVELS.map((item, index) => {
              const isActive = index === activeIndex
              const isPast = index < activeIndex

              return (
                <div 
                  key={item.lvl}
                  onClick={() => handleManualInteraction(index)}
                  className={cn(
                    "relative z-10 w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-[9px] tracking-tighter transition-all duration-500 cursor-pointer hover:scale-125",
                    isActive 
                      ? "bg-[#FF7A00] text-black w-12 h-12 shadow-[0_0_45px_rgba(255,122,0,1)] border-2 border-[#FF7A00] text-xs scale-125" 
                      : isPast
                        ? "bg-[#FF7A00] text-black border border-[#FF7A00] shadow-[0_0_10px_rgba(255,122,0,0.3)]"
                        : "bg-[#1a1a1a] text-white/40 border border-white/10 hover:border-white/30"
                  )}
                >
                  {item.lvl}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-[#FF7A00]/20 blur-md -z-10 animate-pulse" />
                  )}
                </div>
              )
            })}
            </div>
          </div>
        </div>

        {/* Right Column: Stacked Cards */}
        <div className="gsap-lvl-stack relative h-[450px] sm:h-[500px] w-full flex items-center justify-center lg:justify-end pr-0 lg:pr-8 perspective-[1200px]">
          <div 
            className="relative w-full max-w-[340px] h-[400px] cursor-pointer"
            onClick={() => handleManualInteraction()}
          >
            {LEVELS.map((item, i) => {
              const isActive = i === activeIndex
              
              return (
                <div
                  key={item.lvl}
                  ref={(el) => { cardsRef.current[i] = el }}
                  className="absolute top-0 left-0 w-full pointer-events-none origin-center"
                >
                  <div 
                    className={cn(
                      "relative rounded-2xl border p-6 pt-7 pb-8 text-left flex flex-col group overflow-visible min-h-[400px] w-full shadow-2xl transition-colors duration-500",
                      isActive 
                        ? "bg-[#111] border-accent/70 shadow-[0_20px_60px_rgba(255,122,0,0.15),_0_0_20px_rgba(255,122,0,0.08),_inset_0_1px_0_rgba(255,122,0,0.15)]" 
                        : "bg-gradient-to-b from-[#151515] to-[#0d0d0d] border-white/[0.06] shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
                    )}
                    style={{ pointerEvents: isActive ? 'auto' : 'none' }}
                  >
                    {/* Internal Card Glow for active */}
                    <div className={cn("absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,_rgba(255,122,0,0.12)_0%,_transparent_60%)] pointer-events-none transition-opacity duration-700", isActive ? "opacity-100" : "opacity-0")} />
                    <div className={cn("absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_100%,_rgba(255,122,0,0.06)_0%,_transparent_50%)] pointer-events-none transition-opacity duration-700", isActive ? "opacity-100" : "opacity-0")} />
                    <div className={cn("absolute -inset-px rounded-2xl border border-accent/30 pointer-events-none transition-opacity duration-700", isActive ? "opacity-100" : "opacity-0")} />

                    {/* Card Header */}
                    <div className="flex flex-col mb-4 relative z-10 w-full text-left">
                      <div className="flex items-center justify-between w-full">
                        <h4 className="font-bold text-xl text-white tracking-tight">{item.label}</h4>
                        <div className={cn("transition-opacity duration-300", isActive ? "opacity-100" : "opacity-0")}>
                          <span className="text-[8px] border border-accent/50 text-accent px-2.5 py-0.5 rounded-md uppercase font-black tracking-wider bg-accent/10 shrink-0">
                            Active Tier
                          </span>
                        </div>
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

                    {/* Mascot Image */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[160%] h-[260px] pointer-events-none overflow-visible">
                      <div className={cn(
                        "relative w-full h-full transition-transform duration-500",
                        item.imgClass
                      )}>
                        <Image 
                          src={item.image} 
                          alt={item.label} 
                          fill
                          className="object-contain object-bottom"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </section>
  )
}
