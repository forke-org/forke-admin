/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import type { Metadata, Viewport } from 'next'
import { geistSans, instrumentSerif, jetbrainsMono } from '@/app/fonts'
import './globals.css'

export const viewport: Viewport = {
  themeColor: '#FF7A00',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://www.forke.space'),
  title: {
    default: 'Forke — Ship Real Work, Get Paid',
    template: '%s | Forke'
  },
  description: 'The micro-task marketplace for developers. Join the movement, complete bounties, level up, and earn rewards for shipping high-quality code.',
  keywords: ['developer marketplace', 'bounties', 'micro-tasks', 'programming', 'software engineering', 'earn money coding', 'forke'],
  authors: [{ name: 'Forke Team' }],
  creator: 'Forke Technology Group',
  publisher: 'Forke',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: 'Forke — Ship Real Work, Get Paid',
    description: 'The micro-task marketplace for developers. Complete bounties and level up your engineering career.',
    url: 'https://www.forke.space',
    siteName: 'Forke',
    images: [
      {
        url: '/forke-assets/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Forke — The Developer Marketplace',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Forke — Ship Real Work, Get Paid',
    description: 'The micro-task marketplace for developers. Complete bounties and level up your engineering career.',
    creator: '@forkedotdev',
    images: ['/forke-assets/og-image.jpg'],
  },

  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

import { NextAuthProvider } from '@/components/providers/NextAuthProvider'
import { ScrollToTopOnLoad } from '@/components/providers/ScrollToTopOnLoad'
import { CookieConsentProvider } from '@/components/providers/CookieConsentProvider'
import { GoogleAnalyticsWrapper } from '@/components/providers/GoogleAnalyticsWrapper'
import { CookieConsentBanner } from '@/components/ui/CookieConsentBanner'

// Load GA4 only in production with a configured ID, so local dev never pollutes
// the live analytics. Set NEXT_PUBLIC_GA_ID in Vercel (e.g. G-XV7FKNZ4S6).
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased bg-[#0A0A0A]">
        <ScrollToTopOnLoad />
        <CookieConsentProvider>
          <NextAuthProvider>
            {children}
          </NextAuthProvider>
          <CookieConsentBanner />
          <GoogleAnalyticsWrapper gaId={GA_ID} />
        </CookieConsentProvider>
      </body>
    </html>
  )
}

