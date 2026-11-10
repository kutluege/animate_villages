// Trafik: zincirlenmiş yollar → şeritler → araçlar. Hareket t'nin saf fonksiyonu:
//   araç i: b_i = (i + jit_i)·slot,  τ_i = t + b_i/W + φ,  s_i = (b_i + F(τ_i)) mod L
//   F = dur-kalk profili (durma oranı d, periyot P, ortalama hız V). F azalmayan → sollama/çarpışma yok;
//   faz b/W ile kaydığından duruş dalgası şeritte geriye doğru yayılır.
// Gece ışık izleri araçların kendisi değil, şerit boyunca serilmiş şeritlerde (yol eksenini izler) aynı F ile
// şaderde hesaplanır; iz boyu = anlık hız × pozlama → duran araçta yalnızca nokta ışık.
// Araç gövdeleri: yakın plan ayrıntılı (gövde/cam/tekerlek/far/stop), uzak plan basit kutu (LOD).
import * as THREE from 'three';
import { Builder, key, lin, miterNormals, smooth } from './util.js';

const MOVING = new Set(['trunk', 'link', 'primary', 'secondary', 'minor']);
const BOX = { x0: -800, x1: 800, z0: -720, z1: 820 };
export const WAVE = 12;      // duruş dalgası hızı (m/s, geriye)
const EXPOSURE = 3.6;        // iz pozlaması (s)
const LOD_NEAR = 170;        // m

// ───────────────────────── hareket profili (JS ve GLSL birebir) ─────────────────────────
const fract = (x) => x - Math.floor(x);
function Fpos(tau, V, P, d) {
  if (P <= 0) return V * tau;
  const u = tau / P, f = fract(u);
  let h = 0;
  if (f > d) { const y = (f - d) / (1 - d); h = y * y * y * (y * (y * 6 - 15) + 10); }
  return V * P * (Math.floor(u) + h);
}
function Fvel(tau, V, P, d) {
  if (P <= 0) return V;
  const f = fract(tau / P);
  if (f <= d) return 0;
  const y = (f - d) / (1 - d);
  return (V * 30 * y * y * (1 - y) * (1 - y)) / (1 - d);
}
const jitter = (i, js) => (fract(i * 0.618034 + js) - 0.5) * 0.2;
const GLSL_MOTION = /* glsl */`
float trF(float tau, vec4 lp){ // lp: V, P, d, phi
  if (lp.y <= 0.0) return lp.x * tau;
  float u = tau / lp.y, f = fract(u), h = 0.0;
  if (f > lp.z) { float y = (f - lp.z) / (1.0 - lp.z); h = y * y * y * (y * (y * 6.0 - 15.0) + 10.0); }
  return lp.x * lp.y * (floor(u) + h);
}
float trV(float tau, vec4 lp){
  if (lp.y <= 0.0) return lp.x;
  float f = fract(tau / lp.y);
  if (f <= lp.z) return 0.0;
  float y = (f - lp.z) / (1.0 - lp.z);
  return lp.x * 30.0 * y * y * (1.0 - y) * (1.0 - y) / (1.0 - lp.z);
}
`;

