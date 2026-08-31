/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { cookies } from 'next/headers'

// Single source of truth for marketing attribution.
// First-party signals only (UTM params, referrer, landing page) — no IP / device fingerprint.

export const ATTRIBUTION_COOKIE = 'forke_attribution'
export const SESSION_COOKIE = 'forke_session'

export type Attribution = {
  source: string
  medium?: string
  campaign?: string
  referrer?: string
  landingPage?: string
  firstSeenAt?: string
  signupRole?: 'developer' | 'owner'
  sessionId?: string // forke_session cookie — joins this signup back to the click that produced it
}

/** Read the forke_session id (set by middleware) so a signup can be tied to its originating click. */
export async function readSessionId(): Promise<string | undefined> {
  try {
    const store = await cookies()
    return store.get(SESSION_COOKIE)?.value || undefined
  } catch {
    return undefined
  }
}

/**
 * Known marketing channels and the variants we collapse into each one.
 *
 * Shared links get mangled in the wild in two ways:
 *  - concatenated — "?source=reddit" glued to the next URL becomes
 *    "reddithttps://www…", which slugifies to "reddithttpsw…"
 *  - truncated — a link clipped mid-param leaves "?source=wh" / "?source=whatsa"
 *
 * Matching on a prefix/contains for each canonical channel folds both cases back
 * into the right bucket so the dashboard shows "reddit"/"whatsapp", not garbage.
 * Order matters: longer, more specific aliases are checked first.
 */
const CHANNEL_ALIASES: { canonical: string; matches: string[] }[] = [
  { canonical: 'whatsapp', matches: ['whatsapp', 'whatsa', 'whats', 'whatp', 'wapp', 'wa', 'wh'] },
  { canonical: 'reddit', matches: ['reddit', 'reddi', 'redd'] },
  { canonical: 'twitter', matches: ['twitter', 'tweet', 'twt', 'x'] },
  { canonical: 'linkedin', matches: ['linkedin', 'linked', 'lnkd'] },
  { canonical: 'instagram', matches: ['instagram', 'insta', 'ig'] },
  { canonical: 'discord', matches: ['discord', 'discrd'] },
  { canonical: 'telegram', matches: ['telegram', 'tgram', 'tg'] },
  { canonical: 'facebook', matches: ['facebook', 'fbook', 'fb'] },
  { canonical: 'youtube', matches: ['youtube', 'ytube', 'yt'] },
  { canonical: 'email', matches: ['email', 'newsletter', 'mail'] },
  { canonical: 'chatgpt', matches: ['chatgpt', 'chatgptcom', 'openai'] },
  { canonical: 'claude', matches: ['claude', 'anthropic'] },
  { canonical: 'perplexity', matches: ['perplexity', 'pplx'] },
  { canonical: 'gemini', matches: ['gemini', 'deepmind'] },
  { canonical: 'deepseek', matches: ['deepseek'] },
  { canonical: 'hackernews', matches: ['hackernews', 'hn', 'ycombinator'] },
  { canonical: 'peerlist', matches: ['peerlist'] },
  { canonical: 'threads', matches: ['threads'] },
  { canonical: 'bluesky', matches: ['bluesky', 'bsky'] },
  { canonical: 'github', matches: ['github', 'gh'] },
  { canonical: 'producthunt', matches: ['producthunt', 'ph'] },
]

/** Map a slugified value to a canonical channel, or null if it matches no known channel. */
function canonicalChannel(slug: string): string | null {
  for (const { canonical, matches } of CHANNEL_ALIASES) {
    // exact alias, or the value starts with the canonical name (catches concatenated junk)
    if (slug === canonical || slug.startsWith(canonical)) return canonical
    if (matches.some((m) => slug === m)) return canonical
  }
  return null
}

/**
 * Normalize a raw ?source= / ?utm_source= value into a clean, comparable channel slug.
 * Used by the middleware (capture), the waitlist route, and server actions so they all agree.
 */
export function normalizeSource(raw?: string | null): string {
  if (!raw) return 'direct'
  const cleaned = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '') // strip anything that isn't a safe slug char
    .slice(0, 32)
  if (!cleaned) return 'direct'
  return canonicalChannel(cleaned) || cleaned
}

/** Light cleaner for free-text attribution fields (medium/campaign). Keeps it short and printable. */
function cleanField(raw?: string | null): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.toLowerCase().trim().replace(/[^a-z0-9_\- ]/g, '').slice(0, 64)
  return cleaned || undefined
}

/**
 * Read the first-touch attribution cookie set by middleware.
 * Server-side only. Returns a safe { source: 'direct' } fallback when missing or malformed.
 */
export async function readAttributionCookie(): Promise<Attribution> {
  try {
    const store = await cookies()
    const raw = store.get(ATTRIBUTION_COOKIE)?.value
    if (!raw) return { source: 'direct' }
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Attribution>
    return {
      source: normalizeSource(parsed.source),
      medium: cleanField(parsed.medium),
      campaign: cleanField(parsed.campaign),
      referrer: typeof parsed.referrer === 'string' ? parsed.referrer.slice(0, 255) : undefined,
      landingPage: typeof parsed.landingPage === 'string' ? parsed.landingPage.slice(0, 255) : undefined,
      firstSeenAt: typeof parsed.firstSeenAt === 'string' ? parsed.firstSeenAt : undefined,
    }
  } catch {
    return { source: 'direct' }
  }
}
