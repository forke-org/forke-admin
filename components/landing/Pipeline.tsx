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
import { Check, GitPullRequest } from 'lucide-react'
import { Section, Eyebrow, H2 } from './primitives'
import Reveal from './Reveal'

/* ── Step vignettes — crisp, readable miniatures of the real product UI.
     They come alive once the grid scrolls into view: the claim timer ticks,
     the PR checks land one by one, and the payout counts up. ─────────────── */

const SHIP_CHECKS: [string, string][] = [
  ['FORKE_SUBMISSION.md', 'found'],
  ['build', 'passed'],
  ['tests', '14/14'],
  ['lint · scope', 'clean'],
  ['ai review', 'approve'],
]

function formatTimer(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function ClaimCard({ seconds }: { seconds: number }) {
  return (
    <div className="w-full max-w-[272px] rounded-xl border border-white/10 bg-[#0c0c0f] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium leading-snug text-white">Fix OAuth redirect loop</p>
        <span className="font-mono text-[13px] font-semibold text-accent">₹450</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['react · tier 2', 'lvl 8+', 'trust 80%+'].map((chip) => (
          <span
            key={chip}
            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-white/45"
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-[#0a0a0a]">
          claim task
        </span>
        <span className="inline-flex h-8 items-center rounded-md border border-white/10 px-2.5 font-mono text-[11px] text-white/50 tabular-nums">
          {formatTimer(seconds)}
        </span>
      </div>
    </div>
  )
}

function ShipCard({ shown }: { shown: number }) {
  return (
    <div className="w-full max-w-[272px] rounded-xl border border-white/10 bg-[#0c0c0f] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
        <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate font-mono text-[11px] text-white/70">dev/you/task-2841</span>
        <span className="ml-auto rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
          pr #42
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {SHIP_CHECKS.map(([label, status], i) => {
          const visible = i < shown
          return (
            <li
              key={label}
              className="flex items-center justify-between font-mono text-[11px] transition-all duration-300"
              style={{ opacity: visible ? 1 : 0.18, transform: visible ? 'none' : 'translateY(3px)' }}
            >
              <span className="text-white/50">{label}</span>
              <span className="flex items-center gap-1.5 text-white/70">
                {visible ? status : '…'}
                <Check
                  className="h-3 w-3 text-emerald-400 transition-transform duration-300"
                  style={{ transform: visible ? 'scale(1)' : 'scale(0)' }}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PaidCard({ amount, done }: { amount: number; done: boolean }) {
  return (
    <div className="w-full max-w-[272px] rounded-xl border border-dashed border-white/[0.16] bg-[#0c0c0f] p-4 font-mono shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">escrow release</p>
      <p className="mt-1.5 text-[26px] font-semibold tracking-tight text-accent tabular-nums">
        ₹{amount.toFixed(2)}
      </p>
      <div className="mt-3 space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-white/40">to</span>
          <span className="text-white/75">ayushman@upi</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">after merge</span>
          <span className="text-white/75">41s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">status</span>
          <span className={`transition-colors duration-300 ${done ? 'text-emerald-400' : 'text-white/45'}`}>
            {done ? 'paid ✓' : 'releasing…'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex justify-between border-t border-dashed border-white/10 pt-2.5 text-[11px]">
        <span className="text-white/40">xp earned</span>
        <span
          className="text-accent transition-opacity duration-500"
          style={{ opacity: done ? 1 : 0.25 }}
        >
          +150
        </span>
      </div>
    </div>
  )
}

/* ── Section ─────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    n: '01',
    title: 'Claim',
    copy: 'Browse tasks gated to your level, skill tier, and trust score. Claiming locks it for you — 20 minutes to activate, and nobody can snipe it.',
  },
  {
    n: '02',
    title: 'Ship',
    copy: "Work in an isolated Forke branch — never on the owner's repo. Submit a PR; automated checks and an AI review run before a human ever looks.",
  },
  {
    n: '03',
    title: 'Get paid',
    copy: 'The owner approves a plain-English verdict, Forke merges, and escrow releases straight to your UPI — usually within a minute of the merge.',
  },
]

export default function Pipeline() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [live, setLive] = useState(false)
  const [reduced, setReduced] = useState(false)

  // Animation state
  const [tick, setTick] = useState(0) // claim timer seconds elapsed
  const [shown, setShown] = useState(0) // ship checks revealed
  const [amount, setAmount] = useState(0) // payout count-up

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Arm the vignettes when the grid scrolls into view
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
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

  // Claim card: reservation timer ticks down (cycles so it never hits zero)
  useEffect(() => {
    if (!live || reduced) return
    const i = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(i)
  }, [live, reduced])

  // Ship card: checks land one by one, hold, then replay
  useEffect(() => {
    if (!live || reduced) return
    const t = setTimeout(
      () => setShown((s) => (s >= SHIP_CHECKS.length ? 0 : s + 1)),
      shown === 0 ? 600 : shown >= SHIP_CHECKS.length ? 3400 : 480
    )
    return () => clearTimeout(t)
  }, [live, reduced, shown])

  // Paid card: count up to ₹800 once live
  useEffect(() => {
    if (!live) return
    if (reduced) {
      setAmount(800)
      return
    }
    const start = performance.now()
    const duration = 1100
    let raf: number
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setAmount(Math.round(800 * eased))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [live, reduced])

  const timerSeconds = reduced ? 1200 : 1200 - (tick % 95)
  const checksShown = reduced ? SHIP_CHECKS.length : shown
  const paidDone = amount >= 800

  const vignettes = [
    <ClaimCard key="claim" seconds={timerSeconds} />,
    <ShipCard key="ship" shown={checksShown} />,
    <PaidCard key="paid" amount={amount} done={paidDone} />,
  ]

  return (
    <Section id="pipeline" className="px-5 py-16 md:px-10 md:py-24">
      <Reveal>
        <Eyebrow n="001" label="the pipeline" />
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <H2 accent="cash.">From claim to</H2>
          <p className="max-w-md pb-1.5 text-[15px] font-light leading-relaxed text-white/45">
            One workflow, three moves. No proposals, no negotiation threads, no
            invoices — the pipeline does the trust work for you.
          </p>
        </div>
      </Reveal>

      <div
        ref={gridRef}
        className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] grid-cols-1 lg:grid-cols-3"
      >
        {STEPS.map((step, i) => (
          <div key={step.n} className="flex flex-col bg-[#070708]">
            <Reveal delay={i * 110} className="flex h-full flex-col">
              {/* Vignette stage — fixed height so the three captions align */}
              <div className="flex h-[300px] items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,122,0,0.035)_0%,transparent_70%)] px-7">
                {vignettes[i]}
              </div>
              {/* Caption */}
              <div className="flex-1 border-t border-white/[0.06] p-7 md:p-8">
                <span className="font-mono text-[11px] text-accent/70">{step.n}</span>
                <h3 className="mt-2 text-xl font-medium tracking-[-0.02em] text-white">{step.title}</h3>
                <p className="mt-2.5 text-sm font-light leading-relaxed text-white/45">{step.copy}</p>
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  )
}
