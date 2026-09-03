import * as THREE from 'three';
import { loadJSON } from '../../core/data.js';
/** Sewage layer (secondary scope): ETEs + lift stations from CASAN PEC (SES Continental) and OSM. No simulation model yet. */
export const sewageLayer = {
  id: 'sewage', name: 'Esgoto (ETEs e elevatórias)', color: '#b07cff', defaultVisible: false,
  description: 'Estações de tratamento de esgoto (OSM/CASAN) e elevatórias do SES Continental (PEC CASAN). Sem simulação (camada de exemplo da arquitetura modular).',
  async init(ctx) {
    this.ctx = ctx; const { app } = ctx; this.group = new THREE.Group(); this.group.name = 'sewage'; app.scene.add(this.group); this.labels = [];
    const pec = await loadJSON('./data/sewage_pec.json');
    const etes = [
      { name: 'ETE Insular (612 L/s, terciário)', lon: -48.55622, lat: -27.60009 }, { name: 'ETE Potecas (São José) – nova ETE em obras', lon: -48.65429, lat: -27.56801 },
      { name: 'ETE Canasvieiras', lon: -48.43425, lat: -27.43189 }, { name: 'ETE Ingleses', lon: -48.41472, lat: -27.44112 }, { name: 'ETE João Paulo (85 L/s)', lon: -48.50635, lat: -27.5535 },
      { name: 'ETE Lagoa da Conceição', lon: -48.4720, lat: -27.6050 }, { name: 'ETE Jurerê Internacional', lon: -48.50299, lat: -27.44641 }, { name: 'URA Beira-Mar Norte', lon: -48.55023, lat: -27.58484 }, { name: 'ETE Santo Amaro (CASAN)', lon: -48.76343, lat: -27.68804 }
    ];
    const col = new THREE.Color(this.color);
    for (const e of etes) { const m = new THREE.Mesh(new THREE.BoxGeometry(90, 40, 90), new THREE.MeshLambertMaterial({ color: col })); m.position.copy(app.pos(e.lon, e.lat, 22)); m.userData = { type: 'ete', name: e.name }; this.group.add(m); app.pickables.push(m); this.labels.push(app.addLabel(e.name, { pos: m.position.clone().add(new THREE.Vector3(0, 40, 0)), maxDist: 40000, priority: 3 })); }
    const g = new THREE.ConeGeometry(1, 1, 6); const mat = new THREE.MeshLambertMaterial({ color: col.clone().offsetHSL(0, 0, 0.15) });
    const inst = new THREE.InstancedMesh(g, mat, pec.eee.length); const M = new THREE.Matrix4();
    pec.eee.forEach((s, i) => { const sc = s.size === 'G' ? 40 : s.size === 'M' ? 28 : 18; const p = app.pos(s.lon, s.lat, sc / 2 + 1); M.compose(p, new THREE.Quaternion(), new THREE.Vector3(sc * 0.6, sc, sc * 0.6)); inst.setMatrixAt(i, M); });
    inst.userData = { type: 'eee', list: pec.eee }; this.group.add(inst); app.pickables.push(inst); this.inst = inst;
  },
  setVisible(v) { this.group.visible = v; for (const L of this.labels) L.visible = v; },
  pick(hit) {
    const u = hit.object.userData; if (u.type === 'ete') return { kind: 'ete', html: `<h3>${u.name}</h3><span class="tag doc">OSM / CASAN</span><div class="note">Camada de esgoto: apenas localização. Modelo de simulação: a implementar (ver docs/IMPROVEMENTS.md).</div>`, pos: hit.point };
    if (u.type === 'eee') { const s = u.list[hit.instanceId]; return { kind: 'eee', html: `<h3>${s.name}</h3><span class="tag doc">PEC SES Continental</span><div>${s.code} · porte ${({ P: 'pequeno (≤10 L/s)', M: 'médio (11–40 L/s)', G: 'grande (>40 L/s)' })[s.size]}</div>`, pos: hit.point }; }
    return null;
  },
  legendHtml() { return `<div class="legend"><span class="sw" style="background:#b07cff"></span><span>ETE (caixa) · elevatória de esgoto (cone, tamanho = porte)</span></div>`; }
};
