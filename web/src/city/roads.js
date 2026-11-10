// Yollar: ağ, köprü/rampa kotları, şerit çizgili yüzeyler, kaldırımlar, yaya alanları, yeşil alanlar,
// viyadük tabliyesi + ayakları + bariyerler, viyadük altı gölge (AO) bandı.
import * as THREE from 'three';
import { Builder, Grid, GLSL_HASH, cleanRing, cumLength, key, lin, miterNormals, signedArea } from './util.js';

const CLS = {
  motorway: 'trunk', trunk: 'trunk', motorway_link: 'link', trunk_link: 'link', primary: 'primary', primary_link: 'link',
  secondary: 'secondary', secondary_link: 'link', tertiary: 'secondary', tertiary_link: 'link', residential: 'minor',
  living_street: 'minor', unclassified: 'minor', road: 'minor', service: 'service', busway: 'busway', footway: 'path',
  pedestrian: 'path', steps: 'path', platform: 'path', path: 'path', cycleway: 'path',
};
// Şader tür kodu
const CODE = { minor: 0, service: 0, secondary: 1, primary: 2, link: 2, trunk: 3, busway: 4, path: 5 };
// Arazi üstü kot farkı (m)
const YOFF = { sidewalk: 0.16, path: 0.2, minor: 0.26, service: 0.26, secondary: 0.28, link: 0.3, primary: 0.3, trunk: 0.32, busway: 0.34 };
const VEH = new Set(['trunk', 'link', 'primary', 'secondary', 'minor', 'service', 'busway']);
const RAMP_INTO = new Set(['trunk', 'link', 'busway', 'primary', 'secondary']);

export const DECK_T = 1.7; // tabliye kalınlığı

