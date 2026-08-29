'use server'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { isAdminAuthenticated } from './admin-actions'

export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

/** Pull a single meta/og value out of raw HTML by property/name. */
function pickMeta(html: string, keys: string[]): string | null {
  for (const key of keys) {
    // Matches <meta property="og:title" content="…"> in either attribute order.
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`,
      'i'
    )
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`,
      'i'
    )
    const m = html.match(re) || html.match(re2)
    if (m?.[1]) return decodeEntities(m[1].trim())
  }
  return null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
}

/**
 * Fetch Open Graph / meta data for a URL so the editor can render a rich
 * link-preview card. Runs server-side to dodge CORS. Best-effort: returns
 * whatever it can scrape, falling back to the hostname as a title.
 */
export async function getLinkPreview(rawUrl: string): Promise<LinkPreview> {
  if (!(await isAdminAuthenticated())) {
    throw new Error('Unauthorized')
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return {
      url: rawUrl,
      title: rawUrl,
      description: null,
      image: null,
      siteName: null,
      favicon: null,
    }
  }

  const fallback: LinkPreview = {
    url: url.toString(),
    title: url.hostname.replace(/^www\./, ''),
    description: null,
    image: null,
    siteName: url.hostname.replace(/^www\./, ''),
    favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`,
  }

  try {
    const res = await fetch(url.toString(), {
      headers: {
        // Pretend to be a browser so sites return their OG-rich HTML.
        'User-Agent':
          'Mozilla/5.0 (compatible; ForkeBot/1.0; +https://forke.dev)',
        Accept: 'text/html,application/xhtml+xml',
      },
      // Don't hang the editor on slow sites.
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return fallback
    const html = (await res.text()).slice(0, 500_000) // cap parse size

    const title =
      pickMeta(html, ['og:title', 'twitter:title']) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      fallback.title
    const image = pickMeta(html, ['og:image', 'twitter:image', 'twitter:image:src'])

    return {
      url: url.toString(),
      title: title ? decodeEntities(title) : fallback.title,
      description: pickMeta(html, ['og:description', 'twitter:description', 'description']),
      image: image ? new URL(image, url).toString() : null,
      siteName: pickMeta(html, ['og:site_name']) || fallback.siteName,
      favicon: fallback.favicon,
    }
  } catch {
    return fallback
  }
}
