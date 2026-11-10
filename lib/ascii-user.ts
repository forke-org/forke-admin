type Hit = { z: number; n: number[]; p: number[] }

export function mountAsciiUser(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const FONT = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
  const RAMP = ' .,:;-=+*#%@';
  let W = 0, H = 0, S = 0, CX = 0, CY = 0, CW = 8, CH = 13;
  const HEAD = { y: 0.42, r: 0.31 };
  const BODY = { y: -0.46, rx: 0.64, ry: 0.56, rz: 0.42, floor: -0.86 };
  const LIGHT = (() => { const l = [0.5, 0.55, 0.68]; const n = Math.hypot(l[0], l[1], l[2]); return l.map((v) => v / n) })()
  const ORBIT_TILT = 0.38;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.min(W * 0.4, H * 0.34);
    CX = W / 2; CY = H * 0.5;
    CW = Math.max(6, Math.round(S / 32)); CH = Math.round(CW * 1.6);
  }

  function hit(x: number, y: number): Hit | null {
    let best: Hit | null = null
    const dy = y - HEAD.y, h2 = HEAD.r * HEAD.r - x * x - dy * dy;
    if (h2 > 0) {
      const z = Math.sqrt(h2);
      best = { z, n: [x / HEAD.r, dy / HEAD.r, z / HEAD.r], p: [x, y, z] };
    }
    if (y > BODY.floor) {
      const by = y - BODY.y;
      const k = 1 - (x / BODY.rx) ** 2 - (by / BODY.ry) ** 2;
      if (k > 0) {
        const z = BODY.rz * Math.sqrt(k);
        if (!best || z > best.z) {
          const n = [x / BODY.rx ** 2, by / BODY.ry ** 2, z / BODY.rz ** 2];
          const len = Math.hypot(n[0], n[1], n[2])
          best = { z, n: n.map((v) => v / len), p: [x, y, z] };
        }
      }
    }
    return best;
  }

  function drawFigure(spin: number) {
    ctx.font = `${Math.round(CH * 0.82)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const cols = Math.ceil((S * 1.4) / CW), rows = Math.ceil((S * 1.9) / CH);
    for (let j = -rows; j <= rows; j++) {
      const sy = CY + j * CH;
      const y = (CY - sy) / S;
      for (let i = -cols; i <= cols; i++) {
        const sx = CX + i * CW;
        const x = (sx - CX) / S;
        const h = hit(x, y);
        if (!h) continue;
        const [nx, ny, nz] = h.n;
        const light = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
        const rim = Math.pow(1 - Math.max(0, nz), 2.4);
        const px = h.p[0] * cs + h.p[2] * sn, pz = -h.p[0] * sn + h.p[2] * cs;
        const lon = (Math.atan2(px, pz) * 180) / Math.PI;
        const meridian = Math.abs(((lon % 24) + 24) % 24 - 12) > 10.6;
        if (meridian) {
          ctx.fillStyle = `rgba(255,140,40,${(0.25 + light * 0.55).toFixed(3)})`;
          ctx.fillText(light > 0.5 ? '|' : ':', sx, sy);
          continue;
        }
        const v = Math.min(1, 0.1 + light * 0.9);
        const ch = RAMP[Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 2)))];
        const a = 0.14 + v * 0.74;
        ctx.fillStyle = rim > 0.35 ? `rgba(255,140,40,${(0.2 + rim * 0.5).toFixed(3)})` : `rgba(240,227,222,${a.toFixed(3)})`;
        ctx.fillText(ch, sx, sy);
      }
    }
  }

  function orbitPoint(t: number, radius: number) {
    const x = Math.cos(t) * radius, z = Math.sin(t) * radius;
    const y = -0.02 + z * Math.sin(ORBIT_TILT) * 0.35;
    return { sx: CX + x * S, sy: CY - y * S + z * Math.sin(ORBIT_TILT) * S * 0.0, z, y, x };
  }

  function drawOrbit(now: number, front: boolean) {
    const R1 = 1.05;
    ctx.save();
    ctx.setLineDash([2, 6]);
    ctx.strokeStyle = 'rgba(240,227,222,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(CX, CY + 0.02 * S, R1 * S, R1 * S * Math.sin(ORBIT_TILT) * 0.35, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let k = 0; k < 3; k++) {
      const t = now * 0.00045 + (k * Math.PI * 2) / 3;
      const p = orbitPoint(t, R1);
      if ((p.z > 0) !== front) continue;
      const sy = CY + 0.02 * S + Math.sin(t) * R1 * S * Math.sin(ORBIT_TILT) * 0.35;
      const size = 2.2 + (p.z + R1) * 1.1;
      const glow = ctx.createRadialGradient(p.sx, sy, 0, p.sx, sy, size * 5);
      glow.addColorStop(0, 'rgba(255,122,0,0.35)'); glow.addColorStop(1, 'rgba(255,122,0,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.sx, sy, size * 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = front ? '#ffb25c' : 'rgba(255,163,71,0.45)';
      ctx.beginPath(); ctx.arc(p.sx, sy, size, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHalo() {
    const g = ctx.createRadialGradient(CX, CY - S * 0.1, S * 0.2, CX, CY - S * 0.1, S * 1.4);
    g.addColorStop(0, 'rgba(255,122,0,0.08)'); g.addColorStop(1, 'rgba(255,122,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(240,227,222,0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(CX - S * 1.1, CY - BODY.floor * S + CH * 0.6); ctx.lineTo(CX + S * 1.1, CY - BODY.floor * S + CH * 0.6); ctx.stroke();
    ctx.setLineDash([]);
  }

  resize();
  window.addEventListener('resize', resize);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  function frame(now: number) {
    const spin = reduce ? 0.6 : now * 0.0005;
    ctx.clearRect(0, 0, W, H);
    drawHalo();
    drawOrbit(reduce ? 0 : now, false);
    drawFigure(spin);
    drawOrbit(reduce ? 0 : now, true);
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}
