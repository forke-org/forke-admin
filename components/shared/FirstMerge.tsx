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

import React, { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

export default function FirstMerge() {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // 1. Lazy loading observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: '200px', // Lazy-load 200px before the video enters the viewport
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  // Subtle Apple-style ken-burns: the video drifts from slightly zoomed to rest
  // as the banner scrolls through the viewport. Only the video layer moves; the
  // edge-blend overlays stay fixed. Skipped under reduced motion.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(
        videoWrapRef.current,
        { scale: 1.12, yPercent: -3 },
        {
          scale: 1,
          yPercent: 3,
          ease: 'none',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
          },
        }
      )
    },
    { scope: containerRef }
  )

  return (
    <div ref={containerRef} className="w-full relative overflow-hidden bg-bg">
      {/* Edge blending overlays */}
      <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_30px_rgba(5,5,5,1)] md:shadow-[inset_0_0_80px_rgba(5,5,5,1)]" />
      <div className="absolute top-0 left-0 right-0 h-8 md:h-28 bg-gradient-to-b from-[#050505] to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-8 md:h-28 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 bottom-0 left-0 w-3 md:w-20 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none z-10" />
      <div className="absolute top-0 bottom-0 right-0 w-3 md:w-20 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none z-10" />

      {/* Video Content */}
      <div ref={videoWrapRef} className="w-full flex items-center justify-center will-change-transform">
        {isVisible ? (
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-auto block object-cover"
          >
            <source src="/forke-assets/landing-assets/the first merge.webm" type="video/webm" />
            <source src="/forke-assets/landing-assets/the first merge.mp4" type="video/mp4" />
          </video>
        ) : (
          /* Placeholder to maintain height during lazy load */
          <div className="w-full aspect-[1280/302] bg-[#050505]" />
        )}
      </div>
    </div>
  )
}
