import * as THREE from 'three';
import { toXZ, mercY } from './geo.js';

/**
 * Terrain: coarse regional mesh (with a hole) + fine core mesh, both textured with the same web-mercator basemap.
 * Basemaps: 'satellite' (Esri World Imagery), 'hypso' (elevation colours), 'landcover' (ESA WorldCover, if available).
 */
export function buildTerrain(app, opts = {}) {
  const dem = app.dem; const outerStep = opts.outerStep || (app.lowPower ? 4 : 2); const coreStep = opts.coreStep || (app.lowPower ? 2 : 1);
  const group = new THREE.Group(); group.name = 'terrainGroup';
  const meshes = [];
  const core = dem.core;
  const inCore = (lon, lat) => core && core.contains(lon, lat);
  function buildMesh(grid, step, skipFn) {
    const W = Math.floor(grid.w / step), H = Math.floor(grid.h / step);
    const pos = new Float32Array(W * H * 3), col = new Float32Array(W * H * 3), uv = new Float32Array(W * H * 2);
    const skip = new Uint8Array(W * H);
    const c = new THREE.Color();
    const palette = [[-3, 0x173f6a], [0.2, 0x1c5a8a], [0.3, 0xd9cfa5], [3, 0xa9c477], [40, 0x7aa356], [150, 0x64874a], [350, 0x857f5b], [700, 0xa39f8e], [1300, 0xe0e0e0]];
    const colorFor = (h) => { for (let i = 1; i < palette.length; i++) if (h <= palette[i][0]) { const a = palette[i - 1], b = palette[i]; return c.setHex(a[1]).lerp(new THREE.Color(b[1]), Math.max(0, Math.min(1, (h - a[0]) / (b[0] - a[0])))); } return c.setHex(palette[palette.length - 1][1]); };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const gx = i * step, gy = j * step; const h = grid.at(gx, gy); const ll = grid.lonLatOfGrid(gx, gy); const { x, z } = toXZ(ll.lon, ll.lat);
      const k = (j * W + i); pos[k * 3] = x; pos[k * 3 + 1] = Math.max(h, -2) * app.exag; pos[k * 3 + 2] = z;
      const cc = colorFor(h); col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
      uv[k * 2] = ll.lon; uv[k * 2 + 1] = mercY(ll.lat); // lon / mercator-y; remapped per basemap in the shader via uniforms
      if (skipFn && skipFn(ll.lon, ll.lat)) skip[k] = 1;
    }
    const idx = []; for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, d = a + W, e = d + 1; if (skip[a] && skip[b] && skip[d] && skip[e]) continue; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const mat = makeTerrainMaterial();
  const outerGeo = buildMesh(dem.outer, outerStep, core ? (lon, lat) => inCore(lon, lat) : null);
  const outer = new THREE.Mesh(outerGeo, mat); outer.name = 'terrain'; outer.userData.kind = 'terrain'; group.add(outer); meshes.push(outer);
  if (core) { const cm = new THREE.Mesh(buildMesh(core, coreStep, null), mat); cm.name = 'terrainCore'; cm.userData.kind = 'terrain'; group.add(cm); meshes.push(cm); }
  // far sea plane below the DEM (DEM itself carries the sea inside its bounds)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600000, 600000), new THREE.MeshLambertMaterial({ color: 0x173f6a }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -2.5 * app.exag; sea.name = 'sea'; group.add(sea);
  app.scene.add(group); app.pickables.push(...meshes);
  const api = {
    group, meshes, material: mat, mode: 'hypso',
    async setBasemap(mode) {
      api.mode = mode; const u = mat.uniforms;
      if (mode === 'hypso') { u.uMode.value = 0; return; }
      const key = mode === 'satellite' ? 'satellite' : 'landcover';
      if (!api[key]) {
        const meta = await (await fetch(`./data/${key}.json`)).json();
        const file = key === 'satellite' && app.lowPower ? 'satellite_lo.jpg' : key === 'satellite' ? 'satellite.jpg' : 'landcover.png';
        const tex = await new THREE.TextureLoader().loadAsync(`./data/${file}`);
        tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, app.renderer.capabilities.getMaxAnisotropy()); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; if (key === 'landcover') { tex.magFilter = THREE.NearestFilter; }
        api[key] = { tex, meta };
      }
      const { tex, meta } = api[key]; const b = meta.bounds;
      u.uMap.value = tex; u.uBounds.value.set(b.west, mercY(b.north), b.east - b.west, mercY(b.south) - mercY(b.north)); u.uMode.value = 1;
    }
  };
  return api;
}

function makeTerrainMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.uniforms = { uMap: { value: null }, uBounds: { value: new THREE.Vector4(0, 0, 1, 1) }, uMode: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGeo;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvGeo = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGeo; uniform sampler2D uMap; uniform vec4 uBounds; uniform int uMode;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (uMode == 1) { vec2 t = vec2((vGeo.x - uBounds.x) / uBounds.z, 1.0 - (vGeo.y - uBounds.y) / uBounds.w); if (t.x >= 0.0 && t.x <= 1.0 && t.y >= 0.0 && t.y <= 1.0) { vec4 s = texture2D(uMap, t); diffuseColor.rgb = s.rgb; } }`);
  };
  mat.customProgramCacheKey = () => 'terrain-basemap';
  return mat;
}
