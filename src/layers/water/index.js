import * as THREE from 'three';
import { loadJSON } from '../../core/data.js';
import { toXZ, fromXZ } from '../../core/geo.js';
import { WaterModel } from './model.js';
import { buildScenarios } from './scenarios.js';
import netData from './network.json';

const KIND_COLOR = { raw: 0x9b6b3c, treated: null, distribution: null, planned: 0x8899aa, interconnect: 0xaaaaaa };
const STATE_RGB = { full: [0.22, 0.77, 0.42], low: [1.0, 0.69, 0.13], none: [1.0, 0.3, 0.31] };
const STATE_HEX = { full: 0x2ee36f, low: 0xffb020, none: 0xff3b3b };

export const waterLayer = {
  id: 'water', name: 'Água (abastecimento)', color: '#2f7bff', defaultVisible: true,
  description: 'Captações, ETAs, adutoras, reservatórios, elevatórias/boosters e zonas de atendimento (CASAN + Águas de Palhoça).',
  opts: { connections: false, mains: true, estimated: true, planned: true, zones: true, labels: true },
  async init(ctx) {
    this.ctx = ctx; const { app } = ctx;
    const routes = await loadJSON('./data/water_routes.json');
    this.net = netData; this.routes = routes;
    this.model = new WaterModel({ net: netData, routes, places: ctx.places, buildings: ctx.buildings, app });
    this.scenarios = buildScenarios(this.model);
    this.group = new THREE.Group(); this.group.name = 'water'; app.scene.add(this.group);
    this._buildPipes(); this._buildNodes(); await this._buildZones(); this._buildConnections(); this._segZones();
    this.applyState();
  },
  setVisible(v) { this.group.visible = v; for (const L of this.nodeLabels) L.visible = v && this.opts.labels; if (!v) this.ctx.roads.tint(() => null); else this.applyState(); },
  sysColor(sys) { return new THREE.Color(this.net.systems[sys]?.color || '#2f7bff'); },
  _curve(e) {
    const app = this.ctx.app; const lift = 6 + (e.diameter_mm || 200) / 60;
    const pts = e.path.map(([lon, lat]) => app.pos(lon, lat, lift));
    // drop consecutive duplicates
    const out = [pts[0]]; for (let i = 1; i < pts.length; i++) if (pts[i].distanceToSquared(out[out.length - 1]) > 1) out.push(pts[i]);
    if (out.length < 2) out.push(out[0].clone().add(new THREE.Vector3(5, 0, 5)));
    return new THREE.CatmullRomCurve3(out, false, 'centripetal', 0.3);
  },
  _buildPipes() {
    this.pipeMeshes = new Map();
    for (const e of this.model.edges) {
      const curve = this._curve(e); const r = Math.max(6, Math.min(40, 4 + (e.diameter_mm || 200) / 40));
      const segs = Math.max(8, Math.min(400, Math.round(curve.getLength() / 60)));
      let obj;
      const color = KIND_COLOR[e.kind] ?? this.sysColor(this.model.node(e.to).system).getHex();
      if (e.planned) {
        const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(segs));
        obj = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 300, gapSize: 200, linewidth: 1, depthTest: false })); obj.computeLineDistances();
      } else {
        const g = new THREE.TubeGeometry(curve, segs, r, this.ctx.app.mobile ? 5 : 7, false);
        const m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: e.route === 'estimated' ? 0.62 : 0.95, emissive: 0x000000, depthTest: false, depthWrite: false });
        obj = new THREE.Mesh(g, m);
      }
      obj.userData = { type: 'edge', id: e.id, baseColor: color }; obj.name = 'pipe:' + e.id; obj.renderOrder = 20;
      this.group.add(obj); this.ctx.app.pickables.push(obj); this.pipeMeshes.set(e.id, obj);
    }
  },
  _buildNodes() {
    const app = this.ctx.app; this.nodeMeshes = new Map(); this.nodeLabels = [];
    const geo = {
      reservoir: (n) => new THREE.CylinderGeometry(1, 1, 1, 18), eta: () => new THREE.BoxGeometry(1, 1, 1), intake: () => new THREE.SphereGeometry(1, 14, 10),
      erat: () => new THREE.ConeGeometry(1, 1, 10), booster: () => new THREE.ConeGeometry(1, 1, 8), junction: () => new THREE.SphereGeometry(1, 10, 8), bulk_point: () => new THREE.OctahedronGeometry(1, 0)
    };
    const prio = { eta: 5, intake: 4, reservoir: 3, erat: 2, bulk_point: 2, booster: 1, junction: 1 };
    for (const n of this.model.nodes.values()) {
      const col = this.sysColor(n.system); const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col.clone().multiplyScalar(0.15), depthTest: false, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh((geo[n.type] || geo.junction)(n), mat);
      let s = 30, h = 40;
      if (n.type === 'reservoir') { s = Math.max(28, Math.min(95, 18 + Math.cbrt(n.cap_m3) * 4)); h = 45; }
      if (n.type === 'eta') { s = 110; h = 50; } if (n.type === 'intake') { s = 40; h = 40; } if (n.type === 'erat' || n.type === 'booster') { s = 26; h = 70; } if (n.type === 'junction') { s = n.confidence === 'estimated' ? 18 : 22; h = 18; } if (n.type === 'bulk_point') { s = 34; h = 34; }
      mesh.scale.set(s, h, s); const p = app.pos(n.lon, n.lat, h / 2 + 2); mesh.position.copy(p);
      mesh.userData = { type: 'node', id: n.id }; mesh.name = 'node:' + n.id; mesh.renderOrder = 21; this.group.add(mesh); app.pickables.push(mesh); this.nodeMeshes.set(n.id, mesh);
      if (n.type === 'reservoir') { // level indicator ring
        const lvl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x39c46b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false }));
        lvl.position.copy(p); lvl.scale.set(s, h, s); lvl.userData.levelOf = n.id; lvl.renderOrder = 22; this.group.add(lvl); mesh.userData.levelMesh = lvl;
      }
      const label = app.addLabel(n.name.replace(/\s*\(.*$/, ''), { pos: p.clone().add(new THREE.Vector3(0, h / 2 + 10, 0)), maxDist: n.type === 'eta' || n.type === 'intake' ? 90000 : n.type === 'reservoir' ? 26000 : 12000, priority: prio[n.type] || 1, data: n });
      this.nodeLabels.push(label);
    }
  },
  /**
   * Zone footprints (heuristic v1): a 60 m raster over the urban area; a cell is "occupied" when ESA WorldCover says built-up
   * or an OSM building falls within one cell of it. Each occupied cell goes to the nearest zone centre (≤ 2.5 km), so zones
   * partition the occupied land without overlaps. Each zone is drawn as the union of its cells plus an outline along the
   * partition boundary. (Improvement ideas: census tracts, pressure-zone maps, smoothing of the raster boundary.)
   */
  async _buildZones() {
    const { app, dem, buildings } = this.ctx; const zones = this.model.zones;
    let lc = null; try { lc = new Uint8Array(await (await fetch('./data/landcover.bin')).arrayBuffer()); } catch (e) { /* optional */ }
    const CELL = 60, west = -48.90, east = -48.36, north = -27.35, south = -27.85;
    const p0 = toXZ(west, north), p1 = toXZ(east, south); const nx = Math.ceil((p1.x - p0.x) / CELL), nz = Math.ceil((p1.z - p0.z) / CELL);
    const occ = new Uint8Array(nx * nz);
    const cellOf = (x, z) => [Math.floor((x - p0.x) / CELL), Math.floor((z - p0.z) / CELL)];
    if (lc && dem.outer) { for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const ll = fromXZ(p0.x + (i + 0.5) * CELL, p0.z + (j + 0.5) * CELL); const g = dem.outer.gridOf(ll.lon, ll.lat); const gi = Math.floor(g.gx), gj = Math.floor(g.gy); if (gi < 0 || gj < 0 || gi >= dem.outer.w || gj >= dem.outer.h) continue; if (lc[gj * dem.outer.w + gi] === 50) occ[j * nx + i] = 1; } }
    for (const bld of buildings) { const [i, j] = cellOf(bld.cx, bld.cz); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) occ[jj * nx + ii] = 1; } }
    // nearest zone per occupied cell (bucketed)
    const zp = zones.map(z => { const p = toXZ(z.lon, z.lat); return [p.x, p.z]; });
    const B = 2500, bx = new Map(); const bk = (x, z) => (Math.floor(x / B) + 4096) * 8192 + Math.floor(z / B) + 4096;
    zp.forEach((p, k) => { const key = bk(p[0], p[1]); (bx.get(key) || bx.set(key, []).get(key)).push(k); });
    const owner = new Int16Array(nx * nz).fill(-1); const count = new Int32Array(zones.length);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!occ[j * nx + i]) continue; const x = p0.x + (i + 0.5) * CELL, z = p0.z + (j + 0.5) * CELL; let best = -1, bd = 2500 * 2500;
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const arr = bx.get(bk(x + a * B, z + c * B)); if (!arr) continue; for (const k of arr) { const d = (zp[k][0] - x) ** 2 + (zp[k][1] - z) ** 2; if (d < bd) { bd = d; best = k; } } }
      owner[j * nx + i] = best; if (best >= 0) count[best]++;
    }
    // geometry: one fill mesh per zone (pickable) + one merged outline
    this.zoneMeshes = []; const linePos = [], lineCol = []; this.zoneLineRanges = new Array(zones.length);
    const hAt = (x, z) => { const ll = fromXZ(x, z); return app.elev(ll.lon, ll.lat) * app.exag + 3; };
    const cellsOf = new Array(zones.length).fill(null).map(() => []);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const o = owner[j * nx + i]; if (o >= 0) cellsOf[o].push(i, j); }
    for (let k = 0; k < zones.length; k++) {
      const z = zones[k]; const cells = cellsOf[k]; z.cells = cells.length / 2; z.radius = Math.max(150, Math.sqrt(z.cells) * CELL * 0.6);
      if (!cells.length) { z.mesh = null; this.zoneLineRanges[k] = [0, 0]; continue; }
      const pos = new Float32Array(cells.length / 2 * 4 * 3), idx = []; let v = 0;
      for (let c = 0; c < cells.length; c += 2) {
        const i = cells[c], j = cells[c + 1]; const x0 = p0.x + i * CELL, z0 = p0.z + j * CELL;
        const corners = [[x0, z0], [x0 + CELL, z0], [x0 + CELL, z0 + CELL], [x0, z0 + CELL]];
        for (const [x, zz] of corners) { pos[v * 3] = x; pos[v * 3 + 1] = hAt(x, zz); pos[v * 3 + 2] = zz; v++; }
        const b0 = v - 4; idx.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
        // outline edges where the neighbour belongs to someone else
        const nb = [[i, j - 1, 0, 1], [i + 1, j, 1, 2], [i, j + 1, 2, 3], [i - 1, j, 3, 0]];
        for (const [ni, nj, a, b2] of nb) { const oo = (ni < 0 || nj < 0 || ni >= nx || nj >= nz) ? -1 : owner[nj * nx + ni]; if (oo !== k) { linePos.push(corners[a][0], hAt(corners[a][0], corners[a][1]) + 1, corners[a][1], corners[b2][0], hAt(corners[b2][0], corners[b2][1]) + 1, corners[b2][1]); lineCol.push(0, 1, 0, 0, 1, 0); } }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: STATE_HEX.full, transparent: true, opacity: 0.24, depthWrite: false, depthTest: false }));
      m.userData = { type: 'zone', id: z.id }; m.renderOrder = 15; this.group.add(m); app.pickables.push(m); this.zoneMeshes.push(m); z.mesh = m;
      this.zoneLineRanges[k] = [this.zoneLineRanges[k - 1]?.[1] ?? 0, linePos.length / 3];
    }
    // fix ranges for zones without cells (carry previous end)
    let last = 0; for (let k = 0; k < zones.length; k++) { if (!zones[k].mesh) this.zoneLineRanges[k] = [last, last]; else { this.zoneLineRanges[k][0] = last; last = this.zoneLineRanges[k][1]; } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
    this.zoneLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthTest: false })); this.zoneLines.renderOrder = 16; this.group.add(this.zoneLines);
  },
  _buildConnections() {
    // "Cities Skylines" style: imaginary service line from each building to the nearest street
    const { app, roads, buildings } = this.ctx; const verts = []; const cols = []; this.connIndex = [];
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i]; if (!b.zone) continue; const n = roads.nearest(b.cx, b.cz, 500); if (!n) continue;
      verts.push(b.cx, b.top, b.cz, n.x, n.y - 1, n.z); cols.push(0.3, 0.6, 1, 0.3, 0.6, 1); this.connIndex.push(i);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.conn = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, depthTest: false })); this.conn.renderOrder = 19; this.conn.visible = this.opts.connections; this.group.add(this.conn);
  },
  _segZones() {
    const { roads } = this.ctx; const mids = roads.segMid; const n = mids.length / 2; this.segZone = new Int32Array(n).fill(-1);
    const zs = this.model.zones.map(z => { const p = this.ctx.app.pos(z.lon, z.lat); return [p.x, p.z, z.radius * 1.6, z]; });
    for (let s = 0; s < n; s++) { const x = mids[2 * s], z = mids[2 * s + 1]; let best = -1, bd = Infinity; for (let k = 0; k < zs.length; k++) { const d = (zs[k][0] - x) ** 2 + (zs[k][1] - z) ** 2; if (d < zs[k][2] ** 2 && d < bd) { bd = d; best = k; } } this.segZone[s] = best; }
  },
  /** push model state to meshes/colours */
  applyState() {
    const m = this.model; const { buildings: B, roads } = this.ctx;
    for (const e of m.edges) {
      const obj = this.pipeMeshes.get(e.id); if (!obj) continue;
      obj.visible = (e.route !== 'estimated' || this.opts.estimated) && (!e.planned || this.opts.planned);
      if (obj.material.emissive) { if (e.broken) { obj.material.color.setHex(0xff2d2d); obj.material.emissive.setHex(0x550000); } else if (e.open < 1 && !e.planned) { obj.material.color.setHex(obj.userData.baseColor).lerp(new THREE.Color(0x556677), 1 - e.open); obj.material.emissive.setHex(0x000000); } else { obj.material.color.setHex(obj.userData.baseColor); obj.material.emissive.setHex(0x000000); } }
    }
    for (const r of m.reservoirs) { const mesh = this.nodeMeshes.get(r.id); const lm = mesh?.userData.levelMesh; if (lm) { const s = mesh.scale; lm.scale.set(s.x * 1.02, Math.max(1, s.y * r.level), s.z * 1.02); lm.position.y = mesh.position.y - s.y / 2 + Math.max(1, s.y * r.level) / 2; lm.material.color.setHex(r.level > 0.35 ? 0x39c46b : r.level > 0.1 ? 0xffb020 : 0xff4d4f); } }
    const lc = this.zoneLines.geometry.attributes.color.array; const tmp = new THREE.Color();
    m.zones.forEach((z, k) => { if (z.mesh) { z.mesh.material.color.setHex(STATE_HEX[z.served]); z.mesh.material.opacity = z.served === 'full' ? 0.2 : 0.42; z.mesh.visible = this.opts.zones; } const [s0, s1] = this.zoneLineRanges[k]; tmp.setHex(STATE_HEX[z.served]); const a = z.served === 'full' ? 0.75 : 1; for (let v = s0; v < s1; v++) { lc[v * 3] = tmp.r * a; lc[v * 3 + 1] = tmp.g * a; lc[v * 3 + 2] = tmp.b * a; } const rgb = z.served === 'full' ? null : STATE_RGB[z.served]; for (const bi of z.buildings) B.setState(bi, rgb, 0.8); });
    this.zoneLines.geometry.attributes.color.needsUpdate = true; this.zoneLines.visible = this.opts.zones;
    B.commit();
    if (this.conn) { const arr = this.conn.geometry.attributes.color.array; for (let k = 0; k < this.connIndex.length; k++) { const z = this.ctx.buildings[this.connIndex[k]].zone; const c = z ? STATE_RGB[z.served] : [0.3, 0.6, 1]; const cc = z && z.served === 'full' ? [0.3, 0.6, 1] : c; for (let j = 0; j < 2; j++) { arr[k * 6 + j * 3] = cc[0]; arr[k * 6 + j * 3 + 1] = cc[1]; arr[k * 6 + j * 3 + 2] = cc[2]; } } this.conn.geometry.attributes.color.needsUpdate = true; this.conn.visible = this.opts.connections; }
    if (this.opts.mains) roads.tint(s => { const zi = this.segZone[s]; if (zi < 0) return null; const z = m.zones[zi]; return z.served === 'full' ? [0.25, 0.55, 1] : STATE_RGB[z.served]; }); else roads.tint(() => null);
  },
  onFrame(dt) {
    this._ph = (this._ph || 0) + dt * 4; const k = 0.5 + 0.5 * Math.sin(this._ph);
    for (const e of this.model.edges) if (e.broken) { const o = this.pipeMeshes.get(e.id); if (o?.material.emissive) o.material.emissive.setRGB(0.5 * k, 0.05, 0.05); }
  },
  pick(hit) {
    const u = hit.object.userData; if (!u.type) return null;
    if (u.type === 'edge') { const e = this.model.edge(u.id); return { kind: 'edge', obj: e, html: this.edgeHtml(e), pos: hit.point }; }
    if (u.type === 'node') { const n = this.model.node(u.id); return { kind: 'node', obj: n, html: this.nodeHtml(n), pos: hit.point }; }
    if (u.type === 'zone') { const z = this.model.zones.find(z => z.id === u.id); return { kind: 'zone', obj: z, html: this.zoneHtml(z), pos: hit.point }; }
    return null;
  },
  tag(conf) { return conf === 'documented' ? '<span class="tag doc">documentado</span>' : '<span class="tag est">estimado</span>'; },
  edgeHtml(e) {
    const st = e.broken ? '<b style="color:#ff4d4f">ROMPIDA</b>' : e.closedNow ? 'fechada (manobra)' : e.planned ? 'projeto' : e.open < 1 ? `em carga (${Math.round(e.open * 100)} %)` : 'operando';
    return `<h3>${e.name}</h3>${this.tag(e.confidence)} <span class="tag">traçado ${e.route === 'documented' ? 'descrito' : 'estimado (A*)'}</span><div>${e.diameter_mm ? e.diameter_mm + ' mm · ' : ''}${e.capacity_lps ? 'cap. ~' + e.capacity_lps + ' L/s · ' : ''}${(e.len_m / 1000).toFixed(1)} km</div><div>Estado: ${st} · vazão simulada ${Math.round(e.flow)} L/s</div>${e.notes ? `<div class="note">${e.notes}</div>` : ''}<div class="note">Fonte: ${e.src || '—'}</div>`;
  },
  nodeHtml(n) {
    const extra = [n.cap_m3 ? `reservação ${n.cap_m3.toLocaleString('pt-BR')} m³ · nível ${Math.round((n.level ?? 1) * 100)} %` : '', n.capacity_lps ? `capacidade ${n.capacity_lps} L/s` : '', n.production_lps ? `produção simulada ${n.production_lps} L/s` : '', `cota ≈ ${Math.round(n.elev)} m`].filter(Boolean).join(' · ');
    return `<h3>${n.name}</h3>${this.tag(n.confidence)} <span class="tag">${n.type}</span> <span class="tag">${n.muni || ''}</span><div>${extra}</div>${n.notes ? `<div class="note">${n.notes}</div>` : ''}<div class="note">Fonte: ${n.src || '—'}</div>`;
  },
  zoneHtml(z) {
    const f = this.model.node(z.feeder);
    return `<h3>Zona: ${z.name}</h3><span class="tag est">zona heurística</span><div>Atendida por: ${f.name}</div><div>Pop. estimada ${z.pop.toLocaleString('pt-BR')} · demanda ≈ ${Math.round(z.demand_lps)} L/s · ${z.buildings.length} edificações OSM · cota ≈ ${Math.round(z.elev)} m</div><div>Atendimento: <b style="color:${['#39c46b', '#ffb020', '#ff4d4f'][['full', 'low', 'none'].indexOf(z.served)]}">${Math.round(z.supply * 100)} %</b>${z.hoursOut > 0 ? ` · ${z.hoursOut.toFixed(1)} h sem água` : ''}</div><div class="note">Zona = bairro OSM ligado ao ponto de distribuição mais próximo; área = células de 60 m ocupadas (WorldCover urbano + edificações OSM) mais próximas deste bairro (${z.cells || 0} células ≈ ${((z.cells || 0) * 0.36).toFixed(1)} km²); população municipal (IBGE 2022) rateada por nº de edificações.</div>`;
  },
  renderPanel(el) {
    const o = this.opts; const mk = (key, label, hint) => { const id = 'w_' + key; return `<div class="row"><label><input type="checkbox" id="${id}" ${o[key] ? 'checked' : ''}> ${label}</label>${hint ? `<span class="note">${hint}</span>` : ''}</div>`; };
    el.innerHTML = mk('zones', 'Zonas de atendimento') + mk('mains', 'Redes de rua (ruas coloridas por estado)') + mk('connections', 'Ligações prediais imaginárias (edifício → rua)') + mk('estimated', 'Trechos com traçado estimado') + mk('planned', 'Adutoras em projeto') + mk('labels', 'Rótulos das unidades')
      + `<div class="row"><label><input type="checkbox" id="w_emerg" ${this.model.params.emergencyIntakes ? 'checked' : ''}> Ativar captações emergenciais da Ilha</label></div>`
      + `<div class="row"><label><input type="checkbox" id="w_inter" ${this.model.params.interconnectOpen ? 'checked' : ''}> Abrir interligação Costeira ↔ Rio Tavares (manobra hipotética)</label></div>`
      + `<div class="row"><label style="flex:1">Produção (fator)<input type="range" id="w_prod" min="0.3" max="1.3" step="0.05" value="${this.model.params.productionFactor}"></label><b id="w_prodv">${this.model.params.productionFactor.toFixed(2)}</b></div>`;
    for (const key of ['zones', 'mains', 'connections', 'estimated', 'planned', 'labels']) el.querySelector('#w_' + key).onchange = (ev) => { o[key] = ev.target.checked; if (key === 'labels') for (const L of this.nodeLabels) L.visible = o.labels && this.group.visible; this.applyState(); };
    el.querySelector('#w_emerg').onchange = ev => { this.model.params.emergencyIntakes = ev.target.checked; this.ctx.sim.invalidate(); this.ctx.sim.seek(this.ctx.sim.t); this.applyState(); };
    el.querySelector('#w_inter').onchange = ev => { this.model.params.interconnectOpen = ev.target.checked; for (const e of this.model.edges) if (e.closed) e.closedNow = !ev.target.checked; this.ctx.sim.invalidate(); this.ctx.sim.seek(this.ctx.sim.t); this.applyState(); };
    el.querySelector('#w_prod').oninput = ev => { this.model.params.productionFactor = +ev.target.value; el.querySelector('#w_prodv').textContent = (+ev.target.value).toFixed(2); this.ctx.sim.invalidate(); this.ctx.sim.seek(this.ctx.sim.t); this.applyState(); };
  },
  legendHtml() {
    const sys = Object.entries(this.net.systems).map(([k, s]) => `<span class="ln" style="background:${s.color}"></span><span>${s.name}</span>`).join('');
    return `<div class="legend">${sys}<span class="ln" style="background:#9b6b3c"></span><span>Água bruta (captação → ETA)</span><span class="ln" style="background:#2f7bff;opacity:.5"></span><span>Traçado estimado (mais transparente)</span><span class="ln dashed" style="color:#8899aa"></span><span>Em projeto</span><span class="ln" style="background:#ff2d2d"></span><span>Trecho rompido</span><span class="sw" style="background:#39c46b"></span><span>Zona/edifícios abastecidos</span><span class="sw" style="background:#ffb020"></span><span>Baixa pressão / parcial</span><span class="sw" style="background:#ff4d4f"></span><span>Sem água</span></div><div class="note" style="margin-top:6px">Formas: caixa = ETA · cilindro = reservatório (anel = nível) · cone = elevatória/booster · esfera = captação/junção · losango = ponto de entrega (Palhoça). Tamanhos são esquemáticos.</div>`;
  }
};
