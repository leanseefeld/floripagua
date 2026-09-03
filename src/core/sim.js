import { Emitter } from './app.js';
/**
 * Generic scenario engine. A Scenario = { id, name, description, start: ISO date, duration_h, events: [{t_h, label, apply(model)}], setup(model) }.
 * The engine advances model time in fixed steps and applies events when their time is reached.
 */
export class SimEngine extends Emitter {
  constructor() { super(); this.t = 0; this.playing = false; this.speed = 600; /* sim-seconds per real second */ this.stepH = 1 / 12; this.scenario = null; this.model = null; }
  load(scenario, model) {
    this.scenario = scenario; this.model = model; this.t = 0; this.playing = false; this._applied = new Set();
    this.invalidate();
    model.reset(); scenario.setup && scenario.setup(model); this._applyEventsUpTo(0); model.step(0, 0);
    this.emit('reset'); this.emit('tick', this.t);
    this._warmCheckpoints();
  }
  /** drop cached checkpoints (call after changing model parameters) */
  invalidate() { this._cps = []; this._warmId && (cancelIdleCallback ? cancelIdleCallback(this._warmId) : clearTimeout(this._warmId)); this._warmId = null; }
  /** precompute a checkpoint at every event boundary during idle time so jumps are O(step) instead of O(scenario) */
  _warmCheckpoints() {
    // event boundaries first (instant card jumps), then hourly checkpoints (fast scrubbing)
    const D = this.scenario.duration_h; const evs = (this.scenario.events || []).map(e => e.t_h + 0.01).filter(t => t < D);
    for (let h = 1; h < D; h += 1) evs.push(h); let k = 0;
    const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 30));
    const run = (deadline) => { const t0 = performance.now(); while (k < evs.length && (performance.now() - t0 < 40 || (deadline && deadline.timeRemaining && deadline.timeRemaining() > 8))) { const t = evs[k++]; if (!this._cps.some(c => Math.abs(c.t - t) < 1e-9)) this._computeTo(t, true); } this._warmId = k < evs.length ? idle(run) : null; };
    this._warmId = idle(run);
  }
  /** rebuild state to time t from the nearest earlier checkpoint (or scratch) */
  _computeTo(t, keepCurrent = false) {
    const cur = keepCurrent ? { t: this.t, applied: new Set(this._applied), snap: this.model.snapshot() } : null;
    let cp = null; for (const c of this._cps) if (c.t <= t + 1e-9 && (!cp || c.t > cp.t)) cp = c;
    if (cp) { this.model.restore(cp.snap); this._applied = new Set(cp.applied); this.t = cp.t; }
    else { this.model.reset(); this.scenario.setup && this.scenario.setup(this.model); this._applied = new Set(); this.t = 0; }
    while (this.t < t - 1e-9) { const dt = Math.min(this.stepH, t - this.t); this._applyEventsUpTo(this.t); this.model.step(dt, this.t); this.t += dt; }
    this._applyEventsUpTo(this.t); this.model.step(0, this.t);
    if (!this._cps.some(c => Math.abs(c.t - t) < 1e-9) && this._cps.length < 256) this._cps.push({ t: this.t, applied: new Set(this._applied), snap: this.model.snapshot() });
    if (cur) { this.model.restore(cur.snap); this._applied = cur.applied; this.t = cur.t; }
  }
  _applyEventsUpTo(t) {
    for (const ev of this.scenario.events || []) if (ev.t_h <= t && !this._applied.has(ev)) { this._applied.add(ev); ev.apply && ev.apply(this.model, this); this.emit('event', ev); }
  }
  seek(t) {
    // deterministic: rebuild to time t from the nearest checkpoint (checkpoints are created at event boundaries)
    const wasPlaying = this.playing; this.playing = false;
    this._computeTo(Math.max(0, Math.min(t, this.scenario.duration_h)));
    this.playing = wasPlaying; this.emit('tick', this.t);
  }
  tick(realDt) {
    if (!this.playing || !this.model) return;
    let adv = realDt * this.speed / 3600; // hours
    const end = this.scenario.duration_h;
    while (adv > 0 && this.t < end) {
      const dt = Math.min(this.stepH, adv, end - this.t);
      this._applyEventsUpTo(this.t); this.model.step(dt, this.t); this.t += dt; adv -= dt;
    }
    this._applyEventsUpTo(this.t);
    if (this.t >= end) this.playing = false;
    this.emit('tick', this.t);
  }
  date() { const d = new Date(this.scenario.start); d.setTime(d.getTime() + this.t * 3600e3); return d; }
}
