// Çatı kalabalığı (merdiven kovaları, su depoları, güneş enerjili termosifonlar, klima), ağaçlar, cami kubbe + minareleri.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lin, pip } from './util.js';

function colorize(g, rgb) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = rgb[0]; c[i * 3 + 1] = rgb[1]; c[i * 3 + 2] = rgb[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  return g;
}

export function buildProps(ctx, U, footprints, isInside) {
  const group = new THREE.Group(); group.name = 'city-props';
  const boxes = [], tanks = [], solars = [];
  for (const f of footprints) {
    if (!f.flat || f.cat > 2 || f.area < 35 || f.H < 5) continue;
    const r = ctx.rng('city/roof/' + f.id);
    // ana kenar yönü
    let best = 0, ang = 0;
    for (let i = 0; i < f.pts.length; i++) {
      const p = f.pts[i], q = f.pts[(i + 1) % f.pts.length];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (l > best) { best = l; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); }
    }
    const [x0, z0, x1, z1] = f.bbox;
    const spot = (m) => {
      for (let t = 0; t < 14; t++) {
        const x = x0 + m + r() * Math.max(0.1, x1 - x0 - 2 * m), z = z0 + m + r() * Math.max(0.1, z1 - z0 - 2 * m);
        if (pip(x, z, f.pts) && pip(x + m, z, f.pts) && pip(x - m, z, f.pts) && pip(x, z + m, f.pts) && pip(x, z - m, f.pts)) return [x, z];
      }
      return null;
    };
    const y = f.roofY;
    if (f.cat === 2) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const sx = 3 + r() * 6, sz = 3 + r() * 5, p = spot(Math.max(sx, sz) * 0.6);
        if (p) boxes.push({ x: p[0], y, z: p[1], sx, sy: 2.5 + r() * 2.5, sz, rot: -ang, col: lin(r() < 0.5 ? '8d8f90' : 'a9a9a6') });
      }
      continue;
    }
    if (r() < 0.78) {
      const sx = 2.4 + r() * 1.2, sz = 3 + r() * 1.8, p = spot(2.4);
      if (p) boxes.push({ x: p[0], y, z: p[1], sx, sy: 2.5 + r() * 0.5, sz, rot: -ang, col: f.fc.map((v) => v * (0.85 + r() * 0.1)) });
    }
    const nt = r() < 0.7 ? 1 + Math.floor(r() * 3) : 0;
    for (let i = 0; i < nt; i++) {
      const p = spot(1.2);
      if (p) tanks.push({ x: p[0], y, z: p[1], s: 0.8 + r() * 0.5, h: 1 + r() * 0.6, col: lin(['e9e7e0', '2b2c2e', '3d5f8f', 'c9c3b5'][Math.floor(r() * 4)]) });
    }
    if (r() < 0.38) {
      const ns = 1 + Math.floor(r() * Math.min(5, f.area / 60));
      for (let i = 0; i < ns; i++) { const p = spot(1.6); if (p) solars.push({ x: p[0], y, z: p[1], rot: (r() - 0.5) * 0.4 }); }
    }
    const na = Math.floor(r() * 3);
    for (let i = 0; i < na; i++) { const p = spot(0.8); if (p) boxes.push({ x: p[0], y, z: p[1], sx: 0.9, sy: 0.65, sz: 0.4, rot: -ang + (r() < 0.5 ? 0 : Math.PI / 2), col: lin('d8d6d0') }); }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
  // kutular
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); boxGeo.deleteAttribute('uv');
  const boxCol = new Float32Array(boxGeo.attributes.position.count * 3).fill(1);
  boxGeo.setAttribute('color', new THREE.BufferAttribute(boxCol, 3));
  const bm = new THREE.InstancedMesh(boxGeo, mat, Math.max(1, boxes.length));
  bm.count = boxes.length; bm.name = 'city-roof-boxes'; bm.castShadow = true; bm.receiveShadow = true;
  boxes.forEach((b, i) => { q.setFromAxisAngle(Y, b.rot); m4.compose(v.set(b.x, b.y, b.z), q, s.set(b.sx, b.sy, b.sz)); bm.setMatrixAt(i, m4); bm.setColorAt(i, c.setRGB(b.col[0], b.col[1], b.col[2])); });
  // su depoları
  const tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).translate(0, 0.5, 0); tankGeo.deleteAttribute('uv');
  tankGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tankGeo.attributes.position.count * 3).fill(1), 3));
  const tm = new THREE.InstancedMesh(tankGeo, mat, Math.max(1, tanks.length));
  tm.count = tanks.length; tm.name = 'city-roof-tanks'; tm.castShadow = true; tm.receiveShadow = true;
  tanks.forEach((b, i) => { m4.compose(v.set(b.x, b.y, b.z), q.identity(), s.set(b.s, b.h, b.s)); tm.setMatrixAt(i, m4); tm.setColorAt(i, c.setRGB(b.col[0], b.col[1], b.col[2])); });
  // termosifon: güneye (+z) eğik panel + yatay depo
  const panel = colorize(new THREE.BoxGeometry(1.0, 0.06, 2.0).rotateX(-0.75).translate(0, 0.75, 0.1), lin('1d2a3d'));
  const tankH = colorize(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 8).rotateZ(Math.PI / 2).translate(0, 1.45, -0.75), lin('dcdcd6'));
  const legs = colorize(new THREE.BoxGeometry(0.9, 1.3, 0.08).translate(0, 0.65, -0.75), lin('7d7f80'));
  const solarGeo = mergeGeometries([panel, tankH, legs]);
  const sm = new THREE.InstancedMesh(solarGeo, mat, Math.max(1, solars.length));
  sm.count = solars.length; sm.name = 'city-roof-solar'; sm.castShadow = true; sm.receiveShadow = true;
  solars.forEach((b, i) => { q.setFromAxisAngle(Y, b.rot); m4.compose(v.set(b.x, b.y, b.z), q, s.set(1, 1, 1)); sm.setMatrixAt(i, m4); sm.setColorAt(i, c.setRGB(1, 1, 1)); });
  for (const im of [bm, tm, sm]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); group.add(im); }

  // ağaçlar
  const trees = [];
  const tr = ctx.rng('city/trees');
  for (const p of ctx.data.points?.points || []) {
    if (p.kind !== 'tree' || !Number.isFinite(p.x)) continue;
    if (isInside(p.x, p.z, 0.5)) continue;
    trees.push({ x: p.x, z: p.z, y: ctx.heightAt(p.x, p.z), h: 5 + tr() * 6, w: 2.2 + tr() * 2.2, col: lin(['3f5a2a', '4a6630', '36512a', '56703a', '425f34'][Math.floor(tr() * 5)], 0.9 + tr() * 0.2) });
  }
  const trunk = colorize(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6).translate(0, 0.25, 0), [0.28, 0.2, 0.14]);
  const crown = colorize(new THREE.IcosahedronGeometry(0.5, 1).scale(1, 0.85, 1).translate(0, 0.66, 0), [1, 1, 1]);
  const treeGeo = mergeGeometries([trunk, crown]);
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const tmesh = new THREE.InstancedMesh(treeGeo, treeMat, Math.max(1, trees.length));
  tmesh.count = trees.length; tmesh.name = 'city-trees'; tmesh.castShadow = true; tmesh.receiveShadow = true;
  trees.forEach((t, i) => { q.setFromAxisAngle(Y, tr() * 6.28); m4.compose(v.set(t.x, t.y, t.z), q, s.set(t.w * 2, t.h, t.w * 2)); tmesh.setMatrixAt(i, m4); tmesh.setColorAt(i, c.setRGB(t.col[0], t.col[1], t.col[2])); });
  tmesh.instanceMatrix.needsUpdate = true; if (tmesh.instanceColor) tmesh.instanceColor.needsUpdate = true; tmesh.computeBoundingSphere();
  group.add(tmesh);

  // camiler: kubbe + minare
  const parts = [];
  const stone = lin('e6e0d2'), lead = lin('7d858b');
  for (const f of footprints) {
    if (!/mosque/.test(f.kind) || f.area < 80) continue;
    const rad = Math.min(11, 0.3 * Math.sqrt(f.area));
    parts.push(colorize(new THREE.CylinderGeometry(rad * 1.02, rad * 1.02, rad * 0.25, 20).translate(f.cx, f.top + rad * 0.125, f.cz), stone));
    parts.push(colorize(new THREE.SphereGeometry(rad, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(f.cx, f.top + rad * 0.25, f.cz), lead));
    // minare: izin bir köşesinin 2 m içine
    let far = f.pts[0], fd = 0;
    for (const p of f.pts) { const d = Math.hypot(p[0] - f.cx, p[1] - f.cz); if (d > fd) { fd = d; far = p; } }
    const k = Math.max(0, (fd - 2.5) / fd);
    const mx = f.cx + (far[0] - f.cx) * k, mz = f.cz + (far[1] - f.cz) * k;
    const mh = Math.max(28, f.H + 22), by = f.baseY;
    parts.push(colorize(new THREE.CylinderGeometry(1.1, 1.3, mh, 12).translate(mx, by + mh / 2, mz), stone));
    parts.push(colorize(new THREE.CylinderGeometry(1.75, 1.6, 0.7, 12).translate(mx, by + mh * 0.78, mz), stone));
    parts.push(colorize(new THREE.ConeGeometry(1.2, 6.5, 12).translate(mx, by + mh + 3.25, mz), lead));
  }
  let mosqueMat = null;
  if (parts.length) {
    mosqueMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, emissive: 0x000000 });
    const mm = new THREE.Mesh(mergeGeometries(parts), mosqueMat);
    mm.name = 'city-mosques'; mm.castShadow = true; mm.receiveShadow = true;
    group.add(mm);
  }
  return {
    group, counts: { boxes: boxes.length, tanks: tanks.length, solars: solars.length, trees: trees.length },
    update(state) {
      if (mosqueMat) mosqueMat.emissive.setRGB(1.0, 0.82, 0.6).multiplyScalar(0.45 * Math.min(1, state.lightsOn * 2.5));
    },
  };
}
