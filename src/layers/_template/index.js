import * as THREE from 'three';
/**
 * Template for a new utility layer (e.g. garbage collection, power, gas).
 * Copy this folder, register the layer in src/main.js, and add data under public/data/.
 * Contract: see src/layers/registry.js. Scenario/model contract: see src/core/sim.js and src/layers/water/model.js.
 */
export const templateLayer = {
  id: 'template', name: 'Nova camada (exemplo)', color: '#ffcc00', defaultVisible: false,
  description: 'Exemplo mínimo: um marcador. Substitua por seus dados.',
  async init(ctx) {
    this.group = new THREE.Group(); ctx.app.scene.add(this.group);
    const m = new THREE.Mesh(new THREE.SphereGeometry(60), new THREE.MeshLambertMaterial({ color: this.color }));
    m.position.copy(ctx.app.pos(-48.55, -27.59, 60)); m.userData = { type: 'template' }; this.group.add(m); ctx.app.pickables.push(m);
  },
  setVisible(v) { this.group.visible = v; },
  pick(hit) { return hit.object.userData.type === 'template' ? { kind: 'template', html: '<h3>Exemplo</h3><div class="note">Objeto da camada-modelo.</div>', pos: hit.point } : null; },
  // scenarios: [...], model: {...}, renderPanel(el, ctx) {...}, onFrame(dt) {...}
};
