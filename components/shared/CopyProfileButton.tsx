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
import { Link2, Check } from 'lucide-react'

export default function CopyProfileButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const link = `${window.location.origin}/${username}`
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold hover:bg-accent/25 hover:border-accent/50 transition-all cursor-pointer select-none active:scale-[0.98]"
      title="Copy Profile Link"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Copied Link!</span>
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5" />
          <span>Copy Profile</span>
        </>
      )}
    </button>
  )
}