// ───────────────────────── araç geometrileri (parça kodlu) ─────────────────────────
// aPart: 0 boya (instanceColor) · 1 cam · 2 kauçuk/siyah · 3 far camı · 4 stop · 5 gri trim · 6 taksi lambası · 7 beyaz gövde · 8 körük
class VB {
  constructor() { this.b = new Builder({ aPart: 1 }); }
  v(x, y, z, n, part) { return this.b.v(x, y, z, n[0], n[1], n[2], [1, 1, 1], { aPart: [part] }); }
  quad(p, n, part) { const ids = p.map((q) => this.v(q[0], q[1], q[2], n, part)); this.b.quad(ids[0], ids[1], ids[2], ids[3], n[0], n[1], n[2]); }
  box(x0, y0, z0, x1, y1, z1, part, skipBottom = true, parts = {}) {
    const P = (k) => parts[k] ?? part;
    this.quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], P('px'));
    this.quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [-1, 0, 0], P('nx'));
    this.quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], P('py'));
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], P('pz'));
    this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], P('nz'));
    if (!skipBottom) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], P('ny'));
  }
  /** Yan profil (z,y) çokgenini x ∈ [−w0, w0] (alt) / [−w1, w1] (üst) arasında uzat; kenar başına parça. */
  prism(prof, wAt, edgeParts, sidePart) {
    const n = prof.length;
    for (let i = 0; i < n; i++) {
      const a = prof[i], c = prof[(i + 1) % n];
      const wa = wAt(a[1]), wc = wAt(c[1]);
      const dz = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dz, dy) || 1;
      let nz = dy / l, ny = -dz / l;
      // profil saat yönü tersine (z ileri, y yukarı) → dışa normal (dy, −dz)
      const part = edgeParts[i] ?? sidePart;
      this.quad([[-wa, a[1], a[0]], [wa, a[1], a[0]], [wc, c[1], c[0]], [-wc, c[1], c[0]]], [0, ny, nz], part);
    }
    for (const sd of [-1, 1]) {
      const v2 = prof.map((p) => new THREE.Vector2(p[0], p[1]));
      const tris = THREE.ShapeUtils.triangulateShape(v2, []);
      const ids = prof.map((p) => this.v(sd * wAt(p[1]), p[1], p[0], [sd, 0, 0], sidePart));
      for (const t of tris) this.b.tri(ids[t[0]], ids[t[1]], ids[t[2]], sd, 0, 0);
    }
  }
  wheel(x, z, r, w) {
    const N = 10;
    const ring = [];
    for (let k = 0; k < N; k++) { const a = (k / N) * Math.PI * 2; ring.push([Math.cos(a) * r, Math.sin(a) * r + r]); }
    for (let k = 0; k < N; k++) {
      const p = ring[k], q = ring[(k + 1) % N];
      const nm = [0, (p[1] + q[1]) / 2 - r, (p[0] + q[0]) / 2]; const nl = Math.hypot(nm[1], nm[2]); nm[1] /= nl; nm[2] /= nl;
      this.quad([[x - w, p[1], z + p[0]], [x + w, p[1], z + p[0]], [x + w, q[1], z + q[0]], [x - w, q[1], z + q[0]]], nm, 2);
    }
    for (const sd of [-1, 1]) {
      const xs = x + sd * w, n3 = [sd, 0, 0];
      const outer = ring.map((p) => this.v(xs, p[1], z + p[0], n3, 2));
      const inner = ring.map((p) => this.v(xs, r + (p[1] - r) * 0.6, z + p[0] * 0.6, n3, 2));
      for (let k = 0; k < N; k++) this.b.quad(outer[k], outer[(k + 1) % N], inner[(k + 1) % N], inner[k], sd, 0, 0);
      const c = this.v(xs, r, z, n3, 5);
      const hub = ring.map((p) => this.v(xs, r + (p[1] - r) * 0.6, z + p[0] * 0.6, n3, 5));
      for (let k = 0; k < N; k++) this.b.tri(c, hub[k], hub[(k + 1) % N], sd, 0, 0);
    }
  }
  geometry() { return this.b.geometry(); }
}

