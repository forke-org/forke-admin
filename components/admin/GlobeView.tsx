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

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'

// 3D WebGL globe (react-globe.gl / three-globe). Countries are extruded/shaded by
// click volume. Client-only — this file is dynamically imported with ssr:false by
// the parent, because the globe needs WebGL + window.

type CountryDatum = { country: string; clicks: number; conversions?: number }
type Feature = { properties: Record<string, any>; bbox?: number[] }

const GEOJSON_URL = '/countries-110m.geojson' // vendored in /public

// Rough lat/long centroids for the countries we expect — used to rotate the globe to
// a country. Falls back to the polygon bbox center for anything not listed.
const CENTROIDS: Record<string, { lat: number; lng: number }> = {
  IN: { lat: 22, lng: 79 }, US: { lat: 39, lng: -98 }, GB: { lat: 54, lng: -2 },
  DE: { lat: 51, lng: 10 }, AE: { lat: 24, lng: 54 }, CA: { lat: 56, lng: -106 },
  SG: { lat: 1.3, lng: 103.8 }, FR: { lat: 46, lng: 2 }, AU: { lat: -25, lng: 133 },
  BR: { lat: -10, lng: -55 }, JP: { lat: 36, lng: 138 }, NL: { lat: 52, lng: 5 },
}

export default function GlobeView({
  data,
  focusIso,
  onHover,
}: {
  data: CountryDatum[]
  focusIso?: string | null
  onHover?: (d: { name: string; clicks: number } | null) => void
}) {
  const globeEl = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [countries, setCountries] = useState<Feature[]>([])
  const [size, setSize] = useState({ w: 480, h: 480 })
  const didInitView = useRef(false)

  const globeMaterial = useMemo(
    () => new THREE.MeshPhongMaterial({ color: 0x0c0c0e, transparent: true, opacity: 0.95 }),
    [],
  )

  const byIso = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of data) m.set(d.country.toUpperCase(), d.clicks)
    return m
  }, [data])
  const max = Math.max(...data.map((d) => d.clicks), 1)

  // The country with the most clicks — the globe starts pointed here.
  const topIso = useMemo(() => {
    let top: string | null = null
    let best = -1
    for (const d of data) if (d.clicks > best) { best = d.clicks; top = d.country.toUpperCase() }
    return top
  }, [data])

  // Resolve an ISO-2 to a lat/lng (centroid table first, then polygon bbox center).
  const centroidFor = (iso: string): { lat: number; lng: number } | null => {
    if (CENTROIDS[iso]) return CENTROIDS[iso]
    const feat = countries.find((f) => f.properties.ISO_A2 === iso)
    if (feat?.bbox) {
      const [minX, minY, maxX, maxY] = feat.bbox
      return { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 }
    }
    return null
  }

  const rotateTo = (iso: string | null, ms = 800) => {
    const g = globeEl.current
    if (!g || !iso) return
    const c = centroidFor(iso)
    if (c) g.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.8 }, ms)
  }

  // Load vendored country polygons once.
  useEffect(() => {
    let alive = true
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => { if (alive) setCountries(geo.features || []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Responsive sizing.
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width
      const h = Math.min(Math.max(w, 360), 520)
      setSize({ w, h })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Initial setup: auto-rotate, and point at the TOP country once polygons load.
  useEffect(() => {
    const g = globeEl.current
    if (!g || countries.length === 0) return
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.5
    g.controls().enableZoom = false
    if (!didInitView.current) {
      didInitView.current = true
      if (topIso && centroidFor(topIso)) rotateTo(topIso, 0)
      else g.pointOfView({ lat: 20, lng: 30, altitude: 2.1 }, 0)
    }
  }, [countries, topIso])

  // When a country is selected in the list, stop spinning and rotate to it.
  useEffect(() => {
    const g = globeEl.current
    if (!g) return
    if (focusIso) {
      g.controls().autoRotate = false
      rotateTo(focusIso, 900)
    } else {
      g.controls().autoRotate = true
    }
  }, [focusIso, countries])

  const colorFor = (feat: Feature) => {
    const iso = feat.properties.ISO_A2 as string
    const clicks = byIso.get(iso)
    if (!clicks) return 'rgba(255,255,255,0.08)'
    const t = clicks / max
    // Selected country gets a brighter highlight.
    if (focusIso && iso === focusIso) return 'rgba(255,150,40,0.98)'
    return `rgba(255,122,0,${0.25 + t * 0.7})`
  }

  return (
    <div ref={wrapRef} className="w-full flex items-center justify-center">
      <Globe
        ref={globeEl}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor="#ff7a00"
        atmosphereAltitude={0.12}
        showGlobe
        globeMaterial={globeMaterial}
        polygonsData={countries}
        polygonCapColor={colorFor as any}
        polygonSideColor={() => 'rgba(255,122,0,0.12)'}
        polygonStrokeColor={() => 'rgba(255,255,255,0.18)'}
        polygonAltitude={((feat: Feature) => {
          const iso = feat.properties.ISO_A2
          const clicks = byIso.get(iso)
          if (focusIso && iso === focusIso) return 0.18
          return clicks ? 0.02 + (clicks / max) * 0.12 : 0.006
        }) as any}
        onPolygonHover={((feat: Feature | null) => {
          if (!onHover) return
          if (!feat) { onHover(null); return }
          const iso = feat.properties.ISO_A2
          const clicks = byIso.get(iso)
          if (clicks) onHover({ name: feat.properties.NAME || feat.properties.ADMIN || iso, clicks })
          else onHover(null)
        }) as any}
        polygonsTransitionDuration={300}
      />
    </div>
  )
}
