// Az sayıdaki yeşil: OSM ağaçları + park çokgenlerine ve mezarlık boşluğuna prosedürel ekim. Tek InstancedMesh.
import { lin, pointInRing, ringArea } from './util.js';

const GREENS = [0x3b4f2e, 0x455834, 0x34482c, 0x4d5c38, 0x2e4129, 0x414f33].map(lin);
const CYPRESS = [0x22382a, 0x1d3125, 0x283f2c].map(lin);
const DENS = { park: 1 / 70, wood: 1 / 38, garden: 1 / 80, grass: 1 / 260, playground: 1 / 220, dog_park: 1 / 200 };

export function buildTrees(ctx, ground, bld, roadInfo, group) {
  const { THREE, data } = ctx;
  const rng = ctx.rng('city/trees');
  const pois = data.pois || {};
  const T = []; // [x, z, r, sy, col]
  const add = (x, z, cyp) => {
    if (bld.inBuilding(x, z) || roadInfo.onRoad(x, z)) return;
    const r = cyp ? 1.0 + rng() * 0.6 : 1.9 + rng() * 1.7;
    const sy = cyp ? 4.0 + rng() * 2.4 : 0.95 + rng() * 0.5;
    const pal = cyp ? CYPRESS : GREENS;
    const c = pal[Math.floor(rng() * pal.length)];
    const k = 0.75 + rng() * 0.5;
    T.push([x, z, r, sy, [c[0] * k, c[1] * k, c[2] * k]]);
  };
  for (const p of pois.trees || []) add(p[0], p[1], false);
  for (const g of pois.greens || []) {
    const d = DENS[g.kind];
    if (!d || !g.ring || g.ring.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of g.ring) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[1]);
      z1 = Math.max(z1, p[1]);
    }
    const n = Math.min(400, Math.ceil(Math.abs(ringArea(g.ring)) * d));
    const tries = Math.ceil((n * (x1 - x0) * (z1 - z0)) / Math.max(1, Math.abs(ringArea(g.ring))));
    for (let i = 0; i < tries; i++) {
      const x = x0 + rng() * (x1 - x0);
      const z = z0 + rng() * (z1 - z0);
      if (pointInRing(x, z, g.ring)) add(x, z, false);
    }
  }
  // orijinin GB'sındaki boşluk (veri notları: büyük olasılıkla mezarlık) — servi ağırlıklı
  for (let i = 0; i < 1500; i++) {
    const x = -340 + rng() * 475;
    const z = 75 + rng() * 315;
    const cyp = rng() < 0.55;
    add(x, z, cyp);
  }

  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position;
  const jr = ctx.rng('city/tree-shape');
  // aynı konumdaki köşeler aynı kaysın (düz gölgeli ikosahedronda köşeler çoğaltılmış)
  const seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let s = seen.get(key);
    if (s === undefined) {
      s = 0.78 + jr() * 0.44;
      seen.set(key, s);
    }
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
  }
  // yumuşak normal (yön = konum) + alttan üste koyulaşma
  const nn = geo.attributes.normal;
  const cc = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const l = Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) || 1;
    nn.setXYZ(i, p.getX(i) / l, p.getY(i) / l, p.getZ(i) / l);
    const k = 0.5 + 0.5 * Math.min(1, Math.max(0, p.getY(i) * 0.6 + 0.55));
    cc[i * 3] = k; cc[i * 3 + 1] = k; cc[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, T.length));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  T.forEach((t, i) => {
    const gy = ground.gY(t[0], t[1]);
    e.set(0, rng() * 6.28, 0);
    q.setFromEuler(e);
    s.set(t[2], t[2] * t[3], t[2]);
    v.set(t[0], gy + 1.0 + t[2] * t[3] * 0.85, t[1]);
    m4.compose(v, q, s);
    mesh.setMatrixAt(i, m4);
    c.setRGB(t[4][0], t[4][1], t[4][2]);
    mesh.setColorAt(i, c);
  });
  mesh.count = T.length;
  mesh.name = 'city-trees';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  return { count: T.length };
}
