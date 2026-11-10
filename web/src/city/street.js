// Sokak hayatı: otobüs durakları, yaya kalabalığı (tek instanced ağ, yürüyüş köşe gölgelendiricisinde,
// yalnız uTime'ın saf fonksiyonu), dükkân tabelaları.
import { GeoBuilder, lin, rightNormals, pointInRing, ringArea, segDist, h1 } from './util.js';
import { TILES } from './decals.js';

const C_STEEL = lin(0x3c4248);
const C_ROOF = lin(0x8f989c);
const C_GLASS = [0.07, 0.1, 0.11];
const C_BENCH = lin(0x6b4a2e);
const CLOTHES = [0x1c1c20, 0x23304a, 0x55585c, 0xd8d6d0, 0xb9a88a, 0x8e1f1c, 0x4a5a3a, 0x3c5f8f, 0xc79a1e, 0x6a2f4a, 0x2f2f33, 0x7a7d82, 0xe8e6e0, 0x1e3a34].map(lin);

export function buildStreet(ctx, net, ground, bld, roadInfo, decals, group, verdict) {
  const { THREE, data } = ctx;
  const rng = ctx.rng('city/street');
  const pois = data.pois || {};
  const gb = new GeoBuilder();
  const P = []; // yayalar: [x,y,z, dx,dz, len, speed, phase, dy, scale, colIdx]

  const person = (x, z, dx, dz, len, speed) => {
    const y0 = ground.gY(x, z);
    const y1 = ground.gY(x + dx * len, z + dz * len);
    P.push([x, y0 + 0.16, z, dx, dz, Math.max(len, 0.01), speed, rng() * 40, y1 - y0, 0.92 + rng() * 0.16, Math.floor(rng() * CLOTHES.length), rng()]);
  };

  // ---- otobüs durakları -------------------------------------------------------------------
  const vroads = net.roads.filter((r) => r.veh && !r.bridge && !r.ext && r.type !== 3 && r.type !== 0);
  const o = { t: 0 };
  let nShelter = 0;
  (pois.busStops || []).forEach((s, si) => {
    if (s.metrobus) return;
    let best = 30;
    let hit = null;
    for (const r of vroads) {
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i];
        const b = r.pts[i + 1];
        const d = segDist(s.x, s.z, a[0], a[2], b[0], b[2], o);
        if (d < best) {
          best = d;
          hit = { r, a, b, t: o.t };
        }
      }
    }
    if (!hit) return;
    const { r, a, b, t } = hit;
    const l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const dx = (b[0] - a[0]) / l;
    const dz = (b[2] - a[2]) / l;
    const px = a[0] + (b[0] - a[0]) * t;
    const pz = a[2] + (b[2] - a[2]) * t;
    let sd = (s.x - px) * -dz + (s.z - pz) * dx >= 0 ? 1 : -1; // sağ taraf +1
    if (r.oneway) sd = 1;
    const nx = -dz * sd;
    const nz = dx * sd;
    const cx = px + nx * (r.width / 2 + 1.9);
    const cz = pz + nz * (r.width / 2 + 1.9);
    if (bld.inBuilding(cx, cz) || roadInfo.onCarriageway(cx, cz)) return;
    const y = ground.gY(cx, cz) + 0.12;
    const ang = Math.atan2(dz, dx);
    nShelter++;
    // çatı, arka cam, direkler, bank
    gb.box(cx, y + 2.45, cz, 2.1, 0.1, 0.8, ang, C_ROOF, [0, 0, 0, 0], true, true);
    gb.box(cx + nx * 0.7, y + 0.35, cz + nz * 0.7, 2.0, 1.95, 0.03, ang, C_GLASS);
    for (const e of [-2, 0, 2]) gb.box(cx + dx * e + nx * 0.72, y, cz + dz * e + nz * 0.72, 0.05, 2.45, 0.05, ang, C_STEEL);
    gb.box(cx + nx * 0.4, y + 0.42, cz + nz * 0.4, 1.3, 0.07, 0.2, ang, C_BENCH, [0, 0, 0, 0], true, true);
    // ışıklı reklam panosu (uçta, yola dik)
    const ex = cx + dx * 2.15;
    const ez = cz + dz * 2.15;
    gb.box(ex, y + 0.25, ez, 0.07, 2.1, 0.62, ang, C_STEEL);
    for (const f of [1, -1]) decals.add(TILES.ad(si + (f > 0 ? 0 : 1)), [ex + dx * 0.07 * f, y + 1.3, ez + dz * 0.07 * f], [dz * 0.55 * f, 0, -dx * 0.55 * f], [0, 0.95, 0], [dx * f, 0, dz * f], 0.02 + 0.1 * h1(si, 3));
    // durak levhası
    const sx = cx - dx * 2.5 - nx * 0.6;
    const sz = cz - dz * 2.5 - nz * 0.6;
    gb.box(sx, y, sz, 0.035, 2.9, 0.035, ang, C_STEEL);
    const tl = si % 6 === 0 ? TILES.taxi : si % 5 === 0 ? TILES.dolmus : si % 3 === 0 ? TILES.iett : TILES.stop;
    decals.add(tl, [sx, y + 2.6, sz], [dx * 0.32 * sd, 0, dz * 0.32 * sd], [0, 0.32, 0], [nx, 0, nz], -1, true);
    // bekleyenler
    const k = 4 + Math.floor(rng() * 9);
    for (let j = 0; j < k; j++) {
      const u = (rng() - 0.5) * 5.5;
      const w = -1.6 + rng() * 2.0;
      const fa = rng() * 6.28;
      person(cx + dx * u + nx * w, cz + dz * u + nz * w, Math.cos(fa), Math.sin(fa), 0.01, 0);
    }
  });

  // ---- kaldırımlarda yürüyenler ----------------------------------------------------------
  const HOT = [480, 20]; // viyadük altı / meydan: en kalabalık
  for (const r of net.roads) {
    if (r.bridge || r.ext || r.type === 0 || r.type === 3 || r.type === 5) continue;
    if (!r.veh && r.cls !== 'pedestrian' && r.cls !== 'footway') continue;
    const rn = rightNormals(r.pts);
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (l < 1) continue;
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[2] + b[2]) / 2;
      const dh = Math.hypot(mx - HOT[0], (mz - HOT[1]) * 1.6);
      if (Math.hypot(mx, mz) > 900 && dh > 900) continue;
      const near = dh < 420 ? 1 : dh < 700 ? 0.4 : 0.14;
      const base = r.cls === 'pedestrian' ? 0.2 : r.cls === 'footway' ? 0.03 : r.type === 1 ? 0.2 : 0.045;
      let cnt = l * base * near;
      cnt = Math.floor(cnt) + (rng() < cnt % 1 ? 1 : 0);
      const dx = (b[0] - a[0]) / l;
      const dz = (b[2] - a[2]) / l;
      for (let k = 0; k < cnt; k++) {
        const t = rng();
        const sd = rng() < 0.5 ? 1 : -1;
        const off = r.veh ? r.width / 2 + 0.7 + rng() * 1.5 : (rng() - 0.5) * r.width * 0.8;
        const rev = rng() < 0.5 ? 1 : -1;
        const len = 8 + rng() * 26;
        const sp = rng() < 0.12 ? 0 : 0.9 + rng() * 0.7;
        const x = a[0] + (b[0] - a[0]) * t + rn[i][0] * sd * off;
        const z = a[2] + (b[2] - a[2]) * t + rn[i][1] * sd * off;
        if (bld.inBuilding(x, z) || (r.veh ? roadInfo.onCarriageway(x, z) : false)) continue;
        const ex = x + dx * rev * len;
        const ez = z + dz * rev * len;
        if (sp > 0 && (bld.inBuilding(ex, ez) || roadInfo.onCarriageway(ex, ez) || bld.inBuilding((x + ex) / 2, (z + ez) / 2) || roadInfo.onCarriageway((x + ex) / 2, (z + ez) / 2))) {
          person(x, z, dx * rev, dz * rev, 0.01, 0);
          continue;
        }
        person(x, z, dx * rev, dz * rev, sp > 0 ? len : 0.01, sp);
      }
    }
  }
  // meydanlar
  for (const s of pois.squares || []) {
    if (!s.ring || s.ring.length < 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of s.ring) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[1]);
      z1 = Math.max(z1, p[1]);
    }
    const n = Math.min(260, Math.floor(Math.abs(ringArea(s.ring)) / 28));
    for (let k = 0; k < n * 2; k++) {
      const x = x0 + rng() * (x1 - x0);
      const z = z0 + rng() * (z1 - z0);
      const fa = rng() * 6.28;
      const len = 6 + rng() * 14;
      const sp = rng() < 0.3 ? 0 : 0.8 + rng() * 0.7;
      if (!pointInRing(x, z, s.ring) || bld.inBuilding(x, z) || roadInfo.onCarriageway(x, z)) continue;
      const ex = x + Math.cos(fa) * len;
      const ez = z + Math.sin(fa) * len;
      const ok = sp > 0 && pointInRing(ex, ez, s.ring) && !bld.inBuilding(ex, ez) && !roadInfo.onCarriageway(ex, ez);
      person(x, z, Math.cos(fa), Math.sin(fa), ok ? len : 0.01, ok ? sp : 0);
    }
  }

  // ---- dükkân tabelaları (cadde cepheleri) -----------------------------------------------
  let nSign = 0;
  (data.buildings || []).forEach((b, bi) => {
    if (b.landmark || !b.ring || b.ring.length < 3 || b.height < 8 || b.part || (verdict && verdict.has(b))) return;
    const c0 = b.ring[0];
    if (Math.hypot(c0[0] - 300, c0[1]) > 800) return;
    let ring = b.ring;
    if (ringArea(ring) < 0) ring = ring.slice().reverse();
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % n];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 5) continue;
      const dx = (c[0] - a[0]) / len;
      const dz = (c[1] - a[1]) / len;
      const nx = dz;
      const nz = -dx;
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[1] + c[1]) / 2;
      if (!(roadInfo.onRoad(mx + nx * 4, mz + nz * 4) || roadInfo.onRoad(mx + nx * 8, mz + nz * 8))) continue;
      if (bld.inBuilding(mx + nx * 1.5, mz + nz * 1.5)) continue;
      const gy = ground.gY(mx + nx, mz + nz);
      const k = Math.max(1, Math.floor(len / 5.5));
      for (let j = 0; j < k; j++) {
        const hsh = h1(bi, i * 13 + j, 21);
        if (hsh < 0.45) continue;
        const u = ((j + 0.5) / k - 0.5) * len;
        const x = mx + dx * u;
        const z = mz + dz * u;
        const tile = TILES.shop(Math.floor(h1(bi, i * 13 + j, 22) * 16));
        const th = 0.02 + 0.3 * h1(bi, i * 13 + j, 23);
        if (hsh > 0.8) {
          // cepheye dik, çift yüzlü asma tabela
          decals.add(tile, [x + nx * 0.75, gy + 3.5, z + nz * 0.75], [nx * 0.62, 0, nz * 0.62], [0, 0.62, 0], [dx, 0, dz], th, true);
        } else {
          // cepheye yapışık alınlık tabelası
          decals.add(tile, [x + nx * 0.06, gy + 3.25, z + nz * 0.06], [-dx * 1.25, 0, -dz * 1.25], [0, 1.25, 0], [nx, 0, nz], th);
        }
        nSign++;
      }
    }
  });

  // ---- ağlar -----------------------------------------------------------------------------
  if (gb.count) {
    const m = new THREE.Mesh(gb.build(THREE, { uvw: false, info: false }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2, envMapIntensity: 0.5 }));
    m.name = 'city-shelters';
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const people = buildPeople(ctx, P, roadInfo, group);
  return { people: P.length, shelters: nShelter, signs: nSign, mesh: people };
}

