// baglam — "tek bir sohbette, tek bir modele yazdırmadım… bağlam şişer… model saçmalamaya başlar"
// Tek metafor: harita üstünde tek bir "sohbet kutusu". İş geldikçe satırlar birikir, sıkışır, bulanır; kutu şişer,
// ölçek çubuğu (BAĞLAM) taşar; "saçmalamaya" sözünde yazılar anlamsızlaşır, çerçeve çatlar.
// Bu dosya ayrıca anlatım sahnelerinin (ekip / maresal / dongu) ortak küçük yardımcılarını da dışa verir.
import { C, FONT, SAFE, W, H, ease, range, clamp, lerp, hash01, rng } from '../theme.js';
import { h, s } from '../kit.js';

// =====================================================================================================================
// Ortak yardımcılar (anlatım sahneleri)
// =====================================================================================================================
/** Tema belirtecinden yarı saydam renk (sabit renk yazmamak için). */
export const rgba = (c, a) => {
  if (/^#[0-9a-f]{6}$/i.test(c)) { const n = parseInt(c.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  return `color-mix(in srgb, ${c} ${(a * 100).toFixed(1)}%, transparent)`;
};
/** İki tema rengi arasında geçiş (x: 0 → a, 1 → b). */
export const mixc = (a, b, x) => `color-mix(in srgb, ${b} ${(clamp(x) * 100).toFixed(1)}%, ${a})`;
/** Tam ekran SVG katmanı (1080×1920 koordinatları). */
export const svgLayer = (props = {}) => s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H,
  style: { position: 'absolute', left: '0', top: '0', overflow: 'visible', pointerEvents: 'none' }, ...props });
/** Haritacı köşe işaretleri (dört köşede L). */
export const ticksD = (x, y, w, hh, L = 18) =>
  `M${x},${y + L}V${y}H${x + L} M${x + w - L},${y}H${x + w}V${y + L} M${x + w},${y + hh - L}V${y + hh}H${x + w - L} M${x + L},${y + hh}H${x}V${y + hh - L}`;
/** Sahnenin gerçek koordinatı (üst proje README: 41.060–41.072 K, 28.984–29.000 D). */
export const COORD = '41.066° K   28.992° D';
/** Küçük mono etiket. */
export const label = (text, style = {}) => h('div', { style: {
  position: 'absolute', font: `700 28px/1 ${FONT.mono}`, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.dim, whiteSpace: 'nowrap', ...style } }, text);

/** Eğri yol: makePath([x,y], ['C',x1,y1,x2,y2,x,y] | ['L',x,y] …) → { d, len, at(u) → { x, y, a } } (yay uzunluğuna göre). */
export function makePath(start, ...segs) {
  let d = `M${start[0]},${start[1]}`;
  const pts = [[start[0], start[1]]];
  let p = start;
  for (const sg of segs) {
    if (sg[0] === 'L') { d += `L${sg[1]},${sg[2]}`; for (let i = 1; i <= 12; i++) pts.push([lerp(p[0], sg[1], i / 12), lerp(p[1], sg[2], i / 12)]); p = [sg[1], sg[2]]; }
    else {
      const [, x1, y1, x2, y2, x, y] = sg;
      d += `C${x1},${y1} ${x2},${y2} ${x},${y}`;
      for (let i = 1; i <= 40; i++) {
        const u = i / 40, v = 1 - u;
        pts.push([v * v * v * p[0] + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x,
          v * v * v * p[1] + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y]);
      }
      p = [x, y];
    }
  }
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = acc[acc.length - 1];
  return {
    d, len,
    at(u) {
      const L = clamp(u) * len;
      let i = 1;
      while (i < acc.length - 1 && acc[i] < L) i++;
      const k = (L - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
      const a = pts[i - 1], b = pts[i];
      return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), a: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
    },
  };
}

