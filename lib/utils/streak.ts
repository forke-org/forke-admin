/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

// Returns true if two dates are on consecutive calendar days
export function isConsecutiveDay(last: Date, now: Date): boolean {
  const lastDay = new Date(last)
  lastDay.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - lastDay.getTime()
  return diff === 86_400_000 // exactly 24 hours apart
}

// Returns true if last login was today (already logged in today)
export function isAlreadyLoggedInToday(last: Date, now: Date): boolean {
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth() === now.getMonth() &&
    last.getDate() === now.getDate()
  )
}
