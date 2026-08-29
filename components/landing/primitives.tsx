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

/**
 * Shared building blocks for the landing/marketing "ledger" layout.
 * Content lives between two vertical rails; sections start with a hairline and
 * crosshair joints mark where hairlines meet the rails. Rails can fade at
 * either end so full-bleed moments (video, CTA) blend in smoothly.
 */

const RAIL = 'rgba(255, 255, 255, 0.07)'

export function Rails({
  children,
  className = '',
  fadeTop = false,
  fadeBottom = false,
}: {
  children: React.ReactNode
  className?: string
  fadeTop?: boolean
  fadeBottom?: boolean
}) {
  const railGradient = `linear-gradient(to bottom, ${fadeTop ? 'transparent' : RAIL}, ${RAIL} 160px, ${RAIL} calc(100% - 160px), ${fadeBottom ? 'transparent' : RAIL})`
  return (
    <div className={`relative mx-auto max-w-7xl min-[1920px]:max-w-[1920px] ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-px lg:block z-10"
        style={{ background: railGradient }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-px lg:block z-10"
        style={{ background: railGradient }}
      />
      {children}
    </div>
  )
}

/** Crosshair joints for the top corners of a full-rail-width section. */
export function Crosses() {
  return (
    <>
      <span aria-hidden className="ui-cross hidden lg:block left-0 top-0 -translate-x-1/2 -translate-y-1/2">+</span>
      <span aria-hidden className="ui-cross hidden lg:block right-0 top-0 translate-x-1/2 -translate-y-1/2">+</span>
    </>
  )
}

export function Section({
  id,
  className = '',
  flush = false,
  children,
}: {
  id?: string
  className?: string
  /** Skip the top hairline + crosses — for sections that follow a faded edge. */
  flush?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={`relative ${flush ? '' : 'border-t border-white/[0.06]'} ${className}`}
    >
      {!flush && <Crosses />}
      {children}
    </section>
  )
}

export function Eyebrow({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] text-white/35">
      <span className="text-accent/80">{n}</span>
      <span className="h-px w-8 bg-white/15" />
      <span className="uppercase">{label}</span>
    </div>
  )
}

/** Section heading — sans-medium with a single serif-italic accent word. */
export function H2({
  children,
  accent,
  className = '',
}: {
  children: React.ReactNode
  accent: string
  className?: string
}) {
  return (
    <h2 className={`mt-5 text-4xl md:text-[3.25rem] font-medium tracking-[-0.035em] leading-[1.06] text-white ${className}`}>
      {children}{' '}
      <span className="font-serif italic font-normal text-accent">{accent}</span>
    </h2>
  )
}
