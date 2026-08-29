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
import { NextAuthProvider } from '@/components/providers/NextAuthProvider'
import { ScrollToTopOnLoad } from '@/components/providers/ScrollToTopOnLoad'

export const viewport: Viewport = {
  themeColor: '#FF7A00',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://admin.forke.space'),
  title: {
    default: 'Admin Control Unit | Forke',
    template: '%s | Forke Admin'
  },
  description: 'Forke administrative operations console.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

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
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  )
}
