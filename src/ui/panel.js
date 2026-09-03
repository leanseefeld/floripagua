/** Interface: brand + toolbar (sheets: layers/basemap, legend, about, settings) and the bottom story bar (clock, transport, timeline, event card). */
export function buildUI(ctx) {
  const { app, registry, sim, terrain } = ctx;
  const $ = (s) => document.querySelector(s);
  const simLayer = registry.layers.find(l => l.scenarios && l.model);
  const fmtN = n => Math.round(n).toLocaleString('pt-BR');
  const fmtK = n => n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.', ',') + ' mil' : fmtN(n);
  const TZ = 'America/Sao_Paulo';
  const fmtDay = d => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TZ }).replace('.', '');
  const fmtTime = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', 'h');
  const evDate = (s, ev) => new Date(new Date(s.start).getTime() + ev.t_h * 3600e3);
  const icon = (id) => `<svg><use href="#${id}"/></svg>`;

  // ---------- sheets ----------
  const pops = ['layers', 'legend', 'about', 'settings'];
  function openPop(id) {
    for (const p of pops) { const el = $('#pop-' + p); el.hidden = p !== id ? true : !el.hidden; }
    document.querySelectorAll('[data-pop]').forEach(b => b.classList.toggle('active', b.dataset.pop === id && !$('#pop-' + id).hidden));
    $('#settingsBtn').classList.toggle('active', id === 'settings' && !$('#pop-settings').hidden);
  }
  const closePops = () => { for (const p of pops) $('#pop-' + p).hidden = true; document.querySelectorAll('[data-pop],#settingsBtn').forEach(b => b.classList.remove('active')); };
  document.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => openPop(b.dataset.pop));
  $('#settingsBtn').onclick = () => openPop('settings');
  $('#gl').addEventListener('pointerdown', closePops);

  function renderLayers() {
    const el = $('#pop-layers');
    el.innerHTML = `<h2>Mapa base</h2><div class="seg" id="basemap"><button data-b="satellite">Satélite</button><button data-b="hypso">Relevo</button><button data-b="landcover">Cobertura</button></div>
      <div class="note" id="basemapNote" style="margin-top:6px"></div>
      <h2>Camadas</h2>${registry.layers.map(l => `<div class="row"><label><input type="checkbox" data-layer="${l.id}" ${l.visible ? 'checked' : ''}><span class="sw" style="background:${l.color}"></span>${l.name}</label></div>`).join('')}
      <div class="row"><label><input type="checkbox" id="t_buildings" ${ctx.buildingsMesh.visible ? 'checked' : ''}> Edificações 3D (OSM)</label></div>
      <div class="row"><label><input type="checkbox" id="t_roads" checked> Vias principais</label></div>
      <div class="row"><label><input type="checkbox" id="t_places" checked> Nomes de bairros</label></div>
      <div id="layerPanels"></div>`;
    const notes = { satellite: 'Esri World Imagery (Esri, Maxar, Earthstar Geographics).', hypso: 'Cores por altitude (AWS Terrain Tiles, 34 m no núcleo urbano).', landcover: 'ESA WorldCover 2021, 10 m: floresta, campo, agricultura, área urbana, áreas úmidas, mangue, água.' };
    el.querySelectorAll('#basemap button').forEach(b => { b.classList.toggle('on', b.dataset.b === terrain.mode); b.onclick = async () => { await terrain.setBasemap(b.dataset.b); el.querySelectorAll('#basemap button').forEach(x => x.classList.toggle('on', x === b)); $('#basemapNote').textContent = notes[b.dataset.b]; }; });
    $('#basemapNote').textContent = notes[terrain.mode];
    el.querySelectorAll('[data-layer]').forEach(cb => cb.onchange = () => registry.setVisible(cb.dataset.layer, cb.checked));
    $('#t_buildings').onchange = e => ctx.buildingsMesh.visible = e.target.checked;
    $('#t_roads').onchange = e => ctx.roads.lines.visible = e.target.checked;
    $('#t_places').onchange = e => ctx.placeLabels.forEach(L => L.visible = e.target.checked);
    const lp = $('#layerPanels');
    for (const l of registry.layers) if (l.renderPanel) { const d = document.createElement('details'); d.innerHTML = `<summary>Opções: ${l.name}</summary>`; const box = document.createElement('div'); d.appendChild(box); lp.appendChild(d); l.renderPanel(box, ctx); }
  }
  function renderLegend() { $('#pop-legend').innerHTML = registry.layers.filter(l => l.legendHtml).map(l => `<h2>${l.name}</h2>${l.legendHtml()}`).join('') + `<h2>Cobertura do solo (ESA WorldCover)</h2><div class="legend"><span class="sw" style="background:#006400"></span><span>Floresta</span><span class="sw" style="background:#ffbb22"></span><span>Arbustos</span><span class="sw" style="background:#ffff4c"></span><span>Campo</span><span class="sw" style="background:#f096ff"></span><span>Agricultura</span><span class="sw" style="background:#fa0000"></span><span>Área urbana</span><span class="sw" style="background:#b4b4b4"></span><span>Solo exposto</span><span class="sw" style="background:#0064c8"></span><span>Água</span><span class="sw" style="background:#0096a0"></span><span>Áreas úmidas</span><span class="sw" style="background:#00cf75"></span><span>Mangue</span></div>`; }
  function renderAbout() { $('#pop-about').innerHTML = `<h2>Fontes</h2><div class="note">Unidades e coordenadas: Planos de Emergência e Contingência da CASAN (SIA Grande Florianópolis 2023; Costa Norte e Costa Sul/Leste 2024). Diâmetros e extensões: notícias da CASAN. Cronologia do rompimento de 31/08/2026: CASAN, ND Mais, NSC, TVBV. Relevo: AWS Terrain Tiles (z14 no núcleo urbano, ~34 m). Imagens: Esri World Imagery. Cobertura do solo: ESA WorldCover 2021. Edificações, vias e bairros: OpenStreetMap.</div><h2>Limitações</h2><div class="note">Traçados sem descrição pública são <b>estimados</b> (caminho de menor custo sobre relevo, vias e cobertura do solo) e desenhados mais transparentes. A simulação é um modelo de grafo com heurísticas, não hidráulico. População por zona rateada por edificações OSM. Detalhes em <code>docs/SOURCES.md</code> e <code>docs/IMPROVEMENTS.md</code>.</div><h2>Como navegar</h2><div class="note">Desktop: arrastar gira, botão direito/Shift move, roda aproxima. Celular: um dedo move, dois dedos inclinam e aproximam. Toque em tubos, unidades ou zonas para detalhes.</div><h2>Atalhos</h2><div class="note"><kbd>espaço</kbd> rodar/pausar · <kbd>←</kbd> <kbd>→</kbd> evento anterior/próximo · <kbd>[</kbd> <kbd>]</kbd> velocidade</div>`; }
  function renderSettings() {
    const p = simLayer.model.params; p.rampHours ??= 8; p.rampStages ??= 4;
    $('#pop-settings').innerHTML = `<h2>Recarga gradual (após o reparo)</h2><div class="row"><label style="flex:1;flex-direction:column;align-items:stretch">Duração da carga: <b id="rampHv">${p.rampHours}</b> h<input type="range" id="rampH" min="1" max="24" step="1" value="${p.rampHours}"></label></div><div class="row"><label style="flex:1;flex-direction:column;align-items:stretch">Estágios de abertura: <b id="rampSv">${p.rampStages}</b><input type="range" id="rampS" min="1" max="8" step="1" value="${p.rampStages}"></label></div><div class="note">A adutora reparada é aberta em estágios (fração da capacidade) ao longo da duração escolhida; reservatórios reenchem com a sobra e as zonas mais altas só voltam quando o reservatório passa de 35 %.</div>`;
    $('#rampH').oninput = e => { p.rampHours = +e.target.value; $('#rampHv').textContent = e.target.value; sim.seek(sim.t); };
    $('#rampS').oninput = e => { p.rampStages = +e.target.value; $('#rampSv').textContent = e.target.value; sim.seek(sim.t); };
  }

  // ---------- story bar ----------
  const story = $('#story'), sel = $('#scenario'), track = $('#track'), marks = track.querySelector('.track-marks');
  sel.innerHTML = simLayer.scenarios.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  sel.onchange = () => loadScenario(sel.value);
  const setCollapsed = (c) => { story.classList.toggle('collapsed', c); $('#storyToggle').innerHTML = icon(c ? 'i-up' : 'i-down'); };
  $('#storyToggle').onclick = () => setCollapsed(!story.classList.contains('collapsed'));
  // play: tap toggles; press-and-hold runs at 5x while held
  (() => {
    const btn = $('#play'); let timer = null, holding = false, baseSpeed = null;
    const start = (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } holding = false; timer = setTimeout(() => { holding = true; baseSpeed = sim.speed; sim.speed = baseSpeed * 5; if (!sim.playing) { if (sim.t >= sim.scenario.duration_h - 1e-6) sim.seek(0); sim.playing = true; } btn.classList.add('holding'); refresh(); }, 320); };
    const end = () => { if (timer) { clearTimeout(timer); timer = null; } if (holding) { holding = false; sim.speed = baseSpeed; btn.classList.remove('holding'); refresh(); } else if (baseSpeed === null || !holding) togglePlay(); };
    btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', () => { if (timer) clearTimeout(timer); timer = null; if (holding) { holding = false; sim.speed = baseSpeed; btn.classList.remove('holding'); } });
    btn.addEventListener('contextmenu', e => e.preventDefault());
  })();
  $('#reset').onclick = () => { sim.playing = false; sim.seek(0); refresh(); };
  $('#speed').onchange = e => sim.speed = +e.target.value; sim.speed = 900;
  $('#prevEv').addEventListener('click', (e) => { e.preventDefault(); stepEvent(-1); });
  $('#nextEv').addEventListener('click', (e) => { e.preventDefault(); stepEvent(1); });
  function togglePlay() { if (sim.t >= sim.scenario.duration_h - 1e-6) sim.seek(0); sim.playing = !sim.playing; refresh(); }
  /** jump to the previous/next event boundary (pauses playback) */
  function stepEvent(dir) {
    const evs = sim.scenario.events; if (!evs.length) return; const t = sim.t;
    sim.playing = false;
    if (dir > 0) { const target = evs.find(e => e.t_h > t + 1e-6); if (target) sim.seek(target.t_h + 0.01); else sim.seek(sim.scenario.duration_h); }
    else { const past = evs.filter(e => e.t_h < t - 0.05); const target = past[past.length - 1]; sim.seek(target ? target.t_h + 0.01 : 0); }
    slideIn(dir); refresh();
  }
  /** slide the card content in from the direction of travel */
  function slideIn(dir) { const m = $('.event-main'); m.classList.add(dir > 0 ? 'out-right' : 'out-left'); void m.offsetWidth; m.classList.remove('out-right', 'out-left'); m.style.transform = ''; m.style.opacity = ''; }
  // swipe on the event card: left = next, right = previous
  (() => {
    const card = $('#eventCard'), main = $('.event-main'); let sx = 0, sy = 0, dx = 0, active = false, id = null;
    card.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; active = true; id = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; card.classList.add('dragging'); main.style.transition = 'none'; });
    card.addEventListener('pointermove', e => { if (!active || e.pointerId !== id) return; dx = e.clientX - sx; const dy = e.clientY - sy; if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 10) return; try { card.setPointerCapture(id); } catch (_) { /* synthetic */ } main.style.transform = `translateX(${dx * 0.45}px)`; main.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 260)); });
    const finish = () => { if (!active) return; active = false; card.classList.remove('dragging'); main.style.transition = ''; if (Math.abs(dx) > 48) stepEvent(dx < 0 ? 1 : -1); else { main.style.transform = ''; main.style.opacity = ''; } dx = 0; };
    card.addEventListener('pointerup', finish); card.addEventListener('pointercancel', finish);
  })();
  function flash() { const c = $('#eventCard'); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); }
  let drag = false;
  const seekFromX = (x) => { const r = track.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (x - r.left) / r.width)); sim.playing = false; sim.seek(f * sim.scenario.duration_h); refresh(); };
  track.addEventListener('pointerdown', e => { if (e.target.classList.contains('mark')) return; drag = true; track.setPointerCapture(e.pointerId); seekFromX(e.clientX); });
  track.addEventListener('pointermove', e => { if (drag) seekFromX(e.clientX); });
  track.addEventListener('pointerup', () => drag = false); track.addEventListener('pointercancel', () => drag = false);
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); } else if (e.key === 'ArrowRight') stepEvent(1); else if (e.key === 'ArrowLeft') stepEvent(-1);
    else if (e.key === ']' || e.key === '[') { const o = [...$('#speed').options]; let i = o.findIndex(x => x.selected); i = Math.max(0, Math.min(o.length - 1, i + (e.key === ']' ? 1 : -1))); $('#speed').selectedIndex = i; sim.speed = +o[i].value; }
  });

  function loadScenario(id) {
    const s = simLayer.scenarios.find(x => x.id === id); if (!s) return; sel.value = id;
    sim.load(s, simLayer.model); sim.playing = false;
    $('#evDots').innerHTML = s.events.map((ev, i) => `<i class="${ev.apply ? 'key' : ''}" data-i="${i}"></i>`).join('');
    $('#evDots').querySelectorAll('i').forEach(d => d.onclick = () => { sim.playing = false; const i = +d.dataset.i; const dir = s.events[i].t_h > sim.t ? 1 : -1; sim.seek(s.events[i].t_h + 0.01); slideIn(dir); refresh(); });
    marks.innerHTML = s.events.map((ev, i) => `<div class="mark ${ev.apply ? 'key' : ''}" style="left:${(100 * ev.t_h / s.duration_h).toFixed(2)}%" data-i="${i}" title="${fmtDay(evDate(s, ev))} ${fmtTime(evDate(s, ev))}"></div>`).join('');
    marks.querySelectorAll('.mark').forEach(m => m.addEventListener('pointerdown', (e) => { e.stopPropagation(); sim.playing = false; sim.seek(s.events[+m.dataset.i].t_h + 0.01); refresh(); flash(); }));
    $('#settingsBtn').style.display = /recarga|rompimento/.test(id) ? '' : 'none';
    if (id === 'rompimento_2026' || id.startsWith('recarga')) app.flyTo(app.pos(-48.64, -27.62), 20000, 48);
    refresh();
  }
  let lastEv = null;
  function refresh() {
    const s = sim.scenario, t = sim.t, m = simLayer.model; simLayer.applyState && simLayer.applyState();
    const d = sim.date(); $('#clockDay').textContent = fmtDay(d); $('#clockTime').textContent = fmtTime(d);
    $('#play').innerHTML = icon(sim.playing ? 'i-pause' : (t >= s.duration_h - 1e-6 ? 'i-reset' : 'i-play'));
    const f = t / s.duration_h; track.querySelector('.track-fill').style.width = (100 * f).toFixed(2) + '%'; track.querySelector('.track-head').style.left = (100 * f).toFixed(2) + '%';
    marks.querySelectorAll('.mark').forEach((el, i) => el.classList.toggle('done', s.events[i].t_h <= t));
    const past = s.events.filter(e => e.t_h <= t + 1e-6); const cur = past[past.length - 1];
    if (cur) { $('#evWhen').innerHTML = `${fmtDay(evDate(s, cur))} <small>${fmtTime(evDate(s, cur))}</small>`; $('#evText').textContent = cur.label.replace(/^[^–]*–\s*/, ''); $('#evCount').textContent = `Evento ${past.length} de ${s.events.length}`; }
    else { $('#evWhen').innerHTML = `${fmtDay(d)} <small>${fmtTime(d)}</small>`; $('#evText').textContent = s.description; $('#evCount').textContent = s.events.length ? `Início · ${s.events.length} eventos` : 'Regime permanente'; }
    $('#prevEv').disabled = t <= 1e-6; $('#nextEv').disabled = t >= s.duration_h - 1e-6;
    $('#evDots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', cur === s.events[i]));
    if (cur !== lastEv && sim.playing) { flash(); slideIn(1); } lastEv = cur;
    const st = m.stats;
    $('#chips').innerHTML = `<span class="chip" title="População sem água"><i style="background:var(--danger)"></i>${fmtK(st.popNone)}</span><span class="chip" title="Baixa pressão / parcial"><i style="background:var(--warn)"></i>${fmtK(st.popLow)}</span><span class="chip" title="Abastecimento normal"><i style="background:var(--ok)"></i>${fmtK(st.popFull)}</span><span class="chip dim" title="Índice heurístico de transiente (golpe de aríete)">⚡ ${st.surge.toFixed(2)}</span>`;
  }
  sim.on('tick', refresh);

  // ---------- popup ----------
  const popup = $('#popup');
  app.on('pick', (hit) => {
    const r = registry.pick(hit); if (!r) { popup.hidden = true; return; }
    let extra = '';
    if (r.kind === 'edge' && !r.obj.planned) extra = `<div class="row" style="margin-top:8px"><button class="btn ${r.obj.broken ? '' : 'danger'}" id="pp_break">${r.obj.broken ? 'Reparar' : 'Romper'}</button><button class="btn" id="pp_close">${r.obj.closedNow ? 'Abrir' : 'Fechar'} registro</button></div>`;
    popup.innerHTML = `<button class="close" id="pp_x">${icon('i-close')}</button>${r.html}${extra}`; popup.hidden = false;
    const v = hit.point.clone().project(app.camera); const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
    if (app.mobile) { Object.assign(popup.style, { left: '8px', right: '8px', top: 'calc(64px + env(safe-area-inset-top))', maxWidth: 'none' }); } else { Object.assign(popup.style, { right: '', maxWidth: '340px', left: Math.min(innerWidth - 350, x + 12) + 'px', top: Math.max(70, Math.min(innerHeight - 280, y - 20)) + 'px' }); }
    popup.querySelector('#pp_x').onclick = () => popup.hidden = true;
    const bb = popup.querySelector('#pp_break'); if (bb) bb.onclick = () => { r.obj.broken = !r.obj.broken; if (!r.obj.broken) r.obj.open = 1; r.obj.ramp = null; r.layer.model.step(0, sim.t); refresh(); popup.innerHTML = `<button class="close" id="pp_x">${icon('i-close')}</button>${r.layer.edgeHtml(r.obj)}`; popup.querySelector('#pp_x').onclick = () => popup.hidden = true; };
    const cb = popup.querySelector('#pp_close'); if (cb) cb.onclick = () => { r.obj.closedNow = !r.obj.closedNow; r.layer.model.step(0, sim.t); refresh(); popup.hidden = true; };
  });
  app.on('pickNone', () => { popup.hidden = true; });

  renderLayers(); renderLegend(); renderAbout(); renderSettings();
  loadScenario('rompimento_2026');
  setCollapsed(app.mobile);
  return { loadScenario, refresh };
}
