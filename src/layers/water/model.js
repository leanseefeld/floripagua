import { distMeters } from '../../core/geo.js';
/**
 * Graph-based supply model (not a hydraulic solver).
 * Each step: (1) effective capacity per edge, (2) multi-source shortest-path tree over usable edges,
 * (3) greedy allocation of source capacity to demand zones ordered by (path length + elevation penalty),
 * (4) reservoir buffers cover deficits / refill with leftover capacity, (5) pressure gating for high zones.
 * See docs/IMPROVEMENTS.md for the known limitations of this heuristic.
 */
export const LPS_PER_CAPITA = 0.0028; // ≈ 240 L/hab/dia incl. perdas (CASAN: demanda RM ≈ 2.800 L/s p/ ~1 M hab)
export const MUNI_POP = { 'Florianópolis': 537213, 'São José': 270299, 'Palhoça': 222598, 'Biguaçu': 75161, 'Santo Amaro da Imperatriz': 25012 }; // IBGE Censo 2022
/** population served per municipality/system: CASAN (SIA serves 46 % of Florianópolis ≈ 250 k; Costa Norte 80–130 k; Costa Sul/Leste 102–113 k) */
export const SERVED_POP = { 'Florianópolis|sia': 260000, 'Florianópolis|costa_norte': 100000, 'Florianópolis|costa_sul_leste': 105000, 'São José|*': 270299, 'Palhoça|*': 222598, 'Biguaçu|*': 75161, 'Santo Amaro da Imperatriz|*': 25012 };

