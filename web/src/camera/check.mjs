// ROTA DENETİMİ — node web/src/camera/check.mjs [--table] [--glint]
// Veriye karşı: bina içinden geçme, zemin/yol/tabliye açıklığı, hız-ivme sürekliliği, dönüş hızı,
// son 1.5 sn durağanlığı ve doruk (16–20.5 sn) ayna geometrisi. Hata varsa çıkış kodu 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FPS, DURATION, todAt, sunAt } from '../core/timeline.js';
import { poseAt, DURATION as ROUTE_DURATION } from './route.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../../public/data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const B = load('buildings.json');
const R = load('roads.json');
const T = load('terrain.json');
const args = new Set(process.argv.slice(2));

const H_MARGIN = 5; // m — bina cephesine yatay pay
const V_MARGIN = 4; // m — çatı üstü pay
const GROUND_MIN = 3.5; // m — zeminden
const ROAD_MIN = 4.2; // m — taşıt yolu üstünden (otobüs ~3.2 m)
const DECK_BELOW = 3.0; // m — tabliye üst kotunun en az bu kadar altında (kiriş payı)
const DECK_ABOVE = 5.5;
// Simge yapılar veri yüksekliğinden uzun modellenebilir (bkz. CONTRACT veri notları).
const LANDMARK_MIN_TOP = { trump: 150, torun: 170 };

function heightAt(x, z) {
  const fx = (x - T.x0) / T.dx;
  const fz = (z - T.z0) / T.dz;
  const ix = Math.max(0, Math.min(T.nx - 2, Math.floor(fx)));
  const iz = Math.max(0, Math.min(T.nz - 2, Math.floor(fz)));
  const u = Math.max(0, Math.min(1, fx - ix));
  const v = Math.max(0, Math.min(1, fz - iz));
  const g = (a, b) => T.heights[b * T.nx + a];
  return g(ix, iz) * (1 - u) * (1 - v) + g(ix + 1, iz) * u * (1 - v) + g(ix, iz + 1) * (1 - u) * v + g(ix + 1, iz + 1) * u * v;
}

const blds = B.filter((b) => b.ring && b.ring.length >= 3).map((b) => {
  const xs = b.ring.map((p) => p[0]);
  const zs = b.ring.map((p) => p[1]);
  let top = Math.max(b.baseY ?? 0, b.groundY ?? -1e9) + (b.height || 9);
  if (b.landmark && b.height > 50 && LANDMARK_MIN_TOP[b.landmark]) top = Math.max(top, LANDMARK_MIN_TOP[b.landmark]);
  return {
    b,
    top,
    bottom: (b.baseY ?? 0) + (b.minHeight || 0),
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    z0: Math.min(...zs),
    z1: Math.max(...zs),
  };
});

function inRing(ring, x, z) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function distSeg(x, z, a, c) {
  const dx = c[0] - a[0];
  const dz = c[1] - a[1];
  const L2 = dx * dx + dz * dz || 1e-9;
  const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return Math.hypot(x - a[0] - u * dx, z - a[1] - u * dz);
}
function distRing(ring, x, z) {
  if (inRing(ring, x, z)) return 0;
  let d = Infinity;
  for (let i = 0; i < ring.length; i++) d = Math.min(d, distSeg(x, z, ring[i], ring[(i + 1) % ring.length]));
  return d;
}

/** Kameranın binalara göre durumu: en yakın "tehdit" (yatay pay içinde ve çatı payının altında). */
function buildingHit(x, y, z, hm = H_MARGIN, vm = V_MARGIN, skip = null) {
  let worst = null;
  for (const e of blds) {
    if (skip && skip(e.b)) continue;
    if (x < e.x0 - hm || x > e.x1 + hm || z < e.z0 - hm || z > e.z1 + hm) continue;
    if (y > e.top + vm || y < e.bottom - vm) continue;
    const d = distRing(e.b.ring, x, z);
    if (d <= hm && (!worst || d < worst.d)) worst = { d, id: e.b.id, name: e.b.name, top: e.top };
  }
  return worst;
}