function carGeometryNear() {
  const g = new VB();
  // alt gövde: ön kaput eğik, arka bagaj
  const body = [[-2.25, 0.36], [2.25, 0.36], [2.27, 0.66], [2.1, 0.8], [1.15, 0.9], [-1.85, 0.94], [-2.25, 0.86]];
  g.prism(body, () => 0.89, { 0: 2, 1: 2 }, 0);
  // kabin (cam yanlar), tavan boya
  const cab = [[1.15, 0.9], [0.3, 1.4], [-1.05, 1.42], [-1.85, 0.94]];
  g.prism(cab, (y) => 0.86 - (y - 0.9) * 0.36, { 0: 1, 1: 0, 2: 1, 3: 2 }, 1);
  // şasi gölgesi, tekerlekler
  g.box(-0.82, 0.16, -1.95, 0.82, 0.37, 1.95, 2);
  for (const z of [-1.42, 1.38]) for (const x of [-0.8, 0.8]) g.wheel(x, z, 0.31, 0.11);
  // farlar, stoplar, tampon
  for (const sd of [-1, 1]) {
    g.quad([[sd * 0.86, 0.6, 2.275], [sd * 0.5, 0.6, 2.275], [sd * 0.5, 0.71, 2.26], [sd * 0.86, 0.71, 2.25]].map((p) => p), [0, 0.1, 1], 3);
    g.quad([[sd * 0.5, 0.7, -2.27], [sd * 0.87, 0.7, -2.27], [sd * 0.87, 0.83, -2.265], [sd * 0.5, 0.83, -2.265]], [0, 0, -1], 4);
  }
  g.box(-0.92, 0.3, 2.2, 0.92, 0.46, 2.32, 5);
  g.box(-0.92, 0.3, -2.32, 0.92, 0.46, -2.2, 5);
  g.box(-0.3, 1.42, -0.55, 0.3, 1.58, -0.3, 6); // taksi lambası (yalnız taksilerde)
  return g.geometry();
}
function carGeometryFar() {
  const g = new VB();
  g.box(-0.9, 0.3, -2.25, 0.9, 0.9, 2.25, 0, true, { pz: 3, nz: 4 });
  g.box(-0.78, 0.9, -1.3, 0.78, 1.4, 0.7, 1, true, { py: 0 });
  g.box(-0.85, 0.0, -2.0, 0.85, 0.3, 2.0, 2);
  return g.geometry();
}
function busGeometry(len, articulated) {
  const g = new VB();
  const h = len / 2, gap = articulated ? 0.7 : 0;
  const parts = articulated ? [[-h, -gap / 2], [gap / 2, h]] : [[-h, h]];
  parts.forEach(([z0, z1], k) => {
    const front = k === parts.length - 1, back = k === 0;
    g.box(-1.27, 0.32, z0, 1.27, 1.05, z1, 0, true, { pz: front ? 7 : 0, nz: back ? 7 : 0 });
    g.box(-1.27, 1.05, z0, 1.27, 2.55, z1, 1, true, { py: 7, pz: front ? 1 : 1, nz: back ? 7 : 1 });
    g.box(-1.27, 2.55, z0, 1.27, 3.05, z1, 7, true, { pz: 7, nz: 7 });
    g.box(-0.9, 3.05, z0 + 1.5, 0.9, 3.3, z0 + Math.min(4.5, z1 - z0 - 1), 5);
    const ax = articulated ? (front ? [z1 - 2.6, z0 + 1.8] : [z0 + 2.2]) : [z1 - 2.5, z0 + 3.0];
    for (const z of ax) for (const x of [-1.05, 1.05]) g.wheel(x, z, 0.48, 0.16);
    if (front) for (const sd of [-1, 1]) g.quad([[sd * 1.2, 0.55, z1 + 0.01], [sd * 0.8, 0.55, z1 + 0.01], [sd * 0.8, 0.75, z1 + 0.01], [sd * 1.2, 0.75, z1 + 0.01]], [0, 0, 1], 3);
    if (back) for (const sd of [-1, 1]) g.quad([[sd * 0.8, 0.7, z0 - 0.01], [sd * 1.2, 0.7, z0 - 0.01], [sd * 1.2, 1.1, z0 - 0.01], [sd * 0.8, 1.1, z0 - 0.01]], [0, 0, -1], 4);
  });
  if (articulated) {
    // körük: kıvrımlı koyu bölüm
    for (let k = 0; k < 5; k++) {
      const z0 = -gap / 2 + (k * gap) / 5, z1 = z0 + gap / 5, w = k % 2 ? 1.12 : 1.2;
      g.box(-w, 0.45, z0, w, 2.95, z1, 8);
    }
  }
  return g.geometry();
}

function vehicleMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.32, metalness: 0.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCarLight = U.uCarLight; sh.uniforms.uLightsOn = U.uLightsOn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aPart; attribute vec3 iInfo; flat varying float vPart; varying vec3 vInfo;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vPart = floor(aPart + 0.5); vInfo = iInfo;
if (aPart > 5.5 && aPart < 6.5 && iInfo.x < 0.5) transformed = vec3(0.0, 0.8, 0.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uCarLight; uniform float uLightsOn; flat varying float vPart; varying vec3 vInfo;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float vGlass = 0.0, vRough = 0.32, vMetal = 0.3; vec3 vEm = vec3(0.0);
{
  float p = vPart;
  #if defined( USE_COLOR )
  vec3 paint = vColor.rgb;
  #else
  vec3 paint = vec3(0.7);
  #endif
  vec3 c = paint;
  if (p < 0.5) { c = paint; }
  else if (p < 1.5) { c = vec3(0.09, 0.105, 0.13); vGlass = 1.0; vRough = 0.08; vMetal = 0.55;
    vEm = vec3(0.75, 0.88, 1.0) * 2.4 * vInfo.z * uLightsOn; }
  else if (p < 2.5) { c = vec3(0.018); vRough = 0.85; vMetal = 0.0; }
  else if (p < 3.5) { c = vec3(0.75, 0.78, 0.8); vRough = 0.1; vMetal = 0.6; vEm = vec3(1.0, 0.93, 0.82) * uCarLight; }
  else if (p < 4.5) { c = vec3(0.35, 0.02, 0.015); vRough = 0.2; vMetal = 0.2; vEm = vec3(1.0, 0.04, 0.01) * (uCarLight * 0.45 + vInfo.y * 6.0 * uLightsOn); }
  else if (p < 5.5) { c = vec3(0.12, 0.12, 0.13); vRough = 0.5; }
  else if (p < 6.5) { c = vec3(0.85, 0.7, 0.1); vEm = vec3(1.0, 0.8, 0.2) * 3.0 * uLightsOn; }
  else if (p < 7.5) { c = vec3(0.82, 0.82, 0.8); vRough = 0.35; vMetal = 0.15; }
  else { c = vec3(0.04); vRough = 0.9; vMetal = 0.0; }
  diffuseColor.rgb = c;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = vRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = vMetal;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vEm;`);
  };
  m.customProgramCacheKey = () => 'city-vehicle-v2';
  return m;
}

/** Aynı ada/türe sahip parçaları uç uca ekleyerek uzun güzergâhlar kur. */
function buildChains(roads) {
  const veh = roads.filter((r) => MOVING.has(r.cls) && !r.inCemetery);
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
    for (;;) {
      const last = ch[ch.length - 1];
      const k = last.rev ? last.r._ks : last.r._ke;
      let nx = null;
      for (const c of starts.get(k) || []) if (!used.has(c) && compat(r0, c)) { nx = { r: c, rev: false }; break; }
      if (!nx && !r0.oneway) for (const c of ends.get(k) || []) if (!used.has(c) && compat(r0, c)) { nx = { r: c, rev: true }; break; }
      if (!nx) break;
      used.add(nx.r); ch.push(nx);
    }
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
const reversed = (a) => a.slice().reverse();

const _p = [0, 0, 0];
function writeMatrix(arr, o, lane, s, sx, sy, sz) {
  const S = lane.S;
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
  const seg = S[hi] - S[lo] || 1, t = (s - S[lo]) / seg;
  const px = lane.X[lo] + (lane.X[hi] - lane.X[lo]) * t, py = lane.Y[lo] + (lane.Y[hi] - lane.Y[lo]) * t, pz = lane.Z[lo] + (lane.Z[hi] - lane.Z[lo]) * t;
  let fx = lane.X[hi] - lane.X[lo], fy = lane.Y[hi] - lane.Y[lo], fz = lane.Z[hi] - lane.Z[lo];
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
  arr[o] = rx * sx; arr[o + 1] = 0; arr[o + 2] = rz * sx; arr[o + 3] = 0;
  arr[o + 4] = ux * sy; arr[o + 5] = uy * sy; arr[o + 6] = uz * sy; arr[o + 7] = 0;
  arr[o + 8] = fx * sz; arr[o + 9] = fy * sz; arr[o + 10] = fz * sz; arr[o + 11] = 0;
  arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
  _p[0] = px; _p[1] = py; _p[2] = pz;
}

const PAINT = [['e9e9e6', 30], ['abadb0', 17], ['60636a', 13], ['1d1e21', 14], ['26324f', 5], ['8e1f1d', 5], ['d8d2c4', 4], ['5b2a1f', 2], ['2f4a3a', 2]];
const TAXI = 'e8b400';
function paint(r) {
  let t = 0; for (const [, w] of PAINT) t += w;
  let v = r() * t;
  for (const [h, w] of PAINT) { v -= w; if (v <= 0) return lin(h); }
  return lin(PAINT[0][0]);
}

/** Şerit param seti: V (ort. hız), P (periyot), d (durma oranı). */
const PARAM = {
  trunk: { gap: [8.4, 10], V: [5.0, 6.8], P: [9, 15], d: [0.0, 0.06] },
  link: { gap: [10, 13], V: [4, 5.5], P: [12, 18], d: [0.12, 0.3] },
  primary: { gap: [9, 11.5], V: [3.5, 5], P: [16, 26], d: [0.2, 0.4] },
  secondary: { gap: [12, 17], V: [3.5, 5], P: [18, 28], d: [0.25, 0.45] },
  minor: { gap: [26, 50], V: [3, 4.5], P: [0, 0], d: [0, 0] },
};

/** Gece ışık izi şeritleri: her şerit boyunca çapraz şerit; şader F ile araç konumlarını yeniden kurar. */
function trailMesh(U, lanes) {
  const pos = [], aS = [], aX = [], aT = [], aL1 = [], aL2 = [], aH = [], idx = [];
  let n = 0;
  for (const lane of lanes) {
    if (!lane.nCars) continue;
    const N = lane.X.length;
    for (let i = 0; i < N; i++) {
      const j = Math.min(i, N - 2);
      let tx = lane.X[j + 1] - lane.X[j], tz = lane.Z[j + 1] - lane.Z[j]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = -tz, nz = tx, y = lane.Y[i] + lane.lampY;
      const x = lane.X[i], z = lane.Z[i], w = lane.trailW;
      pos.push(x - nx * w, y, z - nz * w, x + nx * w, y, z + nz * w, x, y - 0.32, z, x, y + 0.32, z);
      for (let q = 0; q < 4; q++) {
        aS.push(lane.S[i]); aH.push(lane.halfLen ?? 2.1); aX.push(q % 2 ? 1 : -1); aT.push(tx, 0, tz);
        aL1.push(lane.L, lane.slot, lane.nCars, lane.js); aL2.push(lane.V, lane.P, lane.d, lane.phi);
      }
      if (i) { const b = n - 4; idx.push(b, b + 1, b + 5, b, b + 5, b + 4, b + 2, b + 3, b + 7, b + 2, b + 7, b + 6); }
      n += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setAttribute('aX', new THREE.Float32BufferAttribute(aX, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 3));
  g.setAttribute('aL1', new THREE.Float32BufferAttribute(aL1, 4));
  g.setAttribute('aL2', new THREE.Float32BufferAttribute(aL2, 4));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = U.uT; sh.uniforms.uCarI = U.uCarI; sh.uniforms.uExp = { value: EXPOSURE };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aS; attribute float aX; attribute vec3 aT; attribute vec4 aL1; attribute vec4 aL2; attribute float aH;
varying float vH; varying float vS; varying float vX; varying vec4 vL1; varying vec4 vL2; varying float vFacing;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vS = aS; vX = aX; vL1 = aL1; vL2 = aL2; vH = aH;
{ vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz; vFacing = dot(normalize(aT), normalize(cameraPosition - wp)); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uT; uniform float uCarI; uniform float uExp;
varying float vH; varying float vS; varying float vX; varying vec4 vL1; varying vec4 vL2; varying float vFacing;
${GLSL_MOTION}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float L = vL1.x, slot = vL1.y, nC = vL1.z, js = vL1.w;
  float s = vS;
  float W = ${WAVE.toFixed(1)};
  // araç indeksi tahmini: b + F(t + b/W + φ) = s sabit nokta yinelemesi
  float b = s - trF(uT + s / W + vL2.w, vL2);
  for (int it = 0; it < 4; it++) { float bm = mod(b, L); b = s - trF(uT + bm / W + vL2.w, vL2); }
  float k0 = floor(b / slot);
  float head = 0.0, tail = 0.0;
  for (int dk = -2; dk <= 5; dk++) {
    float k = k0 + float(dk);
    float i = mod(k, nC), m = floor(k / nC);
    float bi = (i + (fract(i * 0.618034 + js) - 0.5) * 0.2) * slot;
    float tau = uT + bi / W + vL2.w;
    float p = bi + m * L + trF(tau, vL2);
    float v = trV(tau, vL2);
    float tl = clamp(v * uExp, 0.0, 42.0);
    float dh = p + vH - s, dt = p - vH - s;
    // nokta ışık + hızla uzayan iz (yalnızca arkada)
    head = max(head, exp(-dh * dh * 2.5) * 0.4 + (dh > 0.0 && dh < tl ? pow(1.0 - dh / tl, 0.7) * 0.8 : 0.0));
    tail = max(tail, exp(-dt * dt * 2.5) * 0.55 + (dt > 0.0 && dt < tl ? pow(1.0 - dt / tl, 0.7) * 0.75 : 0.0));
  }
  float fw = smoothstep(-0.25, 0.25, vFacing);
  float prof = exp(-vX * vX * 3.0);
  vec3 c = mix(vec3(1.0, 0.05, 0.015) * tail * 1.25, vec3(1.0, 0.88, 0.72) * head, fw);
  diffuseColor.rgb = c * prof * uCarI;
  diffuseColor.a = 1.0;
}`);
  };
  m.customProgramCacheKey = () => 'city-trails-v2';
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'city-traffic-trails'; mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}

