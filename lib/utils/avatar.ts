/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { decryptUrl, isEncrypted } from '@/lib/utils/encrypt'

/**
 * Resolves a stored avatar value into a usable URL.
 * Uploaded avatars are stored AES-256-GCM encrypted (their real /uploads path
 * is never exposed); OAuth avatars are plain external URLs. Server-only.
 */
export function resolveAvatarUrl(image: string | null | undefined): string | null {
  if (!image) return null
  
  let url = image
  if (isEncrypted(image)) {
    url = decryptUrl(image) || image
  }

  // Optimize Google/GitHub OAuth image sizes for crisp rendering on high-DPI/3D cards
  if (url.includes('googleusercontent.com')) {
    if (url.match(/=s\d+(-\w+)?$/)) {
      return url.replace(/=s\d+(-\w+)?$/, '=s384-c')
    }
    if (url.match(/\/s\d+(-\w+)?\//)) {
      return url.replace(/\/s\d+(-\w+)?\//, '/s384-c/')
    }
    if (!url.includes('=')) {
      return `${url}=s384-c`
    }
  }

  if (url.includes('githubusercontent.com')) {
    try {
      const parsed = new URL(url)
      parsed.searchParams.set('s', '384')
      return parsed.toString()
    } catch {
      return url
    }
  }

  return url
}
