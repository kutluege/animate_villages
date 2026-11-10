// Trafik: zincirlenmiş yollar → şeritler → araçlar (t'nin saf fonksiyonu). Gece: far/stop ışık izleri
// (kameraya bakan yön beyaz, uzaklaşan kırmızı). Metrobüs: araçlar + kesintisiz ışık şeridi.
import * as THREE from 'three';
import { Builder, key, lin, miterNormals, smooth } from './util.js';

const MOVING = new Set(['trunk', 'link', 'primary', 'secondary', 'minor']);
const BOX = { x0: -800, x1: 800, z0: -720, z1: 820 };

function boxInto(b, x0, y0, z0, x1, y1, z1, col) {
  const F = [
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
    [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]],
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
  ];
  for (const [a, bb, c, d, n] of F) {
    const ids = [a, bb, c, d].map((p) => b.v(p[0], p[1], p[2], n[0], n[1], n[2], col));
    b.quad(ids[0], ids[1], ids[2], ids[3], n[0], n[1], n[2]);
  }
}

function carGeometry() {
  const b = new Builder();
  boxInto(b, -0.9, 0.28, -2.2, 0.9, 0.95, 2.2, [1, 1, 1]);
  // kabin: eğik ön/arka cam (kesik piramit), cam koyu, tavan gövde renginde
  const lo = [[-0.84, -1.55], [0.84, -1.55], [0.84, 1.05], [-0.84, 1.05]], hi = [[-0.72, -1.2], [0.72, -1.2], [0.72, 0.3], [-0.72, 0.3]];
  const y0 = 0.95, y1 = 1.48, glass = [0.06, 0.065, 0.075];
  for (let i = 0; i < 4; i++) {
    const a = lo[i], c = lo[(i + 1) % 4], d = hi[(i + 1) % 4], e = hi[i];
    const ux = c[0] - a[0], uz = c[1] - a[1];
    let nx = uz, nz = -ux; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2 + 0.25;
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    const l = Math.hypot(nx, nz) || 1, ny = 0.45;
    const ids = [b.v(a[0], y0, a[1], nx / l, ny, nz / l, glass), b.v(c[0], y0, c[1], nx / l, ny, nz / l, glass), b.v(d[0], y1, d[1], nx / l, ny, nz / l, glass), b.v(e[0], y1, e[1], nx / l, ny, nz / l, glass)];
    b.quad(ids[0], ids[1], ids[2], ids[3], nx / l, ny, nz / l);
  }
  const top = hi.map((p) => b.v(p[0], y1, p[1], 0, 1, 0, [0.9, 0.9, 0.9]));
  b.quad(top[0], top[1], top[2], top[3], 0, 1, 0);
  boxInto(b, -0.82, 0.0, -1.7, 0.82, 0.32, -1.0, [0.03, 0.03, 0.03]);
  boxInto(b, -0.82, 0.0, 1.0, 0.82, 0.32, 1.7, [0.03, 0.03, 0.03]);
  return b.geometry();
}
function busGeometry(len, articulated, body, stripe) {
  const b = new Builder();
  const h = len / 2, gap = articulated ? 0.5 : 0;
  const parts = articulated ? [[-h, -gap / 2], [gap / 2, h]] : [[-h, h]];
  for (const [z0, z1] of parts) {
    boxInto(b, -1.27, 0.35, z0, 1.27, 1.05, z1, stripe);
    boxInto(b, -1.25, 1.05, z0, 1.25, 2.55, z1, [0.07, 0.08, 0.09]);
    boxInto(b, -1.27, 2.55, z0, 1.27, 3.15, z1, body);
  }
  if (articulated) boxInto(b, -1.1, 0.4, -gap / 2 - 0.05, 1.1, 3.0, gap / 2 + 0.05, [0.1, 0.1, 0.1]);
  return b.geometry();
}
/** Işık izi: iki çapraz dörtgen; aL = (t: 0 ön → 1 kuyruk, karşı eksen −1..1). */
function streakGeometry(len, width, lampY) {
  const pos = [], aL = [], idx = [];
  let n = 0;
  const add = (x, y, t, a) => { pos.push(x, y, 0); aL.push(t, a); return n++; };
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    add(-width, lampY, t, -1); add(width, lampY, t, 1); add(0, lampY - 0.35, t, -1); add(0, lampY + 0.35, t, 1);
    if (k) { const b = n - 8, c = n - 4; idx.push(b, b + 1, c + 1, b, c + 1, c, b + 2, b + 3, c + 3, b + 2, c + 3, c + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 2));
  g.setIndex(idx);
  g.userData.front = len / 2;
  return g;
}
function streakMaterial(U, front, len) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTrail = U.uTrail; sh.uniforms.uCarI = U.uCarI;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aL; uniform float uTrail; varying vec2 vL; varying float vFacing;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed.z = ${front.toFixed(2)} - aL.x * (${len.toFixed(2)} + uTrail);
vL = aL;
{
  mat4 im = modelMatrix * instanceMatrix;
  vec3 fwd = normalize((im * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  vec3 cp = (im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vFacing = dot(fwd, normalize(cameraPosition - cp));
}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uCarI; varying vec2 vL; varying float vFacing;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float fw = smoothstep(-0.3, 0.3, vFacing);
  vec3 head = vec3(1.0, 0.88, 0.72), tail = vec3(1.0, 0.05, 0.015);
  float t = vL.x;
  float prof = (exp(-t * 14.0) * 1.6 + pow(1.0 - t, 1.4) * 0.55) * exp(-vL.y * vL.y * 3.0);
  diffuseColor.rgb = mix(tail * 1.3, head, fw) * prof * uCarI;
  diffuseColor.a = 1.0;
}`);
  };
  m.customProgramCacheKey = () => `city-streak-${front}-${len}`;
  return m;
}

/** Aynı ada/türe sahip parçaları uç uca ekleyerek uzun güzergâhlar kur. */
function buildChains(roads) {
  const veh = roads.filter((r) => MOVING.has(r.cls));
  const starts = new Map(), ends = new Map();
  const push = (m, k, r) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(r); };
  for (const r of veh) {
    const a = r.pts[0], b = r.pts[r.pts.length - 1];
    r._ks = key(a[0], a[1]); r._ke = key(b[0], b[1]);
    push(starts, r._ks, r); push(ends, r._ke, r);
  }
  const used = new Set(), chains = [];
  const compat = (a, b) => a.oneway === b.oneway && (a.name ? a.name === b.name : (!b.name && a.kind === b.kind)) && Math.abs(a.halfW - b.halfW) < 2.5;
  for (const r0 of veh) {
    if (used.has(r0)) continue;
    used.add(r0);
    const ch = [{ r: r0, rev: false }];
    // ileri
    for (;;) {
      const last = ch[ch.length - 1];
      const k = last.rev ? last.r._ks : last.r._ke;
      let nx = null;
      for (const c of starts.get(k) || []) if (!used.has(c) && compat(r0, c)) { nx = { r: c, rev: false }; break; }
      if (!nx && !r0.oneway) for (const c of ends.get(k) || []) if (!used.has(c) && compat(r0, c)) { nx = { r: c, rev: true }; break; }
      if (!nx) break;
      used.add(nx.r); ch.push(nx);
    }
    // geri
    for (;;) {
      const first = ch[0];
      const k = first.rev ? first.r._ke : first.r._ks;
      let pv = null;
      for (const c of ends.get(k) || []) if (!used.has(c) && compat(r0, c)) { pv = { r: c, rev: false }; break; }
      if (!pv && !r0.oneway) for (const c of starts.get(k) || []) if (!used.has(c) && compat(r0, c)) { pv = { r: c, rev: true }; break; }
      if (!pv) break;
      used.add(pv.r); ch.unshift(pv);
    }
    const pts = [], ys = [], hw = [];
    for (const { r, rev } of ch) {
      const n = r.pts.length;
      for (let j = 0; j < n; j++) {
        const i = rev ? n - 1 - j : j;
        if (pts.length && j === 0) continue;
        pts.push(r.pts[i]); ys.push(r.y[i]); hw.push(r.halfW);
      }
    }
    if (pts.length >= 2) chains.push({ cls: r0.cls, oneway: r0.oneway, lanes: r0.lanes, pts, ys, hw, name: r0.name, id: r0.id });
  }
  return chains;
}

function makeLane(pts, ys, offs) {
  const nrm = miterNormals(pts);
  const n = pts.length;
  const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = typeof offs === 'number' ? offs : offs[i];
    X[i] = pts[i][0] + nrm[i][0] * o; Z[i] = pts[i][1] + nrm[i][1] * o; Y[i] = ys[i];
    if (i) S[i] = S[i - 1] + Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1], Y[i] - Y[i - 1]);
  }
  return { X, Y, Z, S, L: S[n - 1] };
}
function reversed(a) { return a.slice().reverse(); }

function writeMatrix(arr, o, lane, s, sx, sy, sz) {
  const S = lane.S;
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const seg = S[hi] - S[lo] || 1, t = (s - S[lo]) / seg;
  const px = lane.X[lo] + (lane.X[hi] - lane.X[lo]) * t, py = lane.Y[lo] + (lane.Y[hi] - lane.Y[lo]) * t, pz = lane.Z[lo] + (lane.Z[hi] - lane.Z[lo]) * t;
  let fx = lane.X[hi] - lane.X[lo], fy = lane.Y[hi] - lane.Y[lo], fz = lane.Z[hi] - lane.Z[lo];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  // sağ = up × f
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  // yukarı = f × r
  const ux = fy * rz - 0, uy = fz * rx - fx * rz, uz = -fy * rx;
  arr[o] = rx * sx; arr[o + 1] = 0; arr[o + 2] = rz * sx; arr[o + 3] = 0;
  arr[o + 4] = ux * sy; arr[o + 5] = uy * sy; arr[o + 6] = uz * sy; arr[o + 7] = 0;
  arr[o + 8] = fx * sz; arr[o + 9] = fy * sz; arr[o + 10] = fz * sz; arr[o + 11] = 0;
  arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
}

const PAINT = [['e9e9e6', 30], ['abadb0', 17], ['60636a', 13], ['1d1e21', 14], ['26324f', 5], ['8e1f1d', 5], ['e7b400', 12], ['d8d2c4', 4]];
function paint(r, taxiOK) {
  let t = 0; for (const [, w] of PAINT) t += w;
  for (;;) {
    let v = r() * t;
    for (const [h, w] of PAINT) { v -= w; if (v <= 0) { if (h === 'e7b400' && !taxiOK) break; return lin(h); } }
  }
}

export function buildTraffic(ctx, U, roadNet, isInside) {
  const group = new THREE.Group(); group.name = 'city-traffic';
  const chains = buildChains(roadNet.roads);
  const lanes = [];
  const PARAM = {
    trunk: { gap: [8.2, 10.5], v: [3.5, 6.5] }, link: { gap: [10, 14], v: [4, 6] }, primary: { gap: [9, 12], v: [3.5, 6] },
    secondary: { gap: [12, 18], v: [4, 6.5] }, minor: { gap: [28, 60], v: [3, 5] },
  };
  const inBox = (p) => p[0] > BOX.x0 && p[0] < BOX.x1 && p[1] > BOX.z0 && p[1] < BOX.z1;
  const parked = [];
  for (const ch of chains) {
    if (!ch.pts.some(inBox)) continue;
    const r = ctx.rng('city/lane/' + ch.id);
    const P = PARAM[ch.cls];
    const lanesN = Math.max(1, Math.min(6, ch.lanes));
    const mk = (offs, rev) => {
      const lane = rev ? makeLane(reversed(ch.pts), reversed(ch.ys), Array.isArray(offs) ? reversed(offs) : offs) : makeLane(ch.pts, ch.ys, offs);
      lane.cls = ch.cls; lane.gap = P.gap[0] + r() * (P.gap[1] - P.gap[0]); lane.v = P.v[0] + r() * (P.v[1] - P.v[0]);
      lane.seed = r();
      lanes.push(lane);
    };
    if (ch.oneway) {
      for (let i = 0; i < lanesN; i++) mk(ch.hw.map((h) => -h + (i + 0.5) * (2 * h / lanesN)), false);
    } else {
      const nf = Math.max(1, Math.floor(lanesN / 2));
      for (let i = 0; i < nf; i++) {
        mk(ch.hw.map((h) => (i + 0.5) * (h / nf)), false);
        // ters yön: ters çevrilmiş çizgide sağ taraf, aynı fiziksel taraf için işaret değişir
        mk(ch.hw.map((h) => (i + 0.5) * (h / nf)), true);
      }
    }
    // park etmiş araçlar
    if ((ch.cls === 'minor' || ch.cls === 'secondary') && ch.ys.length > 2) {
      const hw0 = ch.hw[0];
      const sides = ch.oneway ? (hw0 >= 2.8 ? [-1] : []) : (hw0 >= 4.4 ? [-1, 1] : []);
      for (const sd of sides) {
        const lane = makeLane(ch.pts, ch.ys, ch.hw.map((h) => sd * (h - 1.05)));
        for (let s = 6; s < lane.L - 6; s += 5.6) {
          if (r() > 0.62) continue;
          parked.push({ lane, s, rev: sd < 0 && r() < 0.5 });
        }
      }
    }
  }
  // hareketli araçlar
  const cars = [], buses = [];
  for (const lane of lanes) {
    const r = ctx.rng('city/cars/' + lane.seed.toFixed(6));
    const n = lane.L > lane.gap ? Math.floor(lane.L / lane.gap) : (lane.L > 0.6 * lane.gap ? 1 : 0);
    const slot = lane.L / Math.max(1, n);
    let skip = false;
    for (let i = 0; i < n; i++) {
      if (skip) { skip = false; continue; }
      const base = (i + (r() - 0.5) * 0.3) * slot;
      const big = (lane.cls === 'primary' || lane.cls === 'trunk') && r() < 0.03 && n > 3;
      if (big) { buses.push({ lane, base: base + slot * 0.5, col: lin(r() < 0.5 ? '2f5fa8' : 'c9c9c4') }); skip = true; continue; }
      if (lane.cls === 'minor' && r() < 0.25) continue;
      cars.push({ lane, base, col: paint(r, lane.cls !== 'minor'), sx: 0.94 + r() * 0.1, sy: r() < 0.2 ? 1.2 + r() * 0.15 : 0.95 + r() * 0.1, sz: 0.9 + r() * 0.18 });
    }
  }
  const carGeo = carGeometry();
  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 });
  const carMesh = new THREE.InstancedMesh(carGeo, carMat, Math.max(1, cars.length));
  carMesh.count = cars.length; carMesh.name = 'city-cars';
  carMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  carMesh.castShadow = true; carMesh.receiveShadow = true; carMesh.frustumCulled = false;
  cars.forEach((c, i) => carMesh.setColorAt(i, new THREE.Color(c.col[0], c.col[1], c.col[2])));
  if (carMesh.instanceColor) carMesh.instanceColor.needsUpdate = true;
  group.add(carMesh);
  const carStreak = new THREE.InstancedMesh(streakGeometry(4.4, 0.75, 0.75), streakMaterial(U, 2.2, 4.4), Math.max(1, cars.length));
  carStreak.instanceMatrix = carMesh.instanceMatrix; carStreak.count = cars.length; carStreak.frustumCulled = false; carStreak.name = 'city-car-trails';
  carStreak.renderOrder = 5;
  group.add(carStreak);

  const busGeo = busGeometry(12, false, lin('e8e8e4'), lin('e8e8e4'));
  const busMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 });
  const busMesh = new THREE.InstancedMesh(busGeo, busMat, Math.max(1, buses.length));
  busMesh.count = buses.length; busMesh.name = 'city-buses'; busMesh.frustumCulled = false;
  busMesh.castShadow = true; busMesh.receiveShadow = true;
  buses.forEach((b, i) => busMesh.setColorAt(i, new THREE.Color(b.col[0], b.col[1], b.col[2])));
  if (busMesh.instanceColor) busMesh.instanceColor.needsUpdate = true;
  group.add(busMesh);
  const busStreak = new THREE.InstancedMesh(streakGeometry(12, 0.95, 0.9), streakMaterial(U, 6, 12), Math.max(1, buses.length));
  busStreak.name = 'city-bus-trails'; busStreak.instanceMatrix = busMesh.instanceMatrix; busStreak.count = buses.length; busStreak.frustumCulled = false; busStreak.renderOrder = 5;
  group.add(busStreak);

  // park etmiş
  const pr = ctx.rng('city/parked');
  const parkedOK = parked.filter((p) => {
    const S = p.lane.S; let i = 0; while (i < S.length - 1 && S[i + 1] < p.s) i++;
    return !isInside(p.lane.X[i], p.lane.Z[i], 0.8);
  });
  const parkMesh = new THREE.InstancedMesh(carGeo, carMat, Math.max(1, parkedOK.length));
  parkMesh.count = parkedOK.length; parkMesh.name = 'city-parked'; parkMesh.castShadow = true; parkMesh.receiveShadow = true;
  parkedOK.forEach((p, i) => {
    writeMatrix(parkMesh.instanceMatrix.array, i * 16, p.lane, p.s, 0.95 + pr() * 0.1, 0.95 + pr() * 0.2, 0.9 + pr() * 0.15);
    if (p.rev) { const a = parkMesh.instanceMatrix.array, o = i * 16; for (const j of [0, 2, 8, 10]) a[o + j] = -a[o + j]; }
    const c = paint(pr, false); parkMesh.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
  });
  parkMesh.instanceMatrix.needsUpdate = true; if (parkMesh.instanceColor) parkMesh.instanceColor.needsUpdate = true;
  parkMesh.computeBoundingSphere();
  group.add(parkMesh);

  // ── Metrobüs
  const mb = buildMetrobus(ctx, U, roadNet, group);

  function update(state) {
    const t = state.t;
    const A = carMesh.instanceMatrix.array;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i], L = c.lane.L;
      let s = (c.base + c.lane.v * t) % L; if (s < 0) s += L;
      writeMatrix(A, i * 16, c.lane, s, c.sx, c.sy, c.sz);
    }
    carMesh.instanceMatrix.needsUpdate = true;
    const B = busMesh.instanceMatrix.array;
    for (let i = 0; i < buses.length; i++) {
      const c = buses[i], L = c.lane.L;
      let s = (c.base + c.lane.v * t) % L; if (s < 0) s += L;
      writeMatrix(B, i * 16, c.lane, s, 1, 1, 1);
    }
    busMesh.instanceMatrix.needsUpdate = true;
    const on = state.lightsOn;
    const vis = on > 0.004;
    carStreak.visible = busStreak.visible = vis;
    mb.update(state);
  }
  return { group, update, counts: { cars: cars.length, buses: buses.length, parked: parkedOK.length, lanes: lanes.length, metrobus: mb.count } };
}

function buildMetrobus(ctx, U, roadNet, group) {
  const paths = (ctx.data.landmarks?.landmarks || []).find((l) => l.key === 'metrobus_line')?.paths || [];
  const res = (pts) => {
    const out = [[pts[0][0], pts[0][1]]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(l / 4));
      for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    return out;
  };
  const P = paths.filter((p) => Array.isArray(p.pts) && p.pts.length >= 2).map((p) => ({ dir: p.dir, pts: res(p.pts) }));
  const distTo = (x, z, pts) => {
    let best = 1e9;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
    }
    return best;
  };
  const lanes = [];
  for (const p of P) {
    const other = P.find((q) => q !== p);
    let off = p.pts.map(([x, z]) => (other && distTo(x, z, other.pts) < 1.6 ? 1.75 : 0));
    // yumuşat
    for (let pass = 0; pass < 4; pass++) off = off.map((v, i) => (off[Math.max(0, i - 2)] + off[Math.max(0, i - 1)] + v + off[Math.min(off.length - 1, i + 1)] + off[Math.min(off.length - 1, i + 2)]) / 5);
    const ys = p.pts.map(([x, z]) => roadNet.busY(x, z));
    // kot yumuşatma (köprü/zemin geçişlerinde sıçrama olmasın)
    let ysm = ys;
    for (let pass = 0; pass < 3; pass++) ysm = ysm.map((v, i) => (ysm[Math.max(0, i - 1)] + v + ysm[Math.min(ysm.length - 1, i + 1)]) / 3);
    const lane = makeLane(p.pts, ysm, off);
    lane.off = off; lane.pts = p.pts; lane.ys = ysm;
    lanes.push(lane);
  }
  // araçlar
  const buses = [];
  const SPACING = 150, V = 11;
  lanes.forEach((lane, li) => {
    const n = Math.max(1, Math.floor(lane.L / SPACING));
    const r = ctx.rng('city/metrobus/' + li);
    for (let i = 0; i < n; i++) buses.push({ lane, base: (i + 0.15 * (r() - 0.5)) * lane.L / n + li * 37 });
  });
  const geo = busGeometry(18.5, true, lin('f2f2ef'), lin('b8262b'));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, buses.length));
  mesh.count = buses.length; mesh.name = 'city-metrobus'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);
  // pencere ışığı (gece)
  const wb = new Builder();
  for (const sd of [-1, 1]) {
    const x = sd * 1.262;
    for (const [z0, z1] of [[-9.0, -0.4], [0.4, 9.0]]) {
      const a = wb.v(x, 1.15, z0, sd, 0, 0, [1, 1, 1]), b = wb.v(x, 1.15, z1, sd, 0, 0, [1, 1, 1]);
      const c = wb.v(x, 2.45, z1, sd, 0, 0, [1, 1, 1]), d = wb.v(x, 2.45, z0, sd, 0, 0, [1, 1, 1]);
      wb.quad(a, b, c, d, sd, 0, 0);
    }
  }
  const winMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const win = new THREE.InstancedMesh(wb.geometry(), winMat, Math.max(1, buses.length));
  win.instanceMatrix = mesh.instanceMatrix; win.count = buses.length; win.frustumCulled = false; win.visible = false;
  group.add(win);
  const streak = new THREE.InstancedMesh(streakGeometry(18.5, 1.0, 0.95), streakMaterial(U, 9.25, 18.5), Math.max(1, buses.length));
  streak.name = 'city-metrobus-trails'; streak.instanceMatrix = mesh.instanceMatrix; streak.count = buses.length; streak.frustumCulled = false; streak.renderOrder = 5;
  group.add(streak);

  // Kesintisiz ışık şeridi: her yönün sağ kenarında, bariyer üstünde (yatay + dikey çapraz şerit)
  const pos = [], kk = [], sv = [], idx = [];
  let n = 0;
  for (const lane of lanes) {
    const edge = lane.off.map((o) => o + 1.95);
    const L2 = makeLane(lane.pts, lane.ys, edge);
    for (let i = 0; i < L2.X.length; i++) {
      const x = L2.X[i], y = L2.Y[i], z = L2.Z[i];
      const j = Math.min(i, L2.X.length - 2);
      const dx = L2.X[j + 1] - L2.X[j], dz = L2.Z[j + 1] - L2.Z[j], dl = Math.hypot(dx, dz) || 1;
      const nx = -dz / dl, nz = dx / dl;
      const k = 0.3 + 0.32 * Math.min(1, Math.max(0, (x + 700) / 1400));
      const yy = y + 0.93;
      pos.push(x - nx * 0.3, yy, z - nz * 0.3, x + nx * 0.3, yy, z + nz * 0.3, x, yy - 0.22, z, x, yy + 0.22, z);
      for (let q = 0; q < 4; q++) { kk.push(k); sv.push(q % 2 ? 1 : -1); }
      if (i) { const b = n - 4; idx.push(b, b + 1, b + 5, b, b + 5, b + 4, b + 2, b + 3, b + 7, b + 2, b + 7, b + 6); }
      n += 4;
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sg.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1));
  sg.setAttribute('aV', new THREE.Float32BufferAttribute(sv, 1));
  sg.setIndex(idx);
  const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  sMat.onBeforeCompile = (sh) => {
    sh.uniforms.uLightsOn = U.uLightsOn; sh.uniforms.uStripI = U.uStripI;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aK; attribute float aV; varying float vK; varying float vV;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vK = aK; vV = aV;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uLightsOn; uniform float uStripI; varying float vK; varying float vV;`).replace('#include <color_fragment>', `#include <color_fragment>
{
  float on = smoothstep(vK, vK + 0.035, uLightsOn);
  float prof = exp(-vV * vV * 2.2);
  diffuseColor.rgb = vec3(0.12, 0.62, 1.0) * uStripI * on * prof;
  diffuseColor.a = 1.0;
}`);
  };
  sMat.customProgramCacheKey = () => 'city-mb-strip';
  const strip = new THREE.Mesh(sg, sMat); strip.name = 'city-metrobus-strip'; strip.renderOrder = 6; strip.frustumCulled = false;
  group.add(strip);

  const winCol = new THREE.Color();
  return {
    count: buses.length,
    update(state) {
      const A = mesh.instanceMatrix.array;
      for (let i = 0; i < buses.length; i++) {
        const b = buses[i], L = b.lane.L;
        let s = (b.base + V * state.t) % L; if (s < 0) s += L;
        writeMatrix(A, i * 16, b.lane, s, 1, 1, 1);
      }
      mesh.instanceMatrix.needsUpdate = true;
      const on = state.lightsOn;
      win.visible = on > 0.004;
      winCol.setRGB(0.75, 0.88, 1.0).multiplyScalar(3.2 * smooth(0.02, 0.25, on));
      winMat.color.copy(winCol);
      strip.visible = streak.visible = on > 0.004;
    },
  };
}
