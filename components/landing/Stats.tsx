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
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Section } from './primitives'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// Product facts, not traction claims — every number here is a design guarantee.
// `count` marks the one value that ends in a plain integer we can tick up to.
const STATS = [
  { value: '30m–4h', label: 'scoped task size', sub: 'bite-sized by design' },
  { value: '<60s', label: 'merge → UPI payout', sub: 'escrow releases on merge' },
  { value: '4-layer', label: 'review pipeline', sub: 'build · tests · ai · human' },
  { value: '25', count: 25, label: 'levels to climb', sub: 'newcomer → forke legend' },
]

export default function Stats() {
  const rootRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const cells = gsap.utils.toArray<HTMLElement>('[data-stat-cell]')
      const trigger = { trigger: rootRef.current, start: 'top 80%', once: true }

      // Staggered reveal as the grid scrolls in — crisper than a uniform fade.
      gsap.from(cells, {
        opacity: 0,
        y: 20,
        filter: 'blur(6px)',
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: trigger,
      })

      // Tick the one plain-integer value up to its target.
      const countEl = rootRef.current?.querySelector<HTMLElement>('[data-stat-count]')
      const target = Number(countEl?.dataset.statCount || 0)
      if (countEl && target) {
        const obj = { v: 0 }
        gsap.to(obj, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: trigger,
          onUpdate: () => {
            countEl.textContent = String(Math.round(obj.v))
          },
        })
      }
    },
    { scope: rootRef }
  )

  return (
    <Section>
      <div ref={rootRef} className="grid grid-cols-2 gap-px bg-white/[0.06] lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="bg-[#050505] transition-colors hover:bg-[#0a0a0c]">
            <div data-stat-cell className="px-6 py-8 md:px-9 md:py-10">
              <p className="font-mono text-2xl font-semibold tracking-tight text-white tabular-nums md:text-[1.9rem]">
                {'count' in stat && stat.count ? (
                  <span data-stat-count={stat.count}>{stat.value}</span>
                ) : (
                  stat.value
                )}
              </p>
              <p className="mt-2 text-[13px] text-white/55">{stat.label}</p>
              <p className="mt-1 font-mono text-[10.5px] text-white/25">{stat.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
