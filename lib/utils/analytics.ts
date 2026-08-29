/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { createHash } from 'node:crypto'

// Server-side analytics helpers (Node runtime only — uses node:crypto).
// Two distinct concerns live here on purpose:
//   1. Visit tracking  -> first-party marketing signal, NO IP (see lib/utils/attribution.ts).
//   2. IP hashing       -> security/auth log only, one-way salted hash, never the raw IP.

export const SESSION_COOKIE = 'forke_session'

/** Salt for IP hashing. Set ANALYTICS_IP_SALT in env; fall back keeps dev working. */
const IP_SALT = process.env.ANALYTICS_IP_SALT || 'forke-default-rotate-me'

/**
 * One-way, salted SHA-256 of an IP address. We store ONLY this — never the raw IP.
 * Same IP always hashes to the same value (so we can still spot "many accounts, one IP"),
 * but the hash can't be reversed back to an address.
 */
export function hashIp(ip?: string | null): string | null {
  if (!ip) return null
  const clean = ip.split(',')[0].trim() // x-forwarded-for can be a list; take the client IP
  if (!clean) return null
  return createHash('sha256').update(IP_SALT + clean).digest('hex')
}

/** Pull the client IP from standard proxy headers (Vercel / nginx / RDS proxy). */
export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for') ||
    headers.get('x-real-ip') ||
    null
  )
}

/** Coarse country from edge geo headers (Vercel sets x-vercel-ip-country). No IP retained. */
export function getCountry(headers: Headers): string | null {
  return (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    null
  )
}

// Conservative bot match — keeps obvious crawlers out of the human click charts without
// trying to be a full bot-detection system.
//
// Deliberately NOT matching bare "google" / "bing" / "preview": those appear in ordinary
// human user-agents (Chrome on Android ships "Mobile Safari", iOS in-app webviews identify
// as "GSA"/Google app, and "preview" shows up in legitimate webviews). Matching them meant
// real visits were dropped before insert and never recorded at all. Crawlers are matched by
// their specific bot tokens instead.
const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|googlebot|adsbot|mediapartners-google|bingbot|yandexbot|baiduspider|duckduckbot|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|embedly|quora link preview|monitor|curl|wget|python-requests|libwww-perl|go-http-client|okhttp|axios|node-fetch|headless|phantomjs|puppeteer|playwright|lighthouse|pingdom|uptime|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|ccbot|claudebot|perplexitybot/i

export function isBotUserAgent(ua?: string | null): boolean {
  if (!ua) return true // no UA at all is almost always a script/scanner
  return BOT_UA.test(ua)
}
