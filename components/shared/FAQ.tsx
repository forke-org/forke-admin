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

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { Section, Eyebrow, H2 } from '@/components/landing/primitives'
import Reveal from '@/components/landing/Reveal'

const FAQS = [
  {
    q: 'How do I get paid?',
    a: 'Every task is escrowed up front — the client deposits the full bounty before you ever see it. Ship your PR, pass review, and the moment it merges the escrow releases straight to your UPI. No invoices, no net-30, no chasing.',
  },
  {
    q: "What if I claim a task and can't finish it?",
    a: 'Claiming gives you a 20-minute window to activate. If life happens after that, forfeit from your dashboard and the task returns to the standby queue for someone else. Forfeiting is allowed — but your completion rate feeds your trust score, which gates the bigger bounties.',
  },
  {
    q: 'Do I need a resume or an interview?',
    a: 'No. Anyone can claim entry-level tasks on day one. Higher-paying work is gated by your level, skill tier, and trust score — all of which are earned by shipping, not by talking about shipping.',
  },
  {
    q: 'Who reviews my code?',
    a: 'Four layers. Automated checks first: build, tests, lint, scope and security scan. Then an AI review scores the diff against the task spec. A risk score routes the submission, and finally the owner approves a plain-English verdict — they never wade through your raw diff.',
  },
  {
    q: 'What does Forke cost?',
    a: 'Developers keep 100% of the listed bounty. Clients pay a 10% platform fee on top — a ₹500 task costs them ₹550, and you receive the full ₹500.',
  },
]

export default function FAQ({ n = '007' }: { n?: string }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <Section id="faq" className="px-5 py-16 md:px-10 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.7fr] lg:gap-20">
        {/* Left: header column */}
        <Reveal>
          <Eyebrow n={n} label="faq" />
          <H2 accent="answered.">Questions,</H2>
          <p className="mt-5 max-w-sm text-[15px] font-light leading-relaxed text-white/45">
            Everything you need to know about shipping and earning on Forke.
            Something else on your mind?
          </p>
          <a
            href="mailto:support@forke.space"
            className="mt-4 inline-block font-mono text-[12.5px] text-accent transition-colors hover:text-accent-hover"
          >
            support@forke.space →
          </a>
        </Reveal>

        {/* Right: accordion fills the remaining width */}
        <Reveal delay={120}>
          <div className="border-t border-white/[0.07]">
            {FAQS.map((faq, i) => {
              const isOpen = open === i
              return (
                <div key={faq.q} className="border-b border-white/[0.07]">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-5 py-6 text-left"
                  >
                    <span
                      className={`font-mono text-xs transition-colors ${
                        isOpen ? 'text-accent' : 'text-white/30'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`flex-1 text-base font-medium tracking-[-0.01em] transition-colors md:text-lg ${
                        isOpen ? 'text-white' : 'text-white/65'
                      }`}
                    >
                      {faq.q}
                    </span>
                    <Plus
                      className={`h-4.5 w-4.5 shrink-0 transition-transform duration-300 ${
                        isOpen ? 'rotate-45 text-accent' : 'text-white/35'
                      }`}
                    />
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-2xl pb-7 pl-[34px] text-[15px] font-light leading-relaxed text-white/50 md:pl-[42px]">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
