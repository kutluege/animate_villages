// Hook laboratuvarı: açılış haritasının (comp/assets/hook/make-map.mjs) YAKIN PLAN katmanları.
// Aynı veri, aynı renk/katman kuralları; yalnız daha yüksek ölçekte ve parça parça (karo) çizilir → yakın planda harita bulanıklaşmaz.
//   node tools/hook-lab-map.mjs   → comp/assets/hook-lab/<seviye>_<i>_<j>.jpg + levels.json
// animate_villages2 ve comp/assets/hook içine hiçbir şey yazılmaz.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ROOT } from './serve.mjs';

const SRC = 'C:/Users/USER/Desktop/ege_repolar/animate_villages2/web/public/data';
const OUT = join(ROOT, 'comp', 'assets', 'hook-lab');
mkdirSync(OUT, { recursive: true });
// Seviyeler (metre, x doğu / z güney). TILE: karo boyu (çıktı pikseli), MG: karo kenar payı (komşu karoyla bindirme)
const LEVELS = [
  { id: 'L1', scale: 3, win: { x0: -260, x1: 960, z0: -500, z1: 800 } },     // üç simge yapı + çevresi
  { id: 'L2', scale: 7.5, win: { x0: -140, x1: 240, z0: -400, z1: 40 } },   // Trump Towers yakını (makro)
];
const TILE = 1300, MG = 6, SS = 2;

const load = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'));
const data = { buildings: load('buildings.json'), roads: load('roads.json'), pois: load('pois.json'), terrain: load('terrain.json') };

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => console.log('[sayfa]', m.text()));
await page.evaluate((d) => { window.__data = d; }, data);
await page.evaluate(`window.drawTile = ${drawTile.toString()}`);

const meta = { note: 'tools/hook-lab-map.mjs çıktısı. Her karo: dosya + metre penceresi (kenar payı dahil). Renk kuralları make-map.mjs ile aynı.', levels: [] };
for (const L of LEVELS) {
  const Wt = Math.round((L.win.x1 - L.win.x0) * L.scale), Ht = Math.round((L.win.z1 - L.win.z0) * L.scale);
  const nx = Math.ceil(Wt / TILE), nz = Math.ceil(Ht / TILE);
  const tiles = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const px0 = i * TILE - MG, pz0 = j * TILE - MG;
    const pw = Math.min(TILE, Wt - i * TILE) + 2 * MG, ph = Math.min(TILE, Ht - j * TILE) + 2 * MG;
    const win = { x0: L.win.x0 + px0 / L.scale, z0: L.win.z0 + pz0 / L.scale };
    win.x1 = win.x0 + pw / L.scale; win.z1 = win.z0 + ph / L.scale;
    const b64 = await page.evaluate(({ WIN, SCALE, SS, pw, ph }) => drawTile(window.__data, WIN, SCALE, SS, pw, ph), { WIN: win, SCALE: L.scale, SS, pw, ph });
    const file = `${L.id}_${i}_${j}.jpg`;
    writeFileSync(join(OUT, file), Buffer.from(b64, 'base64'));
    tiles.push({ file, i, j, w: pw, h: ph, ...win });
    console.log(`[harita] ${file} ${pw}×${ph}`);
  }
  meta.levels.push({ id: L.id, scale: L.scale, win: L.win, mg: MG, tiles });
}
await browser.close();
writeFileSync(join(OUT, 'levels.json'), JSON.stringify(meta, null, 1));
console.log('ok');