export class WaterModel {
  constructor({ net, routes, places, buildings, app }) {
    this.net = net; this.app = app;
    this.nodes = new Map(net.nodes.map(n => [n.id, { ...n, elev: app.elev(n.lon, n.lat) }]));
    this.edges = net.edges.map(e => ({ ...e, len_m: routes.routes[e.id]?.length_m || distMeters(this.nodes.get(e.from), this.nodes.get(e.to)), path: routes.routes[e.id]?.path || [[this.nodes.get(e.from).lon, this.nodes.get(e.from).lat], [this.nodes.get(e.to).lon, this.nodes.get(e.to).lat]], open: 1, broken: false, ramp: null, flow: 0 }));
    this.adj = new Map(); for (const n of this.nodes.keys()) this.adj.set(n, []);
    for (const e of this.edges) { this.adj.get(e.from).push(e); this.adj.get(e.to).push(e); }
    this.params = { emergencyIntakes: false, interconnectOpen: false, productionFactor: 1.0, reservoirStart: 0.9 };
    this.sources = [...this.nodes.values()].filter(n => n.production_lps > 0);
    this.reservoirs = [...this.nodes.values()].filter(n => n.cap_m3 > 0);
    this._buildZones(places, buildings);
    this.reset();
  }
  _buildZones(places, buildings) {
    const feeders = [...this.nodes.values()].filter(n => ['reservoir', 'erat', 'booster', 'bulk_point', 'eta', 'junction'].includes(n.type) && !n.no_zone && n.id !== 'res_contato_mq');
    const cands = places.filter(p => ['suburb', 'neighbourhood', 'quarter', 'village', 'town'].includes(p.type));
    const zones = [];
    for (const p of cands) {
      let best = null, bd = 6000;
      for (const f of feeders) { const d = distMeters(p, f); if (d < bd) { bd = d; best = f; } }
      if (!best) continue;
      if (zones.some(z => z.name === p.name && distMeters(z, p) < 2500)) continue;
      zones.push({ id: 'z_' + zones.length, name: p.name, lon: p.lon, lat: p.lat, elev: this.app.elev(p.lon, p.lat), feeder: best.id, muni: best.muni, buildings: [], pop: 0, demand_lps: 0, supply: 1, served: 'full', bufferNode: null });
    }
    // assign buildings to nearest zone (≤ 2.5 km)
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i]; let best = null, bd = 2500;
      for (const z of zones) { const d = Math.abs(z.lat - b.lat) * 111320 + Math.abs(z.lon - b.lon) * 98600; if (d < bd) { bd = d; best = z; } }
      if (best) { best.buildings.push(i); b.zone = best; }
    }
    // population: served population per (municipality, system) apportioned by sqrt(building count) (OSM coverage is uneven), demand from per-capita
    const groupOf = z => { const sys = this.nodes.get(z.feeder).system; return z.muni === 'Florianópolis' ? 'Florianópolis|' + (sys === 'costa_norte' || sys === 'costa_sul_leste' ? sys : 'sia') : z.muni + '|*'; };
    const byGroup = {}; for (const z of zones) (byGroup[groupOf(z)] ||= []).push(z);
    const w = z => Math.sqrt(z.buildings.length + 10);
    for (const [g, zs] of Object.entries(byGroup)) {
      const tot = zs.reduce((s, z) => s + w(z), 0); const pop = SERVED_POP[g] || 20000;
      for (const z of zs) { z.pop = Math.round(pop * w(z) / tot); z.demand_lps = z.pop * LPS_PER_CAPITA; }
    }
    this.zones = zones.filter(z => z.pop > 0);
    this.totalPop = this.zones.reduce((s, z) => s + z.pop, 0);
  }
  reset() {
    for (const e of this.edges) { e.open = 1; e.broken = false; e.ramp = null; e.flow = 0; e.closedNow = !!e.closed && !this.params.interconnectOpen; }
    for (const r of this.reservoirs) { r.level = this.params.reservoirStart; }
    for (const z of this.zones) { z.supply = 1; z.served = 'full'; z.hoursOut = 0; }
    this.t = 0; this.stats = { popNone: 0, popLow: 0, popFull: this.totalPop, surge: 0 };
    this.surge = 0;
  }
  /** cheap state snapshot/restore for seek checkpoints */
  snapshot() {
    return { t: this.t, surge: this.surge, edges: this.edges.map(e => [e.open, e.broken, e.ramp ? { ...e.ramp } : null, e.closedNow, e.flow]), res: this.reservoirs.map(r => r.level), zones: this.zones.map(z => [z.supply, z.served, z.hoursOut, z.alloc]), stats: { ...this.stats } };
  }
  restore(s) {
    this.t = s.t; this.surge = s.surge;
    this.edges.forEach((e, i) => { const a = s.edges[i]; e.open = a[0]; e.broken = a[1]; e.ramp = a[2] ? { ...a[2] } : null; e.closedNow = a[3]; e.flow = a[4]; });
    this.reservoirs.forEach((r, i) => r.level = s.res[i]);
    this.zones.forEach((z, i) => { const a = s.zones[i]; z.supply = a[0]; z.served = a[1]; z.hoursOut = a[2]; z.alloc = a[3]; });
    this.stats = { ...s.stats };
  }
  edge(id) { return this.edges.find(e => e.id === id); }
  /** multi-source shortest-path distances over all non-planned edges (static topology, used for priority ordering) */
  _staticDist() {
    const dist = new Map(); const pq = [];
    for (const s of this.sources) { dist.set(s.id, 0); pq.push([0, s.id]); }
    const done = new Set();
    while (pq.length) {
      let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i; const [d, u] = pq[bi]; pq[bi] = pq[pq.length - 1]; pq.pop();
      if (done.has(u)) continue; done.add(u);
      for (const e of this.adj.get(u)) { if (e.planned || e.closed) continue; const v = e.from === u ? e.to : e.from; if (e.kind === 'raw' && v !== e.to) continue; const nd = d + e.len_m * (1200 / (e.diameter_mm || 300)); if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); pq.push([nd, v]); } }
    }
    return dist;
  }
  _nearestReservoirStatic(id) {
    // BFS over topology for the nearest reservoir node (buffer for zones whose feeder is currently cut off)
    const seen = new Set([id]); const q = [id];
    while (q.length) { const u = q.shift(); const n = this.nodes.get(u); if (n.cap_m3 && u !== id) return n; for (const e of this.adj.get(u)) { if (e.planned) continue; const v = e.from === u ? e.to : e.from; if (!seen.has(v)) { seen.add(v); q.push(v); } } }
    return null;
  }
  node(id) { return this.nodes.get(id); }
  effCap(e) { if (e.planned || e.closedNow || e.broken) return 0; return e.capacity_lps * e.open; }
  /** valve ramp: open goes from->to over [t0,t1] in `stages` steps */
  setRamp(e, t0, hours, from = 0, to = 1, stages = 4) { e.ramp = { t0, t1: t0 + hours, from, to, stages }; }
  _applyRamps(t) {
    let surge = 0;
    for (const e of this.edges) {
      if (!e.ramp) continue; const r = e.ramp; const prev = e.open;
      if (t >= r.t1) { e.open = r.to; e.ramp = null; }
      else if (t >= r.t0) { const f = (t - r.t0) / (r.t1 - r.t0); const s = Math.min(r.stages, Math.floor(f * r.stages) + 1) / r.stages; e.open = r.from + (r.to - r.from) * s; }
      if (e.open !== prev) surge = Math.max(surge, Math.abs(e.open - prev) * e.capacity_lps / 1000); // heuristic surge index
    }
    return surge;
  }
  step(dt, t) {
    this.t = t;
    const surgeNow = this._applyRamps(t);
    this.surge = Math.max(surgeNow, this.surge * Math.exp(-dt / 2)); // decays with 2 h time constant
    // (1) residuals
    const res = new Map(); for (const e of this.edges) { res.set(e, this.effCap(e)); e.flow = 0; }
    const srcRes = new Map();
    for (const s of this.sources) { let p = s.production_lps * this.params.productionFactor; if (s.type === 'intake' && !this.params.emergencyIntakes) p = 0; srcRes.set(s.id, p); }
    if (this.params.emergencyIntakes) for (const n of this.nodes.values()) if (n.type === 'intake' && n.capacity_lps && !srcRes.has(n.id) && n.system === 'sia' && n.id !== 'cap_piloes' && n.id !== 'cap_cubatao') srcRes.set(n.id, n.capacity_lps);
    // (2) static ordering: multi-source shortest path over the whole network (ignores residuals)
    if (!this._static) this._static = this._staticDist();
    const distS = this._static;
    // (3) per-zone augmenting path: cheapest path from the zone's feeder to any source with remaining capacity over edges with residual > 0
    const findPath = (startId) => {
      const dist = new Map([[startId, 0]]), parent = new Map(); const pq = [[0, startId]]; const done = new Set();
      while (pq.length) {
        let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i; const [d, u] = pq[bi]; pq[bi] = pq[pq.length - 1]; pq.pop();
        if (done.has(u)) continue; done.add(u);
        if ((srcRes.get(u) ?? 0) > 1e-6) { const edges = []; let cur = u; while (parent.has(cur)) { const e = parent.get(cur); edges.push(e); cur = e.from === cur ? e.to : e.from; } return { edges, src: u }; }
        for (const e of this.adj.get(u)) {
          if (res.get(e) <= 1e-6) continue;
          const v = e.from === u ? e.to : e.from;
          if (e.kind === 'raw' && !(u === e.to && v === e.from)) continue; // toward the intake only (emergency intakes)
          const nd = d + e.len_m * (1200 / (e.diameter_mm || 300));
          if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); parent.set(v, e); pq.push([nd, v]); }
        }
      }
      return null;
    };
    const pathOf = findPath;
    const order = this.zones.slice().sort((a, b) => ((distS.get(a.feeder) ?? 1e12) + a.elev * 40) - ((distS.get(b.feeder) ?? 1e12) + b.elev * 40));
    for (const z of order) {
      z.alloc = 0; z.buffer = null;
      const fn = this.nodes.get(z.feeder); if (fn.cap_m3) z.buffer = fn;
      const r = findPath(z.feeder);
      if (!r) { if (!z.buffer) { const rb = this._nearestReservoirStatic(z.feeder); z.buffer = rb; } continue; }
      const { edges, src } = r;
      let bn = srcRes.get(src) ?? 0; for (const e of edges) bn = Math.min(bn, res.get(e));
      const a = Math.min(z.demand_lps, Math.max(0, bn));
      if (a > 0) { srcRes.set(src, srcRes.get(src) - a); for (const e of edges) { res.set(e, res.get(e) - a); e.flow += a; } }
      z.alloc = a;
      if (!z.buffer) for (const e of edges) { const n1 = this.nodes.get(e.from), n2 = this.nodes.get(e.to); if (n1.cap_m3) { z.buffer = n1; break; } if (n2.cap_m3) { z.buffer = n2; break; } }
    }
    // (4) reservoir buffers: cover deficits, refill with leftover capacity
    const draw = new Map();
    for (const z of this.zones) {
      let s = z.demand_lps > 0 ? z.alloc / z.demand_lps : 1;
      if (s < 1 && z.buffer && z.buffer.level > 0 && dt > 0) {
        const deficit = z.demand_lps * (1 - s); const avail = z.buffer.level * z.buffer.cap_m3 / (dt * 3.6); // L/s available this step
        const cover = Math.min(deficit, avail); draw.set(z.buffer, (draw.get(z.buffer) || 0) + cover); s += cover / z.demand_lps;
      }
      // (5) pressure gating: high zones served last when the buffer reservoir is low
      if (z.buffer && z.elev > z.buffer.elev + 8) { const lvl = z.buffer.level; if (lvl < 0.35) s *= Math.max(0, lvl / 0.35); }
      if (!z.buffer && z.alloc <= 0) s = 0;
      z.supply = Math.max(0, Math.min(1, s));
      z.served = z.supply >= 0.9 ? 'full' : z.supply >= 0.4 ? 'low' : 'none';
      if (z.served === 'none') z.hoursOut += dt;
    }
    if (dt > 0) for (const r of this.reservoirs) {
      const d = draw.get(r) || 0;
      if (d > 0) r.level = Math.max(0, r.level - d * dt * 3.6 / r.cap_m3);
      else if (r.level < 1) {
        const pr = pathOf(r.id); if (!pr) continue; const { edges, src } = pr; let bn = srcRes.get(src) ?? 0; for (const e of edges) bn = Math.min(bn, res.get(e));
        const refill = Math.min(Math.max(0, bn), r.cap_m3 * 0.12 / 3.6); // ≤ 12 %/h refill rate (L/s)
        if (refill > 0) { srcRes.set(src, srcRes.get(src) - refill); for (const e of edges) { res.set(e, res.get(e) - refill); e.flow += refill; } r.level = Math.min(1, r.level + refill * dt * 3.6 / r.cap_m3); }
      }
    }
    // stats
    let none = 0, low = 0; for (const z of this.zones) { if (z.served === 'none') none += z.pop; else if (z.served === 'low') low += z.pop; }
    this.stats = { popNone: none, popLow: low, popFull: this.totalPop - none - low, surge: this.surge, production: [...srcRes.entries()].reduce((s, [id]) => s + (this.sources.find(x => x.id === id)?.production_lps || 0), 0) };
  }
}