export function buildTraffic(ctx, U, roadNet, isInside) {
  const group = new THREE.Group(); group.name = 'city-traffic';
  const chains = buildChains(roadNet.roads);
  const lanes = [];
  const inBox = (p) => p[0] > BOX.x0 && p[0] < BOX.x1 && p[1] > BOX.z0 && p[1] < BOX.z1;
  const parked = [];
  const rr = (r, [a, b]) => a + r() * (b - a);
  for (const ch of chains) {
    if (!ch.pts.some(inBox)) continue;
    const r = ctx.rng('city/lane/' + ch.id);
    const P = PARAM[ch.cls];
    const lanesN = Math.max(1, Math.min(6, ch.lanes));
    const mk = (offs, rev) => {
      const lane = rev ? makeLane(reversed(ch.pts), reversed(ch.ys), Array.isArray(offs) ? reversed(offs) : offs) : makeLane(ch.pts, ch.ys, offs);
      lane.cls = ch.cls; lane.gap = rr(r, P.gap); lane.V = rr(r, P.V); lane.P = P.P[1] > 0 ? rr(r, P.P) : 0; lane.d = rr(r, P.d);
      lane.phi = r() * 40; lane.js = r(); lane.seed = r(); lane.lampY = 0.72; lane.trailW = ch.cls === 'trunk' ? 1.05 : 0.8;
      lanes.push(lane);
    };
    if (ch.oneway) {
      for (let i = 0; i < lanesN; i++) mk(ch.hw.map((h) => -h + (i + 0.5) * (2 * h / lanesN)), false);
    } else {
      const nf = Math.max(1, Math.floor(lanesN / 2));
      for (let i = 0; i < nf; i++) {
        mk(ch.hw.map((h) => (i + 0.5) * (h / nf)), false);
        mk(ch.hw.map((h) => (i + 0.5) * (h / nf)), true);
      }
    }
    if ((ch.cls === 'minor' || ch.cls === 'secondary') && ch.ys.length > 2) {
      const hw0 = ch.hw[0];
      const sides = ch.oneway ? (hw0 >= 2.8 ? [-1] : []) : (hw0 >= 4.4 ? [-1, 1] : []);
      for (const sd of sides) {
        const lane = makeLane(ch.pts, ch.ys, ch.hw.map((h) => sd * (h - 1.05)));
        for (let s = 6; s < lane.L - 6; s += 5.6) { if (r() > 0.62) continue; parked.push({ lane, s, rev: sd < 0 && r() < 0.5 }); }
      }
    }
  }
  // araçlar: her slot dolu (iz şaderiyle birebir); bazı slotlar otobüs
  const cars = [], buses = [];
  for (const lane of lanes) {
    const r = ctx.rng('city/cars/' + lane.seed.toFixed(6));
    const n = lane.L > lane.gap ? Math.floor(lane.L / lane.gap) : (lane.L > 0.6 * lane.gap ? 1 : 0);
    lane.nCars = n; lane.slot = lane.L / Math.max(1, n);
    const busOK = (lane.cls === 'primary' || lane.cls === 'trunk') && n > 4 && lane.slot > 9.4;
    for (let i = 0; i < n; i++) {
      const v = { lane, i, b: (i + jitter(i, lane.js)) * lane.slot };
      if (busOK && r() < 0.035) { v.col = lin(r() < 0.6 ? '1f63b0' : '2a8f8a'); buses.push(v); continue; }
      const taxi = lane.cls !== 'minor' && r() < 0.16;
      v.taxi = taxi; v.col = taxi ? lin(TAXI) : paint(r);
      v.sx = 0.95 + r() * 0.09; v.sy = r() < 0.18 ? 1.15 + r() * 0.15 : 0.96 + r() * 0.08; v.sz = 0.92 + r() * 0.16;
      cars.push(v);
    }
  }
  const vmat = vehicleMaterial(U);
  const mkInst = (geo, count, name) => {
    const im = new THREE.InstancedMesh(geo, vmat, Math.max(1, count));
    im.name = name; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.setColorAt(0, new THREE.Color(1, 1, 1));
    im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const info = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 3), 3);
    info.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iInfo', info);
    im.count = 0;
    group.add(im);
    return im;
  };
  const nearGeo = carGeometryNear(), farGeo = carGeometryFar();
  const carNear = mkInst(nearGeo, cars.length, 'city-cars-near');
  const carFar = mkInst(farGeo, cars.length, 'city-cars-far');
  const busMesh = mkInst(busGeometry(10.5, false), buses.length, 'city-buses');

  // park etmiş (statik, ayrıntılı geometri ayrı kopya)
  const pr = ctx.rng('city/parked');
  const parkedOK = parked.filter((p) => { const S = p.lane.S; let i = 0; while (i < S.length - 1 && S[i + 1] < p.s) i++; return !isInside(p.lane.X[i], p.lane.Z[i], 0.8); });
  const parkMesh = mkInst(carGeometryNear(), parkedOK.length, 'city-parked');
  parkMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  parkedOK.forEach((p, i) => {
    writeMatrix(parkMesh.instanceMatrix.array, i * 16, p.lane, p.s, 0.95 + pr() * 0.1, 0.96 + pr() * 0.15, 0.92 + pr() * 0.12);
    if (p.rev) { const a = parkMesh.instanceMatrix.array, o = i * 16; for (const j of [0, 2, 8, 10]) a[o + j] = -a[o + j]; }
    const c = paint(pr); parkMesh.setColorAt(i, new THREE.Color(c[0], c[1], c[2]));
  });
  parkMesh.count = parkedOK.length;
  parkMesh.instanceMatrix.needsUpdate = true; parkMesh.instanceColor.needsUpdate = true;

  // metrobüs
  const mb = buildMetrobus(ctx, U, roadNet, group, mkInst, lanes);
  const trails = trailMesh(U, [...lanes, ...mb.lanes]);
  group.add(trails);

  const cam = ctx.camera, col = new THREE.Color();
  function place(list, im, near, filter) {
    const A = im.instanceMatrix.array, C = im.instanceColor.array, I = im.geometry.attributes.iInfo.array;
    let k = 0;
    for (const c of list) {
      const L = c.lane.L, ln = c.lane;
      const tau = c.t + c.b / WAVE + ln.phi;
      let s = (c.b + Fpos(tau, ln.V, ln.P, ln.d)) % L; if (s < 0) s += L;
      // önce konum → LOD kararı
      const o = k * 16;
      writeMatrix(A, o, ln, s, c.sx ?? 1, c.sy ?? 1, c.sz ?? 1);
      if (filter) {
        const d2 = (_p[0] - cam.position.x) ** 2 + (_p[1] - cam.position.y) ** 2 + (_p[2] - cam.position.z) ** 2;
        if ((d2 < LOD_NEAR * LOD_NEAR) !== near) continue;
      }
      C[k * 3] = c.col[0]; C[k * 3 + 1] = c.col[1]; C[k * 3 + 2] = c.col[2];
      const v = Fvel(tau, ln.V, ln.P, ln.d);
      I[k * 3] = c.taxi ? 1 : 0; I[k * 3 + 1] = v < 1.2 ? 1 : 0; I[k * 3 + 2] = c.interior ? 1 : 0;
      k++;
    }
    im.count = k;
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.geometry.attributes.iInfo.needsUpdate = true;
    void col;
  }

  function update(state) {
    const t = state.t;
    for (const c of cars) c.t = t;
    for (const c of buses) { c.t = t; c.interior = 1; }
    place(cars, carNear, true, true);
    place(cars, carFar, false, true);
    place(buses, busMesh, true, false);
    const on = state.lightsOn;
    trails.visible = on > 0.004;
    U.uT.value = t;
    mb.update(state, place);
  }
  return { group, update, counts: { cars: cars.length, buses: buses.length, parked: parkedOK.length, lanes: lanes.length, metrobus: mb.count } };
}

