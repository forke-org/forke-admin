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

import { useEffect, useState } from 'react'

export default function DotPatternBackground() {
  const [patternNum, setPatternNum] = useState<number | null>(null)

  useEffect(() => {
    // Select only from the organic/random dot patterns (1, 2, 3, 5).
    // Pattern 4 and 6 are uniform square grids, which we exclude.
    const organicPatterns = [1, 2, 3, 5]
    const randomPattern = organicPatterns[Math.floor(Math.random() * organicPatterns.length)]
    setPatternNum(randomPattern)
  }, [])

  return (
    <div className="absolute inset-0 z-0 bg-[#070709]">
      {/* Client-side randomized organic dot pattern background overlay */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-screen bg-repeat bg-center transition-opacity duration-1000"
        style={{
          backgroundImage: patternNum ? `url('/patterns/pattern_${patternNum}.svg')` : 'none',
          backgroundSize: '400px', // balanced tile size
          opacity: patternNum ? 0.16 : 0, // clean and visible but not overwhelming
          filter: 'invert(0.5) sepia(1) saturate(5) hue-rotate(12deg)', // Warm amber/orange colorization
        }}
      />
      {/* Clean, subtle radial glow in the center to highlight the content */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,138,0,0.05)_0%,transparent_75%)] pointer-events-none" />
    </div>
  )
}
