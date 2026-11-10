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
    if (bld.inBuilding(x, z) || roadInfo.onRoad(x, z) || roadInfo.underDeck(x, z, -1e3) > 0) return; // tabliye altına ağaç yok (tepesi yolu deler)
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

  // boş parsellerin "ot" hücreleri (zemin gölgelendiricisiyle aynı ızgara): seyrek ağaç
  for (let iz = -19; iz <= 19; iz++) {
    for (let ix = -19; ix <= 19; ix++) {
      const ty = (((ix * 3 + iz * 5) % 7) + 7) % 7;
      if (ty !== 3 && ty !== 4) continue;
      for (let k = 0; k < 14; k++) {
        const x = ix * 48 + rng() * 48;
        const z = iz * 48 + rng() * 48;
        const ok = rng() < 0.75;
        if (!ok || bld.inBuilding(x + 3, z) || bld.inBuilding(x - 3, z) || bld.inBuilding(x, z + 3) || bld.inBuilding(x, z - 3)) continue;
        add(x, z, false);
      }
    }
  }

  // taç: üç yumuşak kürenin birleşimi (köşeli tek top yerine öbekli siluet); normal = küre merkezinden dışarı
  const jr = ctx.rng('city/tree-shape');
  const BLOBS = [[0, 0, 0, 1.0], [0.52, 0.18, 0.22, 0.74], [-0.44, 0.26, -0.36, 0.68], [0.05, 0.5, -0.1, 0.6]];
  const gp = [];
  const gn = [];
  const gc = [];
  for (const [bx, by, bz, br] of BLOBS) {
    const ico = new THREE.IcosahedronGeometry(1, 1);
    const ip = ico.attributes.position;
    const seen = new Map();
    for (let i = 0; i < ip.count; i++) {
      const x = ip.getX(i);
      const y = ip.getY(i);
      const z = ip.getZ(i);
      const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      let k = seen.get(key);
      if (k === undefined) {
        k = 0.92 + jr() * 0.16;
        seen.set(key, k);
      }
      const px = bx + x * br * k;
      const py = by + y * br * k;
      const pz = bz + z * br * k;
      gp.push(px, py, pz);
      // normal: küre yönü ile taç merkezinden dışarı yönün karışımı → öbekler arası yumuşak geçiş
      const ol = Math.hypot(px, py, pz) || 1;
      let nx = x * 0.55 + (px / ol) * 0.45;
      let ny = y * 0.55 + (py / ol) * 0.45;
      let nz = z * 0.55 + (pz / ol) * 0.45;
      const nl = Math.hypot(nx, ny, nz) || 1;
      gn.push(nx / nl, ny / nl, nz / nl);
      const sh = 0.68 + 0.32 * Math.min(1, Math.max(0, py * 0.55 + 0.5));
      gc.push(sh, sh, sh);
    }
    ico.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(gn, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true });
  // gölgede tam siyaha düşmesin: yaprak geçirgenliği niyetine küçük bir taban ton + normalde sarma
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = ctx.uniforms.uNight;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * mix(0.2, 0.05, uNight);');
  };
  mat.customProgramCacheKey = () => 'city-tree-v2';
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
