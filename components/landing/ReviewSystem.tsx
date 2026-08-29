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
import { Cpu, Sparkles, Gauge, UserCheck } from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Section, Eyebrow, H2 } from './primitives'
import Reveal from './Reveal'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * The review system as a 3D blueprint — an isometric scene built entirely in
 * CSS: a floating PR chip in the center, four extruded gate tiles around it,
 * dashed connectors and slow spinner rings. Labels stay on-plane like a real
 * isometric technical drawing. The plain-English explanation sits below.
 */

const GATES = [
  {
    n: '01',
    icon: Cpu,
    title: 'Machines check it',
    copy: 'Build, tests, lint, scope and a security scan run the moment you submit. Broken code never reaches a human.',
  },
  {
    n: '02',
    icon: Sparkles,
    title: 'AI reads the diff',
    copy: 'An AI reviewer scores the work against the task spec, flags anything off, and writes a plain-English summary.',
  },
  {
    n: '03',
    icon: Gauge,
    title: 'Risk gets scored',
    copy: 'Track record and how critical the task is decide how much extra scrutiny a submission needs.',
  },
  {
    n: '04',
    icon: UserCheck,
    title: 'A human approves',
    copy: 'The owner reads the verdict — not the code — and clicks approve. The merge and the payout are automatic.',
  },
]

/** An extruded isometric tile: a dim base plate with a raised top face. */
function Tile({
  className = '',
  width,
  label,
  sub,
  accent = false,
}: {
  className?: string
  width: number
  label: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={`absolute ${className}`} style={{ width, transformStyle: 'preserve-3d' }}>
      {/* base plate (extrusion shadow) */}
      <div
        className="absolute inset-0 rounded-lg border border-white/[0.07] bg-[#050505]"
        style={{ transform: 'translateZ(-14px)' }}
      />
      {/* top face */}
      <div
        className={`relative flex items-center gap-2.5 rounded-lg border px-4 py-3 ${
          accent
            ? 'border-accent/40 bg-[#0c0a08] shadow-[0_0_30px_rgba(255,122,0,0.15)]'
            : 'border-white/[0.14] bg-[#08080a]'
        }`}
      >
        <span className={`font-mono text-[11px] font-semibold tracking-wide ${accent ? 'text-accent' : 'text-white/75'}`}>
          {label}
        </span>
        {sub && <span className="ml-auto font-mono text-[9px] text-white/30">{sub}</span>}
      </div>
    </div>
  )
}

/** Oval capability pill, like the reference blueprint. */
function Pill({ className = '', label }: { className?: string; label: string }) {
  return (
    <div
      className={`absolute rounded-full border border-white/[0.12] bg-[#060608]/80 px-5 py-2.5 font-mono text-[10px] tracking-[0.08em] text-white/45 ${className}`}
    >
      {label}
    </div>
  )
}

/** Dashed connector drawn on the plane. */
function Connector({ className = '', length, vertical = false }: { className?: string; length: number; vertical?: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute ${vertical ? 'ui-flow-line-v w-px' : 'ui-flow-line h-px'} ${className}`}
      style={vertical ? { height: length } : { width: length }}
    />
  )
}

/** Slow elliptical spinner ring, as seen on the reference board. */
function SpinnerRing({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute ${className}`}>
      <div className="ui-iso-spin h-9 w-9 rounded-full border-2 border-white/[0.08] border-t-accent/80" />
    </div>
  )
}

