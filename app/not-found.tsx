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

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/shared/Navbar'

const REDIRECT_SECONDS = 3

export default function NotFound() {
  const router = useRouter()
  const [count, setCount] = useState(REDIRECT_SECONDS)

  useEffect(() => {
    if (count <= 0) {
      router.push('/')
      return
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [count, router])

  return (
    <div className="h-screen w-full bg-[#0A0A0A] text-white selection:bg-accent selection:text-white flex flex-col overflow-hidden fixed inset-0">
      <Navbar />
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-accent/5 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('/forke-assets/dot-grid.png')] opacity-[0.03]" />
      </div>

      <main className="flex-grow flex flex-col items-center justify-center relative z-10">
        
        {/* Massive 404 Text Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 px-4">
           <h1 className="text-[30vw] md:text-[45vw] font-sans font-black text-white/[0.03] leading-none tracking-tighter select-none uppercase">
             404
           </h1>
        </div>

        {/* Huge Mascot Visual */}
        <div className="relative group z-10 mt-12">
          <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full scale-90 group-hover:scale-125 transition-transform duration-1000" />
          <div className="relative">
             <Image
               src="/forke-assets/forky-reactions/404_forky.png"
               alt="404 Forky"
               width={700}
               height={700}
               className="drop-shadow-[0_0_60px_rgba(255,122,0,0.5)] animate-float max-w-[90vw] max-h-[55vh] object-contain relative z-20"
               priority
             />
          </div>
        </div>

        {/* Auto-redirect notice */}
        <div className="relative z-10 mt-2 flex flex-col items-center gap-3">
          <p className="text-sm text-white/45">
            Redirecting you home in{' '}
            <span className="font-mono font-medium text-accent tabular-nums">{count}s</span>…
          </p>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full origin-left rounded-full bg-accent"
              style={{ animation: `nf-countdown ${REDIRECT_SECONDS}s linear forwards` }}
            />
          </div>
          <Link
            href="/"
            className="text-[11px] font-mono uppercase tracking-[0.18em] text-white/30 transition-colors hover:text-white/60"
          >
            ← take me home now
          </Link>
        </div>
      </main>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-25px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes nf-countdown {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}
