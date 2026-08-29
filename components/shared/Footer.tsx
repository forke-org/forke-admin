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

import React from 'react'

const ic = 'h-[18px] w-[18px]'
const SOCIALS: { label: string; href: string; icon: React.ReactNode }[] = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/forke/',
    icon: (
      <svg className={`${ic} fill-current`} viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
    ),
  },
  {
    label: 'X',
    href: 'https://x.com/forkespace',
    icon: (
      <svg className={`${ic} fill-current`} viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/forke.space/',
    icon: (
      <svg className={`${ic} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
    ),
  },
  {
    label: 'Threads',
    href: 'https://www.threads.com/@forke.space',
    icon: (
      <svg className={`${ic} fill-current`} viewBox="0 0 24 24"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" /></svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/people/Forke/61591130679350/',
    icon: (
      <svg className={`${ic} fill-current`} viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/forke-org',
    icon: (
      <svg className={`${ic} fill-current`} viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
    ),
  },
  {
    label: 'Email',
    href: 'mailto:support@forke.space',
    icon: (
      <svg className={`${ic} fill-none stroke-current`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
    ),
  },
]

export default function Footer() {

  const columns: { heading: string; links: { name: string; href: string; external?: boolean }[] }[] = [
    {
      heading: 'product',
      links: [
        { name: 'whats-forke', href: '/whats-forke' },
        { name: 'levels', href: '/levels' },
        { name: 'docs', href: '/docs' },
        { name: 'changelog', href: '/changelog' },
      ],
    },
    {
      heading: 'company',
      links: [
        { name: 'blogs', href: '/blogs' },
        { name: 'contact', href: '/contact' },
      ],
    },
    {
      heading: 'legal',
      links: [
        { name: 'privacy', href: '/privacy' },
        { name: 'terms', href: '/terms' },
        { name: 'refunds', href: '/refund' },
      ],
    },
  ]

  return (
    <footer className="relative z-10 overflow-hidden border-t border-white/[0.07]" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-7xl px-5 pt-16 md:px-10 md:pt-20 min-[1920px]:max-w-[1920px]">
        <div className="grid gap-8 md:gap-12 sm:grid-cols-2 md:grid-cols-[1.8fr_1fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div className="md:col-span-1">
            <a href="/" className="inline-flex items-center transition-opacity hover:opacity-80">
              <img
                src="/forke-assets/forke_logo.png"
                alt="Forke Logo"
                className="h-14 w-14 object-contain"
              />
              <span className="text-[26px] font-semibold tracking-[-0.04em] text-white">
                forke<span className="text-accent">*</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-white/60">
              The micro-task marketplace where Indian developers earn real money by
              shipping real code.
            </p>
            <p className="mt-5 font-mono text-[11px] text-white/55">
              {'//'} prove skill by shipping
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
                {col.heading}
              </p>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="font-mono text-[13px] text-white/60 transition-colors hover:text-white"
                    >
                      {link.name}
                      {link.external && ' ↗'}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Connect column */}
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
              connect
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  title={s.label}
                  {...(s.href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/60 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/[0.05] py-7 font-mono text-[11px] text-white/60 md:flex-row">
          <span>© 2026 forke — all rights reserved</span>
          <span>made in india · paid in rupees</span>
        </div>
      </div>

      {/* Giant outlined wordmark, clipped at the page edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative mx-auto h-[16vw] max-w-7xl select-none overflow-hidden md:h-[13vw] min-[1920px]:max-w-[1920px]"
      >
        <span className="text-outline absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap text-[20vw] font-medium leading-[0.78] tracking-[-0.05em] md:text-[16vw]">
          forke<span className="[-webkit-text-stroke:1px_rgba(255,122,0,0.55)]">*</span>
        </span>
      </div>
    </footer>
  )
}
