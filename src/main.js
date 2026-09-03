import { App } from './core/app.js';
import { DEM } from './core/dem.js';
import { loadRoads, loadBuildings, loadJSON } from './core/data.js';
import { buildTerrain } from './core/terrain.js';
import { buildRoads } from './core/roads.js';
import { buildBuildings } from './core/buildings.js';
import { LayerRegistry } from './layers/registry.js';
import { SimEngine } from './core/sim.js';
import { buildUI } from './ui/panel.js';
import { waterLayer } from './layers/water/index.js';
import { sewageLayer } from './layers/sewage/index.js';
import { templateLayer } from './layers/_template/index.js';

const say = (t) => { const el = document.getElementById('loadingText'); if (el) el.textContent = t; };
(async () => {
  try {
    say('Carregando relevo…');
    const [dem, roadsRaw, buildingsRaw, places] = await Promise.all([DEM.load(), loadRoads(), loadBuildings(), loadJSON('./data/places.json')]);
    const app = new App({ canvas: document.getElementById('gl'), dem });
    say('Construindo terreno…'); await new Promise(r => setTimeout(r, 10));
    const terrain = buildTerrain(app);
    say('Vias e edificações…'); await new Promise(r => setTimeout(r, 10));
    const roads = buildRoads(app, roadsRaw);
    const buildings = buildBuildings(app, buildingsRaw);
    const placeLabels = []; const seen = new Set();
    for (const p of places) {
      const key = p.name + '|' + (['municipality', 'city', 'town'].includes(p.type) ? 'big' : 'small'); if (seen.has(key)) continue; seen.add(key);
      const big = p.type === 'municipality' || p.type === 'city' || p.type === 'town';
      if (p.type === 'municipality' && !['Florianópolis', 'São José', 'Palhoça', 'Biguaçu', 'Santo Amaro da Imperatriz', 'Águas Mornas', 'Antônio Carlos', 'Governador Celso Ramos', 'São Pedro de Alcântara'].includes(p.name)) continue;
      placeLabels.push(app.addLabel(p.name, { pos: app.pos(p.lon, p.lat, 40), cls: 'place' + (big ? ' muni' : ''), minDist: big ? 6000 : 0, maxDist: big ? 200000 : 14000, priority: big ? 3 : 0.5 }));
    }
    const ctx = { app, dem, terrain, roads, buildings: buildingsRaw, buildingsMesh: buildings.mesh, places, placeLabels, sim: new SimEngine() };
    ctx.buildings = buildingsRaw; // building records (with zone assignment); mesh helper below
    ctx.buildings.setState = (i, rgb, mix) => buildings.setState(i, rgb, mix); ctx.buildings.commit = () => buildings.commit();
    const registry = new LayerRegistry(ctx); ctx.registry = registry;
    registry.register(waterLayer); registry.register(sewageLayer); registry.register(templateLayer);
    await registry.initAll(n => say('Camada: ' + n));
    ctx.ui = buildUI(ctx);
    terrain.setBasemap('satellite').catch(e => console.warn('satellite basemap unavailable', e));
    document.getElementById('loading').remove();
    app.start(dt => { ctx.sim.tick(dt); registry.onFrame(dt); });
    window.__ctx = ctx; // debugging hook
  } catch (err) { console.error('boot failed', err); say('Erro: ' + err.message); }
})();
