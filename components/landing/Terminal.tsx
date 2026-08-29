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
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * The signature artifact: a terminal session that types out the entire product —
 * claim → push → checks → AI review → merge → UPI payout → XP — and keeps going
 * into the next claim, dissolving into the bottom edge (Linear-style fade).
 * The window tilts in 3D and flattens as it scrolls into view.
 */

type Seg = { t: string; c?: string }
type Line = { segs: Seg[]; pause?: number }

const ACCENT = 'text-accent'
const CMD = 'text-white/90'
const OK = 'text-emerald-400'
const SOFT = 'text-white/65'
const DIM = 'text-white/35'

// One scenario per builder — the session loops through the whole crew.
const PERSONAS = [
  { name: 'ayushman', task: 2841, stack: 'react', tests: '14/14', quote: 'scoped, tested, clean diff', amount: '₹800.00', paid: '41s', xp: '+150 xp', tail: 'lvl 12 · 7-day streak', next: 2903, nextStack: 'node' },
  { name: 'sudhanshu', task: 3127, stack: 'next', tests: '22/22', quote: 'matches repo patterns', amount: '₹1,500.00', paid: '38s', xp: '+200 xp', tail: 'lvl 9 → lvl 10', next: 3140, nextStack: 'api' },
  { name: 'sujal', task: 2966, stack: 'fullstack', tests: '9/9', quote: 'tight diff, zero side effects', amount: '₹650.00', paid: '47s', xp: '+100 xp', tail: 'lvl 7 · trust 91%', next: 3015, nextStack: 'react' },
  { name: 'naman', task: 3208, stack: 'api', tests: '17/17', quote: 'handles edge cases cleanly', amount: '₹1,100.00', paid: '33s', xp: '+200 xp', tail: 'lvl 11 · 12-day streak', next: 3222, nextStack: 'next' },
]

function buildScenario(p: (typeof PERSONAS)[number]): Line[] {
  return [
    { segs: [{ t: '$ ', c: ACCENT }, { t: `forke claim ${p.task}`, c: CMD }, { t: ` --stack ${p.stack}`, c: DIM }], pause: 520 },
    { segs: [{ t: '✓ ', c: OK }, { t: 'reserved', c: SOFT }, { t: ' · 20:00 to activate', c: DIM }], pause: 620 },
    { segs: [{ t: '$ ', c: ACCENT }, { t: 'git push origin ', c: CMD }, { t: `dev/${p.name}/task-${p.task}`, c: 'text-white/55' }], pause: 540 },
    { segs: [{ t: '✓ build   ', c: OK }, { t: `✓ tests ${p.tests}   `, c: OK }, { t: '✓ lint   ', c: OK }, { t: '✓ scope', c: OK }], pause: 500 },
    { segs: [{ t: '✓ ', c: OK }, { t: 'ai review — approve', c: SOFT }, { t: ` · "${p.quote}"`, c: DIM }], pause: 560 },
    { segs: [{ t: '✓ ', c: OK }, { t: 'merged into main', c: SOFT }, { t: ' by owner', c: DIM }], pause: 760 },
    { segs: [{ t: p.amount, c: 'text-accent font-semibold' }, { t: ` → ${p.name}@upi`, c: SOFT }, { t: ` · paid ${p.paid} after merge`, c: DIM }], pause: 600 },
    { segs: [{ t: p.xp, c: 'text-accent/80' }, { t: ` · ${p.tail}`, c: DIM }], pause: 900 },
    { segs: [{ t: '$ ', c: ACCENT }, { t: `forke claim ${p.next}`, c: CMD }, { t: ` --stack ${p.nextStack}`, c: DIM }], pause: 480 },
    { segs: [{ t: '✓ ', c: OK }, { t: 'reserved', c: SOFT }, { t: ' · 20:00 to activate', c: DIM }], pause: 420 },
    { segs: [{ t: '$ ', c: ACCENT }, { t: 'git checkout -b ', c: CMD }, { t: `dev/${p.name}/task-${p.next}`, c: 'text-white/55' }] },
  ]
}

const SCENARIOS: Line[][] = PERSONAS.map(buildScenario)

