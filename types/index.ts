/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

export interface User {
  id: string
  name: string
  email: string
  role: 'developer' | 'owner'
  level: number
  createdAt: Date
}

export interface Task {
  id: string
  title: string
  description: string
  budget: number
  currency: string
  status: string
  skillTags: string[]
  clientId: string
  claimantId?: string
  createdAt: Date
}

export interface Submission {
  id: string
  taskId: string
  developerId: string
  githubLink: string
  status: string
  createdAt: Date
}