function BlueprintScene() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)

  // Scroll-tied parallax: the blueprint board lifts and tilts toward you as the
  // section scrolls through, so the static iso scene gains depth on scroll. Only
  // the camera wrapper moves — the intricate board transform below is untouched.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(
        cameraRef.current,
        { yPercent: 8, rotateX: 6 },
        {
          yPercent: -6,
          rotateX: -4,
          ease: 'none',
          scrollTrigger: {
            trigger: sceneRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.8,
          },
        }
      )
    },
    { scope: sceneRef }
  )

  return (
    <div ref={sceneRef} aria-hidden className="pointer-events-none relative mx-auto h-[290px] w-full max-w-[860px] select-none sm:h-[380px] md:h-[440px]">
      {/* Perspective camera */}
      <div ref={cameraRef} className="absolute inset-0 will-change-transform" style={{ perspective: '1400px', perspectiveOrigin: '50% 30%' }}>
        {/* The isometric drawing plane */}
        <div
          className="absolute left-1/2 top-1/2 h-[680px] w-[680px] origin-center [--blueprint-scale:scale(0.52)] sm:[--blueprint-scale:scale(0.75)] md:[--blueprint-scale:scale(1)]"
          style={{
            transform: 'translate(-50%, -54%) rotateX(57deg) rotateZ(-45deg) var(--blueprint-scale)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Dashed blueprint grid */}
          <div className="ui-iso-grid absolute inset-0" />

          {/* ── Center: the submission chip — stacked plates, floating ────── */}
          <div className="ui-iso-float absolute left-1/2 top-1/2" style={{ transformStyle: 'preserve-3d' }}>
            {/* deepest plate */}
            <div
              className="absolute -left-[110px] -top-[110px] h-[220px] w-[220px] rounded-xl border border-white/[0.09] bg-[#050505]"
              style={{ transform: 'translateZ(0px)' }}
            />
            {/* middle plate with edge details */}
            <div
              className="absolute -left-[96px] -top-[96px] h-[192px] w-[192px] rounded-xl border border-white/[0.13] bg-[#070708]"
              style={{ transform: 'translateZ(26px)' }}
            />
            {/* top plate with the wordmark */}
            <div
              className="absolute -left-[80px] -top-[80px] flex h-[160px] w-[160px] items-center justify-center rounded-xl border border-accent/50 bg-[#0a0806] shadow-[0_0_60px_rgba(255,122,0,0.25)]"
              style={{ transform: 'translateZ(52px)' }}
            >
              <span className="text-4xl font-semibold tracking-[-0.04em] text-white">
                forke<span className="text-accent">*</span>
              </span>
            </div>
            {/* glow pool under the stack */}
            <div
              className="absolute -left-[130px] -top-[130px] h-[260px] w-[260px] rounded-full bg-accent/[0.08] blur-[40px]"
              style={{ transform: 'translateZ(-6px)' }}
            />
          </div>

          {/* ── Connectors from the chip to the gates ─────────────────────── */}
          <Connector className="left-[150px] top-[339px]" length={120} />
          <Connector className="right-[150px] top-[339px]" length={120} />
          <Connector className="left-[339px] top-[140px]" length={130} vertical />
          <Connector className="left-[339px] bottom-[140px]" length={130} vertical />

          {/* ── Gate tiles (extruded) ─────────────────────────────────────── */}
          <Tile className="left-[10px] top-[316px]" width={150} label="01 checks" sub="ci" />
          <Tile className="left-[262px] top-[60px]" width={160} label="02 ai review" sub="llm" accent />
          <Tile className="right-[0px] top-[316px]" width={150} label="03 risk score" sub="0–100" />
          <Tile className="left-[256px] bottom-[58px]" width={170} label="04 owner approves" sub="✓" accent />

          {/* ── Capability pills around the board ─────────────────────────── */}
          <Pill className="left-[30px] top-[140px]" label="build · tests · lint" />
          <Pill className="right-[16px] top-[150px]" label="escrow locked" />
          <Pill className="left-[60px] bottom-[120px]" label="scope guard" />
          <Pill className="right-[40px] bottom-[110px]" label="verdict card" />

          {/* ── Spinner rings — work in progress on the board ─────────────── */}
          <SpinnerRing className="left-[210px] top-[235px]" />
          <SpinnerRing className="right-[205px] bottom-[230px]" />
        </div>
      </div>

      {/* Soft vignette so the scene melts into the page */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 55% at 50% 50%, transparent 55%, #050505 95%)',
        }}
      />
    </div>
  )
}

export default function ReviewSystem({ n = '006' }: { n?: string }) {
  return (
    <Section id="review" className="relative overflow-hidden px-5 py-16 md:px-10 md:py-24">
      <div className="relative">
        <Reveal>
          <Eyebrow n={n} label="the review system" />
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <H2 accent="payout.">Four gates before every</H2>
            <p className="max-w-md pb-1.5 text-[15px] font-light leading-relaxed text-white/45">
              No code reaches an owner — and no money moves — until every gate
              clears. That&apos;s why both sides can trust a stranger on the internet.
            </p>
          </div>
        </Reveal>

        {/* The blueprint */}
        <Reveal delay={150}>
          <div className="mt-8 md:mt-12">
            <BlueprintScene />
          </div>
        </Reveal>

        {/* Plain-English gates */}
        <div className="mt-8 grid gap-10 md:mt-14 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 md:gap-8">
          {GATES.map((gate, i) => (
            <Reveal key={gate.n} delay={i * 110}>
              <div className="flex items-start gap-4 md:block">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/[0.06] text-accent md:mb-4">
                  <gate.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </span>
                <div>
                  <span className="font-mono text-[11px] text-accent/70">{gate.n}</span>
                  <h3 className="mt-1 text-[17px] font-medium tracking-[-0.02em] text-white">{gate.title}</h3>
                  <p className="mt-2 text-sm font-light leading-relaxed text-white/45">{gate.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-14 text-center font-mono text-[9.5px] sm:text-[11px] tracking-wide text-white/30 px-4">
            fail any gate → it never reaches the owner&nbsp;&nbsp;·&nbsp;&nbsp;pass all
            four → merge and payout are automatic
          </p>
        </Reveal>
      </div>
    </Section>
  )
}
