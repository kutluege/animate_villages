// Sokak ayrıntısı: yürüyen yayalar (t'nin saf fonksiyonu, instanced, bacak salınımı şaderde),
// trafik ışıkları (çevrimli), otobüs durakları, büfeler, çöp kutuları, yaya korkulukları.
// Yoğunluk açılış kadrajı (viyadük altı / D100 koridoru) çevresinde yüksek, başka yerde seyrek.
import * as THREE from 'three';
import { Builder, lin, miterNormals } from './util.js';

const FOCUS = { x0: -150, x1: 720, z0: -170, z1: 110 };
const inFocus = (x, z, m = 0) => x > FOCUS.x0 - m && x < FOCUS.x1 + m && z > FOCUS.z0 - m && z < FOCUS.z1 + m;

function pathOf(pts, ys, off) {
  const nrm = miterNormals(pts), n = pts.length;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = pts[i][0] + nrm[i][0] * off; Z[i] = pts[i][1] + nrm[i][1] * off; Y[i] = ys[i];
    if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
  }
  return { X, Y, Z, S, L: S[n - 1] };
}
function sampleAt(P, s, out) {
  const S = P.S; let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const t = (s - S[lo]) / (S[hi] - S[lo] || 1);
  out[0] = P.X[lo] + (P.X[hi] - P.X[lo]) * t; out[1] = P.Y[lo] + (P.Y[hi] - P.Y[lo]) * t; out[2] = P.Z[lo] + (P.Z[hi] - P.Z[lo]) * t;
  out[3] = Math.atan2(P.X[hi] - P.X[lo], P.Z[hi] - P.Z[lo]);
  return out;
}

