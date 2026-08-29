/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import type { Metadata } from 'next'

/**
 * Site-wide Open Graph defaults.
 *
 * Next.js does NOT deep-merge a page's `openGraph` into the root layout's — a
 * child block REPLACES the parent entirely. So any page that sets its own
 * openGraph (for a custom title/description) silently drops the inherited
 * `images` and `siteName`, leaving its social card with no image. These helpers
 * fold the defaults back in so every page's card carries og-image.jpg unless it
 * deliberately overrides the image (profile pages, individual blog posts).
 */

export const DEFAULT_OG_IMAGE = {
  url: '/forke-assets/og-image.jpg',
  width: 1200,
  height: 630,
  alt: 'Forke — The Developer Marketplace',
} as const

export const SITE_NAME = 'Forke'

type OgInput = {
  title: string
  description?: string
  /** Absolute or path URL of the page. */
  url?: string
  type?: 'website' | 'article'
}

/**
 * Build a complete `openGraph` object with the default image + siteName baked
 * in. Pass per-page title/description/url; the image is always og-image.jpg.
 */
export function buildOpenGraph(input: OgInput): NonNullable<Metadata['openGraph']> {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    siteName: SITE_NAME,
    type: input.type ?? 'website',
    images: [DEFAULT_OG_IMAGE],
  }
}

/** Matching Twitter card using the same default image. */
export function buildTwitter(input: { title: string; description?: string }): NonNullable<Metadata['twitter']> {
  return {
    card: 'summary_large_image',
    title: input.title,
    description: input.description,
    images: [DEFAULT_OG_IMAGE.url],
  }
}
