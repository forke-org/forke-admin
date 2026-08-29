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
import Link from 'next/link'
import { ArrowRight, Lock, Search } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Section, Eyebrow, H2 } from './primitives'
import Reveal from './Reveal'
import { useWaitlisterView } from './useWaitlisterView'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Proof of work — a snapshot of the real public profile page (DEV ID lanyard +
 * shipped-work ledger), captured as a static image and shown inside a laptop
 * whose lid opens as you scroll the section into view. Using a flat PNG instead
 * of the live 3D lanyard keeps the laptop trivially responsive on phone/tablet.
 */
const MOCKUP_SRC = '/forke-assets/landing-assets/proof-mockup.webp'

/**
 * A laptop that opens on scroll. The screen (lid) is hinged at its bottom edge
 * and rotates from nearly-closed up to flat-open, scrubbed to scroll progress;
 * the base sits below as the keyboard deck. The whole unit scales fluidly with
 * its container, so the same markup works from phone to desktop.
 */
function LaptopMockup({
  lidRef,
  screenRef,
}: {
  lidRef: React.RefObject<HTMLDivElement | null>
  screenRef: React.RefObject<HTMLImageElement | null>
}) {
  return (
    // A long perspective keeps the hinge looking like a real laptop opening
    // rather than a keystoned/stretched plane — short perspectives exaggerate
    // the trapezoid as the lid tilts back.
    <div className="w-full" style={{ perspective: '4500px' }}>
      {/* Screen / lid — hinged at the bottom edge, rotates open on scroll.
          backfaceVisibility:hidden keeps the screen content from bleeding
          through when the lid is tilted near-closed (it must read as a solid
          opaque panel, not glass). An opaque aluminium back sits behind it. */}
      <div
        ref={lidRef}
        className="relative mx-auto w-full origin-bottom"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
      >
        {/* Opaque lid backing — the aluminium underside of the screen */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-t-xl rounded-b-sm bg-[#0b0b0d]"
          style={{ transform: 'translateZ(-1px)', backfaceVisibility: 'visible' }}
        />
        <div
          className="relative overflow-hidden rounded-t-xl rounded-b-sm border border-white/[0.12] bg-[#0b0b0d] p-[0.6%] pb-[0.9%] shadow-[0_40px_120px_rgba(0,0,0,0.7)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Webcam dot on the top bezel */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-[0.35%]">
            <span className="h-[3px] w-[3px] rounded-full bg-white/25 sm:h-[4px] sm:w-[4px]" />
          </div>
          <div className="overflow-hidden rounded-[5px]">
            {/* Browser chrome — traffic lights + an address/search bar so the
                screenshot reads as a live browser tab, not a bare image. */}
            <div className="flex items-center gap-[2%] border-b border-white/[0.06] bg-[#161618] px-[2%] py-[1.1%]">
              <div className="flex shrink-0 items-center gap-[5px]">
                <span className="h-[6px] w-[6px] rounded-full bg-[#ff5f57] sm:h-[8px] sm:w-[8px]" />
                <span className="h-[6px] w-[6px] rounded-full bg-[#febc2e] sm:h-[8px] sm:w-[8px]" />
                <span className="h-[6px] w-[6px] rounded-full bg-[#28c840] sm:h-[8px] sm:w-[8px]" />
              </div>
              {/* Address / search field — clamped sizing so it stays proportional
                  from phone up to the laptop's max width without runaway scaling. */}
              <div className="flex min-w-0 flex-1 items-center gap-[1.5%] rounded-full border border-white/[0.07] bg-white/[0.04] px-[1.8%] py-[0.7%]">
                <Lock
                  className="shrink-0 text-emerald-400/70"
                  style={{ width: 'clamp(7px, 1.3vw, 12px)', height: 'clamp(7px, 1.3vw, 12px)' }}
                />
                <span
                  className="truncate font-mono leading-none text-white/55"
                  style={{ fontSize: 'clamp(6px, 1.25vw, 12px)' }}
                >
                  forke.space/<span className="text-white/85">elonmusk</span>
                </span>
                <Search
                  className="ml-auto shrink-0 text-white/30"
                  style={{ width: 'clamp(7px, 1.3vw, 12px)', height: 'clamp(7px, 1.3vw, 12px)' }}
                />
              </div>
            </div>
            {/* The captured profile-page mockup */}
            <Image
              ref={screenRef}
              src={MOCKUP_SRC}
              alt="A Forke public profile — verified DEV ID card and shipped-work ledger"
              width={1920}
              height={1055}
              sizes="(max-width: 768px) 100vw, 900px"
              loading="lazy"
              className="block w-full h-auto select-none"
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* Base / keyboard deck — slightly wider than the lid, sits flush below it */}
      <div className="relative mx-auto -mt-px w-[106%] -translate-x-[2.8%]">
        <div className="flex h-[10px] justify-center rounded-b-xl border border-t-0 border-white/[0.08] bg-gradient-to-b from-[#26262a] via-[#141416] to-[#0a0a0c] shadow-[0_34px_70px_rgba(0,0,0,0.65)] sm:h-[14px]">
          {/* Trackpad notch */}
          <div className="h-[45%] w-[12%] rounded-b-[5px] bg-black/40" />
        </div>
      </div>
    </div>
  )
}

export default function Proof({ n = '004' }: { n?: string }) {
  const showWaitlisterView = useWaitlisterView()
  const wrapRef = useRef<HTMLDivElement>(null)
  const lidRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLImageElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)

  // Apple-style product reveal. The laptop enters already mostly-open and, as
  // you scroll, pins and eases the lid through its final hinge to upright —
  // just the screen rotating on the hinge, viewed head-on through a single
  // perspective so there's no keystone/stretch. Slow, weighty, organic. No
  // scale-pop or brightness flash (those read as "animated"). Skipped under
  // reduced motion (renders settled open).
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(lidRef.current, { rotateX: 0 })
      return
    }

    // Phones get a shorter pinned scroll (and a slightly smaller initial tilt) so
    // the open doesn't feel like a long drag; desktop keeps the weightier reveal.
    const mm = gsap.matchMedia(wrapRef)

    mm.add(
      {
        isPhone: '(max-width: 767px)',
        isDesktop: '(min-width: 768px)',
      },
      (ctx) => {
        const { isPhone } = ctx.conditions as { isPhone: boolean }

        // If the mockup image hasn't finished loading, the laptop's height (and
        // thus the pin start/end) is measured wrong, which shows up as a jump.
        // Re-measure once it loads.
        const img = screenRef.current
        if (img && !img.complete) {
          img.addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
        }

        gsap.fromTo(
          lidRef.current,
          // Start more closed (deeper tilt) for a stronger "opening" payoff.
          { rotateX: isPhone ? -42 : -55, transformOrigin: 'bottom center', force3D: true },
          {
            rotateX: 0,
            // Linear so the open maps evenly across the (now short) pin — the lid
            // reaches fully-flat exactly as the pin releases, leaving no dead hold.
            ease: 'none',
            force3D: true,
            scrollTrigger: {
              trigger: pinRef.current,
              start: 'center center',
              // Short, fixed pin distance: the laptop sticks, opens over a small
              // scroll, then releases immediately — no long empty "dead scroll"
              // gap below it. A fixed px distance (not a % of viewport) keeps the
              // open feeling snappy and identical regardless of screen height.
              end: isPhone ? '+=140' : '+=240',
              pin: pinRef.current,
              pinSpacing: true,
              // The section uses overflow-hidden, which breaks position:fixed pinning;
              // pin via transforms so it sticks inside the clipped ancestor.
              pinType: 'transform',
              // Tight scrub for a direct, smooth follow; anticipatePin is omitted
              // (it jitters with transform pinning).
              scrub: 0.4,
              invalidateOnRefresh: true,
            },
          }
        )
      }
    )
  }, { scope: wrapRef })

  return (
    <Section id="proof" className="overflow-hidden px-5 pb-10 pt-16 md:px-10 md:pb-16 md:pt-24">
      <div ref={wrapRef}>
        {/* Centered headline above the laptop — Apple product-page composition */}
        <Reveal>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="flex justify-center">
              <Eyebrow n={n} label="proof of work" />
            </div>
            <H2 accent="compiles." className="text-center">A resume that</H2>
            <p className="mt-4 max-w-md text-[15px] font-light leading-relaxed text-white/45">
              Every approved task lands on your public profile automatically —
              timestamped, client-rated, linked to the merged PR. Recruiters
              don&apos;t read claims. They read receipts.
            </p>
            <Link
              href={showWaitlisterView ? '/waitlist' : '/signin'}
              className="group mt-6 inline-flex items-center gap-2 text-[14.5px] font-medium text-white/75 transition-colors hover:text-white"
            >
              {showWaitlisterView ? 'Join the waitlist' : 'Claim your username'}
              <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>

        {/* The artifact: the real profile page (DEV ID card + shipped-work
            ledger) captured as an image, shown on a laptop that opens on scroll */}
        <div className="relative mt-10 flex justify-center w-full md:mt-14">
          <div aria-hidden className="absolute -inset-x-12 top-10 h-56 rounded-full bg-accent/[0.05] blur-[110px]" />
          <div ref={pinRef} className="relative mx-auto w-full max-w-[920px]">
            <LaptopMockup lidRef={lidRef} screenRef={screenRef} />
          </div>
        </div>
      </div>
    </Section>
  )
}
