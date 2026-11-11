// Açılış haritası: animate_villages2'nin veri hattı çıktısından (web/public/data/*.json — salt okunur) dikey kadraja
// uygun, yüksek çözünürlüklü ve kenar yumuşatmalı yeniden çizim. Renk/katman kuralları o projenin
// tools/build_data.py → overview() işlevinden bire bir alındı (arazi rampası, 10 m eş yükselti, yol sınıfı renkleri,
// tahmini bina = gri, yüksekliği bilinen bina = mavi→turuncu). Fark: canvas ile kenar yumuşatma, hafif kabartma gölgesi,
// bina gölgesi; hata ayıklama çerçeveleri (bbox/çekirdek) çizilmez; simge yapılar (pembe) haritaya GÖMÜLMEZ —
// poligonları map.json'a yazılır, sahne bunları SVG olarak üstte çizer/parlatır.
//   node comp/assets/hook/make-map.mjs            → comp/assets/hook/map.jpg + map.json
// animate_villages2 içine hiçbir şey yazılmaz.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = 'C:/Users/USER/Desktop/ege_repolar/animate_villages2/web/public/data';
const WIN = { x0: -560, x1: 1240, z0: -1260, z1: 1600 }; // metre (x doğu, z güney)
// Çıktı ölçeği 1.15 px/m: sahnede harita 0.83–1.08 px/m gösterilir → tarayıcı ölçeği 0.72–0.94 (taslakta 0.36–0.47).
// Böylece Chrome'un görsel mip eşikleri (0.5 / 0.25) hiç aşılmaz; kare, çizim sırasından bağımsız (deterministik) kalır.
const SCALE = 1.15; // piksel / metre (çıktı)
const SS = 2;       // üst örnekleme: 2.3 px/m çizilir, yarıya indirilir (kenar yumuşatma)

