/**
 * Least-cost pipe route heuristic (works in Node and browser).
 * Grid A* over a coarse cost raster built from the DEM and the road network.
 * Heuristic (v1, deliberately simple):
 *   cost(step) = length * terrainFactor * slopeFactor * waterFactor
 *   - roadCell    : cells within ~1 cell of a mapped road cost 0.35x (utilities follow rights-of-way)
 *   - slope       : 1 + 6 * |dh/len|  (avoid steep hills; pipes can go up or down, but construction is costly)
 *   - water       : cells with elevation <= 0.5 m and not on a road (bridge) cost 12x (sea/lagoon crossing)
 *   - steep cliffs: |dh| > 60 m in one cell cost 20x
 *   - land cover : off-road cells weighted by ESA WorldCover class (water 12x, mangrove 5x, wetland 4x, forest 1.6x, built-up 0.9x)
 * Improvements (see docs/IMPROVEMENTS.md): learned cost surfaces, land-use, cadastral data, known easements.
 */
import { mercY } from './geo.js';

/** ESA WorldCover classes: 10 forest, 20 shrub, 30 grass, 40 crop, 50 built-up, 60 bare, 80 water, 90 wetland, 95 mangrove */
const LC_FACTOR = { 10: 1.6, 20: 1.2, 30: 1.0, 40: 1.05, 50: 0.9, 60: 1.0, 80: 12, 90: 4, 95: 5 };
export function buildCostGrid(dem, roads, factor = 2, landcover = null) {
  const w = Math.floor(dem.w / factor), h = Math.floor(dem.h / factor);
  const elev = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0; for (let j = 0; j < factor; j++) for (let i = 0; i < factor; i++) s += dem.at(x * factor + i, y * factor + j);
    elev[y * w + x] = s / (factor * factor);
  }
  const road = new Uint8Array(w * h);
  const lc = new Uint8Array(w * h);
  if (landcover && landcover.length === dem.w * dem.h) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) lc[y * w + x] = landcover[(y * factor) * dem.w + x * factor];
  const y0 = mercY(dem.b.north), y1 = mercY(dem.b.south);
  const gx = (lon) => (lon - dem.b.west) / (dem.b.east - dem.b.west) * w;
  const gy = (lat) => (mercY(lat) - y0) / (y1 - y0) * h;
  for (const way of roads) {
    const p = way.pts;
    for (let k = 0; k + 2 < p.length; k += 2) {
      const ax = gx(p[k]), ay = gy(p[k + 1]), bx = gx(p[k + 2]), by = gy(p[k + 3]);
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          road[yy * w + xx] = Math.max(road[yy * w + xx], (dx === 0 && dy === 0) ? 2 : 1);
        }
      }
    }
  }
  // metres per cell (approx, at centre latitude)
  const latC = (dem.b.north + dem.b.south) / 2;
  const cellM = (dem.b.east - dem.b.west) / w * 111320 * Math.cos(latC * Math.PI / 180);
  return { w, h, elev, road, lc, cellM, gx, gy, lonLatOfCell: (x, y) => dem.lonLatOfGrid((x + 0.5) * factor, (y + 0.5) * factor) };
}

export function stepCost(g, a, b, dist) {
  const ha = g.elev[a], hb = g.elev[b], dh = Math.abs(hb - ha);
  const len = dist * g.cellM;
  let f = 1 + 6 * (dh / len);
  if (dh > 60) f *= 20;
  const r = g.road[b];
  if (r === 2) f *= 0.35; else if (r === 1) f *= 0.6;
  if (hb <= 0.5 && r === 0) f *= 12;
  else if (r === 0) { const k = g.lc[b]; if (k) f *= (LC_FACTOR[k] || 1); }
  return len * f;
}

/** A* from lon/lat to lon/lat. Returns array of [lon,lat] or null. */
export function route(g, from, to, opts = {}) {
  const sx = Math.round(g.gx(from[0])), sy = Math.round(g.gy(from[1]));
  const tx = Math.round(g.gx(to[0])), ty = Math.round(g.gy(to[1]));
  const { w, h } = g; const N = w * h;
  const start = sy * w + sx, goal = ty * w + tx;
  if (start < 0 || goal < 0 || start >= N || goal >= N) return null;
  const gScore = new Float32Array(N).fill(Infinity); gScore[start] = 0;
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  // binary heap
  const heap = []; const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { let l = 2 * k + 1, r = l + 1, m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hfun = (i) => { const x = i % w, y = (i / w) | 0; return Math.hypot(x - tx, y - ty) * g.cellM * 0.3; };
  push(hfun(start), start);
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let iter = 0;
  while (heap.length) {
    const [, cur] = pop(); if (closed[cur]) continue; closed[cur] = 1;
    if (cur === goal) break;
    if (++iter > (opts.maxIter || 2e6)) return null;
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy, d] of nb) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx; if (closed[ni]) continue;
      const ng = gScore[cur] + stepCost(g, cur, ni, d);
      if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; push(ng + hfun(ni), ni); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const path = []; let c = goal; while (c >= 0) { path.push(c); if (c === start) break; c = came[c]; }
  path.reverse();
  // simplify: keep every cell but drop collinear runs
  const out = [];
  for (let i = 0; i < path.length; i++) {
    if (i > 0 && i < path.length - 1) {
      const a = path[i - 1], b = path[i], c2 = path[i + 1];
      const d1 = [b % w - a % w, ((b / w) | 0) - ((a / w) | 0)], d2 = [c2 % w - b % w, ((c2 / w) | 0) - ((b / w) | 0)];
      if (d1[0] === d2[0] && d1[1] === d2[1]) continue;
    }
    const ll = g.lonLatOfCell(path[i] % w, (path[i] / w) | 0);
    out.push([+ll.lon.toFixed(5), +ll.lat.toFixed(5)]);
  }
  out[0] = [from[0], from[1]]; out[out.length - 1] = [to[0], to[1]];
  return { path: out, cost: gScore[goal] };
}

/** Route through an ordered list of waypoints. */
export function routeVia(g, points, opts) {
  const all = []; let cost = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const r = route(g, points[i], points[i + 1], opts);
    if (!r) return null;
    cost += r.cost;
    for (let k = (i === 0 ? 0 : 1); k < r.path.length; k++) all.push(r.path[k]);
  }
  return { path: all, cost };
}
