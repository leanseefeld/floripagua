import * as THREE from 'three';
import { toXZ } from './geo.js';

/** Road polylines draped on terrain + a spatial index of road points (for building service connections). */
export function buildRoads(app, ways) {
  const verts = []; const cols = []; const c = new THREE.Color();
  const clsColor = { 0: 0xffd28a, 1: 0xffc06a, 2: 0xe8e8e8, 3: 0xbfc7d2, 4: 0x8d97a6, 5: 0xd9c9a0 };
  const segMid = []; // [x,z] per segment (for tinting by zone)
  const points = []; // road points for nearest-road lookup
  for (const w of ways) {
    const p = w.pts; const color = c.setHex(clsColor[w.cls] ?? 0x8d97a6);
    let prev = null;
    for (let k = 0; k < p.length; k += 2) {
      const v = app.pos(p[k], p[k + 1], 3 + (w.cls <= 1 ? 4 : 0));
      points.push(v.x, v.z, v.y);
      if (prev) { verts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z); cols.push(color.r, color.g, color.b, color.r, color.g, color.b); segMid.push((prev.x + v.x) / 2, (prev.z + v.z) / 2); }
      prev = v;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const baseColors = new Float32Array(cols);
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false })); lines.renderOrder = 18;
  lines.name = 'roads'; app.scene.add(lines);
  // spatial hash for nearest road point
  const cell = 400; const hash = new Map();
  const key = (x, z) => ((Math.floor(x / cell) + 32768) << 16) | (Math.floor(z / cell) + 32768);
  for (let i = 0; i < points.length; i += 3) { const k = key(points[i], points[i + 1]); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(i); }
  function nearest(x, z, maxR = 800) {
    let best = null, bd = maxR * maxR; const r = Math.ceil(maxR / cell);
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const a = hash.get(((cx + i + 32768) << 16) | (cz + j + 32768)); if (!a) continue;
      for (const idx of a) { const dx = points[idx] - x, dz = points[idx + 1] - z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = idx; } }
    }
    return best == null ? null : { x: points[best], z: points[best + 1], y: points[best + 2], d: Math.sqrt(bd) };
  }
  return { lines, nearest, segMid, baseColors, tint(fn) {
    // fn(segIndex) -> [r,g,b] | null ; recolour road segments
    const arr = g.attributes.color.array; const n = segMid.length / 2;
    for (let s = 0; s < n; s++) { const t = fn(s); const o = s * 6; if (t) { for (let k = 0; k < 2; k++) { arr[o + k * 3] = t[0]; arr[o + k * 3 + 1] = t[1]; arr[o + k * 3 + 2] = t[2]; } } else { for (let k = 0; k < 6; k++) arr[o + k] = baseColors[o + k]; } }
    g.attributes.color.needsUpdate = true;
  } };
}
