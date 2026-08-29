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

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { Section, Eyebrow, H2 } from './primitives'
import Reveal from './Reveal'
import { useWaitlisterView } from './useWaitlisterView'

function ScoreBar({
  label,
  value,
  pct,
  live,
  delay,
}: {
  label: string
  value: string
  pct: number
  live: boolean
  delay: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] text-white/45">{label}</span>
        <span className="font-mono text-[12px] font-semibold text-white tabular-nums">{value}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-[1100ms] ease-out"
          style={{ width: live ? `${pct}%` : '0%', transitionDelay: `${delay}ms` }}
        />
      </div>
    </div>
  )
}

const OWNER_POINTS = [
  'Funds escrowed before work starts — no invoices, no chasing.',
  'Every PR pre-screened: build, tests, lint, scope, security.',
  'You read a plain-English verdict, not a 400-line diff.',
  'Approve once — Forke merges and pays out automatically.',
]

export default function Verdict({ n = '003', flush = false }: { n?: string; flush?: boolean }) {
  const showWaitlisterView = useWaitlisterView()
  const cardRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)

  // Arm the score bars when the card scrolls into view
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLive(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLive(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -15% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Section id="owners" flush={flush} className="px-5 py-16 md:px-10 md:py-24">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Copy */}
        <Reveal>
          <Eyebrow n={n} label="for owners" />
          <H2 accent="freelancer.">Hire a merge, not a</H2>
          <p className="mt-5 max-w-lg text-base font-light leading-relaxed text-white/50">
            Posting a ₹500 bug fix shouldn&apos;t take a week of proposals. Describe the
            task, escrow the bounty, and review a verdict — Forke handles everything
            between.
          </p>
          <ul className="mt-8 space-y-3.5">
            {OWNER_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[14.5px] text-white/65">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                {point}
              </li>
            ))}
          </ul>
          <Link
            href={showWaitlisterView ? '/waitlist' : '/signin'}
            className="group mt-9 inline-flex items-center gap-2 text-[14.5px] font-medium text-white/75 transition-colors hover:text-white"
          >
            {showWaitlisterView ? 'Join the waitlist' : 'Post your first task'}
            <ArrowRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {/* The verdict card — what an owner actually sees */}
        <Reveal delay={140}>
          <div ref={cardRef} className="relative">
            <div
              aria-hidden
              className="absolute -inset-x-6 -bottom-8 h-32 rounded-full bg-accent/[0.06] blur-[80px]"
            />
            <div className="relative rounded-2xl border border-white/10 bg-[#0a0a0c] p-6 shadow-[0_36px_90px_rgba(0,0,0,0.65)] md:p-7">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-white/40">ai verdict · submission #1024</span>
                <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                  risk · low
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <ScoreBar label="task completion" value="9.2 / 10" pct={92} live={live} delay={150} />
                <ScoreBar label="code quality" value="8.7 / 10" pct={87} live={live} delay={350} />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06]">
                {[
                  ['scope', 'respected'],
                  ['security', '0 flags'],
                  ['tests', '14 passed'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#0a0a0c] px-3 py-2.5 text-center">
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-white/30">{k}</p>
                    <p className="mt-1 font-mono text-[11.5px] text-white/75">{v}</p>
                  </div>
                ))}
              </div>

              <p className="mt-6 border-l-2 border-accent/50 pl-3.5 text-[13px] font-light leading-relaxed text-white/55">
                Implements the redirect fix exactly as scoped. Follows existing auth
                patterns, adds two regression tests, touches no files outside scope.
                Recommended: approve.
              </p>

              <div className="mt-7 flex gap-2.5">
                <span className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-accent text-[13px] font-semibold text-[#0a0a0a]">
                  Approve &amp; pay ₹800
                </span>
                <span className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-[13px] font-medium text-white/55">
                  Request changes
                </span>
              </div>
            </div>
            <p className="mt-4 text-center font-mono text-[10.5px] text-white/25">
              what owners see — no raw diffs, no jargon
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