function buildMetrobus(ctx, U, roadNet, group, mkInst) {
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
  P.forEach((p, li) => {
    const other = P.find((q) => q !== p);
    let off = p.pts.map(([x, z]) => (other && distTo(x, z, other.pts) < 1.6 ? 1.75 : 0));
    for (let pass = 0; pass < 4; pass++) off = off.map((v, i) => (off[Math.max(0, i - 2)] + off[Math.max(0, i - 1)] + v + off[Math.min(off.length - 1, i + 1)] + off[Math.min(off.length - 1, i + 2)]) / 5);
    let ys = p.pts.map(([x, z]) => roadNet.busY(x, z));
    for (let pass = 0; pass < 3; pass++) ys = ys.map((v, i) => (ys[Math.max(0, i - 1)] + v + ys[Math.min(ys.length - 1, i + 1)]) / 3);
    const lane = makeLane(p.pts, ys, off);
    lane.off = off; lane.pts = p.pts; lane.ys = ys;
    lane.cls = 'metrobus'; lane.V = 11; lane.P = 0; lane.d = 0; lane.phi = li * 7.3; lane.js = 0.37 * (li + 1);
    lane.nCars = Math.max(1, Math.floor(lane.L / 150)); lane.slot = lane.L / lane.nCars; lane.lampY = 0.85; lane.trailW = 0.95; lane.halfLen = 9.2;
    lanes.push(lane);
  });
  const buses = [];
  for (const lane of lanes) for (let i = 0; i < lane.nCars; i++) buses.push({ lane, i, b: (i + jitter(i, lane.js)) * lane.slot, col: lin('b31b26'), interior: 1 });
  // orijin 18.5 m'lik gövdenin merkezi → izler için ön/arka ~±9 m; şader ±2.1 kullanır, fark gece görünmez
  const mesh = mkInst(busGeometry(18.5, true), buses.length, 'city-metrobus');

  // Kesintisiz ışık şeridi (her yönün sağ kenarında, bariyer üstünde)
  const pos = [], kk = [], sv = [], idx = [];
  let n = 0;
  for (const lane of lanes) {
    const L2 = makeLane(lane.pts, lane.ys, lane.off.map((o) => o + 1.95));
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
  const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
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
  return {
    count: buses.length, lanes,
    update(state, place) {
      for (const b of buses) b.t = state.t;
      place(buses, mesh, true, false);
      strip.visible = state.lightsOn > 0.004;
    },
  };
}

export { Fpos, Fvel, smooth };
