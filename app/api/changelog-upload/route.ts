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
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import crypto from 'crypto'
import { isAdminAuthenticated } from '@/lib/admin-actions'
import { isR2Configured, uploadToR2 } from '@/lib/r2'

export const runtime = 'nodejs'

const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const ALLOWED_VIDEOS = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB max for media uploads

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mp4',
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const isImage = ALLOWED_IMAGES.has(file.type)
  const isVideo = ALLOWED_VIDEOS.has(file.type)

  if (!isImage && !isVideo) {
    return NextResponse.json({ error: 'Unsupported media type. Supported: WebP, PNG, JPG, GIF, MP4, WebM' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50 MB' }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const ext = EXT[file.type] ?? (isImage ? 'webp' : 'mp4')
  const name = `${crypto.randomUUID()}.${ext}`

  try {
    if (isR2Configured()) {
      const r2Url = await uploadToR2(bytes, `changelogs/${name}`, file.type)
      return NextResponse.json({ url: r2Url, mediaType: isVideo ? 'video' : 'image' })
    }

    // Fallback: local disk
    const dir = join(process.cwd(), 'public', 'uploads', 'changelogs')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, name), bytes)

    return NextResponse.json({ url: `/uploads/changelogs/${name}`, mediaType: isVideo ? 'video' : 'image' })
  } catch (err) {
    console.error('Changelog upload handler error:', err)
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 })
  }
}
