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
import Image from 'next/image'

interface LoaderProps {
  text?: string
  fullScreen?: boolean
}

export function Loader({ text = 'LOADING...', fullScreen = false }: LoaderProps) {
  const containerClasses = fullScreen 
    ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] overflow-hidden' 
    : 'w-full h-full min-h-[300px] flex flex-col items-center justify-center'

  return (
    <div className={containerClasses}>
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-2">
        {/* Mascot Container with floating animation */}
        <div className="relative w-32 h-32 animate-[bounce_3s_ease-in-out_infinite]">
          {/* Subtle drop shadow for depth */}
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/50 blur-sm rounded-full animate-[pulse_3s_ease-in-out_infinite]" />
          
          <Image
            src="/forke-assets/forky-reactions/loading_forky.png"
            alt="Loading Forky"
            fill
            className="object-contain drop-shadow-[0_0_15px_rgba(255,122,0,0.3)]"
            priority
          />
        </div>

        {/* Text and Spinner */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/60 font-black uppercase tracking-[0.3em] animate-pulse">
              {text}
            </span>
          </div>
          
          {/* Progress Line — Track Bar style */}
          <div className="relative w-32 h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-2/5 bg-accent rounded-full" style={{ animation: 'progressSlide 1.4s cubic-bezier(.65,.05,.36,1) infinite' }} />
          </div>
        </div>
      </div>

      {/* Inline styles for custom keyframes if needed */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progressSlide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}} />
    </div>
  )
}
