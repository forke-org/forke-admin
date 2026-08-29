/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React from 'react'
import { Section, Eyebrow, H2 } from './primitives'
import Terminal from './Terminal'
import Reveal from './Reveal'

/**
 * The whole product in one typed terminal session — claim → checks → merge →
 * UPI payout. Sits on the blueprint grid so the artifact reads like a spec.
 */
export default function Session({ n = '002' }: { n?: string }) {
  return (
    <Section className="relative overflow-hidden px-5 py-16 md:px-10 md:py-24">
      <div aria-hidden className="ui-grid-soft absolute inset-0" />

      <div className="relative mx-auto w-full flex flex-col items-center">
        <Reveal>
          <div className="flex justify-center">
            <Eyebrow n={n} label="one session" />
          </div>
          <H2 accent="merges." className="text-center">
            Money moves when code
          </H2>
        </Reveal>

        <Reveal delay={140} className="mt-12 w-full flex justify-center">
          {/* Proportional Scaling Wrapper for all screen widths */}
          <div 
            style={{ 
              width: `calc(672px * var(--term-scale))`, 
              height: `calc(365px * var(--term-scale))` 
            }} 
            className="relative overflow-hidden shrink-0"
          >
            <div 
              style={{ 
                transform: `scale(var(--term-scale))`, 
                transformOrigin: 'top left',
                width: '672px',
                height: '365px'
              }}
              className="absolute left-0 top-0"
            >
              <Terminal />
            </div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-7 text-center font-mono text-[9.5px] sm:text-[11px] tracking-wide text-white/30 px-4">
            one task, end to end — claim → checks → ai review → merge → upi
          </p>
        </Reveal>
      </div>
    </Section>
  )
}
