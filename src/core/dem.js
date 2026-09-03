import { mercY } from './geo.js';
/** One elevation grid on a web-mercator tile grid (see scripts/build_dem*.py). */
export class Grid {
  constructor(meta, u16) {
    this.meta = meta; this.w = meta.width; this.h = meta.height; this.data = u16; this.b = meta.bounds;
    this.y0 = mercY(this.b.north); this.y1 = mercY(this.b.south);
  }
  contains(lon, lat) { return lon >= this.b.west && lon <= this.b.east && lat <= this.b.north && lat >= this.b.south; }
  gridOf(lon, lat) {
    return { gx: (lon - this.b.west) / (this.b.east - this.b.west) * this.w, gy: (mercY(lat) - this.y0) / (this.y1 - this.y0) * this.h };
  }
  lonLatOfGrid(gx, gy) {
    const lon = this.b.west + gx / this.w * (this.b.east - this.b.west);
    const y = this.y0 + gy / this.h * (this.y1 - this.y0);
    return { lon, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI };
  }
  at(ix, iy) { ix = Math.max(0, Math.min(this.w - 1, ix)); iy = Math.max(0, Math.min(this.h - 1, iy)); return this.data[iy * this.w + ix] / 4 - 100; }
  elevation(lon, lat) {
    const { gx, gy } = this.gridOf(lon, lat);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const a = this.at(x0, y0), b = this.at(x0 + 1, y0), c = this.at(x0, y0 + 1), d = this.at(x0 + 1, y0 + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
}
/** Multi-resolution DEM: a fine core grid (34 m) inside a coarse regional grid (70 m). Queries use the finest grid that contains the point. */
export class DEM {
  constructor(outer, core) { this.outer = outer; this.core = core; this.grids = core ? [core, outer] : [outer]; Object.assign(this, { w: outer.w, h: outer.h, b: outer.b, at: outer.at.bind(outer), lonLatOfGrid: outer.lonLatOfGrid.bind(outer), gridOf: outer.gridOf.bind(outer) }); }
  static async load(base = './data/') {
    const [meta, buf] = await Promise.all([(await fetch(base + 'dem.json')).json(), (await fetch(base + 'dem.bin')).arrayBuffer()]);
    let core = null;
    try { const [m2, b2] = await Promise.all([(await fetch(base + 'dem_core.json')).json(), (await fetch(base + 'dem_core.bin')).arrayBuffer()]); core = new Grid(m2, new Uint16Array(b2)); } catch (e) { /* optional */ }
    return new DEM(new Grid(meta, new Uint16Array(buf)), core);
  }
  elevation(lon, lat) { for (const g of this.grids) if (g.contains(lon, lat)) return g.elevation(lon, lat); return this.outer.elevation(lon, lat); }
}