// ---- insan figürü: +x ileri, y yukarı ---------------------------------------------------------
function figureGeometry(THREE) {
  const pos = [];
  const nrm = [];
  const part = [];
  const idx = [];
  let base = 0;
  const addGeo = (g, pt) => {
    const p = g.attributes.position;
    const nn = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nrm.push(nn.getX(i), nn.getY(i), nn.getZ(i));
      part.push(pt);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
    g.dispose();
  };
  const box = (sx, sy, sz, x, y, z, pt) => {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(x, y, z);
    addGeo(g, pt);
  };
  // 0 ten, 1 gövde, 2 sol bacak, 3 sağ bacak, 4 sol kol, 5 sağ kol, 6 saç
  box(0.17, 0.84, 0.15, 0, 0.42, -0.09, 2);
  box(0.17, 0.84, 0.15, 0, 0.42, 0.09, 3);
  box(0.24, 0.62, 0.4, 0, 1.14, 0, 1);
  box(0.12, 0.6, 0.1, 0, 1.12, -0.26, 4);
  box(0.12, 0.6, 0.1, 0, 1.12, 0.26, 5);
  box(0.1, 0.08, 0.1, 0, 1.48, 0, 0);
  const head = new THREE.IcosahedronGeometry(0.115, 1);
  head.translate(0.01, 1.62, 0);
  addGeo(head, 0);
  const hair = new THREE.SphereGeometry(0.122, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hair.translate(-0.012, 1.63, 0);
  addGeo(hair, 6);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  return g;
}

function buildPeople(ctx, P, roadInfo, group) {
  const { THREE } = ctx;
  const n = P.length;
  if (!n) return null;
  const g = figureGeometry(THREE);
  const iA = new Float32Array(n * 4);
  const iB = new Float32Array(n * 4);
  const iC = new Float32Array(n * 4);
  const iCol = new Float32Array(n * 3);
  P.forEach((p, i) => {
    iA.set([p[0], p[1], p[2], p[7]], i * 4);
    iB.set([p[3], p[4], p[5], p[6]], i * 4);
    iC.set([p[8], p[9], p[11], roadInfo.underDeck(p[0], p[2], p[1])], i * 4);
    iCol.set(CLOTHES[p[10]], i * 3);
  });
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(iA, 4));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(iB, 4));
  g.setAttribute('iC', new THREE.InstancedBufferAttribute(iC, 4));
  g.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  g.instanceCount = n;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, envMapIntensity: 0.5 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = ctx.uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec3 iCol; attribute float aPart;
        uniform float uTime;
        varying vec3 vPCol; varying float vPAo;
        vec2 cPD; float cPS; float cPLen;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        {
          cPLen = max(iB.z, 0.01);
          float u = mod(iA.w + iB.w * uTime, 2.0 * cPLen);
          float sgn = u < cPLen ? 1.0 : -1.0;
          cPS = u < cPLen ? u : 2.0 * cPLen - u;
          cPD = iB.xy * sgn;
          objectNormal = vec3(cPD.x * objectNormal.x - cPD.y * objectNormal.z, objectNormal.y, cPD.y * objectNormal.x + cPD.x * objectNormal.z);
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float walk = step(0.01, iB.w);
          float ph = (iA.w + iB.w * uTime) * 4.2;
          float sw = sin(ph) * walk;
          vec3 p = transformed * iC.y;
          float legK = clamp(1.0 - p.y / (0.85 * iC.y), 0.0, 1.0);
          if (aPart > 1.5 && aPart < 2.5) p.x += sw * 0.3 * legK;
          if (aPart > 2.5 && aPart < 3.5) p.x -= sw * 0.3 * legK;
          float armK = clamp((1.42 * iC.y - p.y) / (0.6 * iC.y), 0.0, 1.0);
          if (aPart > 3.5 && aPart < 4.5) p.x -= sw * 0.22 * armK;
          if (aPart > 4.5 && aPart < 5.5) p.x += sw * 0.22 * armK;
          p.y += abs(cos(ph)) * 0.025 * walk;
          vec3 w = vec3(iA.x + iB.x * cPS, iA.y + iC.x * (cPS / cPLen), iA.z + iB.y * cPS);
          transformed = w + vec3(cPD.x * p.x - cPD.y * p.z, p.y, cPD.y * p.x + cPD.x * p.z);
          float hsh = fract(iC.z * 7.31);
          vec3 leg = mix(vec3(0.03, 0.035, 0.05), vec3(0.07, 0.11, 0.2), step(0.5, hsh));
          vec3 skin = mix(vec3(0.62, 0.43, 0.32), vec3(0.42, 0.27, 0.19), fract(iC.z * 3.7));
          vec3 hairC = mix(vec3(0.03, 0.025, 0.02), vec3(0.2, 0.13, 0.07), step(0.8, fract(iC.z * 13.1)));
          vPCol = aPart < 0.5 ? skin : (aPart > 5.5 ? hairC : ((aPart > 1.5 && aPart < 3.5) ? leg : iCol));
          vPAo = iC.w;
        }`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPCol; varying float vPAo;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vPCol;')
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.68, vPAo); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }');
  };
  mat.customProgramCacheKey = () => 'city-people-v2';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'city-people';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
