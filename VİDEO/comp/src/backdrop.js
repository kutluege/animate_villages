// Ortak fon: açılıştaki haritanın topografya zemini — prosedürel, keskin, t'nin saf fonksiyonu.
// Açılışta BİR KEZ tuvale çizilir (tohumlu gürültüden yükseklik alanı → yumuşak yeşil tonlama + vektör eş yükselti
// çizgileri + silik ızgara ve nirengi artıları; okunur metin yok); kare başına yalnızca bir transform güncellenir (çok ucuz).
import { C, H, W, alpha, clamp, lerp, rng } from './theme.js';
import { h } from './kit.js';

const BW = 1500, BH = 2200;      // çizilen dünya (px): 1080×1920 + kayma payı
const STEP = 3;                  // yükseklik alanı örnekleme adımı (px)
const VX = 2.4, VY = 1.5;        // kayma hızı (px/sn) — "çok yavaş"
const LEVELS = 17;               // eş yükselti aralığı sayısı
const GRID = 300;                // nirengi ızgarası (px ≈ m)
const TAU = Math.PI * 2;

/** Tohumlu gradyan gürültüsü (Perlin), ~[-0.7, 0.7] */
function makeNoise(seed) {
  const r = rng(seed), N = 256, gx = new Float32Array(N * N), gy = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) { const a = r() * TAU; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
    const a = gx[y0 + x0] * fx + gy[y0 + x0] * fy, b = gx[y0 + x1] * (fx - 1) + gy[y0 + x1] * fy;
    const c = gx[y1 + x0] * fx + gy[y1 + x0] * (fy - 1), d = gx[y1 + x1] * (fx - 1) + gy[y1 + x1] * (fy - 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

function paint(canvas, k = 1) {
  const n1 = makeNoise(4107), n2 = makeNoise(2899);
  const gw = Math.ceil(BW / STEP) + 1, gh = Math.ceil(BH / STEP) + 1;
  const hf = new Float32Array(gw * gh);
  // Yükseklik: alan bükmeli (domain warp) fbm — haritadaki gibi kıvrımlı, geniş sırt/vadi
  const F = 1 / 640;
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const x = i * STEP, y = j * STEP;
      const wx = x + 190 * n2(x * F * 0.9 + 3.1, y * F * 0.9 + 7.7) + 60 * n2(x * F * 2.3 + 40.2, y * F * 2.3 + 11.9);
      const wy = y + 190 * n2(x * F * 0.9 + 91.4, y * F * 0.9 + 55.3) + 60 * n2(x * F * 2.3 + 17.6, y * F * 2.3 + 73.1);
      let v = 0, amp = 1, fx = wx * F, fy = wy * F;
      for (let o = 0; o < 4; o++) {
        v += amp * n1(fx + o * 17.3, fy + o * 9.1);
        const rx = fx * 1.62 - fy * 1.18, ry = fx * 1.18 + fy * 1.62; // döndür + ~2.0× sıklaştır
        fx = rx; fy = ry; amp *= 0.46;
      }
      hf[j * gw + i] = v;
      if (v < lo) lo = v; if (v > hi) hi = v;
    }
  }
  for (let k = 0; k < hf.length; k++) hf[k] = (hf[k] - lo) / (hi - lo);

  // ---- Tonlama: yüksekliğe göre yeşil rampa + yumuşak kuzeybatı ışığı (düşük çözünürlükte hesap, pürüzsüz büyütme) ----
  const low = hex(C.topoLow), mid = hex(C.topoMid), high = hex(C.topoHigh);
  const small = document.createElement('canvas'); small.width = gw; small.height = gh;
  const sg = small.getContext('2d'), img = sg.createImageData(gw, gh), dither = rng(91);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      const dx = hf[j * gw + Math.min(gw - 1, i + 2)] - hf[j * gw + Math.max(0, i - 2)];
      const dy = hf[Math.min(gh - 1, j + 2) * gw + i] - hf[Math.max(0, j - 2) * gw + i];
      const shade = clamp(-(dx * 0.72 + dy * 0.69) * 9, -1, 1);       // ışık sol üstten
      let v = clamp(0.06 + hf[k] * 0.9 + shade * 0.16);
      v = v * v * (3 - 2 * v);
      const a = v < 0.5 ? low : mid, b = v < 0.5 ? mid : high, x = v < 0.5 ? v * 2 : v * 2 - 2 + 1;
      const d = (dither() - 0.5) * 1.6;                               // bantlanmaya karşı ±1 seviye titreşim
      img.data[k * 4] = lerp(a[0], b[0], x) + d; img.data[k * 4 + 1] = lerp(a[1], b[1], x) + d; img.data[k * 4 + 2] = lerp(a[2], b[2], x) + d;
      img.data[k * 4 + 3] = 255;
    }
  }
  sg.putImageData(img, 0, 0);
  canvas.width = Math.round(BW * k); canvas.height = Math.round(BH * k);
  const g = canvas.getContext('2d');
  g.setTransform(canvas.width / BW, 0, 0, canvas.height / BH, 0, 0); // dünya px → tuval px
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, gw, gh, -STEP / 2, -STEP / 2, gw * STEP, gh * STEP);

  // ---- Eş yükselti çizgileri: yürüyen kareler → vektör çizgi (tam çözünürlükte, keskin) ----
  const thin = new Path2D(), index = new Path2D();
  const seg = (p, ax, ay, bx, by) => { p.moveTo(ax * STEP, ay * STEP); p.lineTo(bx * STEP, by * STEP); };
  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      const a = hf[j * gw + i], b = hf[j * gw + i + 1], c = hf[(j + 1) * gw + i + 1], d = hf[(j + 1) * gw + i];
      const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
      for (let L = Math.ceil(mn * LEVELS); L <= mx * LEVELS; L++) {
        const v = L / LEVELS;
        if (v <= mn || v > mx) continue;
        const pts = [];
        if ((a < v) !== (b < v)) pts.push(i + (v - a) / (b - a), j);
        if ((b < v) !== (c < v)) pts.push(i + 1, j + (v - b) / (c - b));
        if ((d < v) !== (c < v)) pts.push(i + (v - d) / (c - d), j + 1);
        if ((a < v) !== (d < v)) pts.push(i, j + (v - a) / (d - a));
        const p = L % 4 === 0 ? index : thin;
        if (pts.length >= 4) seg(p, pts[0], pts[1], pts[2], pts[3]);
        if (pts.length === 8) seg(p, pts[4], pts[5], pts[6], pts[7]);
      }
    }
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = C.line; g.lineWidth = 1.5; g.stroke(thin);
  g.strokeStyle = alpha(C.night, 0.5); g.lineWidth = 2.2; g.stroke(index);
  g.strokeStyle = alpha(C.ink, 0.045); g.lineWidth = 1; g.stroke(index); // ana eğrilerde çok hafif krem parıltı

  // ---- Kartografik ayrıntılar: silik ızgara + nirengi artıları. OKUNUR METİN YOK (koordinat/rakım yazıları sahnelerin ön
  // etiketleriyle çakışıyordu); koordinat etiketi gerekiyorsa sahne kendi katmanında kit.coordLabel() ile koyar. ----
  g.strokeStyle = alpha(C.ink, 0.05); g.lineWidth = 1;
  g.beginPath();
  for (let x = GRID / 2; x < BW; x += GRID) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, BH); }
  for (let y = GRID / 2; y < BH; y += GRID) { g.moveTo(0, y + 0.5); g.lineTo(BW, y + 0.5); }
  g.stroke();
  g.strokeStyle = alpha(C.ink, 0.3); g.lineWidth = 1.6;
  g.beginPath();
  for (let x = GRID / 2; x < BW; x += GRID) for (let y = GRID / 2; y < BH; y += GRID) { g.moveTo(x - 9, y + 0.5); g.lineTo(x + 10, y + 0.5); g.moveTo(x + 0.5, y - 9); g.lineTo(x + 0.5, y + 10); }
  g.stroke();
}

