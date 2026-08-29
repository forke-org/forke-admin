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

// Route handlers have no 1MB Server-Action body cap, so full-resolution images
// upload fine here. Files land in Cloudflare R2 if configured; otherwise they
// fall back to local-disk /public/uploads/blogs/*.

export const runtime = 'nodejs'

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const MAX_BYTES = 25 * 1024 * 1024 // generous — quality preserved, no recompression here

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

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image exceeds 25 MB' }, { status: 413 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const name = `${crypto.randomUUID()}.${EXT[file.type] ?? 'jpg'}`

  try {
    if (isR2Configured()) {
      const r2Url = await uploadToR2(bytes, `blogs/${name}`, file.type)
      return NextResponse.json({ url: r2Url })
    }

    // Fallback: local disk
    const dir = join(process.cwd(), 'public', 'uploads', 'blogs')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, name), bytes)

    return NextResponse.json({ url: `/uploads/blogs/${name}` })
  } catch (err) {
    console.error('Upload handler error:', err)
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 })
  }
}