const load = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));
const data = { buildings: load('buildings.json'), roads: load('roads.json'), pois: load('pois.json'), terrain: load('terrain.json') };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('[sayfa]', m.text()));
const b64 = await page.evaluate(({ data, WIN, SCALE, SS }) => {
  const { buildings, roads, pois, terrain } = data;
  const W = Math.round((WIN.x1 - WIN.x0) * SCALE), H = Math.round((WIN.z1 - WIN.z0) * SCALE);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = (x) => (x - WIN.x0) * SCALE, pz = (z) => (z - WIN.z0) * SCALE;

  // ---- arazi: kübik B-spline ile yumuşak yükseklik alanı ----
  const { nx, nz, x0, z0, dx, dz, heights } = terrain;
  const gmin = Math.min(...heights), gmax = Math.max(...heights);
  const at = (i, j) => heights[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  const bs = (t) => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6, (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6];
  const hgt = new Float32Array(W * H);
  // ayrık: önce satır yönünde (x), sonra sütun (z)
  const tmp = new Float32Array(W * nz);
  for (let i = 0; i < W; i++) {
    const fx = (WIN.x0 + (i + 0.5) / SCALE - x0) / dx; const ix = Math.floor(fx); const w = bs(fx - ix);
    for (let j = 0; j < nz; j++) tmp[j * W + i] = w[0] * at(ix - 1, j) + w[1] * at(ix, j) + w[2] * at(ix + 1, j) + w[3] * at(ix + 2, j);
  }
  const cj = (j) => Math.min(nz - 1, Math.max(0, j));
  for (let y = 0; y < H; y++) {
    const fz = (WIN.z0 + (y + 0.5) / SCALE - z0) / dz; const iz = Math.floor(fz); const w = bs(fz - iz);
    const r0 = cj(iz - 1) * W, r1 = cj(iz) * W, r2 = cj(iz + 1) * W, r3 = cj(iz + 2) * W, o = y * W;
    for (let i = 0; i < W; i++) hgt[o + i] = w[0] * tmp[r0 + i] + w[1] * tmp[r1 + i] + w[2] * tmp[r2 + i] + w[3] * tmp[r3 + i];
  }
  const img = g.createImageData(W, H); const d = img.data;
  const L = [-0.55, -0.62, 0.56]; // ışık: kuzeybatıdan
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x; const h = hgt[o];
      const hx = (hgt[y * W + Math.min(W - 1, x + 1)] - hgt[y * W + Math.max(0, x - 1)]) * 0.5; // m / px
      const hy = (hgt[Math.min(H - 1, y + 1) * W + x] - hgt[Math.max(0, y - 1) * W + x]) * 0.5;
      const tn = (h - gmin) / (gmax - gmin);
      let r = 40 + 60 * tn, gg = 55 + 70 * tn, b = 45 + 40 * tn;
      // kabartma gölgesi (hafif): normal = (-dh/dx, -dh/dz, 1) ; dikey abartı 2.2
      const sx = hx * SCALE * 2.2, sy = hy * SCALE * 2.2; const inv = 1 / Math.hypot(sx, sy, 1);
      const lum = (-sx * L[0] - sy * L[1] + L[2]) * inv; // düzde 0.56
      const sh = 1 + Math.max(-0.2, Math.min(0.2, (lum - 0.56) * 0.6));
      r *= sh; gg *= sh; b *= sh;
      // eş yükselti: 5 m ince, 25 m belirgin (piksel mesafesine göre yumuşatılmış)
      const grad = Math.hypot(hx, hy);
      if (grad > 0.0015) {
        const f = h / 5, dist = Math.abs(f - Math.round(f)) * 5 / grad;
        const idx = Math.abs(Math.round(f) % 5) === 0;
        const a = Math.max(0, Math.min(1, (idx ? 2.0 : 1.25) - dist));
        if (a > 0) { const k = 1 - a * (idx ? 0.34 : 0.22); r *= k; gg *= k; b *= k; }
      }
      const q = o * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // ---- yardımcılar ----
  const rgb = (c, a = 1) => `rgba(${c.map((v) => Math.round(v)).join(',')},${a})`;
  const ring = (pts) => { g.moveTo(px(pts[0][0]), pz(pts[0][1])); for (let i = 1; i < pts.length; i++) g.lineTo(px(pts[i][0]), pz(pts[i][1])); g.closePath(); };
  const fill = (pts, col, a = 1) => { g.beginPath(); ring(pts); g.fillStyle = rgb(col, a); g.fill(); };
  const line = (pts, col, wd, a = 1) => {
    g.beginPath(); g.moveTo(px(pts[0][0]), pz(pts[0][1]));
    for (let i = 1; i < pts.length; i++) g.lineTo(px(pts[i][0]), pz(pts[i][1]));
    g.strokeStyle = rgb(col, a); g.lineWidth = wd; g.stroke();
  };
  g.lineCap = 'round'; g.lineJoin = 'round';

  for (const p of pois.greens) fill(p.ring, [70, 140, 70], 0.7);
  for (const p of pois.squares) fill(p.ring, [200, 190, 150], 0.6);

  // ---- yollar (overview() sırası ve renkleri) ----
  const MAJOR = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'busway']);
  const FOOT = new Set(['footway', 'steps', 'pedestrian', 'path', 'platform', 'corridor', 'cycleway']);
  const rcol = { trunk: [250, 170, 60], trunk_link: [230, 160, 80], primary: [240, 220, 120], primary_link: [230, 210, 130], secondary: [235, 235, 170], tertiary: [225, 225, 225] };
  const key = (r) => (r.bridge ? 4 : 0) + (r.busway ? 2 : 0) + (MAJOR.has(r.cls) ? 1 : 0);
  const order = roads.map((r, i) => [r, i]).sort((a, b) => key(a[0]) - key(b[0]) || a[1] - b[1]).map((x) => x[0]);
  // önce araç yollarının koyu kenarlığı (derinlik)
  for (const r of order) {
    if (r.tunnel || FOOT.has(r.cls)) continue;
    line(r.pts.map((p) => [p[0], p[2]]), [18, 28, 20], Math.max(1, r.width * SCALE) + 2.4, 0.4);
  }
  for (const r of order) {
    const pts = r.pts.map((p) => [p[0], p[2]]);
    const wd = Math.max(1, r.width * SCALE);
    if (r.tunnel) { g.setLineDash([6, 6]); line(pts, [90, 60, 130], 1.4); g.setLineDash([]); }
    else if (r.busway) line(pts, [255, 60, 60], Math.max(2, wd));
    else if (r.bridge) line(pts, [80, 220, 255], Math.max(2, wd));
    else if (FOOT.has(r.cls)) line(pts, [150, 120, 100], 1.3, 0.9);
    else line(pts, rcol[r.cls] || [170, 170, 170], wd);
  }

  // ---- binalar: yükseklik sırasıyla; simge yapılar atlanır ----
  const bs2 = buildings.filter((b) => !b.landmark).sort((a, b) => a.height - b.height);
  g.save(); g.translate(2.2, 2.8);
  for (const b of bs2) { g.beginPath(); ring(b.ring); g.fillStyle = 'rgba(8,16,10,0.34)'; g.fill(); }
  g.restore();
  for (const b of bs2) {
    const hh = Math.min(b.height, 160) / 160;
    let col;
    if (b.estimated) { const v = 95 + 120 * Math.min(b.height / 35, 1); col = [v, v, v]; }
    else col = [60 + 195 * Math.sqrt(hh), 150 - 60 * hh, 235 - 200 * hh];
    g.beginPath(); ring(b.ring); for (const hole of b.holes || []) ring(hole);
    g.fillStyle = rgb(col); g.fill('evenodd');
    g.strokeStyle = 'rgba(14,24,17,0.42)'; g.lineWidth = 1; g.stroke();
  }

  // ---- noktalar ----
  const dot = (x, z, r, col) => { g.beginPath(); g.arc(px(x), pz(z), r, 0, Math.PI * 2); g.fillStyle = rgb(col); g.fill(); };
  for (const t of pois.trees) dot(t[0], t[1], 2.6, [40, 255, 80]);
  for (const e of pois.entrances) dot(e.x, e.z, 3.2, [255, 255, 0]);
  g.lineCap = 'butt';
  for (const s of pois.stations) { line([[s.x - 8, s.z], [s.x + 8, s.z]], [255, 255, 255], 2.4); line([[s.x, s.z - 8], [s.x, s.z + 8]], [255, 255, 255], 2.4); }
  line([[-15, 0], [15, 0]], [255, 0, 0], 2.4); line([[0, -15], [0, 15]], [255, 0, 0], 2.4);
  const ow = Math.round(W / SS), oh = Math.round(H / SS);
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(cv, 0, 0, ow, oh);
  console.log(`harita ${W}x${H} → ${ow}x${oh}`);
  return out.toDataURL('image/jpeg', 0.93).split(',')[1];
}, { data, WIN, SCALE: SCALE * SS, SS });
await browser.close();
writeFileSync(join(HERE, 'map.jpg'), Buffer.from(b64, 'base64'));