/** Döner: Promise<{ el, update(t, vis) }>. pixelScale: çıktı pikseli / sahne pikseli (taslakta 0.5).
 *  Tuval ÇIKTI çözünürlüğünde bir kez çizilip PNG <img>'ye çevrilir; böylece görsel hiçbir zaman küçültülmez (hep ×1.00–1.03).
 *  Küçültülen büyük görselde Chrome'un mip/önbellek seçimi geçmişe bağlı ±1 seviye oynatıyor → determinizm sınaması bozuluyordu. */
export async function createBackdrop({ pixelScale = 1 } = {}) {
  const cv = document.createElement('canvas');
  paint(cv, pixelScale);
  const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
  const map = h('img', { draggable: 'false', style: { position: 'absolute', left: '0', top: '0', width: BW + 'px', height: BH + 'px', maxWidth: 'none', transformOrigin: '0 0' } });
  map.decoding = 'sync';
  map.src = URL.createObjectURL(blob);
  await map.decode();
  // Gezinen yumuşak ışık havuzu ("nefes") + sabit kenar kararması (yazı ve arayüz bölgeleri için)
  const light = h('div', { style: { position: 'absolute', left: '-800px', top: '-800px', width: '1600px', height: '1600px',
    background: `radial-gradient(closest-side, ${alpha(C.window, 0.13)} 0%, ${alpha(C.window, 0.05)} 45%, ${alpha(C.window, 0)} 100%)` } });
  const vignette = h('div', { style: { position: 'absolute', inset: '0', background:
    `radial-gradient(115% 80% at 50% 44%, ${alpha(C.night, 0)} 42%, ${alpha(C.night, 0.5)} 100%),` +
    `linear-gradient(180deg, ${alpha(C.night, 0.5)} 0%, ${alpha(C.night, 0)} 15%, ${alpha(C.night, 0)} 70%, ${alpha(C.night, 0.55)} 100%)` } });
  const el = h('div', { id: 'backdrop', class: 'layer' }, map, light, vignette);
  let shown = null;
  return {
    el,
    /** t: global sn; vis: 0..1 görünürlük (0 → katman kapalı) */
    update(t, vis = 1) {
      const on = vis > 0.001;
      if (on !== shown) { shown = on; el.style.display = on ? '' : 'none'; }
      if (!on) return;
      el.style.opacity = vis >= 0.999 ? '' : vis.toFixed(4);
      const sc = 1.016 + 0.014 * Math.sin(t * TAU / 41 - 1.2);
      const cx = clamp(560 + VX * t + 10 * Math.sin(t * TAU / 29), W / 2, BW - W / 2);
      const cy = clamp(976 + VY * t + 8 * Math.cos(t * TAU / 37), H / 2, BH - H / 2);
      map.style.transform = `translate(${(W / 2 - cx * sc).toFixed(3)}px, ${(H / 2 - cy * sc).toFixed(3)}px) scale(${sc.toFixed(5)})`;
      const lx = 540 + 330 * Math.sin(t * TAU / 67 + 1.0), ly = 820 + 460 * Math.sin(t * TAU / 89 + 2.4);
      light.style.transform = `translate(${lx.toFixed(2)}px, ${ly.toFixed(2)}px)`;
      light.style.opacity = (0.75 + 0.25 * Math.sin(t * TAU / 19)).toFixed(4);
    },
  };
}
