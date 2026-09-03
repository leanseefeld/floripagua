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
  const pops = ['layers', 'legend', 'about', 'scenario'];
  function openPop(id) {
    for (const p of pops) { const el = $('#pop-' + p); el.hidden = p !== id ? true : !el.hidden; }
    document.querySelectorAll('[data-pop]').forEach(b => b.classList.toggle('active', b.dataset.pop === id && !$('#pop-' + id).hidden));
  }
  const closePops = () => { for (const p of pops) $('#pop-' + p).hidden = true; document.querySelectorAll('[data-pop]').forEach(b => b.classList.remove('active')); };
  document.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => openPop(b.dataset.pop));
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
  /** scenario sheet: pick what you are looking at, plus that scenario's parameters */
  function renderScenario() {
    const cur = sim.scenario?.id || simLayer.scenarios[0].id; const par = simLayer.model.params; par.rampHours ??= 8; par.rampStages ??= 4;
    const tunable = /recarga|rompimento/.test(cur);
    $('#pop-scenario').innerHTML = `<h2>Cenário</h2>` + simLayer.scenarios.map(s => `<button class="opt ${s.id === cur ? 'on' : ''}" data-id="${s.id}"><span class="dot"></span><b>${s.name}</b><span>${s.description}</span></button>`).join('')
      + (tunable ? `<h2>Parâmetros da recarga</h2><div class="row"><label style="flex:1;flex-direction:column;align-items:stretch">Duração da carga: <b id="rampHv">${par.rampHours}</b> h<input type="range" id="rampH" min="1" max="24" step="1" value="${par.rampHours}"></label></div><div class="row"><label style="flex:1;flex-direction:column;align-items:stretch">Estágios de abertura: <b id="rampSv">${par.rampStages}</b><input type="range" id="rampS" min="1" max="8" step="1" value="${par.rampStages}"></label></div><div class="note">A adutora reparada é aberta em estágios (fração da capacidade) ao longo da duração escolhida; reservatórios reenchem com a sobra e as zonas mais altas só voltam quando o reservatório passa de 35 %.</div>` : '');
    $('#pop-scenario').querySelectorAll('.opt').forEach(b => b.onclick = () => { loadScenario(b.dataset.id); $('#pop-scenario').hidden = true; document.querySelectorAll('[data-pop]').forEach(x => x.classList.remove('active')); });
    const rh = $('#rampH'), rs = $('#rampS');
    if (rh) rh.oninput = e => { par.rampHours = +e.target.value; $('#rampHv').textContent = e.target.value; sim.invalidate(); sim.seek(sim.t); };
    if (rs) rs.oninput = e => { par.rampStages = +e.target.value; $('#rampSv').textContent = e.target.value; sim.invalidate(); sim.seek(sim.t); };
  }

  // ---------- story bar ----------
  const story = $('#story'), track = $('#track'), marks = track.querySelector('.track-marks');
  const setCollapsed = (c) => { story.classList.toggle('collapsed', c); story.classList.toggle('expanded', !c); $('#storyToggle').innerHTML = icon(c ? 'i-up' : 'i-down'); $('#storyToggle').setAttribute('aria-expanded', String(!c)); };
  $('#storyToggle').onclick = () => setCollapsed(!story.classList.contains('collapsed'));
  // pull gesture on the collapsed bar (phones): drag up to grow the sheet; release past half to expand, or return it to abort. Drag down on the head to collapse.
  (() => {
    const head = $('.story-head'), body = $('.story-body'), inner = $('.story-inner');
    let sy = 0, active = false, decided = false, startExpanded = false, prog = 0, lastY = 0, lastT = 0, vel = 0;
    let H0 = 0; // content height captured at gesture start; the sheet may overshoot it by at most 10 % (rubber band)
    const H = () => H0 || Math.min(inner.scrollHeight + 12, innerHeight * 0.6);
    const apply = (pr) => { prog = pr; body.style.gridTemplateRows = (H() * pr).toFixed(1) + 'px'; body.style.paddingBottom = (12 * pr).toFixed(1) + 'px'; const inset = 10 * (1 - pr); story.style.left = story.style.right = story.style.bottom = inset.toFixed(1) + 'px'; story.style.borderRadius = `22px 22px ${(18 * (1 - pr)).toFixed(1)}px ${(18 * (1 - pr)).toFixed(1)}px`; };
    const clear = () => { body.style.gridTemplateRows = ''; body.style.paddingBottom = ''; body.style.transition = ''; story.style.left = story.style.right = story.style.bottom = story.style.borderRadius = ''; };
    const begin = (y, target) => { if (!app.mobile || target.closest('button,select,input,.chip')) return; H0 = 0; H0 = H(); active = true; decided = false; startExpanded = !story.classList.contains('collapsed'); sy = lastY = y; lastT = performance.now(); vel = 0; };
    const move = (y) => {
      if (!active) return false; const dy = sy - y; // up = positive
      if (!decided) { if (Math.abs(dy) < 6) return false; if ((startExpanded && dy > 0) || (!startExpanded && dy < 0)) { active = false; return false; } decided = true; story.classList.add('dragging'); }
      const now = performance.now(); vel = 0.7 * vel + 0.3 * ((lastY - y) / Math.max(1, now - lastT)); lastY = y; lastT = now;
      const maxPull = Math.min(H() * 0.6, 280); const raw = Math.abs(dy) / maxPull;
      const k = raw <= 1 ? raw : 1 + 0.08 * (1 - Math.exp(-(raw - 1) * 2)); // beyond full size: stiff, capped at ~+10 % of the whole sheet
      apply(startExpanded ? Math.max(0, 1 - raw) : k); return true;
    };
    const end = () => {
      if (!active) return; active = false; if (!decided) return;
      const expand = startExpanded ? !(prog < 0.5 || vel < -0.4) : (prog > 0.5 || vel > 0.4); prog = Math.min(prog, 1);
      story.classList.remove('dragging');
      body.style.transition = 'grid-template-rows .28s cubic-bezier(.2,.9,.25,1), padding-bottom .28s cubic-bezier(.2,.9,.25,1)';
      setTimeout(() => apply(expand ? 1 : 0), 0); // animate to the resting size, then hand over to the class-based layout
      setTimeout(() => { clear(); setCollapsed(!expand); }, 320);
    };
    let tid = null;
    head.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; tid = e.touches[0].identifier; begin(e.touches[0].clientY, e.target); }, { passive: true });
    head.addEventListener('touchmove', e => { const t = [...e.touches].find(t => t.identifier === tid); if (t && move(t.clientY)) e.preventDefault(); }, { passive: false });
    head.addEventListener('touchend', end); head.addEventListener('touchcancel', end);
    head.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') begin(e.clientY, e.target); });
    head.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && active) { move(e.clientY); try { head.setPointerCapture(e.pointerId); } catch (_) {} } });
    head.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') end(); }); head.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') end(); });
  })();
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
  $('#prevEv').addEventListener('click', () => stepEvent(-1));
  $('#nextEv').addEventListener('click', () => stepEvent(1));
  function togglePlay() { if (sim.t >= sim.scenario.duration_h - 1e-6) sim.seek(0); sim.playing = !sim.playing; refresh(); }
  /** card index: 0 = intro (t=0), i = i-th event (last event whose time <= t) */
  const idxAt = (t) => { const evs = sim.scenario.events; let i = 0; for (let k = 0; k < evs.length; k++) if (evs[k].t_h <= t + 1e-6) i = k + 1; return i; };
  /** jump to card i: dim the deck first, let the browser paint, then compute (seek can take tens of ms) */
  let pendingGoto = null;
  const goto = (i) => {
    const evs = sim.scenario.events; i = Math.max(0, Math.min(evs.length, i)); sim.playing = false;
    const leaving = cards.querySelector('.card.on'); const all = cards.querySelectorAll('.card');
    all.forEach(el => { el.style.opacity = ''; el.classList.remove('leaving'); }); if (leaving) leaving.classList.add('leaving'); // the card swiped away fades
    cards.style.transform = `translateX(${-offsetFor(i)}px)`; // optimistic: slide to the card now
    pendingGoto = i;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (pendingGoto !== i) return; pendingGoto = null;
      sim.seek(i === 0 ? 0 : evs[i - 1].t_h + 0.01); refresh(); all.forEach(el => el.classList.remove('leaving'));
    }));
  };
  /** step to the previous/next event card; does nothing at the ends */
  function stepEvent(dir) { const i = idxAt(sim.t) + dir; if (i < 0 || i > sim.scenario.events.length) return; goto(i); }
  // card carousel with weighted swipe: the finger has to travel ~35 % of the card width (or flick) to commit; otherwise it snaps back.
  const cards = $('#cards'), carousel = $('#carousel');
  let dragging = false;
  /** deck offset for card i: first card flush left, last card flush right, others left-aligned with the next card peeking */
  function offsetFor(i) {
    const W = carousel.clientWidth, n = cards.children.length; const cs = getComputedStyle(carousel);
    const gap = parseFloat(cs.getPropertyValue('--gap')) || 16, peek = parseFloat(cs.getPropertyValue('--peek')) || 34; const cw = W - peek;
    const maxX = Math.max(0, n * cw + (n - 1) * gap - W);
    return Math.min(i * (cw + gap), maxX);
  }
  function positionCards(dxPx = 0) { cards.style.transform = `translateX(${(-offsetFor(idxAt(sim.t)) + dxPx).toFixed(1)}px)`; }
  (() => {
    // One gesture controller, two input paths: touch events (iOS Safari cancels pointer streams once it decides to scroll,
    // so we decide direction on the first touchmove and preventDefault from then on) and pointer events for mouse/pen.
    let sx = 0, sy = 0, dx = 0, active = false, decided = false, lastX = 0, lastT = 0, vel = 0;
    const band = (d, limit) => Math.sign(d) * limit * (1 - Math.exp(-Math.abs(d) / limit));
    const begin = (x, y) => { if (sim.scenario.events.length === 0) return; carousel.classList.add('pressed'); active = true; decided = false; sx = lastX = x; sy = y; dx = 0; vel = 0; lastT = performance.now(); };
    /** returns 'h' | 'v' | null (undecided) */
    const move = (x, y) => {
      if (!active) return null; const ddx = x - sx, ddy = y - sy;
      if (!decided) { if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return null; if (Math.abs(ddy) > Math.abs(ddx) * 1.2) { active = false; carousel.classList.remove('pressed'); return 'v'; } decided = true; dragging = true; carousel.classList.add('dragging'); cards.classList.add('dragging'); }
      const now = performance.now(); vel = 0.7 * vel + 0.3 * ((x - lastX) / Math.max(1, now - lastT)); lastX = x; lastT = now; dx = ddx;
      const W = carousel.clientWidth, i = idxAt(sim.t), n = sim.scenario.events.length;
      const blocked = (dx < 0 && i >= n) || (dx > 0 && i <= 0);
      positionCards(blocked ? band(dx, W * 0.12) : band(dx, W * 0.55)); // edge: stiff rubber band, never commits
      const on = cards.querySelector('.card.on'); if (on) on.style.opacity = blocked ? '' : String(1 - 0.35 * Math.min(1, Math.abs(dx) / (W * 0.35)));
      return 'h';
    };
    const end = () => {
      carousel.classList.remove('pressed');
      if (!active) return; active = false; carousel.classList.remove('dragging'); cards.classList.remove('dragging');
      if (!decided) return; dragging = false;
      const W = carousel.clientWidth, i = idxAt(sim.t), n = sim.scenario.events.length;
      const dir = dx < 0 ? 1 : -1; const blocked = (dir > 0 && i >= n) || (dir < 0 && i <= 0);
      const commit = !blocked && (Math.abs(dx) > W * 0.35 || (Math.abs(vel) > 0.6 && Math.abs(dx) > 40));
      if (commit) goto(i + dir); else { positionCards(0); const on = cards.querySelector('.card.on'); if (on) on.style.opacity = ''; } // snap back = cancel
      dx = 0;
    };
    // touch path
    let tid = null;
    carousel.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; tid = e.touches[0].identifier; begin(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    carousel.addEventListener('touchmove', e => { const t = [...e.touches].find(t => t.identifier === tid); if (!t) return; const r = move(t.clientX, t.clientY); if (r === 'h') e.preventDefault(); }, { passive: false });
    carousel.addEventListener('touchend', end); carousel.addEventListener('touchcancel', end);
    // mouse / pen path
    let pid = null;
    carousel.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') return; pid = e.pointerId; begin(e.clientX, e.clientY); });
    carousel.addEventListener('pointermove', e => { if (e.pointerType === 'touch' || e.pointerId !== pid) return; if (move(e.clientX, e.clientY) === 'h') { try { carousel.setPointerCapture(pid); } catch (_) {} } });
    carousel.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') end(); }); carousel.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') end(); });
  })();
  function flash() { /* no visual flash: the card position itself is the signal */ }
  let drag = false;
  /** scrubbing locks onto events: the nearest event mark (or the start) is selected */
  let scrubIdx = -1;
  const seekFromX = (x) => {
    const r = track.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (x - r.left) / r.width)); const s = sim.scenario;
    const pos = [0, ...s.events.map(e => e.t_h / s.duration_h)]; let best = 0; for (let k = 1; k < pos.length; k++) if (Math.abs(pos[k] - f) < Math.abs(pos[best] - f)) best = k;
    if (best === scrubIdx) return; scrubIdx = best; sim.playing = false; sim.seek(best === 0 ? 0 : s.events[best - 1].t_h + 0.01); refresh();
  };
  track.addEventListener('pointerdown', e => { if (e.target.classList.contains('mark')) return; drag = true; scrubIdx = -1; try { track.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } seekFromX(e.clientX); });
  track.addEventListener('pointermove', e => { if (drag) seekFromX(e.clientX); });
  track.addEventListener('pointerup', () => drag = false); track.addEventListener('pointercancel', () => drag = false);
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); } else if (e.key === 'ArrowRight') stepEvent(1); else if (e.key === 'ArrowLeft') stepEvent(-1);
    else if (e.key === ']' || e.key === '[') { const o = [...$('#speed').options]; let i = o.findIndex(x => x.selected); i = Math.max(0, Math.min(o.length - 1, i + (e.key === ']' ? 1 : -1))); $('#speed').selectedIndex = i; sim.speed = +o[i].value; }
  });

  function loadScenario(id) {
    const s = simLayer.scenarios.find(x => x.id === id); if (!s) return;
    $('#scenarioName').textContent = s.short || s.name.split(/\s+[–-]\s+|\s+\(/)[0];
    sim.off('tick', refresh); // rebuild the timeline DOM first, then load the engine
    const intro = `<div class="card intro"><div class="eyebrow">${s.events.length ? 'Início' : 'Regime permanente'}</div><div class="event-when">${fmtDay(new Date(s.start))} <small>${fmtTime(new Date(s.start))}</small></div><div class="event-text">${s.description}</div></div>`;
    cards.setAttribute('aria-live', 'polite'); cards.innerHTML = intro + s.events.map((ev, i) => `<div class="card ${ev.apply ? 'key' : ''}">${ev.apply ? '<div class="eyebrow">Muda a rede</div>' : ''}<div class="event-when">${fmtDay(evDate(s, ev))} <small>${fmtTime(evDate(s, ev))}</small></div><div class="event-text">${ev.label.replace(/^[^–]*–\s*/, '')}</div></div>`).join('');
    cards.classList.add('dragging'); cards.style.transform = 'translateX(0px)'; void cards.offsetWidth; cards.classList.remove('dragging');
    addEventListener('resize', () => positionCards(0), { passive: true });
    marks.innerHTML = s.events.map((ev, i) => `<div class="mark ${ev.apply ? 'key' : ''}" style="left:${(100 * ev.t_h / s.duration_h).toFixed(2)}%" data-i="${i}" title="${fmtDay(evDate(s, ev))} ${fmtTime(evDate(s, ev))}"></div>`).join('');
    marks.querySelectorAll('.mark').forEach(m => m.addEventListener('pointerdown', (e) => { e.stopPropagation(); goto(+m.dataset.i + 1); }));
    sim.load(s, simLayer.model); sim.playing = false; sim.on('tick', refresh); lastEv = null;
    renderScenario();
    if (id === 'rompimento_2026' || id.startsWith('recarga')) app.flyTo(app.pos(-48.64, -27.62), 20000, 48);
    refresh();
  }
  let lastEv = null;
  function refresh() {
    const s = sim.scenario, t = sim.t, m = simLayer.model; simLayer.applyState && simLayer.applyState();
    const d = sim.date(); $('#clockDay').textContent = fmtDay(d); $('#clockTime').textContent = fmtTime(d);
    $('#play').innerHTML = icon(sim.playing ? 'i-pause' : (t >= s.duration_h - 1e-6 ? 'i-reset' : 'i-play'));
    const f = t / s.duration_h; track.querySelector('.track-fill').style.width = (100 * f).toFixed(2) + '%'; track.querySelector('.track-head').style.left = (100 * f).toFixed(2) + '%';
    marks.querySelectorAll('.mark').forEach((el, i) => el.classList.toggle('done', !!s.events[i] && s.events[i].t_h <= t));
    { const i0 = idxAt(t); const ev = i0 ? s.events[i0 - 1] : null; const pct = ev ? 100 * ev.t_h / s.duration_h : 0; const dd = ev ? evDate(s, ev) : new Date(s.start);
      const lbl = $('#markLabel'); lbl.style.left = pct.toFixed(2) + '%'; lbl.innerHTML = `${fmtDay(dd)} <b>${fmtTime(dd)}</b>`; const r = track.clientWidth; lbl.style.transform = pct < 12 ? 'translateX(-15%)' : pct > 88 ? 'translateX(-85%)' : 'translateX(-50%)'; }
    const i = idxAt(t); const cur = i ? s.events[i - 1] : null;
    if (!dragging) positionCards(0);
    cards.querySelectorAll('.card').forEach((el, k) => el.classList.toggle('on', k === i));
    $('#prevEv').classList.toggle('hidden', i <= 0); $('#nextEv').classList.toggle('hidden', i >= s.events.length);
    if (cur !== lastEv && sim.playing) flash(); lastEv = cur;
    const st = m.stats;
    const chip = (cls, dot, val, tip) => `<span class="chip ${cls}" tabindex="0" aria-label="${tip}: ${val}">${dot ? `<i style="background:${dot}"></i>` : ''}${val}<span class="tip" role="tooltip">${tip}</span></span>`;
    const showing = [...$('#chips').querySelectorAll('.chip.show')].map(x => [...x.parentNode.children].indexOf(x));
    $('#chips').innerHTML = chip('', 'var(--danger)', fmtK(st.popNone), 'Pessoas sem água agora') + chip('', 'var(--warn)', fmtK(st.popLow), 'Pessoas com baixa pressão ou abastecimento parcial') + chip('', 'var(--ok)', fmtK(st.popFull), 'Pessoas com abastecimento normal') + chip('dim', '', '⚡ ' + st.surge.toFixed(2), 'Índice heurístico de transiente (golpe de aríete) na rede');
    $('#chips').querySelectorAll('.chip').forEach((el, i) => { if (showing.includes(i)) el.classList.add('show'); el.onclick = (e) => { e.stopPropagation(); const on = el.classList.contains('show'); $('#chips').querySelectorAll('.chip').forEach(x => x.classList.remove('show')); if (!on) { el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2500); } }; });
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

  renderLayers(); renderLegend(); renderAbout();
  loadScenario('rompimento_2026');
  setCollapsed(app.mobile);
  return { loadScenario, refresh };
}