// Yollar: [x,y,z] noktalı çoklu doğrular.
const VEH = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'service', 'living_street', 'busway', 'unclassified']);
const roads = R.filter((r) => VEH.has(r.cls) && !r.tunnel && r.pts && r.pts.length > 1).map((r) => {
  const xs = r.pts.map((p) => p[0]);
  const zs = r.pts.map((p) => p[2]);
  return { r, half: (r.width || 6) / 2, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
});
function roadsUnder(x, z) {
  const out = [];
  for (const e of roads) {
    const m = e.half + 2;
    if (x < e.x0 - m || x > e.x1 + m || z < e.z0 - m || z > e.z1 + m) continue;
    const p = e.r.pts;
    let best = null;
    for (let i = 0; i + 1 < p.length; i++) {
      const dx = p[i + 1][0] - p[i][0];
      const dz = p[i + 1][2] - p[i][2];
      const L2 = dx * dx + dz * dz || 1e-9;
      const u = Math.max(0, Math.min(1, ((x - p[i][0]) * dx + (z - p[i][2]) * dz) / L2));
      const d = Math.hypot(x - p[i][0] - u * dx, z - p[i][2] - u * dz);
      if (!best || d < best.d) best = { d, y: p[i][1] + u * (p[i + 1][1] - p[i][1]) };
    }
    if (best && best.d <= e.half + 1.5) out.push({ y: best.y, bridge: !!(e.r.bridge || e.r.viaduct), id: e.r.id, cls: e.r.cls });
  }
  return out;
}

// ---- örnekleme -----------------------------------------------------------------------
const N = FPS * DURATION;
const dt = 1 / FPS;
const problems = [];
const note = (t, msg) => problems.push(`t=${t.toFixed(2)}  ${msg}`);
if (ROUTE_DURATION !== DURATION) note(0, `route DURATION ${ROUTE_DURATION} ≠ timeline ${DURATION}`);

const S = [];
for (let i = 0; i <= N; i++) {
  const t = i * dt;
  const p = poseAt(t);
  const d = [p.target[0] - p.pos[0], p.target[1] - p.pos[1], p.target[2] - p.pos[2]];
  const hd = Math.hypot(d[0], d[2]);
  let az = (Math.atan2(d[0], -d[2]) * 180) / Math.PI;
  if (az < 0) az += 360;
  S.push({ t, p, az, pitch: (Math.atan2(d[1], hd) * 180) / Math.PI, tdist: Math.hypot(hd, d[1]) });
}
const unwrap = (a, b) => {
  let x = b - a;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
};
let maxV = 0;
let maxA = 0;
let maxYaw = 0;
let maxYawAcc = 0;
for (let i = 0; i <= N; i++) {
  const s = S[i];
  const a = S[Math.max(0, i - 1)];
  const c = S[Math.min(N, i + 1)];
  const span = (c.t - a.t) || dt;
  s.v = Math.hypot(c.p.pos[0] - a.p.pos[0], c.p.pos[1] - a.p.pos[1], c.p.pos[2] - a.p.pos[2]) / span;
  s.yawRate = unwrap(a.az, c.az) / span;
  s.pitchRate = (c.pitch - a.pitch) / span;
  if (i > 0 && i < N) {
    s.acc = Math.hypot(...[0, 1, 2].map((k) => (c.p.pos[k] - 2 * s.p.pos[k] + a.p.pos[k]) / (dt * dt)));
    maxA = Math.max(maxA, s.acc);
  }
  maxV = Math.max(maxV, s.v);
  maxYaw = Math.max(maxYaw, Math.abs(s.yawRate));
}
for (let i = 1; i < N; i++) {
  S[i].yawAcc = (S[i + 1].yawRate - S[i - 1].yawRate) / (2 * dt);
  maxYawAcc = Math.max(maxYawAcc, Math.abs(S[i].yawAcc));
}

let minGround = Infinity;
let minBld = Infinity;
for (const s of S) {
  const [x, y, z] = s.p.pos;
  const g = heightAt(x, z);
  s.clear = y - g;
  minGround = Math.min(minGround, s.clear);
  if (s.clear < GROUND_MIN) note(s.t, `zemine yakın: ${s.clear.toFixed(1)} m (y=${y.toFixed(1)}, zemin=${g.toFixed(1)})`);
  const hit = buildingHit(x, y, z);
  if (hit) note(s.t, `bina: ${hit.id} ${hit.name || ''} yatay ${hit.d.toFixed(1)} m, çatı y=${hit.top.toFixed(1)}, kamera y=${y.toFixed(1)}`);
  // çıplak (paysız) mesafe istatistiği
  const near = buildingHit(x, y, z, 40, 0);
  if (near) minBld = Math.min(minBld, near.d);
  s.under = false;
  for (const rd of roadsUnder(x, z)) {
    if (rd.bridge) {
      if (y < rd.y) {
        s.under = true;
        if (y > rd.y - DECK_BELOW) note(s.t, `tabliye altına yakın: ${rd.id} tabliye y=${rd.y.toFixed(1)}, kamera y=${y.toFixed(1)}`);
      } else if (y < rd.y + DECK_ABOVE) note(s.t, `tabliye üstüne yakın: ${rd.id} y=${rd.y.toFixed(1)}, kamera y=${y.toFixed(1)}`);
    } else if (y - rd.y < ROAD_MIN) note(s.t, `yol üstü açıklık az: ${rd.id} ${rd.cls} yol y=${rd.y.toFixed(1)}, kamera y=${y.toFixed(1)}`);
  }
  if (s.tdist < 60) note(s.t, `bakış noktası çok yakın: ${s.tdist.toFixed(0)} m`);
}

// Viyadük ayakları (isteğe bağlı): şehir modülünün ürettiği konumlar out/tmp/piers.json'da varsa
// (üretmek için: node out/tmp/piers.mjs — şehir modülünü node'da çalıştırıp roadInfo.piers'i döker).
let pierMin = Infinity;
try {
  const piers = JSON.parse(fs.readFileSync(path.resolve(here, '../../../out/tmp/piers.json'), 'utf8'));
  for (const s of S) {
    const [x, y, z] = s.p.pos;
    for (const p of piers) {
      if (y > p.y + 1.5 || Math.abs(x - p.x) > 30 || Math.abs(z - p.z) > 30) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      pierMin = Math.min(pierMin, d);
      if (d < 5) note(s.t, `viyadük ayağına yakın: (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) yatay ${d.toFixed(1)} m`);
      // başlık kirişi: enine ±(w·0.82), boyuna ±1.1, alt kotu ≈ p.y − 1.3
      if (Math.abs(x - p.x) < 1.6 && Math.abs(z - p.z) < p.w * 0.82 + 0.3 && y > p.y - 1.3 - 1.2) note(s.t, `ayak başlığına yakın: (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) kamera y=${y.toFixed(1)}, başlık altı ≈ ${(p.y - 1.3).toFixed(1)}`);
    }
  }
} catch {
  pierMin = NaN;
}

// Son 1.5 sn: neredeyse sabit
const tail = S.filter((s) => s.t >= DURATION - 1.5);
const tailMove = Math.hypot(...[0, 1, 2].map((k) => tail[tail.length - 1].p.pos[k] - tail[0].p.pos[k]));
const tailYaw = Math.abs(unwrap(tail[0].az, tail[tail.length - 1].az)) + Math.abs(tail[tail.length - 1].pitch - tail[0].pitch);
const tailV = Math.max(...tail.map((s) => s.v));
if (tailV > 3.5) note(DURATION - 1.5, `son 1.5 sn hızlı: en çok ${tailV.toFixed(2)} m/sn`);
if (tailYaw > 1.0) note(DURATION - 1.5, `son 1.5 sn bakış kayıyor: ${tailYaw.toFixed(2)}°`);

// ---- doruk: Trump Residence batı cephesinde güneş yansıması -----------------------------
// Cephe düzlemi (M, n). Güneş yönü S (sahneden güneşe). Ayna yönü R = 2(S·n)n − S.
// Parlama noktası G: kamera C = G + λR ⇒ λ = ((C−M)·n)/(S·n).
function glintReport() {
  const res = B.find((b) => b.landmark === 'trump' && b.part && /Residence/i.test(b.name || ''));
  if (!res) return ['Trump Residence bulunamadı'];
  const ring = res.ring;
  let A2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const c = ring[(i + 1) % ring.length];
    A2 += a[0] * c[1] - c[0] * a[1];
  }
  let face = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const c = ring[(i + 1) % ring.length];
    const dx = c[0] - a[0];
    const dz = c[1] - a[1];
    const L = Math.hypot(dx, dz);
    let nx = dz / L;
    let nz = -dx / L;
    if (A2 < 0) {
      nx = -nx;
      nz = -nz;
    }
    // batıya bakan uzun cephe
    if (nx < -0.9 && (!face || L > face.L)) face = { L, nx, nz, mx: (a[0] + c[0]) / 2, mz: (a[1] + c[1]) / 2, ux: dx / L, uz: dz / L };
  }
  const yBot = (res.baseY ?? 0) + (res.minHeight || 0);
  const yTop = Math.max(res.baseY ?? 0, res.groundY ?? -1e9) + res.height;
  const lines = [
    `cephe: orta (${face.mx.toFixed(1)}, ${face.mz.toFixed(1)}), genişlik ${face.L.toFixed(1)} m, normal az ${(((Math.atan2(face.nx, -face.nz) * 180) / Math.PI + 360) % 360).toFixed(1)}°, y ${yBot.toFixed(0)}…${yTop.toFixed(0)} (veri)`,
    '   t    tod   günAz günYük |  u(m)   G.y  cephe? | ekran x,y (−1…1) | bakış−ayna açısı | görüş',
  ];
  const cam = new THREE.PerspectiveCamera(40, 9 / 16, 2, 20000);
  const notTrump = (b) => b.landmark === 'trump';
  for (let t = 16; t <= 21.51; t += 0.5) {
    const sun = sunAt(todAt(t));
    const Sx = sun.dir.x;
    const Sy = sun.dir.y;
    const Sz = sun.dir.z;
    const sn = Sx * face.nx + Sz * face.nz;
    const Rx = 2 * sn * face.nx - Sx;
    const Ry = -Sy;
    const Rz = 2 * sn * face.nz - Sz;
    const p = poseAt(t);
    const [cx, cy, cz] = p.pos;
    const lam = ((cx - face.mx) * face.nx + (cz - face.mz) * face.nz) / sn;
    const G = [cx - lam * Rx, cy - lam * Ry, cz - lam * Rz];
    const u = (G[0] - face.mx) * face.ux + (G[2] - face.mz) * face.uz;
    const on = lam > 0 && Math.abs(u) <= face.L / 2 && G[1] >= yBot && G[1] <= yTop && sun.elev > 0;
    cam.fov = p.fov;
    cam.updateProjectionMatrix();
    cam.position.set(cx, cy, cz);
    cam.up.set(0, 1, 0);
    cam.lookAt(p.target[0], p.target[1], p.target[2]);
    cam.updateMatrixWorld();
    const ndc = new THREE.Vector3(G[0], G[1], G[2]).project(cam);
    // bakış ekseni ile ayna doğrultusu (C→G) arasındaki açı
    const fwd = new THREE.Vector3(p.target[0] - cx, p.target[1] - cy, p.target[2] - cz).normalize();
    const toG = new THREE.Vector3(G[0] - cx, G[1] - cy, G[2] - cz).normalize();
    const off = (Math.acos(Math.min(1, fwd.dot(toG))) * 180) / Math.PI;
    // görüş hattı
    let blocked = null;
    const len = Math.hypot(G[0] - cx, G[1] - cy, G[2] - cz);
    for (let d = 4; d < len - 4 && !blocked; d += 4) {
      const k = d / len;
      blocked = buildingHit(cx + (G[0] - cx) * k, cy + (G[1] - cy) * k, cz + (G[2] - cz) * k, 0, 0, notTrump);
    }
    const inFrame = Math.abs(ndc.x) < 0.9 && Math.abs(ndc.y) < 0.9;
    lines.push(
      `${t.toFixed(1).padStart(5)} ${todAt(t).toFixed(2).padStart(6)} ${((sun.azim * 180) / Math.PI).toFixed(1).padStart(6)} ${((sun.elev * 180) / Math.PI).toFixed(1).padStart(5)}  | ${u.toFixed(1).padStart(6)} ${G[1].toFixed(1).padStart(6)}  ${on ? 'EVET ' : 'hayır'} | ${ndc.x.toFixed(2).padStart(6)} ${ndc.y.toFixed(2).padStart(6)} ${inFrame ? ' ' : '!'}    | ${off.toFixed(1).padStart(6)}°          | ${blocked ? 'KAPALI ' + blocked.id : 'açık'}`,
    );
    if (t >= 17 && t <= 20.5 && (!on || !inFrame || blocked)) note(t, `doruk: yansıma ${!on ? 'cephe dışında' : !inFrame ? 'kadraj dışında' : 'kapalı'}`);
  }
  return lines;
}
const glint = glintReport();

