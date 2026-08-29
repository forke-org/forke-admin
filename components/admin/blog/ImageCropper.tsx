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

/**
 * Dependency-free image cropper modal.
 *
 * Every uploaded image passes through this before insert/upload. The user can:
 *   • keep the full original (no crop, zero re-encode → zero quality loss), or
 *   • drag a crop rectangle (free or fixed aspect) and export the crop.
 *
 * Quality policy (no visible quality drop):
 *   - "Use original" returns the untouched file bytes — pixel-perfect.
 *   - A crop is exported via canvas at quality 0.95 (visually lossless), at the
 *     crop's native source resolution (no upscaling).
 *   - If either source dimension exceeds MAX_DIM, we downscale once with high
 *     image smoothing so web files stay sane without obvious softening.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, X, Crop as CropIcon, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const MAX_DIM = 4000 // px — downscale anything larger on export

type Aspect = 'free' | '16:9' | '4:3' | '1:1' | '3:1'
const ASPECTS: { id: Aspect; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '3:1', label: 'Banner', ratio: 3 },
]

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type DragMode =
  | null
  | { kind: 'move'; startX: number; startY: number; orig: Rect }
  | { kind: 'resize'; corner: 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; orig: Rect }

interface ImageCropperProps {
  file: File
  /** Fixed aspect to start in (e.g. cover banner). Omit for free. */
  defaultAspect?: Aspect
  onCancel: () => void
  /** Returns the chosen blob (original or cropped) + a filename. */
  onConfirm: (blob: Blob, filename: string) => void
}

export default function ImageCropper({
  file,
  defaultAspect = 'free',
  onCancel,
  onConfirm,
}: ImageCropperProps) {
  const [objectUrl, setObjectUrl] = useState<string>('')
  const imgRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [aspect, setAspect] = useState<Aspect>(defaultAspect)
  const [crop, setCrop] = useState<Rect | null>(null) // in displayed-image px
  const [drag, setDrag] = useState<DragMode>(null)
  const [working, setWorking] = useState(false)
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Initialize the crop box to the full image once it's measured.
  const initCrop = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    setCrop({ x: 0, y: 0, w: img.clientWidth, h: img.clientHeight })
  }, [])

  // When aspect changes, fit a centered box of that ratio inside the image.
  useEffect(() => {
    const img = imgRef.current
    if (!img || !img.clientWidth) return
    const def = ASPECTS.find((a) => a.id === aspect)
    if (!def || def.ratio === null) return
    const cw = img.clientWidth
    const ch = img.clientHeight
    let w = cw
    let h = w / def.ratio
    if (h > ch) {
      h = ch
      w = h * def.ratio
    }
    setCrop({ x: (cw - w) / 2, y: (ch - h) / 2, w, h })
  }, [aspect])

  const clampRect = useCallback((r: Rect): Rect => {
    const img = imgRef.current
    if (!img) return r
    const maxW = img.clientWidth
    const maxH = img.clientHeight
    let { x, y, w, h } = r
    w = Math.max(24, Math.min(w, maxW))
    h = Math.max(24, Math.min(h, maxH))
    x = Math.max(0, Math.min(x, maxW - w))
    y = Math.max(0, Math.min(y, maxH - h))
    return { x, y, w, h }
  }, [])

  // Pointer drag handling for move + corner resize (respects locked aspect).
  useEffect(() => {
    if (!drag) return
    const ratio = ASPECTS.find((a) => a.id === aspect)?.ratio ?? null

    const onMove = (e: PointerEvent) => {
      if (!crop) return
      if (drag.kind === 'move') {
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        setCrop(clampRect({ ...drag.orig, x: drag.orig.x + dx, y: drag.orig.y + dy }))
      } else {
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        let { x, y, w, h } = drag.orig
        const right = x + w
        const bottom = y + h
        if (drag.corner === 'se') {
          w = drag.orig.w + dx
          h = ratio ? w / ratio : drag.orig.h + dy
        } else if (drag.corner === 'sw') {
          w = drag.orig.w - dx
          x = right - w
          h = ratio ? w / ratio : drag.orig.h + dy
        } else if (drag.corner === 'ne') {
          w = drag.orig.w + dx
          h = ratio ? w / ratio : drag.orig.h - dy
          y = bottom - h
        } else {
          // nw
          w = drag.orig.w - dx
          x = right - w
          h = ratio ? w / ratio : drag.orig.h - dy
          y = bottom - h
        }
        setCrop(clampRect({ x, y, w, h }))
      }
    }
    const onUp = () => setDrag(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, crop, aspect, clampRect])

  const exportCrop = async () => {
    const img = imgRef.current
    if (!img || !crop) return
    setWorking(true)
    try {
      // Map displayed-px crop → source-px crop.
      const scale = natural.w / img.clientWidth
      let sx = crop.x * scale
      let sy = crop.y * scale
      let sw = crop.w * scale
      let sh = crop.h * scale

      // Downscale only if the crop is larger than MAX_DIM on a side.
      let dw = sw
      let dh = sh
      const longest = Math.max(dw, dh)
      if (longest > MAX_DIM) {
        const k = MAX_DIM / longest
        dw = Math.round(dw * k)
        dh = Math.round(dh * k)
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(dw)
      canvas.height = Math.round(dh)
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)

      // Keep PNG for transparency-capable sources, else high-quality JPEG.
      const isPng = file.type === 'image/png'
      const mime = isPng ? 'image/png' : 'image/jpeg'
      const ext = isPng ? 'png' : 'jpg'
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b!), mime, 0.95)
      )
      onConfirm(blob, `${file.name.replace(/\.[^.]+$/, '')}-cropped.${ext}`)
    } finally {
      setWorking(false)
    }
  }

  const useOriginal = () => onConfirm(file, file.name)

  const handle = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!crop) return
    setDrag({ kind: 'resize', corner, startX: e.clientX, startY: e.clientY, orig: crop })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl flex-col rounded-xl border border-[var(--color-border)] bg-[#0b0b0e] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <CropIcon className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-medium text-white">Crop image</h3>
            {natural.w > 0 && (
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                {natural.w}×{natural.h}
              </span>
            )}
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Aspect presets */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] px-5 py-3">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAspect(a.id)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
                aspect === a.id
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Stage */}
        <div className="flex max-h-[55vh] items-center justify-center overflow-hidden p-5">
          <div ref={stageRef} className="relative inline-block select-none">
            {objectUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={objectUrl}
                alt="To crop"
                onLoad={initCrop}
                draggable={false}
                className="block max-h-[50vh] max-w-full object-contain"
              />
            )}

            {crop && (
              <>
                {/* Dim overlay outside crop via box-shadow */}
                <div
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setDrag({ kind: 'move', startX: e.clientX, startY: e.clientY, orig: crop })
                  }}
                  className="absolute cursor-move border border-white/80"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.w,
                    height: crop.h,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                  }}
                >
                  {/* rule-of-thirds guides */}
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                    <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                    <div className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
                    <div className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
                  </div>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                    <span
                      key={c}
                      onPointerDown={handle(c)}
                      className={cn(
                        'absolute h-3.5 w-3.5 rounded-sm border-2 border-accent bg-[#0b0b0e]',
                        c === 'nw' && '-left-1.5 -top-1.5 cursor-nwse-resize',
                        c === 'ne' && '-right-1.5 -top-1.5 cursor-nesw-resize',
                        c === 'sw' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
                        c === 'se' && '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-5 py-3.5">
          <button
            onClick={useOriginal}
            disabled={working}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-50"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Use original
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={working}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={exportCrop}
              disabled={working}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {working ? 'Processing…' : 'Crop & insert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
