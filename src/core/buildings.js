import * as THREE from 'three';
import { toXZ } from './geo.js';

const KIND_COLORS = [0xd8d3c8, 0xb9c6d9, 0xc9b8a8, 0xd9c9b0];
/** Extruded OSM footprints merged into one mesh; per-building colour ranges for state tinting. */
export function buildBuildings(app, buildings) {
  const pos = [], col = [], idx = []; const ranges = new Array(buildings.length); const c = new THREE.Color();
  let vbase = 0;
  const v2 = [];
  for (let b = 0; b < buildings.length; b++) {
    const B = buildings[b]; const n = B.ring.length / 2;
    const base = app.elev(B.lon, B.lat) * app.exag - 1; const top = base + Math.max(3, B.h) * app.exag;
    const xz = new Array(n); v2.length = 0;
    for (let k = 0; k < n; k++) { const p = toXZ(B.ring[2 * k], B.ring[2 * k + 1]); xz[k] = p; v2.push(new THREE.Vector2(p.x, p.z)); }
    // ensure CCW for triangulation
    const tris = THREE.ShapeUtils.triangulateShape(v2, []);
    c.setHex(KIND_COLORS[B.kind] || KIND_COLORS[0]);
    const start = vbase;
    // walls: 2 verts per ring vertex (bottom, top)
    for (let k = 0; k < n; k++) { pos.push(xz[k].x, base, xz[k].z, xz[k].x, top, xz[k].z); col.push(c.r * 0.8, c.g * 0.8, c.b * 0.8, c.r * 0.92, c.g * 0.92, c.b * 0.92); }
    for (let k = 0; k < n; k++) { const a = vbase + 2 * k, b2 = vbase + 2 * ((k + 1) % n); idx.push(a, b2, a + 1, b2, b2 + 1, a + 1, a, a + 1, b2, b2, a + 1, b2 + 1); }
    vbase += 2 * n;
    // roof
    const roofBase = vbase;
    for (let k = 0; k < n; k++) { pos.push(xz[k].x, top + 0.2, xz[k].z); col.push(c.r, c.g, c.b); }
    for (const t of tris) idx.push(roofBase + t[0], roofBase + t[1], roofBase + t[2], roofBase + t[2], roofBase + t[1], roofBase + t[0]);
    vbase += n;
    ranges[b] = [start, vbase];
    B.top = top; B.base = base; B.x = xz[0].x; B.z = xz[0].z; B.cx = 0; B.cz = 0;
    let sx = 0, sz = 0; for (const p of xz) { sx += p.x; sz += p.z; } B.cx = sx / n; B.cz = sz / n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const baseColors = new Float32Array(col);
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'buildings'; app.scene.add(mesh);
  const colors = g.attributes.color.array;
  return {
    mesh, ranges, count: buildings.length,
    /** tint building i with [r,g,b] (mix), or null to restore */
    setState(i, rgb, mix = 0.75) {
      const [s, e] = ranges[i];
      for (let v = s; v < e; v++) { const o = v * 3; if (rgb) { colors[o] = baseColors[o] * (1 - mix) + rgb[0] * mix; colors[o + 1] = baseColors[o + 1] * (1 - mix) + rgb[1] * mix; colors[o + 2] = baseColors[o + 2] * (1 - mix) + rgb[2] * mix; } else { colors[o] = baseColors[o]; colors[o + 1] = baseColors[o + 1]; colors[o + 2] = baseColors[o + 2]; } }
    },
    commit() { g.attributes.color.needsUpdate = true; }
  };
}
