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
import { ForkyLoader } from '@/components/ui/ForkyLoader'

interface LoaderProps {
  text?: string
  fullScreen?: boolean
}

export function Loader({ text = 'Loading', fullScreen = false }: LoaderProps) {
  return <ForkyLoader label={text} fullScreen={fullScreen} />
}
