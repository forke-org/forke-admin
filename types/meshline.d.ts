/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

// Custom three.js elements registered via `extend()` for the lanyard band.
// Loosely typed so they're usable as JSX intrinsics under @react-three/fiber v9.
import '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: any
    meshLineMaterial: any
  }
}

declare module 'meshline' {
  export const MeshLineGeometry: any
  export const MeshLineMaterial: any
}
