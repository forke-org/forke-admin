/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { isAdminAuthenticated } from '@/lib/admin-actions'
import { isR2Configured, presignUpload } from '@/lib/r2'

// Returns a presigned PUT URL so the browser uploads the file DIRECTLY to R2,
// bypassing this serverless function's ~4.5 MB request-body limit on Vercel.
// The request body here is tiny JSON metadata — never the file itself.
//
// When R2 isn't configured (local dev → disk fallback), this returns 409 and the
// client falls back to POSTing the file to /api/blog-upload instead.

export const runtime = 'nodejs'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 25 * 1024 * 1024 // keep in lockstep with /api/blog-upload

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // No R2 → tell the client to use the legacy direct-POST path (disk fallback).
  if (!isR2Configured()) {
    return NextResponse.json({ error: 'Direct upload unavailable' }, { status: 409 })
  }

  let body: { contentType?: unknown; size?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const size = typeof body.size === 'number' ? body.size : 0

  if (!ALLOWED.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  }
  if (!size || size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image exceeds 25 MB' }, { status: 413 })
  }

  const key = `blogs/${crypto.randomUUID()}.${EXT[contentType] ?? 'bin'}`

  try {
    const { uploadUrl, publicUrl } = await presignUpload(key, contentType)
    return NextResponse.json({ uploadUrl, publicUrl, contentType })
  } catch (err) {
    console.error('Presign handler error:', err)
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
  }
}