// ---- sayfada çalışan çizim (make-map.mjs'in gövdesi; pencere ve ölçek parametreli) ----
function drawTile(data, WIN0, SCALE0, SS, pw, ph) {
  const { buildings, roads, pois, terrain } = data;
  const SCALE = SCALE0 * SS;
  const W = pw * SS, H = ph * SS;
  const WIN = WIN0;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const px = (x) => (x - WIN.x0) * SCALE, pz = (z) => (z - WIN.z0) * SCALE;
  const { nx, nz, x0, z0, dx, dz, heights } = terrain;
  let gmin = Infinity, gmax = -Infinity; for (const v of heights) { if (v < gmin) gmin = v; if (v > gmax) gmax = v; }
  const at = (i, j) => heights[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];
  const bs = (t) => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t ** 2 + 4) / 6, (-3 * t ** 3 + 3 * t ** 2 + 3 * t + 1) / 6, t ** 3 / 6];
  const hgt = new Float32Array(W * H);
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
  const L = [-0.55, -0.62, 0.56];
  // make-map: 2.3 px/m çizimde piksel başı eğim; burada metre başına eğimi aynı ölçeğe getir (kabartma ve eş yükselti kalınlığı aynı görünsün)
  const REF = 2.3, k = SCALE / REF;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x; const h = hgt[o];
      const hx = (hgt[y * W + Math.min(W - 1, x + 1)] - hgt[y * W + Math.max(0, x - 1)]) * 0.5 * k;
      const hy = (hgt[Math.min(H - 1, y + 1) * W + x] - hgt[Math.max(0, y - 1) * W + x]) * 0.5 * k;
      const tn = (h - gmin) / (gmax - gmin);
      let r = 40 + 60 * tn, gg = 55 + 70 * tn, b = 45 + 40 * tn;
      const sx = hx * REF * 2.2, sy = hy * REF * 2.2; const inv = 1 / Math.hypot(sx, sy, 1);
      const lum = (-sx * L[0] - sy * L[1] + L[2]) * inv;
      const sh = 1 + Math.max(-0.2, Math.min(0.2, (lum - 0.56) * 0.6));
      r *= sh; gg *= sh; b *= sh;
      const grad = Math.hypot(hx, hy) / k; // m / (çizim pikseli)
      if (grad > 0.0015 / k) {
        const f = h / 5, dist = Math.abs(f - Math.round(f)) * 5 / grad;
        const idx = Math.abs(Math.round(f) % 5) === 0;
        const a = Math.max(0, Math.min(1, (idx ? 2.0 : 1.25) * Math.sqrt(k) - dist));
        if (a > 0) { const kk = 1 - Math.min(1, a) * (idx ? 0.34 : 0.22); r *= kk; gg *= kk; b *= kk; }
      }
      const q = o * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // çizgi kalınlıkları make-map'teki görünür kalınlığın sqrt(k) katı (yakında biraz daha kalın, ama ölçekle orantılı şişmez)
  const lw = Math.sqrt(k);
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
  const MAJOR = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'busway']);
  const FOOT = new Set(['footway', 'steps', 'pedestrian', 'path', 'platform', 'corridor', 'cycleway']);
  const rcol = { trunk: [250, 170, 60], trunk_link: [230, 160, 80], primary: [240, 220, 120], primary_link: [230, 210, 130], secondary: [235, 235, 170], tertiary: [225, 225, 225] };
  const key = (r) => (r.bridge ? 4 : 0) + (r.busway ? 2 : 0) + (MAJOR.has(r.cls) ? 1 : 0);
  const order = roads.map((r, i) => [r, i]).sort((a, b) => key(a[0]) - key(b[0]) || a[1] - b[1]).map((x) => x[0]);
  for (const r of order) {
    if (r.tunnel || FOOT.has(r.cls)) continue;
    line(r.pts.map((p) => [p[0], p[2]]), [18, 28, 20], Math.max(lw, r.width * SCALE) + 2.4 * lw, 0.4);
  }
  for (const r of order) {
    const pts = r.pts.map((p) => [p[0], p[2]]);
    const wd = Math.max(lw, r.width * SCALE);
    if (r.tunnel) { g.setLineDash([6 * k, 6 * k]); line(pts, [90, 60, 130], 1.4 * lw); g.setLineDash([]); }
    else if (r.busway) line(pts, [255, 60, 60], Math.max(2 * lw, wd));
    else if (r.bridge) line(pts, [80, 220, 255], Math.max(2 * lw, wd));
    else if (FOOT.has(r.cls)) line(pts, [150, 120, 100], 1.3 * lw, 0.9);
    else line(pts, rcol[r.cls] || [170, 170, 170], wd);
  }
  const bs2 = buildings.filter((b) => !b.landmark).sort((a, b) => a.height - b.height);
  g.save(); g.translate(2.2 * k, 2.8 * k);
  for (const b of bs2) { g.beginPath(); ring(b.ring); g.fillStyle = 'rgba(8,16,10,0.34)'; g.fill(); }
  g.restore();
  for (const b of bs2) {
    const hh = Math.min(b.height, 160) / 160;
    let col;
    if (b.estimated) { const v = 95 + 120 * Math.min(b.height / 35, 1); col = [v, v, v]; }
    else col = [60 + 195 * Math.sqrt(hh), 150 - 60 * hh, 235 - 200 * hh];
    g.beginPath(); ring(b.ring); for (const hole of b.holes || []) ring(hole);
    g.fillStyle = rgb(col); g.fill('evenodd');
    g.strokeStyle = 'rgba(14,24,17,0.42)'; g.lineWidth = lw; g.stroke();
  }
  const dot = (x, z, r, col) => { g.beginPath(); g.arc(px(x), pz(z), r, 0, Math.PI * 2); g.fillStyle = rgb(col); g.fill(); };
  for (const t of pois.trees) dot(t[0], t[1], 2.6 * lw, [40, 255, 80]);
  for (const e of pois.entrances) dot(e.x, e.z, 3.2 * lw, [255, 255, 0]);
  g.lineCap = 'butt';
  for (const s of pois.stations) { line([[s.x - 8, s.z], [s.x + 8, s.z]], [255, 255, 255], 2.4 * lw); line([[s.x, s.z - 8], [s.x, s.z + 8]], [255, 255, 255], 2.4 * lw); }
  line([[-15, 0], [15, 0]], [255, 0, 0], 2.4 * lw); line([[0, -15], [0, 15]], [255, 0, 0], 2.4 * lw);
  const out = document.createElement('canvas'); out.width = pw; out.height = ph;
  const og = out.getContext('2d'); og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
  og.drawImage(cv, 0, 0, pw, ph);
  return out.toDataURL('image/jpeg', 0.92).split(',')[1];
}
