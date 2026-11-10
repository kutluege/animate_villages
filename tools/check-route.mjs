// Kamera rotasını veriye karşı doğrular (web/src/edit.js).
//   node tools/check-route.mjs            özet + çarpışmalar (varsa çıkış kodu 1)
//   node tools/check-route.mjs --hz 240   örnekleme sıklığı  --margin 3  güvenlik payı (m)
//   node tools/check-route.mjs --frame 36 o anki kadrajda simge yapıların ekran konumları
//   node tools/check-route.mjs --scene [--atmo b] [--scene-hz 10] [--scene-r 1.5]
//        ek olarak gerçek sahneye (her örnekte __renderFrame(t) → hareketli trafik dahil) ışın testi
// Denetimler: arazi açıklığı, bina izleri × yükseklik (baseY+minHeight … baseY+height), köprü tabliyeleri
// (+ üstündeki trafik zarfı), tabliye altında ayak riski, hız/ivme sürekliliği, bakış açısal hızı,
// tod monotonluğu ve referans saatler, lightsOn penceresi, batı cephesinde güneş yansıması (ayna açısı).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from './lib-browser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs();
const HZ = Number(args.hz) || 240;
const MARGIN = args.margin !== undefined ? Number(args.margin) : 3;
const load = (f) => { try { return JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8')); } catch { return null; } };

const edit = await import(pathToFileURL(join(ROOT, 'web/src/edit.js')).href);
const { makeHeightAt } = await import(pathToFileURL(join(ROOT, 'web/src/terrain.js')).href);
const { timeState, formatTod } = await import(pathToFileURL(join(ROOT, 'web/src/timeline.js')).href);

const heightAt = makeHeightAt(load('terrain.json'));
const buildings = load('buildings.json')?.buildings ?? [];
const roads = load('roads.json')?.roads ?? [];
const landmarks = load('landmarks.json')?.landmarks ?? [];

// ───────── geometri ─────────
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const u = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return { d: Math.hypot(px - ax - u * dx, pz - az - u * dz), u };
}
function inside(px, pz, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function distToPoly(px, pz, ring) {
  if (inside(px, pz, ring)) return 0;
  let d = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) d = Math.min(d, distToSeg(px, pz, ...ring[j], ...ring[i]).d);
  return d;
}
const bbox = (ring) => ring.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [Infinity, Infinity, -Infinity, -Infinity]);

// Katılar: bina izleri + buildings.json'da olmayan simge izleri (Şişli Plaza kulesi: konumu bilinmiyor → tüm dış hat 170 m).
const solids = buildings.map((b) => ({
  id: b.id, name: b.name || b.landmark || '', ring: b.footprint,
  y0: b.baseY + (b.minHeight || 0), y1: b.baseY + b.height, bb: bbox(b.footprint),
}));
const sp = landmarks.find((l) => l.key === 'sisli_plaza');
if (sp) for (const f of sp.footprints) solids.push({ id: f.osmId, name: 'Şişli Plaza (kule konumu bilinmiyor, 170 m)', ring: f.footprint, y0: f.baseY, y1: f.baseY + sp.height, bb: bbox(f.footprint) });

// Köprüler: tabliye üstü ≈ zemin + 9.8 m (viyadük; landmarks deckHeight 9 + city.js'in 9.5 m açıklık + yol ofseti) / 7.5 m (diğer).
// Tabliye kalınlığı 1.7 m (city/roads.js DECK_T); başlık kirişi tabliye kenarını ~0.2 m aşar.
const viaDeck = Math.max(9.8, landmarks.find((l) => l.key === 'viaduct')?.deckHeight ?? 9);
const DECK_T = 1.7;
const decks = [];
for (const r of roads) {
  if (!r.bridge || !r.pts || r.pts.length < 2) continue;
  const top = r.bridgeType === 'viaduct' ? viaDeck : 7.5;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
    decks.push({ id: r.id, kind: r.kind, ax, az, bx, bz, w: r.width || 8, top,
      bb: [Math.min(ax, bx) - 15, Math.min(az, bz) - 15, Math.max(ax, bx) + 15, Math.max(az, bz) + 15] });
  }
}

