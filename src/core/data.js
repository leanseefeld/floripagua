/** Binary data parsers/loaders (formats documented in public/data/*.json). Parsers work in Node too. */
export function parseRoads(buf) {
  const dv = new DataView(buf); let o = 0;
  const n = dv.getUint32(o, true); o += 4;
  const ways = [];
  for (let i = 0; i < n; i++) {
    const np = dv.getUint32(o, true); o += 4; const cls = dv.getUint8(o); o += 1;
    const pts = new Float32Array(np * 2);
    for (let k = 0; k < np; k++) { pts[2 * k] = dv.getFloat32(o, true); pts[2 * k + 1] = dv.getFloat32(o + 4, true); o += 8; }
    ways.push({ cls, pts });
  }
  return ways;
}
export function parseBuildings(buf) {
  const dv = new DataView(buf); let o = 0;
  const n = dv.getUint32(o, true); o += 4;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const nv = dv.getUint8(o); const kind = dv.getUint8(o + 1); const h = dv.getUint16(o + 2, true) / 10;
    const clon = dv.getFloat32(o + 4, true), clat = dv.getFloat32(o + 8, true); o += 12;
    const ring = new Float64Array(nv * 2);
    for (let k = 0; k < nv; k++) { ring[2 * k] = clon + dv.getInt16(o, true) / 1e6; ring[2 * k + 1] = clat + dv.getInt16(o + 2, true) / 1e6; o += 4; }
    out[i] = { lon: clon, lat: clat, h, kind, ring };
  }
  return out;
}
export async function loadRoads(base = './data/') { return parseRoads(await (await fetch(base + 'roads.bin')).arrayBuffer()); }
export async function loadBuildings(base = './data/') { return parseBuildings(await (await fetch(base + 'buildings.bin')).arrayBuffer()); }
export async function loadJSON(path) { const r = await fetch(path); if (!r.ok) throw new Error('fetch ' + path + ' ' + r.status); return r.json(); }