function personGeometry() {
  const b = new Builder({ aPart: 1, aSide: 1 });
  const box = (x0, y0, z0, x1, y1, z1, part, side) => {
    const F = [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]], [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]],
      [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]]];
    for (const [a, bb, c, d, n] of F) { const ids = [a, bb, c, d].map((p) => b.v(p[0], p[1], p[2], n[0], n[1], n[2], [1, 1, 1], { aPart: [part], aSide: [side] })); b.quad(ids[0], ids[1], ids[2], ids[3], n[0], n[1], n[2]); }
  };
  box(-0.19, 0.0, -0.09, -0.02, 0.86, 0.08, 1, -1);
  box(0.02, 0.0, -0.09, 0.19, 0.86, 0.08, 1, 1);
  box(-0.22, 0.84, -0.12, 0.22, 1.45, 0.12, 0, 0);
  box(-0.27, 0.9, -0.08, -0.22, 1.42, 0.07, 0, -1);
  box(0.22, 0.9, -0.08, 0.27, 1.42, 0.07, 0, 1);
  box(-0.1, 1.46, -0.1, 0.1, 1.7, 0.11, 2, 0);
  box(-0.11, 1.64, -0.11, 0.11, 1.74, 0.12, 3, 0);
  return b.geometry();
}
function personMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = U.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uT; attribute float aPart; attribute float aSide; attribute vec2 iWalk; flat varying float vPart; varying float vTone;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPart = floor(aPart + 0.5); vTone = fract(iWalk.x * 0.137);
{
  float ph = uT * 7.0 * iWalk.y + iWalk.x;
  float sw = sin(ph) * 0.42 * iWalk.y;
  if (aPart > 0.5 && aPart < 1.5) {
    // bacak: kalçadan (y=0.86) x ekseni etrafında salınım
    float a = aSide * sw, dy = transformed.y - 0.86;
    transformed.z = transformed.z * cos(a) - dy * sin(a);
    transformed.y = 0.86 + transformed.z * 0.0 + dy * cos(a);
  } else if (aPart < 0.5 && abs(aSide) > 0.5) {
    float a = -aSide * sw * 0.7, dy = transformed.y - 1.42;
    transformed.z = transformed.z * cos(a) - dy * sin(a);
    transformed.y = 1.42 + dy * cos(a);
  }
  transformed.y += abs(cos(ph)) * 0.035 * iWalk.y;
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
flat varying float vPart; varying float vTone;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  #if defined( USE_COLOR )
  vec3 cloth = vColor.rgb;
  #else
  vec3 cloth = vec3(0.3);
  #endif
  vec3 c = cloth;
  if (vPart > 0.5 && vPart < 1.5) c = mix(vec3(0.03, 0.035, 0.05), vec3(0.08, 0.09, 0.13), vTone);
  else if (vPart > 1.5 && vPart < 2.5) c = mix(vec3(0.42, 0.27, 0.18), vec3(0.62, 0.45, 0.33), vTone);
  else if (vPart > 2.5) c = mix(vec3(0.02, 0.015, 0.01), vec3(0.12, 0.08, 0.05), vTone);
  diffuseColor.rgb = c;
}`);
  };
  m.customProgramCacheKey = () => 'city-person-v1';
  return m;
}

const CLOTH = ['1c1d22', '2a2f3a', '3b3b3f', '5a4a3a', '7a1f22', '1f3e6b', 'b8b2a6', '2f4a36', '6b5a4a', 'c9c3b8', '141414', '8a6d3b'];

export function buildStreet(ctx, U, net, isInside) {
  const group = new THREE.Group(); group.name = 'city-street';
  const { heightAt } = ctx;
  const r = ctx.rng('city/street');
  // ── yaya yolları
  const paths = [];
  for (const rd of net.roads) {
    const mid = rd.pts[Math.floor(rd.pts.length / 2)];
    const foc = inFocus(mid[0], mid[1], 40);
    if (rd.inCemetery) continue;
    const ground = (i) => rd.elev[i] < 0.3;
    if (!rd.pts.every((_, i) => ground(i))) {
      // viyadük altı: köprünün iki yanında zemin hizasında yürüyüş çizgileri
      if (rd.bridge && foc) for (const off of [-(rd.halfW + 3), rd.halfW + 4.5]) {
        const ys = rd.pts.map((p, i) => heightAt(p[0] + rd.nrm[i][0] * off, p[1] + rd.nrm[i][1] * off) + 0.12);
        paths.push({ P: pathOf(rd.pts, ys, off), dens: 9, foc });
      }
      continue;
    }
    if (rd.cls === 'path' && (rd.kind === 'pedestrian' || rd.kind === 'footway')) paths.push({ P: pathOf(rd.pts, rd.y, 0), dens: foc ? 6 : 40, foc });
    else if (['primary', 'secondary', 'minor', 'link'].includes(rd.cls)) {
      const sw = rd.cls === 'minor' ? 1.0 : rd.cls === 'link' ? 0.8 : 1.7;
      for (const sd of [-1, 1]) {
        const ys = rd.y.map((y) => y - 0.1);
        paths.push({ own: rd, P: pathOf(rd.pts, ys, sd * (rd.halfW + sw)), dens: foc ? (rd.cls === 'minor' ? 14 : 6) : (rd.cls === 'minor' ? 90 : 45), foc });
      }
    }
  }
  // yol yüzeyine taşan kısımları ayıkla (yayalar araç şeridinde yürümesin)
  const vg = new Map();
  const gk = (x, z) => `${Math.floor(x / 10)},${Math.floor(z / 10)}`;
  for (const rd of net.roads) {
    if (rd.cls === 'path') continue;
    for (let i = 0; i < rd.pts.length; i++) {
      const k = gk(rd.pts[i][0], rd.pts[i][1]); let a = vg.get(k); if (!a) vg.set(k, (a = [])); a.push([rd.pts[i][0], rd.pts[i][1], rd.halfW + (rd.cls === 'trunk' || rd.cls === 'busway' ? 4 : rd.cls === 'link' ? 1.2 : 0.3), rd.y[i], rd]);
    }
  }
  const onRoad = (x, z, y, own) => {
    const ix = Math.floor(x / 10), iz = Math.floor(z / 10);
    for (let a = ix - 2; a <= ix + 2; a++) for (let b = iz - 2; b <= iz + 2; b++) for (const n of vg.get(`${a},${b}`) || []) if (Math.abs(n[3] - y) < 2.5 && Math.hypot(n[0] - x, n[1] - z) < n[2] + (n[4] === own ? 1.0 : 5.5)) return true;
    return false;
  };
  const split = [];
  for (const pa of paths) {
    const P = pa.P, n = P.X.length;
    let st = -1;
    for (let i = 0; i <= n; i++) {
      const free = i < n && !onRoad(P.X[i], P.Z[i], P.Y[i], pa.own);
      if (free && st < 0) st = i;
      if ((!free || i === n) && st >= 0) {
        if (i - st >= 3 && P.S[i - 1] - P.S[st] > 8) {
          const sub = { X: P.X.slice(st, i), Y: P.Y.slice(st, i), Z: P.Z.slice(st, i), S: P.S.slice(st, i).map((v) => v - P.S[st]) };
          sub.L = sub.S[sub.S.length - 1];
          split.push({ ...pa, P: sub });
        }
        st = -1;
      }
    }
  }
  paths.length = 0; paths.push(...split);
  const walkers = [];
  const tmp = [0, 0, 0, 0];
  for (const pa of paths) {
    if (pa.P.L < 6) continue;
    const n = Math.floor(pa.P.L / pa.dens + r());
    for (let i = 0; i < n; i++) {
      const s0 = r() * pa.P.L;
      sampleAt(pa.P, s0, tmp);
      if (isInside(tmp[0], tmp[2], 0.3)) continue;
      const stand = r() < 0.12;
      walkers.push({ P: pa.P, s0, dir: r() < 0.5 ? -1 : 1, v: stand ? 0 : 1.0 + r() * 0.55, lat: (r() - 0.5) * 0.8, sc: 0.92 + r() * 0.16,
        col: lin(CLOTH[Math.floor(r() * CLOTH.length)], 0.8 + r() * 0.3), ph: r() * 100, yaw0: r() * 6.28 });
      if (walkers.length > 6000) break;
    }
  }
  const pg = personGeometry();
  const iWalk = new Float32Array(Math.max(1, walkers.length) * 2);
  walkers.forEach((w, i) => { iWalk[i * 2] = w.ph; iWalk[i * 2 + 1] = w.v > 0 ? w.v / 1.25 : 0; });
  pg.setAttribute('iWalk', new THREE.InstancedBufferAttribute(iWalk, 2));
  const people = new THREE.InstancedMesh(pg, personMaterial(U), Math.max(1, walkers.length));
  people.count = walkers.length; people.name = 'city-pedestrians'; people.castShadow = true; people.receiveShadow = true; people.frustumCulled = false;
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.Color();
  walkers.forEach((w, i) => people.setColorAt(i, col.setRGB(w.col[0], w.col[1], w.col[2])));
  if (people.instanceColor) people.instanceColor.needsUpdate = true;
  group.add(people);

  // ── statik mobilya (birleşik ağ; aEm: gece/çevrim yayıcısı)
  const F = new Builder({ aEm: 4 });
  const NOEM = { aEm: [0, 0, 0, 0] };
  const fbox = (cx, cy, cz, ang, sx, sy, sz, c, em = NOEM) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (x, y, z) => [cx + x * ca - z * sa, cy + y, cz + x * sa + z * ca];
    const hx = sx / 2, hz = sz / 2;
    const faces = [[[hx, 0, -hz], [hx, sy, -hz], [hx, sy, hz], [hx, 0, hz], [1, 0, 0]], [[-hx, 0, hz], [-hx, sy, hz], [-hx, sy, -hz], [-hx, 0, -hz], [-1, 0, 0]],
      [[-hx, sy, -hz], [-hx, sy, hz], [hx, sy, hz], [hx, sy, -hz], [0, 1, 0]], [[-hx, 0, hz], [hx, 0, hz], [hx, sy, hz], [-hx, sy, hz], [0, 0, 1]],
      [[hx, 0, -hz], [-hx, 0, -hz], [-hx, sy, -hz], [hx, sy, -hz], [0, 0, -1]]];
    for (const [a, b, c2, d, n] of faces) {
      const nn = [n[0] * ca - n[2] * sa, n[1], n[0] * sa + n[2] * ca];
      const ids = [a, b, c2, d].map((p) => { const q = P(p[0], p[1], p[2]); return F.v(q[0], q[1], q[2], nn[0], nn[1], nn[2], c, em); });
      F.quad(ids[0], ids[1], ids[2], ids[3], nn[0], nn[1], nn[2]);
    }
  };
  const nearestRoadAng = (x, z) => {
    let best = 1e9, ang = 0;
    for (const rd of net.roads) {
      if (rd.cls === 'path') continue;
      const p0 = rd.pts[0]; if (Math.abs(p0[0] - x) > 600 || Math.abs(p0[1] - z) > 600) { /* kaba eleme */ }
      for (let i = 0; i < rd.pts.length - 1; i += 2) {
        const p = rd.pts[i], d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
        if (d < best) { best = d; const q = rd.pts[i + 1]; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); }
      }
    }
    return ang;
  };
  const grey = lin('4a4d50'), dark = lin('202226'), yellow = lin('d9a514'), white = lin('dedcd6'), glassC = lin('3a4a52'), red = lin('b3261e');
  let nSig = 0, nStop = 0;
  for (const pt of ctx.data.points?.points || []) {
    if (!Number.isFinite(pt.x)) continue;
    if (pt.kind === 'traffic_signals') {
      const ang = nearestRoadAng(pt.x, pt.z), y = heightAt(pt.x, pt.z) + 0.15, ph = (nSig * 7.3) % 40;
      fbox(pt.x, y, pt.z, ang, 0.16, 3.6, 0.16, grey);
      fbox(pt.x, y + 3.6, pt.z, ang, 0.38, 1.05, 0.32, dark);
      [[0, red], [1, yellow], [2, lin('1e9e4a')]].forEach(([li, c]) => fbox(pt.x, y + 4.35 - li * 0.32, pt.z, ang, 0.24, 0.22, 0.36, c, { aEm: [1, li, ph, 0] }));
      nSig++;
    } else if (pt.kind === 'bus_stop') {
      const ang = nearestRoadAng(pt.x, pt.z), y = heightAt(pt.x, pt.z) + 0.15;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (const ox of [-1.8, 1.8]) fbox(pt.x + ox * ca, y, pt.z + ox * sa, ang, 0.1, 2.5, 0.1, grey);
      fbox(pt.x, y + 2.5, pt.z, ang, 4.2, 0.12, 1.6, white);
      fbox(pt.x + 0.7 * -sa, y + 0.2, pt.z + 0.7 * ca, ang, 3.8, 2.1, 0.06, glassC);
      fbox(pt.x + 2.0 * ca, y + 0.4, pt.z + 2.0 * sa, ang, 0.08, 1.8, 1.2, white, { aEm: [2, 0, 0, 0] }); // reklam panosu
      nStop++;
    }
  }
  // büfeler, çöp kutuları, korkuluklar: odak bölgesindeki kaldırımlar boyunca
  let nKiosk = 0, nBin = 0;
  for (const pa of paths) {
    if (!pa.foc) continue;
    for (let s = 5 + r() * 20; s < pa.P.L - 5; s += 22 + r() * 30) {
      sampleAt(pa.P, s, tmp);
      if (isInside(tmp[0], tmp[2], 1.5)) continue;
      const ang = Math.atan2(Math.cos(tmp[3]), Math.sin(tmp[3])) ;
      const roll = r();
      if (roll < 0.06 && nKiosk < 30) {
        const c = lin(['b3261e', '1f63b0', '2a8f4a', 'd9a514'][Math.floor(r() * 4)]);
        fbox(tmp[0], tmp[1], tmp[2], ang, 2.4, 2.5, 1.9, white);
        fbox(tmp[0], tmp[1] + 2.5, tmp[2], ang, 2.7, 0.35, 2.2, c, { aEm: [2, 0, 0, 0] });
        nKiosk++;
      } else if (roll < 0.5) { fbox(tmp[0], tmp[1], tmp[2], ang, 0.45, 0.9, 0.45, lin('3a4a3f')); nBin++; }
    }
  }
  // yaya korkulukları: odaktaki ana cadde kaldırım kenarı
  for (const rd of net.roads) {
    if (!(rd.cls === 'primary' || rd.cls === 'link') || rd.elev.some((e) => e > 0.3)) continue;
    const mid = rd.pts[Math.floor(rd.pts.length / 2)];
    if (!inFocus(mid[0], mid[1])) continue;
    for (const sd of [-1, 1]) {
      const P = pathOf(rd.pts, rd.y, sd * (rd.halfW + 0.35));
      for (let s = 6; s < P.L - 6; s += 2) {
        sampleAt(P, s, tmp);
        const a = Math.atan2(Math.cos(tmp[3]), Math.sin(tmp[3]));
        fbox(tmp[0], tmp[1] - 0.12, tmp[2], a, 0.05, 1.0, 0.05, grey);
        fbox(tmp[0], tmp[1] + 0.85, tmp[2], a, 2.0, 0.05, 0.05, grey);
        fbox(tmp[0], tmp[1] + 0.35, tmp[2], a, 2.0, 0.04, 0.03, grey);
      }
    }
  }
  const fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
  fm.onBeforeCompile = (sh) => {
    sh.uniforms.uT = U.uT; sh.uniforms.uLightsOn = U.uLightsOn;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute vec4 aEm; varying vec4 vEm;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vEm = aEm;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uT; uniform float uLightsOn; varying vec4 vEm;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (vEm.x > 0.5 && vEm.x < 1.5) {
  // trafik ışığı çevrimi: 0-18 yeşil, 18-21 sarı, 21-40 kırmızı
  float cyc = mod(uT + vEm.z, 40.0);
  float li = floor(vEm.y + 0.5);
  float act = li > 1.5 ? step(cyc, 18.0) : li > 0.5 ? step(18.0, cyc) * step(cyc, 21.0) : step(21.0, cyc);
  totalEmissiveRadiance += diffuseColor.rgb * 8.0 * act * uLightsOn;
  diffuseColor.rgb *= mix(0.35, 1.4, act);
} else if (vEm.x > 1.5) {
  totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * 2.6 * uLightsOn;
}`);
  };
  fm.customProgramCacheKey = () => 'city-furniture-v1';
  if (F.count) {
    const fmesh = new THREE.Mesh(F.geometry(), fm);
    fmesh.name = 'city-furniture'; fmesh.castShadow = true; fmesh.receiveShadow = true;
    group.add(fmesh);
  }

  const M = people.instanceMatrix.array;
  group.userData.walkers = walkers;
  return {
    group, counts: { pedestrians: walkers.length, signals: nSig, busStops: nStop, kiosks: nKiosk, bins: nBin },
    update(state) {
      const t = state.t;
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i], L = w.P.L;
        let s = (w.s0 + w.dir * w.v * t) % L; if (s < 0) s += L;
        sampleAt(w.P, s, tmp);
        const yaw = w.v > 0 ? tmp[3] + (w.dir < 0 ? Math.PI : 0) : w.yaw0;
        // yanal ofset (yürüyüş yönüne dik)
        const ox = Math.cos(tmp[3]) * w.lat, oz = -Math.sin(tmp[3]) * w.lat;
        const c = Math.cos(yaw) * w.sc, sn = Math.sin(yaw) * w.sc, o = i * 16;
        M[o] = c; M[o + 1] = 0; M[o + 2] = -sn; M[o + 3] = 0;
        M[o + 4] = 0; M[o + 5] = w.sc; M[o + 6] = 0; M[o + 7] = 0;
        M[o + 8] = sn; M[o + 9] = 0; M[o + 10] = c; M[o + 11] = 0;
        M[o + 12] = tmp[0] + ox; M[o + 13] = tmp[1]; M[o + 14] = tmp[2] + oz; M[o + 15] = 1;
      }
      people.instanceMatrix.needsUpdate = true;
    },
  };
}