// Zemindeki taşıt yolları: araç zarfı zemin+4.2 m (otobüs/kamyon tavanı + pay), yol genişliği boyunca.
const VEH = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'busway', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'motorway_link']);
const lanes = [];
for (const r of roads) {
  if (r.bridge || r.tunnel || !VEH.has(r.kind) || !r.pts || r.pts.length < 2) continue;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
    lanes.push({ id: r.id, kind: r.kind, ax, az, bx, bz, w: r.width || 6,
      bb: [Math.min(ax, bx) - 12, Math.min(az, bz) - 12, Math.max(ax, bx) + 12, Math.max(az, bz) + 12] });
  }
}
const VEH_H = 4.2;

// ───────── örnekleme ─────────
const D = edit.DURATION;
const N = Math.round(D * HZ);
const S = [];
for (let i = 0; i <= N; i++) {
  const t = (i / N) * D, s = edit.shotAt(t);
  S.push({ t, p: s.position, q: s.target, fov: s.fov, tod: s.tod, roll: s.roll || 0 });
}

const hits = [];
let minTerrain = { c: Infinity }, minBld = { d: Infinity }, underDeck = [];
for (const s of S) {
  const [x, y, z] = s.p;
  const g = heightAt(x, z), c = y - g;
  if (c < minTerrain.c) minTerrain = { c, t: s.t };
  if (c < 2) hits.push(`t=${s.t.toFixed(2)} arazi açıklığı ${c.toFixed(2)} m`);
  for (const b of solids) {
    if (x < b.bb[0] - 40 || x > b.bb[2] + 40 || z < b.bb[1] - 40 || z > b.bb[3] + 40) continue;
    const d = distToPoly(x, z, b.ring);
    const above = y - b.y1, below = b.y0 - y;
    const gap = Math.max(d, above, below); // 3B'de kaba açıklık (kutu benzeri)
    if (gap < minBld.d) minBld = { d: gap, t: s.t, id: b.id, name: b.name };
    if (d < MARGIN && y > b.y0 - MARGIN && y < b.y1 + MARGIN) hits.push(`t=${s.t.toFixed(2)} bina ${b.id} ${b.name} (iz mesafesi ${d.toFixed(1)} m, y=${y.toFixed(1)}, bina ${b.y0.toFixed(1)}…${b.y1.toFixed(1)})`);
  }
  for (const k of lanes) {
    if (x < k.bb[0] || x > k.bb[2] || z < k.bb[1] || z > k.bb[3]) continue;
    const { d } = distToSeg(x, z, k.ax, k.az, k.bx, k.bz);
    if (d < k.w / 2 + 1 && c < VEH_H) hits.push(`t=${s.t.toFixed(2)} trafik zarfı ${k.id} (${k.kind}) y-zemin=${c.toFixed(1)} m < ${VEH_H}`);
  }
  for (const k of decks) {
    if (x < k.bb[0] || x > k.bb[2] || z < k.bb[1] || z > k.bb[3]) continue;
    const { d, u } = distToSeg(x, z, k.ax, k.az, k.bx, k.bz);
    const top = heightAt(k.ax + u * (k.bx - k.ax), k.az + u * (k.bz - k.az)) + k.top;
    const lat = d - k.w / 2;
    // tabliye gövdesi [top−DECK_T, top] + üstte araç zarfı (VEH_H + 1 m): yanda MARGIN, altta yakın düzlem payı 1 m.
    // Kenarın dışında ve gövdenin altındaysa (yanal > 1 m) çarpışma yok — tabliye yalnız tavan olarak görünür.
    const body = y > top - DECK_T - 1 && y < top + VEH_H + 1;
    if ((lat < MARGIN && body) || (lat < 1 && y <= top - DECK_T - 1 && y > top - DECK_T - 1.5)) hits.push(`t=${s.t.toFixed(2)} tabliye ${k.id} (${k.kind}) yanal ${lat.toFixed(1)} m, y=${y.toFixed(1)}, üst ${top.toFixed(1)}`);
    if (lat < 3 && y < top - DECK_T) underDeck.push({ t: s.t, id: k.id, d, clear: top - DECK_T - y });
  }
}

