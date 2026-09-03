import { Emitter } from './app.js';
/**
 * Generic scenario engine. A Scenario = { id, name, description, start: ISO date, duration_h, events: [{t_h, label, apply(model)}], setup(model) }.
 * The engine advances model time in fixed steps and applies events when their time is reached.
 */
export class SimEngine extends Emitter {
  constructor() { super(); this.t = 0; this.playing = false; this.speed = 600; /* sim-seconds per real second */ this.stepH = 1 / 12; this.scenario = null; this.model = null; }
  load(scenario, model) {
    this.scenario = scenario; this.model = model; this.t = 0; this.playing = false; this._applied = new Set();
    model.reset(); scenario.setup && scenario.setup(model); this._applyEventsUpTo(0); model.step(0, 0);
    this.emit('reset'); this.emit('tick', this.t);
  }
  _applyEventsUpTo(t) {
    for (const ev of this.scenario.events || []) if (ev.t_h <= t && !this._applied.has(ev)) { this._applied.add(ev); ev.apply && ev.apply(this.model, this); this.emit('event', ev); }
  }
  seek(t) {
    // deterministic: rebuild from scratch to time t
    const wasPlaying = this.playing; this.playing = false;
    this.model.reset(); this.scenario.setup && this.scenario.setup(this.model); this._applied = new Set(); this.t = 0;
    while (this.t < t - 1e-9) { const dt = Math.min(this.stepH, t - this.t); this._applyEventsUpTo(this.t); this.model.step(dt, this.t); this.t += dt; }
    this._applyEventsUpTo(this.t); this.model.step(0, this.t);
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