/** Beş köşeli yıldız yolu (rütbe yıldızı). */
export function starD(cx, cy, R, r = R * 0.42, rot = -90) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (rot + i * 36) * Math.PI / 180, q = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * q).toFixed(2)},${(cy + Math.sin(a) * q).toFixed(2)}`;
  }
  return d + 'Z';
}

/** BAĞLAM göstergesi: harita ölçek çubuğu. set(v, { over, color, status }) — v 0..1, over: taşma (px). */
export function scaleBar({ width = 300, height = 12, segs = 10, title = 'BAĞLAM', small = false, fs = small ? 26 : 28 } = {}) {
  const ttl = h('div', { style: { font: `700 ${fs}px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: C.ink, whiteSpace: 'nowrap' } }, title);
  const stat = h('div', { style: { font: `700 ${fs}px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.dim, whiteSpace: 'nowrap', textTransform: 'uppercase' } });
  const head = h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: width + 'px', marginBottom: (small ? 8 : 12) + 'px' } }, ttl, stat);
  const track = h('div', { style: { position: 'relative', width: width + 'px', height: height + 'px', boxSizing: 'border-box',
    border: `1.5px solid ${rgba(C.ink, 0.75)}`, background: rgba(C.night, 0.55) } });
  for (let i = 0; i < segs; i++) if (i % 2) track.append(h('div', { style: { position: 'absolute', left: (i * 100 / segs) + '%', top: '0', width: (100 / segs) + '%', height: '100%', background: rgba(C.ink, 0.16) } }));
  const fill = h('div', { style: { position: 'absolute', left: '0', top: '0', height: '100%', width: '0', background: C.window } });
  const over = h('div', { style: { position: 'absolute', left: '100%', top: '-3px', height: height + 3 + 'px', width: '0', background: C.ember } });
  const mark = h('div', { style: { position: 'absolute', top: height + 3 + 'px', left: '0', width: '0', height: '0', marginLeft: '-7px',
    borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderBottom: `10px solid ${C.ink}` } });
  track.append(fill, over, mark);
  const el = h('div', { style: { position: 'absolute' } }, head, track);
  return {
    el, title: ttl, stat,
    set(v, { over: ov = 0, color = C.window, status = null, statusColor = C.dim } = {}) {
      const k = clamp(v);
      fill.style.width = (k * 100).toFixed(2) + '%';
      fill.style.background = color;
      over.style.width = Math.max(0, ov).toFixed(1) + 'px';
      mark.style.left = `calc(${(k * 100).toFixed(2)}% + ${Math.max(0, ov).toFixed(1)}px)`;
      mark.style.borderBottomColor = color;
      if (status !== null && stat.textContent !== status) stat.textContent = status;
      stat.style.color = statusColor;
    },
  };
}

// =====================================================================================================================
// Sahne
// =====================================================================================================================
const USER = ['Mecidiyeköy’ü kur', 'yolları çiz', 'binaları yükselt', 'metrobüs hattını ekle', 'Trump Towers’ı kur', 'Cevahir’i ekle',
  'gün batımı ışığı', 'gece pencereleri', 'trafiği akıt', 'kamera rotası çiz', 'mezarlığı ekle', 'viyadük altını düzelt',
  'gökyüzünü yumuşat', 'cepheye derinlik ver', 'Torun Center’ı kur', 'açılışı değiştir', 'videoyu uzat', 'yeniden render et',
  'ışıkları aç', 'gölgeleri düzelt', 'kamerayı yavaşlat', 'kuleyi büyüt', 'yolu genişlet', 'bir daha dene'];
// Model satırları: üst projenin web/src/landmarks.js dosyasından gerçek kod satırları.
const MODEL = ['export async function create(ctx) {', 'const { THREE, heightAt } = ctx;', 'const root = new THREE.Group();',
  'const steel = std(0x8b9298, 0.38, 0.85);', 'const concrete = std(0x9c978e, 0.85, 0);', "const tt = byKey('trump_towers');",
  'function trumpTower(fp, H, residential, seed) {', 'const b = obb(fp.footprint);', 'const fr = frame(b.cx, b.cz, b.angle);',
  'for (let y = base + 2 * FH; y < whiteTop; y += FH) {', 'const r = interpRect(wN, y);', 'const trumpLed = glow(0xfff1dc, 3.5, 0.2);',
  'const top = (x, z) => heightAt(x, z) + 14;', 'const poly = cleanPoly(pod.footprint);', 'const paving = std(0xb3aa9c, 0.82, 0);',
  'const avGeo = new THREE.SphereGeometry(0.5, 10, 8);'];
const GARB = '█▓▒░#@%&?¿!/\\<>{}[]=+*~^§';
const N = 72, BASE = 46;
const CX = 540, CY = 784;

/** Kutunun (kenarları dışa bombeli) yolu. */
function boxD(hw, hh, b, r = 26) {
  const x0 = CX - hw, x1 = CX + hw, y0 = CY - hh, y1 = CY + hh;
  return `M${x0 + r},${y0} Q${CX},${y0 - b} ${x1 - r},${y0} Q${x1},${y0} ${x1},${y0 + r} Q${x1 + b},${CY} ${x1},${y1 - r} Q${x1},${y1} ${x1 - r},${y1} ` +
    `Q${CX},${y1 + b} ${x0 + r},${y1} Q${x0},${y1} ${x0},${y1 - r} Q${x0 - b},${CY} ${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0}Z`;
}

export async function create(ctx) {
  const tw = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const T = {
    sohbet: tw('tek', 0, 1.1), model: tw('tek', 1, 2.32), is: tw('iş', 0, 4.46), siser: tw('şişer', 0, 6.78),
    sistikce: tw('şiştikçe', 0, 7.82), sac: tw('saçmalamaya', 0, 8.66), baslar: tw('başlar', 0, 9.34),
  };
  const D = ctx.duration;

  // Satır sayısı (sürekli): önce tek tük, sonra hızlanarak, sonra taşarak
  const count = (t) => 10 * range(t, 0.1, T.is - 0.15) + 36 * range(t, T.is - 0.1, T.siser + 0.35, (x) => x * x) + 26 * range(t, T.siser + 0.35, T.sac + 0.1);
  const birth = [];
  for (let i = 0; i < N; i++) { let lo = 0, hi = D; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (count(m) > i) hi = m; else lo = m; } birth.push(hi); }

  const el = h('div', { class: 'scene' });
  const world = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: `${CX}px ${CY}px` } });

  // --- BAĞLAM ölçek çubuğu (üstte) ---
  const BARW = 700;
  const bar = scaleBar({ width: BARW, height: 16, segs: 10, title: 'BAĞLAM' });
  bar.el.style.left = SAFE.left + 'px'; bar.el.style.top = '238px';
  const barNote = h('div', { style: { position: 'absolute', left: SAFE.left + 'px', top: '318px', font: `500 28px/1 ${FONT.display}`, color: C.dim, whiteSpace: 'nowrap' } },
    'modelin aynı anda aklında tuttuğu her şey');

  // --- Kutu ---
  const content = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const fillBg = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px', background: C.glass } });
  const rowsEl = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const heat = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const slices = Array.from({ length: 4 }, () => h('div', { class: 'abs', style: { left: '0', height: '10px', display: 'none' } }));
  content.append(fillBg, rowsEl, heat, ...slices);

  const rows = [];
  for (let i = 0; i < N; i++) {
    const user = i % 3 === 0;
    const text = user ? USER[(i / 3) % USER.length | 0] : MODEL[(i - 1 - Math.floor(i / 3)) % MODEL.length];
    const inner = user
      ? h('span', { style: { display: 'inline-block', padding: '7px 18px 8px', borderRadius: '12px 12px 3px 12px', background: rgba(C.window, 0.17),
        boxShadow: `inset 0 0 0 1px ${rgba(C.window, 0.35)}`, font: `600 29px/1 ${FONT.display}`, color: C.ink, whiteSpace: 'nowrap' } }, text)
      : h('span', { style: { display: 'inline-block', padding: '8px 0 9px 16px', borderLeft: `3px solid ${C.cyan}`, font: `500 24px/1 ${FONT.mono}`, color: C.dim, whiteSpace: 'nowrap' } }, text);
    const row = h('div', { class: 'abs', style: { height: BASE + 'px', transformOrigin: '0 0', textAlign: user ? 'right' : 'left', overflow: 'hidden', display: 'none' } }, inner);
    rowsEl.append(row);
    rows.push({ row, inner, user, text, shown: false, garb: -1 });
  }

  const svg = svgLayer();
  const ghostA = s('path', { fill: 'none', 'stroke-width': 3, style: { stroke: C.cyan }, opacity: 0 });
  const ghostB = s('path', { fill: 'none', 'stroke-width': 3, style: { stroke: C.pink }, opacity: 0 });
  const frame = s('path', { fill: 'none', 'stroke-width': 3, 'stroke-linejoin': 'round', pathLength: 1 });
  const tick = s('path', { fill: 'none', 'stroke-width': 2, style: { stroke: rgba(C.ink, 0.55) } });
  // çatlaklar: çerçeveden içeri uzanan kırık çizgiler (tohumlu)
  const crackDefs = [[-1, -0.55, 0.9, 0.25, 11], [1, 0.35, -0.85, -0.3, 23], [0.2, -1, -0.25, 0.9, 37], [-0.5, 1, 0.45, -0.8, 51], [1, -0.6, -0.7, 0.5, 67]];
  const cracks = crackDefs.map(() => ({ glow: s('path', { fill: 'none', 'stroke-width': 10, 'stroke-linejoin': 'bevel', pathLength: 1, style: { stroke: rgba(C.night, 0.75) } }),
    core: s('path', { fill: 'none', 'stroke-width': 3.2, 'stroke-linejoin': 'bevel', pathLength: 1, style: { stroke: C.ink } }) }));
  svg.append(ghostA, ghostB, ...cracks.flatMap((c) => [c.glow, c.core]), frame, tick);

  const chip = (text) => h('div', { style: { position: 'absolute', padding: '10px 16px 9px', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.1em',
    color: C.night, background: C.ink, whiteSpace: 'nowrap', transformOrigin: '0 100%' } }, text);
  const chipA = chip('TEK SOHBET'), chipB = chip('TEK MODEL');
  chipB.style.transformOrigin = '100% 100%';

  // "saçmalama" çıktısı: kutunun alt kenarına vurulan cevap
  const nonsense = h('div', { style: { position: 'absolute', left: '0', top: '0', width: W + 'px', display: 'flex', justifyContent: 'center', opacity: '0' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '18px', padding: '18px 28px 20px', background: C.ember, boxShadow: `0 18px 50px ${rgba(C.night, 0.6)}`, whiteSpace: 'nowrap' } },
      h('span', { style: { font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: rgba(C.ink, 0.9) } }, 'MODEL'),
      h('span', { style: { font: `750 44px/1 ${FONT.display}`, letterSpacing: '-0.01em', color: C.ink } }, '“Kuleleri denize kurdum.”')));
  const huh = h('div', { style: { position: 'absolute', font: `850 120px/1 ${FONT.display}`, color: C.window, opacity: '0', textShadow: `0 8px 30px ${rgba(C.night, 0.7)}` } }, '?!');

  world.append(content, svg, chipA, chipB, nonsense, huh);
  el.append(bar.el, barNote, world);

  function crackPath(def, hw, hh) {
    const [ex, ey, dx, dy, seed] = def;
    const r = rng(seed);
    // çerçeve üstündeki başlangıç noktası
    let x = CX + ex * hw, y = CY + ey * hh;
    const L = Math.hypot(dx, dy); const ux = dx / L, uy = dy / L;
    let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
    const steps = 7, stepLen = (Math.min(hw, hh) * 1.15) / steps;
    for (let i = 0; i < steps; i++) {
      const j = (r() - 0.5) * stepLen * 1.5;
      x += ux * stepLen - uy * j; y += uy * stepLen + ux * j;
      d += `L${x.toFixed(1)},${y.toFixed(1)}`;
      if (i === 3) { const bx = x - uy * stepLen * 1.4 + ux * stepLen * 0.6, by = y + ux * stepLen * 1.4 + uy * stepLen * 0.6; d += `L${bx.toFixed(1)},${by.toFixed(1)}M${x.toFixed(1)},${y.toFixed(1)}`; }
    }
    return d;
  }

  function update(t) {
    const n = count(t);
    const grow = 0.5 * range(t, T.is, T.siser + 0.3, ease.inOutCubic) + 0.5 * range(t, T.siser + 0.3, T.sac, ease.inOutCubic);
    const pressure = range(t, T.is + 0.6, T.sac);                         // 0..1 sıkışma
    const pop = range(t, T.siser - 0.05, T.siser + 0.7);                  // "şişer": yay gibi kabarma
    const gl = t >= T.sac ? 1 : 0;                                        // bozulma
    const hit1 = Math.exp(-Math.max(0, t - T.sac) * 3.2) * gl, hit2 = t >= T.baslar ? Math.exp(-(t - T.baslar) * 4) : 0;
    const breath = Math.sin(t * 8.5) * 3 * pressure;
    const hw = lerp(286, 430, grow) + breath * 0.5, hh = lerp(300, 366, grow) + breath * 0.5;
    const b = 26 * ease.spring(pop, 9, 4) * (pop > 0 ? 1 : 0) + 22 * range(t, T.siser + 0.6, T.sac, ease.inOutCubic) + breath + 8 * hit1;
    const amp = gl ? 3 + 13 * hit1 + 9 * hit2 : 0;
    const fi = Math.floor(t * 30 + 1e-6);
    const sx = (hash01(fi, 3) - 0.5) * 2 * amp, sy = (hash01(fi, 4) - 0.5) * 1.2 * amp;

    // giriş / çöküş (çöküş: yöneticinin duracağı noktaya doğru büzülür → ekip sahnesi oradan açılır)
    const inK = range(t, 0, 0.4, ease.outCubic);
    const out = range(t, D - 0.26, D + 0.3, ease.inCubic);
    world.style.transform = inK >= 1 && out <= 0 && !gl ? 'none' : `translate(${sx.toFixed(2)}px, ${(sy + (1 - inK) * 40 - out * 330).toFixed(2)}px) scale(${((0.94 + 0.06 * inK) * (1 - 0.9 * out)).toFixed(4)})`;
    world.style.opacity = (range(t, 0, 0.2) * (1 - range(t, D + 0.02, D + 0.3))).toFixed(4);
    const headOut = 1 - range(t, D - 0.2, D + 0.1);

    // çerçeve
    const d = boxD(hw, hh, b);
    const over = clamp((n - 46) / 26);
    const v = n / 46;
    const fc = v < 0.7 ? C.ink : v < 1 ? mixc(C.ink, C.sunset, (v - 0.7) / 0.3) : mixc(C.sunset, C.ember, over * 1.6);
    frame.setAttribute('d', d);
    frame.style.stroke = fc;
    frame.setAttribute('stroke-dasharray', `${range(t, 0, 0.4, ease.outCubic).toFixed(4)} 1`);
    frame.setAttribute('stroke-width', (3 + 2 * pressure).toFixed(2));
    tick.setAttribute('d', ticksD(CX - hw - 26 - b, CY - hh - 26 - b, 2 * (hw + 26 + b), 2 * (hh + 26 + b), 22));
    tick.setAttribute('opacity', (range(t, 0.15, 0.5) * (1 - 0.6 * gl)).toFixed(3));
    for (const [g, sgn] of [[ghostA, -1], [ghostB, 1]]) {
      g.setAttribute('d', d);
      g.setAttribute('transform', `translate(${(sgn * (5 + amp * 1.1)).toFixed(2)}, ${(sgn * amp * 0.25).toFixed(2)})`);
      g.setAttribute('opacity', gl ? (0.35 + 0.5 * Math.max(hit1, hit2)).toFixed(3) : 0);
    }
    content.style.clipPath = `path('${d}')`;
    content.style.transform = gl ? `skewX(${((hash01(fi, 9) - 0.5) * (1.5 + 5 * Math.max(hit1, hit2))).toFixed(3)}deg)` : 'none';
    content.style.transformOrigin = `${CX}px ${CY}px`;
    fillBg.style.opacity = range(t, 0, 0.25).toFixed(3);
    heat.style.background = `radial-gradient(60% 55% at 50% ${((CY / H) * 100).toFixed(1)}%, ${rgba(C.ember, 0)} 30%, ${rgba(C.ember, 0.34 * over + 0.12 * gl)} 100%)`;

    // satırlar
    const pad = 30, top = CY - hh + pad + 14, bottom = CY + hh - pad, left = CX - hw + pad, width = 2 * hw - 2 * pad;
    const pitch = Math.min(BASE + 4, (bottom - top) / Math.max(n, 1));
    const sq = Math.min(1, pitch / (BASE + 4));
    const gk = Math.floor(t * 11);
    rowsEl.style.filter = pressure > 0.02 && !gl ? `blur(${(pressure * pressure * 1.5).toFixed(2)}px)` : 'none';
    for (let i = 0; i < N; i++) {
      const r = rows[i];
      const a = clamp(n - i);
      if (a <= 0) { if (r.shown) { r.row.style.display = 'none'; r.shown = false; } continue; }
      if (!r.shown) { r.row.style.display = ''; r.shown = true; }
      const y = top + i * pitch;                       // sohbet gibi yukarıdan dolar; yer bitince satırlar sıkışır
      const age = t - birth[i];
      r.row.style.left = left.toFixed(1) + 'px';
      r.row.style.width = width.toFixed(1) + 'px';
      r.row.style.transform = `translateY(${(y + (1 - ease.outCubic(clamp(age / 0.22))) * 14).toFixed(2)}px) scaleY(${sq.toFixed(4)})`;
      r.row.style.opacity = (clamp(age / 0.16) * (gl ? 0.55 + 0.45 * hash01(i, gk) : 1)).toFixed(3);
      if (!r.user) r.inner.style.clipPath = age < 0.4 ? `inset(0 ${((1 - clamp(age / 0.36)) * 100).toFixed(1)}% 0 0)` : 'none';
      if (gl) {
        if (r.garb !== gk) {
          r.garb = gk;
          let g = '';
          for (let k = 0; k < r.text.length; k++) g += hash01(k * 7 + i * 131, gk) < 0.72 ? GARB[Math.floor(hash01(k + i * 17, gk + 5) * GARB.length)] : r.text[k];
          r.inner.textContent = g;
          const hot = hash01(i, gk + 2);
          r.inner.style.color = hot < 0.3 ? C.ember : hot < 0.45 ? C.window : r.user ? C.ink : C.dim;
          if (!r.user) r.inner.style.borderLeftColor = C.ember;
        }
      } else if (r.garb !== -1) { r.garb = -1; r.inner.textContent = r.text; r.inner.style.color = r.user ? C.ink : C.dim; if (!r.user) r.inner.style.borderLeftColor = C.cyan; }
    }

    // bozulma şeritleri
    slices.forEach((sl, k) => {
      const on = gl && hash01(k * 13 + gk, 77) < 0.12 + 0.75 * Math.max(hit1, hit2);
      sl.style.display = on ? '' : 'none';
      if (!on) return;
      const hgt = 4 + hash01(k, gk + 1) * 26;
      sl.style.top = (CY - hh + hash01(k, gk + 3) * (2 * hh - hgt)).toFixed(1) + 'px';
      sl.style.height = hgt.toFixed(1) + 'px';
      sl.style.left = (CX - hw - 60 + (hash01(k, gk + 4) - 0.5) * 80).toFixed(1) + 'px';
      sl.style.width = (2 * hw + 120) + 'px';
      sl.style.background = rgba([C.ember, C.cyan, C.ink, C.pink][k % 4], 0.22 + 0.3 * hash01(k, gk + 6));
    });

    // çatlaklar
    cracks.forEach((c, k) => {
      const t0 = k < 3 ? T.sac + k * 0.07 : T.baslar + (k - 3) * 0.08;
      const p = range(t, t0, t0 + 0.32, ease.outCubic);
      const dd = p > 0 ? crackPath(crackDefs[k], hw + b * 0.4, hh + b * 0.4) : '';
      for (const el2 of [c.glow, c.core]) { el2.setAttribute('d', dd); el2.setAttribute('stroke-dasharray', `${p.toFixed(4)} 1`); el2.setAttribute('opacity', p > 0 ? 1 : 0); }
    });

    // etiketler
    const ca = range(t, T.sohbet - 0.05, T.sohbet + 0.3, ease.outBack), cb = range(t, T.model - 0.05, T.model + 0.3, ease.outBack);
    chipA.style.left = (CX - hw + 26) + 'px'; chipA.style.top = (CY - hh - b * 0.35 - 24) + 'px';
    chipA.style.transform = ca === 1 ? 'none' : `scale(${ca.toFixed(4)})`; chipA.style.opacity = clamp(ca * 2).toFixed(3);
    chipB.style.right = (W - (CX + hw - 26)) + 'px'; chipB.style.top = (CY - hh - b * 0.35 - 24) + 'px';
    chipB.style.transform = cb === 1 ? 'none' : `scale(${cb.toFixed(4)})`; chipB.style.opacity = clamp(cb * 2).toFixed(3);
    const cc = v < 1 ? C.ink : mixc(C.ink, C.ember, over * 2);
    chipA.style.background = cc; chipB.style.background = cc;
    chipA.style.color = chipB.style.color = v < 1 ? C.night : mixc(C.night, C.ink, over * 2);

    // gösterge
    const barIn = range(t, 0.02, 0.38, ease.outCubic);
    bar.el.style.opacity = (barIn * headOut).toFixed(3);
    bar.el.style.transform = barIn >= 1 ? 'none' : `translateY(${((1 - barIn) * -16).toFixed(2)}px)`;
    barNote.style.opacity = (range(t, 0.1, 0.5) * headOut * 0.95).toFixed(3);
    const flash = gl ? (Math.floor(t * 6) % 2 ? 1 : 0.55) : 1;
    bar.set(v, {
      over: over * (SAFE.width - BARW - 4), color: v < 0.7 ? C.window : v < 1 ? mixc(C.window, C.sunset, (v - 0.7) / 0.3) : C.ember,
      status: v < 0.12 ? 'boş' : v < 0.97 ? 'doluyor' : over < 0.25 ? 'doldu' : 'taştı', statusColor: v < 0.97 ? C.dim : C.ember,
    });
    bar.stat.style.opacity = flash;

    // saçmalama çıktısı
    const nk = range(t, T.sac + 0.1, T.sac + 0.42, ease.outBack);
    nonsense.style.opacity = clamp(nk * 3).toFixed(3);
    nonsense.style.transform = `translate(${((hash01(fi, 21) - 0.5) * amp * 0.6).toFixed(2)}px, ${(CY + hh + b - 54).toFixed(1)}px) rotate(-3deg) scale(${(0.7 + 0.3 * nk).toFixed(4)})`;
    const hk = range(t, T.baslar, T.baslar + 0.3, ease.outBack);
    huh.style.opacity = clamp(hk * 3).toFixed(3);
    huh.style.left = '846px'; huh.style.top = (CY + hh + b - 170).toFixed(1) + 'px';
    huh.style.transform = `rotate(${(12 + (hash01(fi, 31) - 0.5) * 4 * hit2).toFixed(2)}deg) scale(${(0.5 + 0.5 * hk).toFixed(4)})`;
  }

  // ses ipuçları
  const sfx = [{ t: 0.0, name: 'whoosh-short', gain: 0.3 }];
  for (let i = 0; i < 10; i++) sfx.push({ t: birth[i], name: `type-${(i % 3) + 1}`, gain: 0.22 });
  sfx.push({ t: T.sohbet, name: 'tick', gain: 0.3 }, { t: T.model, name: 'tick', gain: 0.3 });
  sfx.push({ t: T.is - 0.05, name: 'typing', gain: 0.2 }, { t: T.is + 1.25, name: 'typing', gain: 0.22 }, { t: T.siser + 0.5, name: 'typing', gain: 0.2 });
  sfx.push({ t: T.siser - 0.02, name: 'anlatim-stretch', gain: 0.4 });
  sfx.push({ t: T.sac - 2.45, name: 'riser-long', gain: 0.2 });
  sfx.push({ t: T.sac - 0.02, name: 'glitch', gain: 0.5 }, { t: T.sac + 0.1, name: 'anlatim-crack', gain: 0.45 }, { t: T.baslar, name: 'glitch', gain: 0.28 }, { t: T.baslar + 0.02, name: 'anlatim-crack', gain: 0.3 });
  sfx.push({ t: D - 0.2, name: 'whoosh-short', gain: 0.35 });

  return { el, update, sfx, subtitleY: 1372, extend: { after: 0.32 } };
}