// ───────── süreklilik ─────────
const dt = D / N;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const vel = [], acc = [];
for (let i = 1; i < S.length - 1; i++) {
  vel.push(len(sub(S[i + 1].p, S[i - 1].p)) / (2 * dt));
  acc.push(S[i + 1].p.map((v, j) => (v - 2 * S[i].p[j] + S[i - 1].p[j]) / (dt * dt)));
}
let maxJumpA = 0, maxA = 0;
for (let i = 1; i < acc.length; i++) { maxJumpA = Math.max(maxJumpA, len(sub(acc[i], acc[i - 1]))); maxA = Math.max(maxA, len(acc[i])); }
const dir = (s) => { const v = sub(s.q, s.p), L = len(v); return v.map((c) => c / L); };
let maxAng = 0, maxAngT = 0, maxPitch = -90, minPitch = 90;
for (let i = 1; i < S.length; i++) {
  const a = dir(S[i - 1]), b = dir(S[i]);
  const w = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / dt * 180 / Math.PI;
  if (w > maxAng) { maxAng = w; maxAngT = S[i].t; }
  const pitch = Math.asin(b[1]) * 180 / Math.PI;
  maxPitch = Math.max(maxPitch, pitch); minPitch = Math.min(minPitch, pitch);
}
let todMono = true;
for (let i = 1; i < S.length; i++) if (S[i].tod < S[i - 1].tod - 1e-9) todMono = false;

// ───────── çıktı ─────────
const at = (t) => S[Math.round((t / D) * N)];
console.log(`edit.js: ${D} sn, ${S.length} örnek (${HZ} Hz), pay ${MARGIN} m`);
console.log(`hız: başta ${vel[0].toFixed(1)} m/s, en yüksek ${Math.max(...vel).toFixed(1)} m/s, son 2 sn en yüksek ${Math.max(...vel.slice(Math.round((D - 2) / dt))).toFixed(2)} m/s`);
console.log(`ivme: en yüksek ${maxA.toFixed(1)} m/s², örnekler arası en büyük sıçrama ${maxJumpA.toFixed(3)} m/s² (C2 ise küçük)`);
console.log(`bakış: en yüksek açısal hız ${maxAng.toFixed(1)}°/s (t=${maxAngT.toFixed(2)}), eğim ${minPitch.toFixed(1)}…${maxPitch.toFixed(1)}°, roll ${Math.max(...S.map((s) => Math.abs(s.roll)))}°`);
console.log(`arazi: en az açıklık ${minTerrain.c.toFixed(1)} m (t=${minTerrain.t.toFixed(2)}); binaya en yakın ${minBld.d.toFixed(1)} m (t=${minBld.t.toFixed(2)}, ${minBld.id} ${minBld.name || ''})`);
if (underDeck.length) {
  const ids = [...new Set(underDeck.map((u) => u.id))];
  const dmin = Math.min(...underDeck.map((u) => u.d)), cmin = Math.min(...underDeck.map((u) => u.clear));
  console.log(`tabliye altı/kenarı (yanal < 3 m): t=${underDeck[0].t.toFixed(2)}…${underDeck.at(-1).t.toFixed(2)} (${ids.join(', ')}), eksene en yakın ${dmin.toFixed(1)} m (ayak riski <4 m), tabliyeye açıklık ≥ ${cmin.toFixed(1)} m`);
}
console.log(`tod: ${todMono ? 'monoton' : 'MONOTON DEĞİL'}; ` + [0, 4, 8, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 33, 36].map((t) => `${t}s ${formatTod(at(t).tod)}`).join(' · '));
const refs = [[16.5, '16:30'], [18.75, '18:45'], [19 + 20 / 60, '19:20'], [19 + 50 / 60, '19:50'], [21.5, '21:30']];
console.log('referans saatler: ' + refs.map(([h, l]) => { const s = S.find((s) => s.tod >= h - 1e-6); return `${l} @ ${s ? s.t.toFixed(1) + ' sn' : 'yok'}`; }).join(' · '));
const lo = S.find((s) => timeState(s.tod).lightsOn > 0.02), hi = S.find((s) => timeState(s.tod).lightsOn > 0.98);
const spd = (s) => vel[Math.min(vel.length - 1, Math.max(0, Math.round(s.t / dt) - 1))];
if (lo && hi) console.log(`lightsOn 0.02→0.98: ${lo.t.toFixed(1)}…${hi.t.toFixed(1)} sn; o aralıkta kamera hızı ≤ ${Math.max(...S.filter((s) => s.t >= lo.t && s.t <= hi.t).map(spd)).toFixed(1)} m/s, en yüksek açısal hız ${(() => { let m = 0; for (let i = 1; i < S.length; i++) if (S[i].t >= lo.t && S[i].t <= hi.t) { const a = dir(S[i - 1]), b = dir(S[i]); m = Math.max(m, Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / dt * 180 / Math.PI); } return m.toFixed(1); })()}°/s`);

