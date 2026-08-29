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
 * Image upload seam for the blog editor.
 *
 * Primary path (production): ask /api/blog-upload/presign for a short-lived
 * presigned R2 URL, then PUT the bytes DIRECTLY to R2. This bypasses Vercel's
 * ~4.5 MB serverless request-body limit, so large files (e.g. GIFs) upload fine.
 *
 * Fallback path (local dev / no R2): the presign route returns 409, and we POST
 * the file to /api/blog-upload, which writes it to /public/uploads and returns a
 * served URL.
 *
 * Both paths use XMLHttpRequest (not fetch) so we can report real upload
 * progress — fetch doesn't expose upload progress events.
 */

import { compressImage } from './compressImage'

export interface UploadResult {
  url: string
}

/** PUT raw bytes to a presigned URL, reporting progress. Resolves on 2xx. */
function putToPresignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('Upload to storage failed.'))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))
    xhr.open('PUT', uploadUrl)
    // Must match the Content-Type the URL was signed with, or R2 rejects it.
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(blob)
  })
}

/** Legacy path: POST the file through our serverless route (≤4.5 MB on Vercel). */
function postThroughServer(
  blob: Blob,
  filename: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const form = new FormData()
  const named =
    blob instanceof File ? blob : new File([blob], `${filename}`, { type: blob.type })
  form.append('file', named)

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('Invalid response from server.'))
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText)
          reject(new Error(data.error || 'Upload failed.'))
        } catch {
          reject(new Error('Upload failed.'))
        }
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))
    xhr.open('POST', '/api/blog-upload')
    xhr.send(form)
  })
}

/**
 * Upload an image file/blob and return its served URL.
 *
 * @param onProgress  Optional callback fired with a 0–100 percentage as bytes
 *                    are sent. Only fires during the upload phase.
 */
export async function uploadImage(
  file: Blob,
  filename = 'image',
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  // Compress in the browser first (downscale + WebP). GIFs and failures pass
  // through untouched, so this never blocks an upload — it only ever shrinks it.
  const { blob, contentType, filename: outName } = await compressImage(file, filename)

  // 1) Try the direct-to-R2 presigned path (no Vercel body limit).
  try {
    const res = await fetch('/api/blog-upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType, size: blob.size }),
    })

    if (res.ok) {
      const { uploadUrl, publicUrl } = await res.json()
      await putToPresignedUrl(uploadUrl, blob, contentType, onProgress)
      return { url: publicUrl }
    }

    // 409 = R2 not configured → fall through to the server POST path.
    // Any other non-OK status is a real error (auth, too large, bad type).
    if (res.status !== 409) {
      let message = 'Upload failed.'
      try {
        message = (await res.json()).error || message
      } catch {
        /* keep default */
      }
      throw new Error(message)
    }
  } catch (err) {
    // A thrown Error above is a genuine failure — surface it. A network/parse
    // failure on the presign request itself also falls through to the fallback.
    if (err instanceof Error && err.message !== 'Failed to fetch') throw err
  }

  // 2) Fallback: POST through the server (local dev / no R2).
  return postThroughServer(blob, outName, onProgress)
}
