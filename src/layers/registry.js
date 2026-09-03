/**
 * Layer registry: every utility (water, sewage, garbage, power…) is a module implementing the Layer interface:
 *   { id, name, description, color, defaultVisible,
 *     async init(ctx)               // load data, build meshes into ctx.app.scene (keep them in a THREE.Group)
 *     setVisible(bool)
 *     renderPanel(el, ctx)          // optional: layer-specific controls
 *     scenarios?: Scenario[]        // optional: simulation scenarios (see core/sim.js)
 *     model?: { reset(), step(dt,t), state }   // optional: simulation model driven by the engine
 *     onFrame?(dt)                  // optional: per-frame animation
 *     pick?(hit) -> info | null     // optional: describe a picked object
 *   }
 */
export class LayerRegistry {
  constructor(ctx) { this.ctx = ctx; this.layers = []; }
  register(layer) { this.layers.push(layer); return layer; }
  get(id) { return this.layers.find(l => l.id === id); }
  async initAll(progress) {
    for (const l of this.layers) { progress && progress(l.name); await l.init(this.ctx); l.visible = l.defaultVisible !== false; l.setVisible(l.visible); }
  }
  setVisible(id, v) { const l = this.get(id); if (l) { l.visible = v; l.setVisible(v); } }
  onFrame(dt) { for (const l of this.layers) if (l.visible && l.onFrame) l.onFrame(dt); }
  pick(hit) { for (const l of this.layers) { if (!l.visible || !l.pick) continue; const r = l.pick(hit); if (r) return { layer: l, ...r }; } return null; }
}