// ───────── kadraj: projeksiyon ─────────
const ASPECT = 9 / 16;
function project(s, P) {
  const f = dir(s), up0 = [0, 1, 0];
  const r = [f[1] * up0[2] - f[2] * up0[1], f[2] * up0[0] - f[0] * up0[2], f[0] * up0[1] - f[1] * up0[0]];
  const rl = len(r); r.forEach((v, i) => (r[i] = v / rl));
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = sub(P, s.p), zc = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (zc <= 0) return null;
  const ty = Math.tan((s.fov * Math.PI) / 360), tx = ty * ASPECT;
  return [(d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / zc / tx, (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / zc / ty];
}

// Güneş yansıması: dikey batı cephesi (normal ≈ −X). Kameradan cepheye ayna yönü v = (−sx, sy, sz).
const facades = [];
for (const key of ['trump_towers', 'torun_center']) {
  const lm = landmarks.find((l) => l.key === key);
  for (const f of lm?.footprints ?? []) {
    if (f.role === 'podium_mall' || f.role === 'low_block' || !f.footprint) continue;
    const xs = f.footprint.map((p) => p[0]), zs = f.footprint.map((p) => p[1]);
    facades.push({ name: `${key}/${f.role}/${f.osmId}`, x: Math.min(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: f.baseY, y1: f.baseY + f.height });
  }
}
const glint = [];
for (const s of S) {
  const st = timeState(s.tod);
  if (st.sunElev <= 0) continue;
  const v = [-st.sunDir.x, st.sunDir.y, st.sunDir.z];
  if (v[0] <= 0) continue;
  for (const F of facades) {
    const k = (F.x - s.p[0]) / v[0];
    if (k <= 0) continue;
    const P = [F.x, s.p[1] + k * v[1], s.p[2] + k * v[2]];
    if (P[2] < F.z0 || P[2] > F.z1 || P[1] < F.y0 || P[1] > F.y1) continue;
    const ndc = project(s, P);
    if (ndc && Math.abs(ndc[0]) < 1 && Math.abs(ndc[1]) < 1) glint.push({ t: s.t, F: F.name, ndc, P, elev: st.sunElev });
  }
}
if (glint.length) {
  const by = {};
  for (const g of glint) (by[g.F] ||= []).push(g);
  for (const [k, gs] of Object.entries(by)) console.log(`güneş yansıması kadrajda: ${k} t=${gs[0].t.toFixed(1)}…${gs.at(-1).t.toFixed(1)} sn (${gs.length} örnek; ilk ekran ${gs[0].ndc.map((v) => v.toFixed(2))}, son ${gs.at(-1).ndc.map((v) => v.toFixed(2))}; güneş ${gs[0].elev.toFixed(1)}°→${gs.at(-1).elev.toFixed(1)}°)`);
} else console.log('güneş yansıması: kadrajda HİÇ yok');

const frames = args.frame !== undefined ? String(args.frame).split(',').map(Number) : [0, 2, 9, 16, 24, 36];
const marks = [];
for (const lm of landmarks) for (const f of lm.footprints ?? []) {
  if (!f.footprint || (f.height ?? 0) < 60) continue;
  const c = f.footprint.reduce((a, p) => [a[0] + p[0] / f.footprint.length, a[1] + p[1] / f.footprint.length], [0, 0]);
  marks.push([`${lm.key}:${f.role}:${f.osmId.slice(-4)}`, [c[0], f.baseY, c[1]], [c[0], f.baseY + f.height, c[1]]]);
}
for (const b of buildings) if (b.height >= 120 && !b.landmark) {
  const c = b.footprint.reduce((a, p) => [a[0] + p[0] / b.footprint.length, a[1] + p[1] / b.footprint.length], [0, 0]);
  marks.push([`${b.name || b.id}`, [c[0], b.baseY, c[1]], [c[0], b.baseY + b.height, c[1]]]);
}
const mb = landmarks.find((l) => l.key === 'metrobus_line')?.paths?.[0]?.pts ?? [];
for (const t of frames) {
  const s = at(t);
  console.log(`\nkare t=${t}: konum ${s.p.map((v) => v.toFixed(0))}, bakış ${s.q.map((v) => v.toFixed(0))}, fov ${s.fov.toFixed(1)}, ${formatTod(s.tod)} (ekran x,y ∈ [−1,1], y yukarı)`);
  for (const [n, a, b] of marks) {
    const pa = project(s, a), pb = project(s, b);
    if (!pa && !pb) continue;
    const vis = [pa, pb].some((p) => p && Math.abs(p[0]) <= 1.05 && Math.abs(p[1]) <= 1.05);
    if (vis) console.log(`  ${n.padEnd(34)} dip ${pa ? pa.map((v) => v.toFixed(2)).join(',') : '—'}  tepe ${pb ? pb.map((v) => v.toFixed(2)).join(',') : '—'}`);
  }
  const line = mb.map(([x, z], i) => [x, heightAt(x, z), z]).map((P) => project(s, P)).filter((p) => p && Math.abs(p[0]) <= 1 && Math.abs(p[1]) <= 1);
  if (line.length) console.log(`  metrobüs hattı: ${line.length} köşe kadrajda, ekran ${line.map((p) => `(${p[0].toFixed(2)},${p[1].toFixed(2)})`).join(' ')}`);
}

// ───────── --scene: gerçek sahneye karşı (hareketli trafik dahil) ─────────
// Tarayıcıda sahne kurulur, her örnekte __renderFrame(t) ile trafik o ana getirilir; kameradan 14 yönde
// ışın (yarıçap SR m) + önceki örnekten bu örneğe ışın. Statik ağlar kameraya uzaklığa göre önelenir.
if (args.scene) {
  const { openBrowser, openScene } = await import('./lib-browser.mjs');
  const SHZ = Number(args['scene-hz']) || 10, SR = Number(args['scene-r']) || 1.5;
  const atmo = args.atmo && args.atmo !== true ? String(args.atmo) : 'b';
  const env = await openBrowser();
  try {
    const sc = await openScene(env, { query: { render: '1', w: 64, h: 114, q: 'draft', atmo }, width: 64, height: 114, log: false });
    console.log(`\nsahne denetimi (atmo ${atmo}, ${SHZ} Hz, yarıçap ${SR} m): ${JSON.stringify(await sc.page.evaluate(() => window.__modules.modules))}`);
    const n = Math.round(D * SHZ);
    let worst = { d: Infinity };
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * D;
      await sc.page.evaluate((tt) => window.__renderFrame(tt), t);
      const r = await sc.page.evaluate(() => {
        const { THREE, scene, camera } = window.__ctx;
        const p = camera.position.clone();
        if (!window.__crMeshes) {
          const list = [];
          scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.geometry && !/sky|atmo|cloud|star|sun|moon|glow|halo|sprite|flare/i.test(o.name + '/' + (o.parent?.name || '')) && !(o.material && o.material.side === THREE.BackSide)) list.push(o); });
          window.__crMeshes = list;
        }
        const sph = new THREE.Sphere();
        const near = window.__crMeshes.filter((o) => {
          if (!o.visible) return false;
          if (o.isInstancedMesh) return true;
          if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
          sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
          return sph.distanceToPoint(p) < 80;
        });
        const rc = new THREE.Raycaster(); let best = { d: Infinity, name: '' };
        const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]];
        for (const v of dirs) {
          rc.set(p, new THREE.Vector3(...v).normalize()); rc.far = 10;
          const h = rc.intersectObjects(near, false)[0];
          if (h && h.distance < best.d) best = { d: h.distance, name: (h.object.parent?.name || '') + '/' + h.object.name };
        }
        let seg = null;
        if (window.__crPrev) {
          const d = p.clone().sub(window.__crPrev), L = d.length();
          if (L > 1e-6) { rc.set(window.__crPrev, d.normalize()); rc.far = L; const h = rc.intersectObjects(near, false)[0]; if (h) seg = (h.object.parent?.name || '') + '/' + h.object.name; }
        }
        window.__crPrev = p;
        return { best, seg };
      });
      if (r.best.d < worst.d) worst = { ...r.best, t };
      if (r.best.d < SR) hits.push(`t=${t.toFixed(2)} sahne: ${r.best.name} ${r.best.d.toFixed(2)} m`);
      if (r.seg) hits.push(`t=${t.toFixed(2)} sahne: rota parçası ${r.seg} içinden geçiyor`);
    }
    console.log(`sahne: en yakın yüzey ${worst.d.toFixed(2)} m (t=${worst.t?.toFixed(2)}, ${worst.name})`);
  } finally { await env.close(); }
}

if (hits.length) {
  console.log(`\nÇARPIŞMA: ${hits.length} örnek`);
  const seen = new Set();
  for (const h of hits) { const k = h.replace(/^t=[\d.]+ /, '').split(' (')[0]; if (seen.has(k)) continue; seen.add(k); console.log('  ' + h); }
  process.exit(1);
}
console.log('\nçarpışma yok ✓');