function makeRoadMaterial(U, units) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: units });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aRd; attribute vec4 aRd2; varying vec4 vRd; varying vec4 vRd2; varying vec3 vWp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vRd = aRd; vRd2 = aRd2; vWp = (modelMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vRd; varying vec4 vRd2; varying vec3 vWp;
${GLSL_HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float rdRough = 0.92;
{
  float code = vRd2.x;
  float s = vRd.x, ac = vRd.y, hw = vRd.z, lanes = max(1.0, vRd.w);
  float ow = vRd2.y, sT = vRd2.z;
  float n1 = cityNoise(vWp.xz * 0.06), n2 = cityNoise(vWp.xz * 0.9 + 13.0), n3 = cityNoise(vWp.xz * 0.21 + 3.0);
  float ds = fwidth(s), da = fwidth(ac);
  vec3 col;
  if (code < 4.5) {
    vec3 asph = code > 3.5 ? vec3(0.15, 0.075, 0.065) : vec3(0.115, 0.115, 0.118);
    asph *= mix(0.84, 1.12, n1) * mix(0.93, 1.07, n2);
    // kenar oluğu: kaldırım dibinde koyu, kirli bant
    asph *= 1.0 - 0.28 * smoothstep(hw - 0.55, hw - 0.05, abs(ac));
    // ince çatlak/yama çizgileri
    float cr = cityNoise(vWp.xz * vec2(0.9, 2.3) + 41.0);
    asph *= 1.0 - 0.12 * smoothstep(0.47, 0.5, cr) * smoothstep(0.53, 0.5, cr);
    float pt = smoothstep(0.66, 0.70, cityNoise(vWp.xz * 0.045 + 7.0));
    asph = mix(asph, asph * vec3(0.72, 0.73, 0.75), pt);
    float lw = 2.0 * hw / lanes;
    float lp = (ac + hw) / lw, lf = fract(lp), dL = fwidth(lp);
    asph *= 1.0 - 0.16 * cityBox(lf, 0.40, 0.60, dL) * (0.6 + 0.4 * n3);
    col = asph;
    float m = 0.0;
    vec3 mc = code > 3.5 ? vec3(0.72, 0.5, 0.06) : vec3(0.74, 0.74, 0.72);
    float endF = smoothstep(4.0, 8.0, s) * smoothstep(4.0, 8.0, sT - s);
    for (int i = 1; i < 8; i++) {
      float fi = float(i);
      if (fi >= lanes) break;
      float pos = -hw + fi * lw;
      bool center = ow < 0.5 && abs(pos) < 0.3;
      float dash = center ? 1.0 : cityBox(fract(s / 9.0), 0.0, 0.36, ds / 9.0);
      float w = center ? 0.22 : 0.14;
      m = max(m, cityBox(ac, pos - w, pos + w, da) * dash);
    }
    if (code > 1.5) m = max(m, cityBox(abs(ac), hw - 0.5, hw - 0.33, da));
    m *= endF;
    if (code > 0.5 && code < 2.5 && sT > 28.0) {
      float zs = min(s, sT - s);
      float zb = cityBox(zs, 1.2, 4.6, ds) * cityBox(fract((ac + hw) * 0.95), 0.0, 0.5, da * 0.95) * step(abs(ac), hw - 0.25);
      m = max(m, zb);
    }
    float far = smoothstep(0.1, 0.35, max(da, ds * 0.25));
    m *= 1.0 - 0.7 * far;
    m *= mix(0.78, 1.0, n2);
    col = mix(col, mc, m);
    rdRough = mix(0.93, 0.6, m);
  } else if (code < 5.5 || (code > 6.5 && code < 7.5)) {
    vec2 tp = vWp.xz / 0.6;
    vec2 tf = fract(tp), tw = fwidth(tp);
    float jt = 1.0 - (1.0 - cityBox(tf.x, 0.06, 0.94, tw.x) * cityBox(tf.y, 0.06, 0.94, tw.y)) * (1.0 - smoothstep(0.2, 0.6, max(tw.x, tw.y)));
    col = vec3(0.30, 0.28, 0.25) * mix(0.85, 1.12, n1) * mix(0.93, 1.05, cityH(floor(tp.x), floor(tp.y), 5.0));
    col *= mix(0.8, 1.0, jt);
    if (code > 6.5) col *= 0.85;
  } else if (code < 6.5) {
    vec2 tp = vWp.xz / 0.4;
    col = vec3(0.27, 0.265, 0.25) * mix(0.82, 1.1, n1) * mix(0.95, 1.04, cityH(floor(tp.x), floor(tp.y), 6.0));
    float curb = cityBox(abs(ac), hw - 0.02, hw + 0.28, da);
    col = mix(col, vec3(0.42, 0.41, 0.39), curb);
  } else if (code > 17.5) {
    col = mix(vec3(0.15, 0.115, 0.08), vec3(0.21, 0.165, 0.11), n2) * mix(0.85, 1.1, n1);
    col = mix(col, col * 0.75, smoothstep(0.6, 1.0, abs(ac) / max(hw, 0.5)));
    rdRough = 1.0;
  } else {
    col = mix(vec3(0.045, 0.075, 0.025), vec3(0.085, 0.10, 0.035), n1) * mix(0.8, 1.15, n2);
    rdRough = 1.0;
  }
  diffuseColor.rgb = col;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = rdRough;`);
  };
  m.customProgramCacheKey = () => 'city-road';
  return m;
}

/** Tek çoklu çizgi için maks-yayılım (rampa): yığın tabanlı. */
class MaxHeap {
  constructor() { this.a = []; }
  push(v, id) { const a = this.a; a.push([v, id]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] >= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] > a[m][0]) m = l; if (r < a.length && a[r][0] > a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export function buildRoads(ctx, U, opts = {}) {
  const { heightAt } = ctx;
  const src = ctx.data.roads?.roads || [];
  const roads = [];
  // landmarks.json osmIds içindeki yollar/alanlar simge yapı ajanının (viyadük hariç: onu yalnız city.js çiziyor)
  const lmSkip = new Set();
  for (const l of ctx.data.landmarks?.landmarks || []) {
    if (l.key === 'viaduct') continue;
    for (const o of l.osmIds || []) { const m = /^(way|node|relation)\/(\d+)$/.exec(o); if (m) lmSkip.add(m[1][0] + m[2]); }
  }
  // ── 1. süz + yeniden örnekle (orijinal köşelerin indeksi tutulur)
  for (const r of src) {
    if (!r || !Array.isArray(r.pts) || r.pts.length < 2) continue;
    if (r.tunnel || (r.layer ?? 0) < 0 || lmSkip.has(r.id)) continue;
    const cls = CLS[r.kind];
    if (!cls) continue;
    const pts = [], orig = [];
    for (let i = 0; i < r.pts.length; i++) {
      const b = r.pts[i];
      if (i === 0) { pts.push([b[0], b[1]]); orig.push(0); continue; }
      const a = r.pts[i - 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      const n = Math.max(1, Math.ceil(len / 4));
      for (let k = 1; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      orig.push(pts.length - 1);
    }
    if (pts.length < 2) continue;
    const lanes = r.lanes || Math.max(1, Math.round(r.width / 3.3));
    const width = Math.max(cls === 'path' ? 2 : 3, r.width || 3.3);
    roads.push({ src: r, id: r.id, kind: r.kind, name: r.name || '', cls, pts, orig, halfW: width / 2, lanes,
      oneway: !!r.oneway, bridge: !!r.bridge && (r.layer ?? 1) >= 1, viaduct: r.bridgeType === 'viaduct' });
  }
  // ── 2. ağ + rampa kotları
  let N = 0;
  for (const r of roads) { r.base = N; N += r.pts.length; }
  const adj = Array.from({ length: N }, () => []);
  const ownerOf = new Int32Array(N);
  roads.forEach((r, ri) => {
    for (let i = 0; i < r.pts.length; i++) {
      ownerOf[r.base + i] = ri;
      if (i > 0) {
        const l = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
        adj[r.base + i].push(r.base + i - 1, l); adj[r.base + i - 1].push(r.base + i, l);
      }
    }
  });
  const keyMap = new Map();
  for (const r of roads) for (const oi of r.orig) {
    const p = r.pts[oi], k = key(p[0], p[1]);
    let a = keyMap.get(k); if (!a) keyMap.set(k, (a = [])); a.push(r.base + oi);
  }
  for (const ids of keyMap.values()) for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { adj[ids[i]].push(ids[j], 0); adj[ids[j]].push(ids[i], 0); }

  const elev = new Float32Array(N);
  for (const group of ['veh', 'ped']) {
    const slope = group === 'veh' ? 0.065 : 0.22;
    const allowed = (r) => (group === 'veh' ? RAMP_INTO.has(r.cls) : r.cls === 'path');
    const heap = new MaxHeap();
    for (const r of roads) {
      if (!r.bridge) continue;
      if ((group === 'veh') !== VEH.has(r.cls)) continue;
      const clr = r.viaduct ? 9.5 : (r.cls === 'path' || r.cls === 'service' ? 5.6 : 7.2);
      for (let i = 0; i < r.pts.length; i++) { const id = r.base + i; if (clr > elev[id]) { elev[id] = clr; heap.push(clr, id); } }
    }
    while (heap.size) {
      const [v, id] = heap.pop();
      if (v < elev[id] - 1e-6) continue;
      const a = adj[id];
      for (let j = 0; j < a.length; j += 2) {
        const nb = a[j], nr = roads[ownerOf[nb]];
        if (nr.bridge || !allowed(nr)) continue;
        const nv = v - slope * a[j + 1];
        if (nv > elev[nb] + 1e-4 && nv > 0.05) { elev[nb] = nv; heap.push(nv, nb); }
      }
    }
  }
  for (const r of roads) {
    r.elev = elev.subarray(r.base, r.base + r.pts.length);
    r.s = cumLength(r.pts);
    r.len = r.s[r.s.length - 1];
    r.nrm = miterNormals(r.pts);
    const off = YOFF[r.cls] ?? 0.26;
    r.ground = new Float32Array(r.pts.length);
    r.y = new Float32Array(r.pts.length);
    for (let i = 0; i < r.pts.length; i++) {
      r.ground[i] = heightAt(r.pts[i][0], r.pts[i][1]);
      r.y[i] = r.ground[i] + off + r.elev[i];
    }
  }

  // ── 3. yüzeyler
  const exDef = { aRd: 4, aRd2: 4 };
  const B = { walk: new Builder(exDef), path: new Builder(exDef), road: new Builder(exDef), bus: new Builder(exDef) };
  const white = [1, 1, 1], up = [0, 1, 0];
  function ribbon(b, r, inner, outer, code, yOff, filter, hwAttr) {
    // inner..outer: across aralığı (−: sol, +: sağ). İki yanlı şerit için inner = −outer.
    const n = r.pts.length;
    let prev = null;
    const seed = (r.base * 7919) % 9973;
    for (let i = 0; i < n; i++) {
      if (filter && !filter(i)) { prev = null; continue; }
      const p = r.pts[i], q = r.nrm[i];
      const y = r.y[i] + yOff;
      const ex = (a) => ({ aRd: [r.s[i], a, hwAttr ?? r.halfW, r.lanes], aRd2: [code, r.oneway ? 1 : 0, r.len, seed] });
      const L = b.v(p[0] + q[0] * inner, y, p[1] + q[1] * inner, 0, 1, 0, white, ex(inner));
      const R = b.v(p[0] + q[0] * outer, y, p[1] + q[1] * outer, 0, 1, 0, white, ex(outer));
      if (prev) b.quad(prev[0], prev[1], R, L, 0, 1, 0);
      prev = [L, R];
    }
  }
  for (const r of roads) {
    if (opts.landAt && (r.cls === 'path' || r.cls === 'service' || r.cls === 'minor')) {
      const m = r.pts[Math.floor(r.pts.length / 2)];
      const a = opts.landAt(m[0], m[1]);
      if (a && a.kind === 'cemetery') r.inCemetery = true;
    }
    if (r.inCemetery) { ribbon(B.path, r, -r.halfW, r.halfW, 18, 0); continue; }
    const code = CODE[r.cls];
    if (r.cls === 'path') { ribbon(B.path, r, -r.halfW, r.halfW, r.kind === 'platform' ? 7 : 5, 0); continue; }
    ribbon(r.cls === 'busway' ? B.bus : B.road, r, -r.halfW, r.halfW, code, 0);
    if (r.cls === 'primary' || r.cls === 'secondary' || r.cls === 'minor' || r.cls === 'link') {
      const sw = r.cls === 'minor' ? 1.7 : r.cls === 'link' ? 1.2 : 3.0;
      const groundOnly = (i) => r.elev[i] < 0.3;
      const dy = YOFF.sidewalk - (YOFF[r.cls] ?? 0.26);
      ribbon(B.walk, r, -r.halfW - sw, -r.halfW + 0.6, 6, dy, groundOnly, r.halfW);
      ribbon(B.walk, r, r.halfW - 0.6, r.halfW + sw, 6, dy, groundOnly, r.halfW);
    }
  }
  // Yaya alanları ve yeşil alanlar (çokgen)
  function polyFill(b, ring, code, yOff) {
    let pts = cleanRing(ring);
    if (pts.length < 3) return;
    if (signedArea(pts) < 0) pts = pts.slice().reverse();
    const v2 = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(v2, []); } catch { return; }
    const ids = pts.map((p) => b.v(p[0], heightAt(p[0], p[1]) + yOff, p[1], 0, 1, 0, white, { aRd: [0, 0, 999, 1], aRd2: [code, 0, 0, 0] }));
    for (const t of tris) b.tri(ids[t[0]], ids[t[1]], ids[t[2]], 0, 1, 0);
  }
  for (const a of ctx.data.roads?.areas || []) if (Array.isArray(a.pts) && !lmSkip.has(a.id)) polyFill(B.walk, a.pts, 5, 0.2);
  for (const g of ctx.data.points?.greens || []) if (Array.isArray(g.pts)) polyFill(B.walk, g.pts, 9, 0.12);

  // ── 4. yapı: tabliye, ayaklar, istinat duvarları, bariyerler
  const S = new Builder();
  const concrete = lin('a9a59c'), concreteD = lin('8c887f'), barrierC = lin('c3c0b8'), soffit = lin('77746e');
  function addBox(cx, y0, cz, ax, az, la, lw, y1, col) {
    // ax,az: boy ekseni (birim); la boy, lw en
    const bx = -az, bz = ax;
    const hx = la / 2, hz = lw / 2;
    const P = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([u, v]) => [cx + ax * u + bx * v, cz + az * u + bz * v]);
    for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4];
      const ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez);
      // dışa normal: merkezden uzağa
      let nx = ez / l, nz = -ex / l;
      const mx = (p[0] + q[0]) / 2 - cx, mz = (p[1] + q[1]) / 2 - cz;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      S.wall(p[0], p[1], q[0], q[1], y0, y1, y0, y1, nx, nz, col);
    }
    const t = P.map((p) => S.v(p[0], y1, p[1], 0, 1, 0, col));
    S.quad(t[0], t[1], t[2], t[3], 0, 1, 0);
  }
  function barrier(r, side, i0, i1, h = 0.9) {
    // side: −1 sol, +1 sağ. Profil: dış kenardan içe.
    const prof = [[0, 0], [0.1, h * 0.35], [0.17, h], [0.33, h], [0.4, h * 0.35], [0.5, 0]];
    let prev = null;
    for (let i = i0; i <= i1; i++) {
      const p = r.pts[i], q = r.nrm[i], y = r.y[i];
      const edge = r.halfW + 0.05;
      const ring = prof.map(([a, hh]) => {
        const off = side * (edge - a);
        return [p[0] + q[0] * off, y + hh, p[1] + q[1] * off];
      });
      if (prev) {
        for (let k = 0; k < prof.length - 1; k++) {
          const a0 = prev[k], a1 = prev[k + 1], b0 = ring[k], b1 = ring[k + 1];
          // yüz normali: profil kenarına dik (yaklaşık)
          const ex = a1[0] - a0[0], ey = a1[1] - a0[1], ez = a1[2] - a0[2];
          const lx = b0[0] - a0[0], ly = b0[1] - a0[1], lz = b0[2] - a0[2];
          let nx = ey * lz - ez * ly, ny = ez * lx - ex * lz, nz = ex * ly - ey * lx;
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          // dışa bakmalı: profil orta noktasından uzağa
          const cxm = (prev[0][0] + prev[prev.length - 1][0]) / 2, cym = prev[0][1] + 0.25, czm = (prev[0][2] + prev[prev.length - 1][2]) / 2;
          const mx = (a0[0] + a1[0]) / 2 - cxm, my = (a0[1] + a1[1]) / 2 - cym, mz = (a0[2] + a1[2]) / 2 - czm;
          if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
          const ia = S.v(a0[0], a0[1], a0[2], nx, ny, nz, barrierC), ib = S.v(a1[0], a1[1], a1[2], nx, ny, nz, barrierC);
          const ic = S.v(b1[0], b1[1], b1[2], nx, ny, nz, barrierC), id = S.v(b0[0], b0[1], b0[2], nx, ny, nz, barrierC);
          S.quad(ia, ib, ic, id, nx, ny, nz);
        }
      }
      prev = ring;
    }
  }
  const aoB = { p: [], c: [], i: [], n: 0 };
  function aoRibbon(r, i0, i1) {
    let prev = null;
    for (let i = i0; i <= i1; i++) {
      const p = r.pts[i], q = r.nrm[i];
      const k = Math.min(1, (r.elev[i] - 0.5) / 4);
      const w = r.halfW + 7;
      const ids = [];
      for (const [a, al] of [[-w, 0], [-r.halfW * 0.6, 0.62 * k], [r.halfW * 0.6, 0.62 * k], [w, 0]]) {
        const x = p[0] + q[0] * a, z = p[1] + q[1] * a;
        aoB.p.push(x, heightAt(x, z) + 0.42, z); aoB.c.push(0, 0, 0, al); ids.push(aoB.n++);
      }
      if (prev) for (let j = 0; j < 3; j++) aoB.i.push(prev[j], ids[j], ids[j + 1], prev[j], ids[j + 1], prev[j + 1]);
      prev = ids;
    }
  }
  for (const r of roads) {
    const n = r.pts.length;
    const elevated = (i) => r.elev[i] > 0.35;
    const isPath = r.cls === 'path';
    // ardışık yükseltilmiş aralıklar
    let i = 0;
    while (i < n) {
      if (!elevated(i)) { i++; continue; }
      let j = i; while (j + 1 < n && elevated(j + 1)) j++;
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, j + 1);
      const deckT = isPath ? 0.8 : DECK_T;
      let pierAcc = 14 + ((r.base * 13) % 17);
      for (let k = i0; k < i1; k++) {
        const p = r.pts[k], q = r.pts[k + 1], np = r.nrm[k], nq = r.nrm[k + 1];
        const yp = r.y[k] - 0.02, yq = r.y[k + 1] - 0.02;
        const ov = 0.35;
        for (const sd of [-1, 1]) {
          const off = sd * (r.halfW + ov);
          const x0 = p[0] + np[0] * off, z0 = p[1] + np[1] * off, x1 = q[0] + nq[0] * off, z1 = q[1] + nq[1] * off;
          const nx = sd * (np[0] + nq[0]) / 2, nz = sd * (np[1] + nq[1]) / 2, nl = Math.hypot(nx, nz) || 1;
          if (r.bridge) S.wall(x0, z0, x1, z1, yp - deckT, yp + 0.05, yq - deckT, yq + 0.05, nx / nl, nz / nl, concrete);
          else S.wall(x0, z0, x1, z1, Math.min(yp - deckT, r.ground[k] - 0.5), yp + 0.05, Math.min(yq - deckT, r.ground[k + 1] - 0.5), yq + 0.05, nx / nl, nz / nl, concreteD);
        }
        if (r.bridge) {
          // alt yüz (soffit)
          const o = r.halfW + ov;
          const a = S.v(p[0] - np[0] * o, yp - deckT, p[1] - np[1] * o, 0, -1, 0, soffit);
          const b = S.v(p[0] + np[0] * o, yp - deckT, p[1] + np[1] * o, 0, -1, 0, soffit);
          const c = S.v(q[0] + nq[0] * o, yq - deckT, q[1] + nq[1] * o, 0, -1, 0, soffit);
          const d = S.v(q[0] - nq[0] * o, yq - deckT, q[1] - nq[1] * o, 0, -1, 0, soffit);
          S.quad(a, b, c, d, 0, -1, 0);
          // ayaklar
          const segL = Math.hypot(q[0] - p[0], q[1] - p[1]);
          pierAcc += segL;
          const spacing = isPath ? 18 : 30;
          if (pierAcc >= spacing && r.elev[k] > 2.5) {
            pierAcc = 0;
            const ax = (q[0] - p[0]) / segL, az = (q[1] - p[1]) / segL;
            const g = r.ground[k] - 0.6, top = yp - deckT;
            if (isPath) addBox(p[0], g, p[1], ax, az, 0.5, 0.5, top, concreteD);
            else {
              const w = r.halfW * 2;
              if (w > 8) {
                for (const sd of [-0.3, 0.3]) addBox(p[0] + np[0] * w * sd, g, p[1] + np[1] * w * sd, ax, az, 1.5, 1.5, top - 1.1, concreteD);
              } else addBox(p[0], g, p[1], ax, az, 1.6, Math.max(1.6, w * 0.45), top - 1.1, concreteD);
              addBox(p[0], top - 1.15, p[1], ax, az, 1.9, w + 0.4, top + 0.02, concrete);
            }
          }
        }
      }
      if (!isPath) { barrier(r, -1, i0, i1); barrier(r, 1, i0, i1); }
      else { barrier(r, -1, i0, i1, 1.1); barrier(r, 1, i0, i1, 1.1); }
      if (r.bridge && j - i > 1) aoRibbon(r, i, j);
      i = j + 1;
    }
    // zemindeki ana yol ve metrobüs bariyerleri (orta refüj)
    if (r.cls === 'trunk' || r.cls === 'busway') {
      let a = 0;
      while (a < n) {
        if (elevated(a)) { a++; continue; }
        let b = a; while (b + 1 < n && !elevated(b + 1)) b++;
        if (b > a) { barrier(r, -1, a, b, 0.85); if (r.cls === 'busway') barrier(r, 1, a, b, 0.85); }
        a = b + 1;
      }
    }
  }

  // ── 5. ağlar
  const group = new THREE.Group(); group.name = 'city-roads';
  const order = [['walk', 2], ['path', 3], ['road', 5], ['bus', 6]];
  const meshes = [];
  for (const [k, units] of order) {
    if (!B[k].count) continue;
    const mesh = new THREE.Mesh(B[k].geometry(), makeRoadMaterial(U, -units));
    mesh.name = 'city-roads-' + k; mesh.receiveShadow = true; mesh.castShadow = false;
    group.add(mesh); meshes.push(mesh);
  }
  // Yükseltilmiş yol yüzeyleri gölge düşürsün diye tabliye yapısı gölge verir (yüzeyler değil).
  const sGeo = S.geometry();
  const sMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  const struct = new THREE.Mesh(sGeo, sMat); struct.name = 'city-viaduct'; struct.castShadow = true; struct.receiveShadow = true;
  group.add(struct);
  if (aoB.n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(aoB.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(aoB.c, 4));
    g.setIndex(aoB.i);
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
    const ao = new THREE.Mesh(g, m); ao.name = 'city-viaduct-ao'; ao.renderOrder = 1;
    group.add(ao);
  }

  // Metrobüs kotu sorgusu: en yakın busway düğümü
  const busGrid = new Grid(12);
  for (const r of roads) if (r.cls === 'busway') for (let i = 0; i < r.pts.length; i++) busGrid.add(r.pts[i][0], r.pts[i][1], [r.pts[i][0], r.pts[i][1], r.y[i]]);
  function busY(x, z) {
    let best = 1e9, y = null;
    busGrid.query(x, z, 12, (it) => { const d = (it[0] - x) ** 2 + (it[1] - z) ** 2; if (d < best) { best = d; y = it[2]; } });
    return y ?? heightAt(x, z) + YOFF.busway;
  }
  return { group, roads, busY, lmSkip, meshes, dispose() { for (const m of [...meshes, struct]) { m.geometry.dispose(); m.material.dispose(); } } };
}
