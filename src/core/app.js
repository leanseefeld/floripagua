import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toXZ, fromXZ } from './geo.js';

/** Tiny event emitter */
export class Emitter {
  constructor() { this.m = new Map(); }
  on(e, f) { (this.m.get(e) || this.m.set(e, []).get(e)).push(f); return () => this.off(e, f); }
  off(e, f) { const a = this.m.get(e); if (a) a.splice(a.indexOf(f) >>> 0, 1); }
  emit(e, ...a) { (this.m.get(e) || []).slice().forEach(f => f(...a)); }
}

export const isMobile = () => matchMedia('(max-width: 799px)').matches;
export const isTouch = () => 'ontouchstart' in window && matchMedia('(pointer: coarse)').matches;

/** Shared application context: renderer, scene, camera, helpers. Layers receive this. */
export class App extends Emitter {
  constructor({ canvas, dem, exaggeration = 1.6 }) {
    super();
    this.canvas = canvas; this.dem = dem; this.exag = exaggeration; this.touch = isTouch(); this.lowPower = this.touch && (innerWidth === 0 || innerWidth < 1100);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lowPower, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.lowPower ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1420);
    this.scene.fog = new THREE.Fog(0x0e1420, 40000, 140000);
    this.camera = new THREE.PerspectiveCamera(55, 1, 40, 500000);
    this.camera.position.set(-12000, 22000, 26000);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, maxPolarAngle: Math.PI * 0.47, minDistance: 150, maxDistance: 120000, screenSpacePanning: false, zoomToCursor: true });
    this.controls.target.set(-4000, 0, 6000);
    // touch: one finger pans along the ground, two fingers pinch-zoom + tilt/rotate
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2118, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.4); sun.position.set(-30000, 40000, 20000); this.scene.add(sun);
    this.labelRoot = document.getElementById('labels');
    this.labels = []; // {obj|pos, el, minDist, maxDist, priority}
    this.pickables = []; this.raycaster = new THREE.Raycaster(); this.raycaster.params.Line = { threshold: 60 };
    this.clock = new THREE.Clock();
    this._setupPicking();
    addEventListener('resize', () => this.resize()); this.resize();
  }
  /** narrow layout (bottom-sheet panel); evaluated live because embedded browsers may report width 0 during load */
  get mobile() { return innerWidth > 0 && innerWidth < 800; }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  /** world position for lon/lat with terrain elevation (+offset metres, not exaggerated) */
  pos(lon, lat, offset = 0, elevOverride) {
    const { x, z } = toXZ(lon, lat);
    const e = elevOverride ?? this.dem.elevation(lon, lat);
    return new THREE.Vector3(x, Math.max(e, 0) * this.exag + offset, z);
  }
  elev(lon, lat) { return Math.max(this.dem.elevation(lon, lat), 0); }
  lonLatAt(v) { return fromXZ(v.x, v.z); }
  addLabel(text, { pos, cls = '', minDist = 0, maxDist = 30000, priority = 1, data = null }) {
    const el = document.createElement('div'); el.className = 'label ' + cls; el.textContent = text; el.style.display = 'none';
    this.labelRoot.appendChild(el);
    const L = { pos, el, minDist, maxDist, priority, data, visible: true };
    this.labels.push(L); return L;
  }
  removeLabel(L) { L.el.remove(); this.labels.splice(this.labels.indexOf(L) >>> 0, 1); }
  _updateLabels() {
    const cam = this.camera; const w = innerWidth, h = innerHeight; const v = new THREE.Vector3();
    const maxN = this.mobile ? 40 : 90; let n = 0;
    const cands = [];
    for (const L of this.labels) {
      if (!L.visible) { L.el.style.display = 'none'; continue; }
      const d = cam.position.distanceTo(L.pos);
      if (d < L.minDist || d > L.maxDist) { L.el.style.display = 'none'; continue; }
      v.copy(L.pos).project(cam);
      if (v.z > 1 || v.x < -1.05 || v.x > 1.05 || v.y < -1.05 || v.y > 1.05) { L.el.style.display = 'none'; continue; }
      cands.push([L.priority * 1e6 - d, L, (v.x + 1) / 2 * w, (1 - v.y) / 2 * h]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    const placed = [];
    for (const [, L, x, y] of cands) {
      if (n >= maxN) { L.el.style.display = 'none'; continue; }
      // crude overlap avoidance
      let ok = true; for (const p of placed) { if (Math.abs(p[0] - x) < 70 && Math.abs(p[1] - y) < 16) { ok = false; break; } }
      if (!ok) { L.el.style.display = 'none'; continue; }
      placed.push([x, y]); n++;
      L.el.style.display = ''; L.el.style.transform = `translate(${x.toFixed(0)}px,${(y - 6).toFixed(0)}px) translate(-50%,-100%)`;
    }
  }
  _setupPicking() {
    let down = null;
    this.canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY, Date.now()]; });
    this.canvas.addEventListener('pointerup', e => {
      if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); const dt = Date.now() - down[2]; down = null;
      if (moved > 8 || dt > 600) return;
      const m = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(m, this.camera);
      const hits = this.raycaster.intersectObjects(this.pickables.filter(o => o.visible && (!o.parent || o.parent.visible)), false);
      if (hits.length) this.emit('pick', hits[0], e); else this.emit('pickNone', e);
    });
  }
  flyTo(target, distance = 4000, angleDeg = 55) {
    const t = target.clone(); const c = this.camera.position; const dir = new THREE.Vector3().subVectors(c, this.controls.target).setY(0).normalize();
    if (!isFinite(dir.x) || dir.length() === 0) dir.set(-0.5, 0, 1).normalize();
    const goal = t.clone().add(dir.multiplyScalar(distance * Math.cos(angleDeg * Math.PI / 180))).add(new THREE.Vector3(0, distance * Math.sin(angleDeg * Math.PI / 180), 0));
    this._fly = { from: c.clone(), to: goal, tFrom: this.controls.target.clone(), tTo: t, k: 0 };
  }
  start(updateFn) {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      if (this._fly) { const f = this._fly; f.k = Math.min(1, f.k + dt * 1.5); const s = f.k * f.k * (3 - 2 * f.k); this.camera.position.lerpVectors(f.from, f.to, s); this.controls.target.lerpVectors(f.tFrom, f.tTo, s); if (f.k >= 1) this._fly = null; }
      this.controls.update();
      updateFn && updateFn(dt);
      this.emit('frame', dt);
      this.renderer.render(this.scene, this.camera);
      this._updateLabels();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