function lineLength(line: Line): number {
  return line.segs.reduce((n, s) => n + s.t.length, 0)
}

function renderSegs(line: Line, count: number) {
  let used = 0
  return line.segs.map((seg, i) => {
    const remaining = count - used
    used += seg.t.length
    const visible = remaining >= seg.t.length ? seg.t : seg.t.slice(0, Math.max(0, remaining))
    return (
      <span key={i} className={seg.c}>
        {visible}
      </span>
    )
  })
}

export default function Terminal() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scenario, setScenario] = useState(0)
  const [lineIdx, setLineIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Linear-style entrance: the window starts tilted back and flattens on scroll
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo(
      frameRef.current,
      { rotateX: 16, y: 56, scale: 0.95, opacity: 0.5, transformPerspective: 1100 },
      {
        rotateX: 0,
        y: 0,
        scale: 1,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: wrapRef.current,
          start: 'top 92%',
          end: 'top 42%',
          scrub: 0.5,
        },
      }
    )
  }, { scope: wrapRef })

  const lines = SCENARIOS[scenario]

  useEffect(() => {
    if (reduced) return
    const line = lines[lineIdx]

    // Scenario finished — hold, then move to the next one
    if (!line) {
      const t = setTimeout(() => {
        setScenario((s) => (s + 1) % SCENARIOS.length)
        setLineIdx(0)
        setCharIdx(0)
      }, 4200)
      return () => clearTimeout(t)
    }

    if (charIdx < lineLength(line)) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), 12 + Math.random() * 20)
      return () => clearTimeout(t)
    }

    const t = setTimeout(() => {
      setLineIdx((i) => i + 1)
      setCharIdx(0)
    }, line.pause ?? 400)
    return () => clearTimeout(t)
  }, [scenario, lineIdx, charIdx, reduced, lines])

  const doneLines = reduced ? lines : lines.slice(0, lineIdx)
  const activeLine = reduced ? undefined : lines[lineIdx]

  return (
    <div ref={wrapRef} className="relative" style={{ perspective: '1100px' }}>
      {/* Warm glow bleeding from under the window */}
      <div aria-hidden className="absolute -inset-x-8 -bottom-10 h-44 rounded-full bg-accent/[0.07] blur-[90px]" />

      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#09090b]/95 shadow-[0_40px_100px_rgba(0,0,0,0.7)]"
      >
        {/* Window chrome — traffic lights are decorative */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-mono text-[11px] text-white/35">forke — session</span>
          <span className="ml-auto font-mono text-[11px] text-white/25">~/payday</span>
        </div>

        {/* Session body — fixed height, numbered lines, content dissolves at the
            bottom edge exactly like a Linear code card */}
        <div
          className="h-[300px] overflow-hidden px-4 py-4 text-left font-mono text-[12px] leading-[2.1] sm:h-[320px] sm:px-5 sm:text-[12.5px]"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 97%)',
            maskImage: 'linear-gradient(to bottom, black 50%, transparent 97%)',
          }}
        >
          {doneLines.map((line, i) => (
            <div key={`${scenario}-${i}`} className="grid grid-cols-[1.6rem_1fr] gap-x-3 sm:grid-cols-[2rem_1fr]">
              <span className="select-none text-right text-white/[0.14] tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="whitespace-pre-wrap">{renderSegs(line, lineLength(line))}</span>
            </div>
          ))}
          {activeLine && (
            <div className="grid grid-cols-[1.6rem_1fr] gap-x-3 sm:grid-cols-[2rem_1fr]">
              <span className="select-none text-right text-white/[0.14] tabular-nums">
                {String(lineIdx + 1).padStart(2, '0')}
              </span>
              <span className="whitespace-pre-wrap">
                {renderSegs(activeLine, charIdx)}
                <span className="animate-caret text-accent">▍</span>
              </span>
            </div>
          )}
          {!activeLine && !reduced && lineIdx >= lines.length && (
            <div className="grid grid-cols-[1.6rem_1fr] gap-x-3 sm:grid-cols-[2rem_1fr]">
              <span />
              <span className="animate-caret text-accent">▍</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