// ---- çıktı ---------------------------------------------------------------------------
if (args.has('--table') || args.size === 0) {
  console.log('    t    tod |      x      y      z |    hız   ivme |  bakış az  eğim  fov | dönüş°/sn | zemin  tabliye-altı');
  for (let i = 0; i <= N; i += FPS / 2) {
    const s = S[i];
    console.log(
      `${s.t.toFixed(1).padStart(5)} ${todAt(s.t).toFixed(2).padStart(6)} | ${s.p.pos.map((v) => v.toFixed(1).padStart(6)).join(' ')} | ${s.v.toFixed(1).padStart(6)} ${(s.acc ?? 0).toFixed(1).padStart(6)} | ${s.az.toFixed(1).padStart(8)} ${s.pitch.toFixed(1).padStart(6)} ${s.p.fov.toFixed(1).padStart(5)} | ${s.yawRate.toFixed(1).padStart(8)}  | ${s.clear.toFixed(1).padStart(5)}  ${s.under ? 'ALT' : ''}`,
    );
  }
}
console.log('\n— doruk ayna geometrisi (Trump Residence batı cephesi) —');
glint.forEach((l) => console.log(l));
console.log(
  `\nözet: en yüksek hız ${maxV.toFixed(1)} m/sn · ivme ${maxA.toFixed(1)} m/sn² · dönüş ${maxYaw.toFixed(1)} °/sn (ivmesi ${maxYawAcc.toFixed(0)} °/sn²) · en az zemin açıklığı ${minGround.toFixed(1)} m · en yakın bina (çatı altında) ${Number.isFinite(minBld) ? minBld.toFixed(1) + ' m' : '—'} · en yakın viyadük ayağı ${Number.isNaN(pierMin) ? '(piers.json yok — denetlenmedi)' : Number.isFinite(pierMin) ? pierMin.toFixed(1) + ' m' : '—'} · son 1.5 sn: ${tailMove.toFixed(2)} m, ${tailYaw.toFixed(2)}°`,
);
if (problems.length) {
  console.log(`\n${problems.length} SORUN:`);
  // ardışık kareleri özetle
  let last = '';
  let shown = 0;
  for (const p of problems) {
    const key = p.replace(/t=[\d.]+/, '').replace(/[\d.]+/g, '#');
    if (key === last) continue;
    last = key;
    if (shown++ < 60) console.log('  ' + p);
  }
  process.exitCode = 1;
} else {
  console.log('\nSORUN YOK');
}
