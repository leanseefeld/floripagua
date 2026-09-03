// Precompute least-cost pipe routes for every edge of a layer network (Node ≥ 18).
// usage: node scripts/route_network.mjs src/layers/water/network.json public/data/water_routes.json
import fs from 'node:fs';
import { DEM, Grid } from '../src/core/dem.js';
import { parseRoads } from '../src/core/data.js';
import { buildCostGrid, routeVia } from '../src/core/routing.js';
import { distMeters } from '../src/core/geo.js';

const [,, netPath, outPath] = process.argv;
const net = JSON.parse(fs.readFileSync(netPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync('public/data/dem.json', 'utf8'));
const demBuf = fs.readFileSync('public/data/dem.bin');
const dem = new DEM(new Grid(meta, new Uint16Array(demBuf.buffer, demBuf.byteOffset, demBuf.byteLength / 2)), null);
const rb = fs.readFileSync('public/data/roads.bin');
const roads = parseRoads(rb.buffer.slice(rb.byteOffset, rb.byteOffset + rb.byteLength));
console.time('grid');
let lc = null; try { const b = fs.readFileSync('public/data/landcover.bin'); lc = new Uint8Array(b.buffer, b.byteOffset, b.byteLength); } catch (e) { console.warn('no landcover.bin'); }
const grid = buildCostGrid(dem, roads, 2, lc);
console.timeEnd('grid');
const byId = Object.fromEntries(net.nodes.map(n => [n.id, n]));
const out = {};
let ok = 0, fail = 0;
for (const e of net.edges) {
  const a = byId[e.from], b = byId[e.to];
  if (!a || !b) { console.warn('missing node for', e.id); continue; }
  const pts = [[a.lon, a.lat], ...(e.waypoints || []), [b.lon, b.lat]];
  const t0 = Date.now();
  const r = routeVia(grid, pts, { maxIter: 3e6 });
  if (!r) { fail++; out[e.id] = { path: pts, length_m: null, method: 'straight (routing failed)' }; console.warn('route failed', e.id); continue; }
  let len = 0; for (let i = 1; i < r.path.length; i++) len += distMeters({ lon: r.path[i - 1][0], lat: r.path[i - 1][1] }, { lon: r.path[i][0], lat: r.path[i][1] });
  out[e.id] = { path: r.path, length_m: Math.round(len), cost: Math.round(r.cost), method: 'least-cost A* (dem+roads)' };
  ok++;
  console.log(e.id.padEnd(28), String(r.path.length).padStart(4), 'pts', String(Math.round(len)).padStart(6), 'm', (Date.now() - t0) + 'ms');
}
fs.writeFileSync(outPath, JSON.stringify({ generated: new Date().toISOString(), heuristic: 'src/core/routing.js v2 (dem + roads + ESA WorldCover)', routes: out }));
console.log('routed', ok, 'failed', fail, '->', outPath);
