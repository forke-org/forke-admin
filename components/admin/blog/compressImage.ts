/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

/**
 * Client-side image compression for the blog editor.
 *
 * Blog uploads go browser → R2 directly (presigned PUT), so the bytes never
 * touch our server — there's no place to run sharp. We therefore compress in the
 * browser BEFORE upload: decode the image, downscale the longest edge, and
 * re-encode to WebP. This shrinks both the stored asset and the bytes on every
 * blog-page view, while staying a valid image for OG/social previews.
 *
 * Safety rules:
 *  - GIFs are returned untouched (canvas would flatten animation to one frame).
 *  - SVGs / unknown types are returned untouched.
 *  - If the result isn't actually smaller, we keep the original.
 *  - Any decode/encode failure falls back to the original file — uploads never
 *    break because compression failed.
 */

const MAX_EDGE = 1600 // cap the longest side; plenty for full-width blog images + OG cards
const QUALITY = 0.8 // WebP quality — strong size win, visually lossless for photos
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export interface CompressedImage {
  blob: Blob
  /** Final content type after compression (e.g. image/webp), or the original type if skipped. */
  contentType: string
  /** A filename with the right extension for the (possibly new) content type. */
  filename: string
  /** True when we actually recompressed; false when we returned the original untouched. */
  compressed: boolean
}

function extFor(type: string): string {
  switch (type) {
    case 'image/webp': return 'webp'
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/avif': return 'avif'
    case 'image/gif': return 'gif'
    default: return 'img'
  }
}

function baseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

/** Decode a Blob into an ImageBitmap (preferred) or HTMLImageElement fallback. */
async function decode(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  // createImageBitmap is fastest and avoids the object-URL dance where supported.
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      cleanup: () => bitmap.close(),
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = url
    })
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(url),
    }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

/**
 * Compress an image file/blob for upload. Returns the original (with metadata)
 * when compression is skipped or wouldn't help.
 */
export async function compressImage(file: File | Blob, filename = 'image'): Promise<CompressedImage> {
  const originalType = file.type || 'application/octet-stream'
  const originalName = file instanceof File ? file.name : filename

  // Never recompress GIFs (animation) or anything we don't explicitly handle.
  if (!COMPRESSIBLE.has(originalType)) {
    return { blob: file, contentType: originalType, filename: originalName, compressed: false }
  }

  try {
    const src = await decode(file)
    try {
      const longest = Math.max(src.width, src.height)
      const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
      const w = Math.max(1, Math.round(src.width * scale))
      const h = Math.max(1, Math.round(src.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      // White matte avoids transparent PNGs turning black when flattened to a
      // format that still has alpha but is shown on dark/light surfaces; WebP
      // keeps alpha, so only matters for the rare opaque-expected case — drawing
      // straight is fine and preserves transparency for WebP.
      src.draw(ctx, w, h)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', QUALITY)
      )

      if (!blob) {
        return { blob: file, contentType: originalType, filename: originalName, compressed: false }
      }
      // Only keep the recompressed version if it's actually smaller.
      if (blob.size >= file.size) {
        return { blob: file, contentType: originalType, filename: originalName, compressed: false }
      }

      return {
        blob,
        contentType: 'image/webp',
        filename: `${baseName(originalName)}.${extFor('image/webp')}`,
        compressed: true,
      }
    } finally {
      src.cleanup()
    }
  } catch {
    // Anything goes wrong → upload the original untouched.
    return { blob: file, contentType: originalType, filename: originalName, compressed: false }
  }
}