// ---- map.json: sahnenin ihtiyacı olan geometri (harita pikseli) ----
const P = (x, z) => [+((x - WIN.x0) * SCALE).toFixed(1), +((z - WIN.z0) * SCALE).toFixed(1)];
const landmarks = {};
for (const b of data.buildings) {
  if (!b.landmark) continue;
  (landmarks[b.landmark] ||= []).push({ id: b.id, name: b.name || null, height: b.height, ring: b.ring.map(([x, z]) => P(x, z)) });
}
const out = {
  note: 'make-map.mjs çıktısı. Koordinatlar harita pikseli (map.jpg). Pembe = build_data.py LANDMARK_IDS (trump, torun, cevahir); adlar OSM etiketlerinden.',
  window: WIN, scale: SCALE, width: Math.round((WIN.x1 - WIN.x0) * SCALE), height: Math.round((WIN.z1 - WIN.z0) * SCALE),
  origin: P(0, 0), lat0: 41.066886, lon0: 28.991723,
  landmarks,
  stations: data.pois.stations.map((s) => ({ name: s.name, kind: s.kind, p: P(s.x, s.z) })),
  metrobus: data.pois.metrobusLines.map((l) => ({ name: l.name, pts: l.pts.map((p) => P(p[0], p[2])) })),
};
writeFileSync(join(HERE, 'map.json'), JSON.stringify(out));
console.log('ok', out.width, out.height, Object.fromEntries(Object.entries(landmarks).map(([k, v]) => [k, v.length])));
