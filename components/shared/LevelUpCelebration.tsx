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

import React, { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { LevelUpModal } from '@/components/ui/LevelUpModal'

export default function LevelUpCelebration() {
  const { data: session } = useSession()
  const [newLevel, setNewLevel] = useState<number | null>(null)
  const lastLevel = useRef<number | null>(null)

  useEffect(() => {
    if (session?.user?.level) {
      const currentLevel = session.user.level
      
      // If we have a previous level and it increased, trigger the modal
      if (lastLevel.current !== null && currentLevel > lastLevel.current) {
        setNewLevel(currentLevel)
      }
      
      lastLevel.current = currentLevel
    }
  }, [session?.user?.level])

  return (
    <LevelUpModal 
      newLevel={newLevel} 
      onClose={() => setNewLevel(null)} 
    />
  )
}
