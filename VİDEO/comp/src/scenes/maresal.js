// maresal — "siz de böyle çalışın: işi bölün, yöneticinin bağlamını temiz tutun… ana ajanınız bir mareşal olsun, emrine ordular verin"
// 1. yarı (öğüt), altyazı hep açık; ekran onu tekrar etmez, GÖSTERİR:
//    a) "böyle çalışın": ekip şeması tam boy ve canlı kalır (ekip.js çizer); bu sahne çerçeve ve etiket ekler.
//    b) "işi bölün": tek büyük iş bloğu beş göreve bölünür.   c) "bağlamını temiz tutun": iki BAĞLAM çubuğu yan yana —
//       her işi kendi yapan yöneticininki taşar, yalnızca rapor okuyanınki temiz kalır.
// 2. yarı (benzetme): harekât haritası. Üstte flama = BAŞKOMUTAN (siz), ortada yıldızlı rozet = MAREŞAL (ana ajan),
//    altta birlik kutuları = ORDULAR (alt ajanlar). Emir hatları yukarıdan aşağı akar, ordular hedefe ilerler.
// Sembol dili (kapanış sahneleri de kullanabilir): starD (rütbe yıldızı), rankBadge (çift halka + yıldız), unitBox
// (çapraz çizgili birlik kutusu + üstünde kademe işareti), pennant (karargâh flaması), advanceArrowD (ilerleme oku).
import { C, FONT, SAFE, W, H, ease, range, clamp, lerp, hash01 } from '../theme.js';
import { h, s } from '../kit.js';
import { rgba, mixc, svgLayer, ticksD, makePath, scaleBar, label, starD } from './baglam.js';

// ---------- sembol dili (dışa açık) ----------
/** Rütbe rozeti: çift halka içinde yıldız. Döner: { g, ring, inner, star } (g'nin merkezi cx,cy). */
export function rankBadge(cx, cy, R, color = C.window) {
  const ring = s('circle', { cx, cy, r: R, 'stroke-width': 5, style: { fill: rgba(C.night, 0.86), stroke: color } });
  const inner = s('circle', { cx, cy, r: R - 13, fill: 'none', 'stroke-width': 1.5, style: { stroke: rgba(C.ink, 0.5) } });
  const star = s('path', { d: starD(cx, cy, R * 0.52), style: { fill: color } });
  const g = s('g', {}, ring, inner, star);
  return { g, ring, inner, star };
}
/** Birlik kutusu: çapraz çizgili dikdörtgen, üstünde kademe işareti. Döner: { g, box, cross, ech }.
 *  Kademe işareti yazı değil, dolu küçük baklava dizisidir ("XXXX" harfleri izleyiciye doldurulmamış metin gibi görünüyordu).
 *  echelon: baklava sayısı ya da eski çağrılardaki gibi dizge (uzunluğu kadar baklava; 'XXXX' → 4 = ordu). ech bir <g>'dir; rengi style.fill ile değişir. */
export function unitBox(cx, cy, w = 140, hh = 92, echelon = 'XXXX', color = C.ink) {
  const x = cx - w / 2, y = cy - hh / 2;
  const box = s('rect', { x, y, width: w, height: hh, 'stroke-width': 3.5, style: { fill: rgba(C.night, 0.8), stroke: color } });
  const cross = s('path', { d: `M${x},${y}L${x + w},${y + hh}M${x + w},${y}L${x},${y + hh}`, fill: 'none', 'stroke-width': 2, style: { stroke: color } });
  const n = Math.max(1, typeof echelon === 'number' ? Math.round(echelon) : String(echelon).length);
  const R = 8, STEP = 24, py = y - 19;
  const ech = s('g', { style: { fill: color } }, ...Array.from({ length: n }, (_, i) => {
    const px = cx + (i - (n - 1) / 2) * STEP;
    return s('path', { d: `M${px},${py - R}L${px + R},${py}L${px},${py + R}L${px - R},${py}Z` });
  }));
  const g = s('g', {}, box, cross, ech);
  return { g, box, cross, ech };
}
/** Karargâh flaması: direk + üçgen flama. Döner: { g, flag, set(wave) } — wave: flama ucunun dalgalanması (px). */
export function pennant(x, yTop, yBase, color = C.pink) {
  const pole = s('path', { d: `M${x},${yTop - 4}V${yBase}`, fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round', style: { stroke: C.ink } });
  const flag = s('path', { style: { fill: color } });
  const base = s('circle', { cx: x, cy: yBase, r: 8, 'stroke-width': 3, style: { fill: C.night, stroke: C.ink } });
  const g = s('g', {}, flag, pole, base);
  const set = (wave = 0) => flag.setAttribute('d', `M${x},${yTop} Q${x + 30},${yTop + 4 + wave} ${x + 62},${yTop + 18 + wave * 1.6} Q${x + 30},${yTop + 24 - wave} ${x},${yTop + 36}Z`);
  set(0);
  return { g, flag, set };
}
/** Harekât oku (geniş gövdeli, aşağı doğru): uzunluk len. */
export const advanceArrowD = (x, y, len, w = 20, head = 26) =>
  `M${x - w * 0.32},${y} L${x + w * 0.32},${y} L${x + w * 0.5},${y + len - head} L${x + w * 1.05},${y + len - head} L${x},${y + len} L${x - w * 1.05},${y + len - head} L${x - w * 0.5},${y + len - head}Z`;

/** Durağan hâlde transform bırakmaz (yazı rasteri önceki karelerden bağımsız kalsın). */
const TX = (x, y = 0) => (Math.abs(x) < 0.01 && Math.abs(y) < 0.01 ? 'none' : `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`);
const SC = (k) => (Math.abs(k - 1) < 0.0005 ? 'none' : `scale(${k.toFixed(4)})`);
const pill = (text, bg = C.pink, fg = C.night) => h('span', { style: { display: 'inline-block', padding: '8px 14px 8px', font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.06em',
  background: bg, color: fg, whiteSpace: 'nowrap' } }, text);
const TASKS = ['VERİ', 'ŞEHİR', 'KULELER', 'IŞIK', 'KAMERA'];

export async function create(ctx) {
  const tw = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const D = ctx.duration;
  const T = {
    tavsiye: tw('tavsiyem', 0, 0.82), buyuk: tw('büyük', 0, 2.18), boyle: tw('böyle', 0, 2.86), isi: tw('işi', 0, 4.11), bolun: tw('bölün', 0, 4.28),
    yon: tw('yöneticinin', 0, 4.66), bag: tw('bağlamını', 0, 5.4), temiz: tw('temiz', 0, 5.9), tutun: tw('tutun', 0, 6.24),
    kendinizi: tw('kendinizi', 0, 7.4), ordu: tw('ordu', 0, 8.6), grubunu: tw('grubunu', 0, 9.02), bas: tw('başkomutan', 0, 9.82), gibi: tw('gibi', 0, 10.4),
    ana: tw('ana', 0, 12.18), ajan: tw('ajanınız', 0, 12.26), mar: tw('mareşal', 0, 12.9), emrine: tw('emrine', 0, 14.21),
    ordular: tw('ordular', 0, 15.26), verin: tw('verin', 0, 15.68),
  };
  const FIG_OUT = 3.5;                              // ekip şemasının çekildiği an (ekip.js'teki M_OUT ile aynı)
  const P1_OUT = T.kendinizi - 0.2;                 // 1. yarının çıkışı
  const A0 = P1_OUT + 0.3, A_STEP = Math.max(0.08, (T.ordu - 0.15 - A0) / 4);   // orduların beliriş anları

  const el = h('div', { class: 'scene' });

  // =================================================================================================================
  // 1a — "böyle çalışın": tam boy ekip şemasının üstüne çerçeve + etiket
  // =================================================================================================================
  const fig = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const FX = 44, FY = 288, FW = 992, FH = 936;
  const svgF = svgLayer();
  const fTicks = s('path', { fill: 'none', 'stroke-width': 4 });
  svgF.append(fTicks);
  const kicker = h('div', { style: { position: 'absolute', left: SAFE.left + 'px', top: '232px', transformOrigin: '0 50%' } }, pill('TAVSİYE'));
  const figCap = h('div', { style: { position: 'absolute', right: W - SAFE.right + 'px', top: '238px', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.ink, whiteSpace: 'nowrap' } }, 'BÜYÜK İŞ = EKİP İŞİ');
  fig.append(svgF, kicker, figCap);

  // =================================================================================================================
  // 1b — iki öğüt, iki resim
  // =================================================================================================================
  const p1 = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const numBadge = (n, top) => h('div', { style: { position: 'absolute', left: SAFE.left + 'px', top: top + 'px', width: '56px', height: '56px', boxSizing: 'border-box',
    border: `3px solid ${C.pink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 32px/1 ${FONT.mono}`, color: C.pink } }, String(n));
  const kick = (text, top) => h('div', { style: { position: 'absolute', left: SAFE.left + 76 + 'px', top: top + 14 + 'px', font: `700 28px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.ink, whiteSpace: 'nowrap' } }, text);
  // --- (1) tek büyük iş → beş görev ---
  const Y1 = 250, BY = 336, BH = 128, TY = 566, TH = 100, GAP = 14, TWD = (SAFE.width - 4 * GAP) / 5;
  const b1 = numBadge(1, Y1), k1 = kick('TEK İŞ → BEŞ GÖREV', Y1);
  const block = h('div', { style: { position: 'absolute', left: SAFE.left + 'px', top: BY + 'px', width: SAFE.width + 'px', height: BH + 'px', background: C.window, display: 'flex',
    alignItems: 'center', justifyContent: 'center', font: `850 64px/1 ${FONT.display}`, letterSpacing: '0.01em', color: C.night, boxSizing: 'border-box', transformOrigin: '50% 50%' } }, 'BÜYÜK İŞ');
  const ghost = h('div', { style: { position: 'absolute', left: SAFE.left + 'px', top: BY + 'px', width: SAFE.width + 'px', height: BH + 'px', boxSizing: 'border-box', border: `2px dashed ${rgba(C.ink, 0.55)}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', font: `850 64px/1 ${FONT.display}`, letterSpacing: '0.01em', color: rgba(C.ink, 0.32) } }, 'BÜYÜK İŞ');
  const svg1 = svgLayer();
  const cuts = [1, 2, 3, 4].map((k) => { const x = SAFE.left + k * (TWD + GAP) - GAP / 2; return s('path', { d: `M${x},${BY - 18}V${BY + BH + 18}`, fill: 'none', 'stroke-width': 5, pathLength: 1, style: { stroke: C.pink } }); });
  const links = TASKS.map((_, i) => {
    const x = SAFE.left + i * (TWD + GAP) + TWD / 2;
    const casing = s('path', { d: `M${x},${BY + BH}V${TY}`, fill: 'none', 'stroke-width': 13, style: { stroke: rgba(C.night, 0.7) } });
    const road = s('path', { d: `M${x},${BY + BH}V${TY}`, fill: 'none', 'stroke-width': 5, style: { stroke: C.road } });
    const flow = s('path', { d: `M${x},${BY + BH}V${TY}`, fill: 'none', 'stroke-width': 5, 'stroke-dasharray': '4 20', style: { stroke: C.night } });
    return { x, casing, road, flow, clip: null };
  });
  const linkClip = s('clipPath', { id: 'mrs-links' }, s('rect', { x: 0, y: BY + BH, width: W, height: 0 }));
  const linkG = s('g', { 'clip-path': 'url(#mrs-links)' }, ...links.flatMap((l) => [l.casing, l.road, l.flow]));
  const sep = s('path', { d: `M${SAFE.left},724H${SAFE.right}`, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '3 10', style: { stroke: rgba(C.ink, 0.4) } });
  svg1.append(s('defs', {}, linkClip), linkG, ...cuts, sep);
  const tiles = TASKS.map((name, i) => {
    const lbl = h('div', { style: { font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.ink, whiteSpace: 'nowrap' } }, name);
    const top = h('div', { class: 'abs', style: { left: '0', top: '0', width: '100%', height: '8px', background: C.window } });
    const box = h('div', { class: 'abs', style: { left: SAFE.left + i * (TWD + GAP) + 'px', top: '0', width: TWD + 'px', boxSizing: 'border-box', display: 'none', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } }, top, lbl);
    return { box, lbl, top };
  });
  // --- (2) yöneticinin bağlamı: taşan / temiz ---
  const Y2 = 762, BW = 690;
  const b2 = numBadge(2, Y2), k2 = kick('YÖNETİCİNİN AKLI', Y2);
  const barA = scaleBar({ width: BW, height: 28, segs: 10, title: 'HER İŞİ KENDİ YAPARSA', fs: 26 });
  barA.el.style.left = SAFE.left + 'px'; barA.el.style.top = '862px';
  const barB = scaleBar({ width: BW, height: 28, segs: 10, title: 'YALNIZCA RAPOR OKURSA', fs: 26 });
  barB.el.style.left = SAFE.left + 'px'; barB.el.style.top = '1022px';
  const BBY = 1022 + 26 + 12;                       // B çubuğunun üst kenarı
  const papers = TASKS.map(() => h('div', { class: 'abs', style: { left: '0', top: '0', width: '40px', height: '50px', marginLeft: '-20px', marginTop: '-25px', display: 'none',
    background: `linear-gradient(225deg, transparent 10px, ${C.ink} 10.5px)`, boxShadow: `0 4px 0 ${rgba(C.night, 0.45)}` } },
    ...[15, 25, 35].map((y, k) => h('div', { class: 'abs', style: { left: '7px', top: y + 'px', width: (k === 2 ? 15 : 26) + 'px', height: '4px', background: rgba(C.night, 0.6) } }))));
  const okMark = h('div', { style: { position: 'absolute', left: SAFE.left + BW + 40 + 'px', top: BBY - 30 + 'px', font: `850 84px/1 ${FONT.display}`, color: C.ok, transformOrigin: '30% 60%', opacity: '0' } }, '✓');
  p1.append(svg1, ghost, block, ...tiles.map((x) => x.box), b1, k1, b2, k2, barA.el, barB.el, okMark, ...papers);

  // =================================================================================================================
  // 2. yarı — harekât haritası
  // =================================================================================================================
  const p2 = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '540px 760px' } });
  const svg = svgLayer();
  const GX = [72, 228, 384, 540, 696, 852, 1008], GY = [246, 402, 558, 714, 870, 1026, 1182];
  const grid = [];
  GX.forEach((x, i) => grid.push({ el: s('path', { d: `M${x},${GY[0]}V${GY[6]}`, fill: 'none', 'stroke-width': 1, pathLength: 1, style: { stroke: rgba(C.ink, 0.2) } }), k: i }));
  GY.forEach((y, i) => grid.push({ el: s('path', { d: `M${GX[0]},${y}H${GX[6]}`, fill: 'none', 'stroke-width': 1, pathLength: 1, style: { stroke: rgba(C.ink, 0.2) } }), k: i + 2 }));
  svg.append(...grid.map((g) => g.el));

  const PX = 540, PT = 282, PB = 366;              // flama
  const MX = 540, MY = 596, MR = 80;               // mareşal
  const AY = 926, AW = 140, AH = 92;               // ordular
  const AXS = [142, 341, 540, 739, 938];
  const objY = 1192;
  const objective = s('path', { d: `M72,${objY + 6} C300,${objY - 22} 780,${objY + 26} 1008,${objY - 4}`, fill: 'none', 'stroke-width': 3, 'stroke-dasharray': '14 10', style: { stroke: C.ember } });
  const objClip = s('clipPath', { id: 'mrs-obj' }, s('rect', { x: 72, y: objY - 40, width: 0, height: 80 }));
  objective.setAttribute('clip-path', 'url(#mrs-obj)');
  const arrows = AXS.map(() => s('path', { style: { fill: C.window } }));
  // emir hatları (önce soluk iskelet, emir gelince dolar)
  const cmd1Ghost = s('path', { d: `M${PX},${PB + 12}V${MY - MR - 14}`, fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '4 10', style: { stroke: rgba(C.ink, 0.4) } });
  const cmd1 = s('path', { d: `M${PX},${PB + 12}V${MY - MR - 14}`, fill: 'none', 'stroke-width': 3.5, 'stroke-dasharray': '10 8', style: { stroke: C.ink } });
  const cmd1Clip = s('clipPath', { id: 'mrs-c1' }, s('rect', { x: PX - 10, y: PB + 10, width: 20, height: 0 }));
  cmd1.setAttribute('clip-path', 'url(#mrs-c1)');
  const fans = AXS.map((x) => {
    const p = makePath([MX + (x - MX) * 0.1, MY + MR + 12], ['C', MX + (x - MX) * 0.12, MY + MR + 110, x, AY - AH / 2 - 150, x, AY - AH / 2 - 48]);
    const ghost2 = s('path', { d: p.d, fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '4 10', 'stroke-linecap': 'round', style: { stroke: rgba(C.ink, 0.4) } });
    const base = s('path', { d: p.d, fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'round', pathLength: 1, style: { stroke: C.window } });
    const flow = s('path', { d: p.d, fill: 'none', 'stroke-width': 4, 'stroke-dasharray': '4 22', 'stroke-linecap': 'round', style: { stroke: C.night } });
    const head = s('path', { d: `M${x - 11},${AY - AH / 2 - 54}L${x},${AY - AH / 2 - 37}L${x + 11},${AY - AH / 2 - 54}Z`, style: { fill: C.window } });
    return { p, ghost: ghost2, base, flow, head };
  });
  const armies = AXS.map((x) => unitBox(x, AY, AW, AH, 'XXXX', C.ink));
  const brace = s('path', { d: `M72,${AY + AH / 2 + 14}V${AY + AH / 2 + 28}H1008V${AY + AH / 2 + 14}`, fill: 'none', 'stroke-width': 2.5, pathLength: 1, style: { stroke: rgba(C.ink, 0.8) } });
  const slot = s('circle', { cx: MX, cy: MY, r: MR, 'stroke-width': 3, 'stroke-dasharray': '8 10', style: { stroke: rgba(C.ink, 0.85), fill: rgba(C.night, 0.35) } });
  const slotStar = s('path', { d: starD(MX, MY, MR * 0.52), fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '5 7', 'stroke-linejoin': 'round', style: { stroke: rgba(C.ink, 0.6) } });
  const penGhost = s('g', {}, s('path', { d: `M${PX},${PT - 4}V${PB}`, fill: 'none', 'stroke-width': 3, 'stroke-dasharray': '5 8', style: { stroke: rgba(C.ink, 0.6) } }),
    s('path', { d: `M${PX},${PT} L${PX + 62},${PT + 18} L${PX},${PT + 36}`, fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '5 7', style: { stroke: rgba(C.ink, 0.6) } }),
    s('circle', { cx: PX, cy: PB, r: 8, fill: 'none', 'stroke-width': 2.5, style: { stroke: rgba(C.ink, 0.6) } }));
  const waves = [0, 1].map(() => s('circle', { cx: PX, cy: PB, r: 10, fill: 'none', 'stroke-width': 2.5, opacity: 0, style: { stroke: C.pink } }));
  const shock = s('circle', { cx: MX, cy: MY, r: MR, fill: 'none', 'stroke-width': 4, opacity: 0, style: { stroke: C.window } });
  const orbit = s('circle', { cx: MX, cy: MY, r: MR + 16, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '3 12', style: { stroke: rgba(C.window, 0.75) } });
  const badge = rankBadge(MX, MY, MR, C.window);
  const pen = pennant(PX, PT, PB, C.pink);
  const skeleton = s('g', {}, cmd1Ghost, ...fans.map((f) => f.ghost));
  svg.append(s('defs', {}, objClip, cmd1Clip), objective, ...arrows, skeleton, cmd1, ...fans.flatMap((f) => [f.base, f.flow, f.head]), brace, ...armies.map((a) => a.g),
    slot, slotStar, penGhost, shock, orbit, badge.g, ...waves, pen.g);

  const nameStyle = (size) => ({ font: `850 ${size}px/1 ${FONT.display}`, letterSpacing: '0.01em', color: C.ink, whiteSpace: 'nowrap', textShadow: `0 3px 0 ${rgba(C.night, 0.55)}` });
  const tier = (x, y, name, size, eq) => {
    const n = h('div', { style: nameStyle(size) }, name);
    const p = h('div', { style: { marginTop: '12px', transformOrigin: '0 50%' } }, pill(eq));
    const box = h('div', { style: { position: 'absolute', left: x + 'px', top: y + 'px' } }, n, p);
    return { box, n, p };
  };
  const tBas = tier(PX + 88, PT - 6, 'BAŞKOMUTAN', 42, '= SİZ');
  const tMar = tier(MX + MR + 40, MY - 50, 'MAREŞAL', 54, '= ANA AJAN');
  const tOrdN = h('div', { style: nameStyle(42) }, 'ORDULAR');
  const tOrdP = h('div', { style: { transformOrigin: '0 50%', overflow: 'hidden', whiteSpace: 'nowrap' } }, pill('= ALT AJANLAR'));
  const tOrd = h('div', { style: { position: 'absolute', left: '0', top: AY + AH / 2 + 46 + 'px', width: W + 'px', display: 'flex', justifyContent: 'center', alignItems: 'center' } }, tOrdN, tOrdP);
  const gauge = scaleBar({ width: 240, height: 12, segs: 10, title: 'BAĞLAM', small: true });
  gauge.el.style.left = MX - MR - 40 - 240 + 'px'; gauge.el.style.top = MY - 32 + 'px';
  gauge.set(0.14, { color: C.ok, status: 'temiz', statusColor: C.ok });
  const capMap = label('HAREKÂT HARİTASI', { left: SAFE.left + 'px', top: objY + 24 + 'px', color: C.dim });
  const capObj = label('HEDEF · BÜYÜK İŞ', { right: W - SAFE.right + 'px', top: objY + 24 + 'px', color: C.ember });
  p2.append(svg, tBas.box, tMar.box, tOrd, gauge.el, capMap, capObj);
  el.append(fig, p1, p2);

  function update(t) {
    // ---------------- 1a: ekip şemasının üstünde ----------------
    const figOut = range(t, FIG_OUT, FIG_OUT + 0.45, ease.inCubic);
    fig.style.display = t < FIG_OUT + 0.5 ? '' : 'none';
    if (t < FIG_OUT + 0.5) {
      fig.style.opacity = (1 - figOut).toFixed(4);
      fig.style.transform = TX(0, -40 * figOut);
      const kk = range(t, T.tavsiye - 0.05, T.tavsiye + 0.3, ease.outBack);
      kicker.style.transform = SC(kk); kicker.style.opacity = clamp(kk * 2).toFixed(3);
      const ck = range(t, T.buyuk - 0.05, T.buyuk + 0.3, ease.outCubic);
      figCap.style.opacity = ck.toFixed(3); figCap.style.transform = TX((1 - ck) * 20, 0);
      const fk = range(t, T.boyle - 0.1, T.boyle + 0.4, ease.outCubic);
      const grow = lerp(46, 0, fk);
      const flash = t >= T.boyle ? Math.exp(-(t - T.boyle) * 3) : 0;
      fTicks.setAttribute('d', ticksD(FX - grow, FY - grow, FW + 2 * grow, FH + 2 * grow, 46));
      fTicks.setAttribute('opacity', fk.toFixed(3));
      fTicks.style.stroke = mixc(C.ink, C.window, flash);
      fTicks.setAttribute('stroke-width', (4 + 3 * flash).toFixed(2));
    }

    // ---------------- 1b: iki öğüt, iki resim ----------------
    const on1 = t > FIG_OUT - 0.05 && t < P1_OUT + 0.5;
    p1.style.display = on1 ? '' : 'none';
    if (on1) {
      const out1 = range(t, P1_OUT, P1_OUT + 0.45, ease.inCubic);
      p1.style.opacity = (1 - out1).toFixed(4);
      p1.style.transform = TX(0, -60 * out1);
      // (1) blok gelir, "bölün"de kesilir, beş görev iner
      const I1 = FIG_OUT + 0.2;
      const bk = range(t, I1, I1 + 0.3, ease.outBack);
      b1.style.opacity = clamp(bk * 2).toFixed(3); b1.style.transform = SC(bk);
      const kk1 = range(t, I1 + 0.08, I1 + 0.35, ease.outCubic);
      k1.style.opacity = kk1.toFixed(3); k1.style.transform = TX((1 - kk1) * -16, 0);
      const blk = range(t, I1 + 0.1, I1 + 0.5, ease.outBack);
      const cut = range(t, T.bolun - 0.02, T.bolun + 0.14, ease.outCubic);
      const split = range(t, T.bolun + 0.1, T.bolun + 0.22);
      block.style.opacity = (clamp(blk * 2) * (1 - split)).toFixed(3);
      block.style.transform = SC(0.9 + 0.1 * blk);
      ghost.style.opacity = split.toFixed(3);
      cuts.forEach((c, i) => {
        c.setAttribute('stroke-dasharray', `${range(t, T.bolun - 0.02 + i * 0.02, T.bolun + 0.12 + i * 0.02, ease.outCubic).toFixed(4)} 1`);
        c.setAttribute('opacity', (cut > 0 ? 1 - range(t, T.bolun + 0.22, T.bolun + 0.5) : 0).toFixed(3));
      });
      let maxDrop = 0;
      tiles.forEach((tl, i) => {
        const t0 = T.bolun + 0.12 + i * 0.06;
        const d = ease.spring(clamp((t - t0) / 0.75), 7.5, 5.2) * (t >= t0 ? 1 : 0);
        const dd = clamp(d, 0, 1.2);
        maxDrop = Math.max(maxDrop, Math.min(1, dd));
        const settled = range(t, t0 + 0.75, t0 + 1.0);
        const bob = Math.sin(t * 2.6 + i * 1.1) * 3 * settled;
        const y = lerp(BY, TY, dd) + bob, hgt = lerp(BH, TH, clamp(dd));
        tl.box.style.display = split > 0 ? 'flex' : 'none';
        tl.box.style.top = y.toFixed(2) + 'px';
        tl.box.style.height = hgt.toFixed(2) + 'px';
        const dark = range(t, t0 + 0.12, t0 + 0.42);
        tl.box.style.background = mixc(C.window, C.glass, dark);
        tl.lbl.style.color = mixc(C.night, C.ink, dark);
        tl.box.style.boxShadow = `inset 0 0 0 2px ${rgba(C.ink, 0.75 * clamp(dd))}`;
        tl.lbl.style.opacity = split.toFixed(3);
        tl.top.style.opacity = range(t, t0 + 0.1, t0 + 0.35).toFixed(3);
      });
      linkClip.firstChild.setAttribute('height', Math.max(0, (TY - BY - BH) * Math.min(1, maxDrop)).toFixed(1));
      links.forEach((l) => l.flow.setAttribute('stroke-dashoffset', (-t * 44).toFixed(2)));
      // (2) iki bağlam çubuğu
      const sp = range(t, T.yon - 0.25, T.yon + 0.2, ease.inOutCubic);
      sep.setAttribute('opacity', sp.toFixed(3));
      const bk2 = range(t, T.yon - 0.1, T.yon + 0.22, ease.outBack);
      b2.style.opacity = clamp(bk2 * 2).toFixed(3); b2.style.transform = SC(bk2);
      const kk2 = range(t, T.yon, T.yon + 0.28, ease.outCubic);
      k2.style.opacity = kk2.toFixed(3); k2.style.transform = TX((1 - kk2) * -16, 0);
      const aIn = range(t, T.yon + 0.1, T.yon + 0.4, ease.outCubic);
      barA.el.style.opacity = aIn.toFixed(3); barA.el.style.transform = TX(0, (1 - aIn) * 18);
      const va = range(t, T.yon + 0.2, T.bag - 0.05, (x) => x * x);
      const fi = Math.floor(t * 30 + 1e-6);
      const ov = range(t, T.bag - 0.05, T.bag + 0.35, ease.outCubic) * (SAFE.width - BW - 6) + (va >= 1 ? (hash01(fi, 5) - 0.5) * 8 : 0);
      barA.set(va, { over: va >= 1 ? ov : 0, color: va < 0.6 ? C.window : va < 1 ? mixc(C.window, C.sunset, (va - 0.6) / 0.4) : C.ember,
        status: va < 1 ? 'doluyor' : 'taştı', statusColor: va < 1 ? C.dim : C.ember });
      barA.stat.style.opacity = va >= 1 ? (Math.floor(t * 5) % 2 ? 1 : 0.6) : 1;
      const bIn = range(t, T.bag - 0.1, T.bag + 0.22, ease.outCubic);
      barB.el.style.opacity = bIn.toFixed(3); barB.el.style.transform = TX(0, (1 - bIn) * 18);
      let got = 0;
      papers.forEach((pp, i) => {
        const t0 = T.bag + i * 0.13, f = range(t, t0, t0 + 0.38, ease.inOutCubic);
        got += f >= 1 ? 1 : 0;
        if (t < t0 - 0.15 || f >= 1) { pp.style.display = 'none'; return; }
        const pop = range(t, t0 - 0.15, t0, ease.outBack);
        const tx = SAFE.left + BW * (0.05 + 0.034 * (i + 1));
        pp.style.display = '';
        pp.style.opacity = (1 - range(f, 0.85, 1)).toFixed(3);
        pp.style.transform = `translate(${lerp(SAFE.right - 30, tx, f).toFixed(2)}px, ${(BBY + 14 - 10 * Math.sin(f * Math.PI)).toFixed(2)}px) rotate(${(Math.sin(f * 7 + i) * 8).toFixed(2)}deg) scale(${(pop * (1 - 0.45 * range(f, 0.6, 1))).toFixed(3)})`;
      });
      const clean = range(t, T.temiz - 0.02, T.temiz + 0.2);
      barB.set(0.05 + 0.034 * got, { color: C.ok, status: clean > 0 ? 'temiz' : 'rapor geliyor', statusColor: clean > 0 ? C.ok : C.dim });
      barB.stat.style.transform = SC(1 + 0.25 * (t >= T.temiz ? Math.exp(-(t - T.temiz) * 6) : 0));
      barB.stat.style.transformOrigin = '100% 50%';
      const ck = range(t, T.tutun - 0.02, T.tutun + 0.3, ease.outBack);
      okMark.style.opacity = clamp(ck * 2.5).toFixed(3);
      okMark.style.transform = `rotate(${(-8 + 8 * clamp(ck)).toFixed(2)}deg) scale(${(0.4 + 0.6 * ck + 0.05 * Math.sin(t * 5) * clamp(ck)).toFixed(4)})`;
    }

    // ---------------- 2. yarı ----------------
    const in2 = t > P1_OUT;
    p2.style.display = in2 ? '' : 'none';
    if (!in2) return;
    const bye = range(t, D - 0.06, D + 0.26, ease.inCubic);
    p2.style.opacity = (1 - bye).toFixed(4);
    p2.style.transform = SC(1 - 0.04 * bye);

    grid.forEach((g) => { g.el.setAttribute('stroke-dasharray', `${range(t, P1_OUT + 0.1 + g.k * 0.05, P1_OUT + 0.8 + g.k * 0.05, ease.inOutCubic).toFixed(4)} 1`); });
    capMap.style.opacity = range(t, P1_OUT + 0.15, P1_OUT + 0.5).toFixed(3);
    // iskelet: emir-komuta zinciri önce boş yuvalar olarak belirir (ekran boş kalmaz), sözlerle dolar
    const sk0 = range(t, P1_OUT + 0.2, P1_OUT + 0.7, ease.outCubic);
    skeleton.setAttribute('opacity', (sk0 * (0.75 + 0.25 * Math.sin(t * 4))).toFixed(3));
    skeleton.setAttribute('stroke-dashoffset', (-t * 14).toFixed(2));
    const penK = range(t, T.bas - 0.06, T.bas + 0.4, ease.outCubic);
    penGhost.setAttribute('opacity', (sk0 * (1 - clamp(penK * 3))).toFixed(3));

    // ordular: belirir ("ordu grubunu"), emir gelince yanar ("ordular")
    const braceK = range(t, T.grubunu, T.grubunu + 0.5, ease.inOutCubic);
    brace.setAttribute('stroke-dasharray', `${braceK.toFixed(4)} 1`);
    brace.setAttribute('opacity', braceK > 0 ? 1 : 0);
    const nk = range(t, T.grubunu + 0.15, T.grubunu + 0.5, ease.outCubic);
    tOrdN.style.opacity = nk.toFixed(3);
    tOrdN.style.transform = TX(0, (1 - nk) * 14);
    const pk = range(t, T.ordular - 0.02, T.ordular + 0.3, ease.outBack);
    tOrdP.style.opacity = clamp(pk * 2).toFixed(3);
    const pw = range(t, T.ordular - 0.12, T.ordular + 0.2, ease.inOutCubic);
    tOrdP.style.width = (276 * pw).toFixed(1) + 'px'; tOrdP.style.marginLeft = (18 * pw).toFixed(1) + 'px';
    const adv = range(t, T.verin - 0.05, T.verin + 0.45, ease.outCubic);
    const standby = range(t, T.gibi + 0.2, T.gibi + 0.5) * (1 - range(t, T.mar - 0.3, T.mar));
    armies.forEach((a, i) => {
      const x = AXS[i];
      const a0 = A0 + i * A_STEP;
      const k = range(t, a0, a0 + 0.34, ease.outBack);
      const lit = range(t, T.ordular + i * 0.07, T.ordular + 0.25 + i * 0.07, ease.outCubic);
      const flash = t >= T.ordular + i * 0.07 ? Math.exp(-(t - T.ordular - i * 0.07) * 4) : 0;
      // emir beklerken: birlikler boyunca soldan sağa hazır-ol dalgası (başkomutan → mareşal arası durağan kalmasın)
      const ripple = Math.exp(-Math.pow((-0.8 + ((((t - T.gibi - 0.2) / 1.15) % 1) + 1) % 1 * 5.6 - i) / 0.55, 2)) * standby;
      a.g.setAttribute('transform', `translate(${x},${(AY + (1 - clamp(k)) * 24 + adv * 8 - 8 * ripple).toFixed(2)}) scale(${(k * (1 + 0.07 * flash + 0.04 * ripple)).toFixed(4)}) translate(${-x},${-AY})`);
      a.g.setAttribute('opacity', clamp(k * 2).toFixed(3));
      const col = mixc(C.ink, C.window, Math.max(lit, 0.85 * ripple));
      a.box.style.stroke = col; a.cross.style.stroke = col; a.ech.style.fill = col;
      a.box.style.fill = mixc(rgba(C.night, 0.8), rgba(C.window, 0.2), lit);
      const y0 = AY + AH / 2 + 110;
      arrows[i].setAttribute('d', adv > 0 ? advanceArrowD(x, y0, lerp(24, objY - y0 - 18, range(t, T.verin - 0.05 + i * 0.04, T.verin + 0.4 + i * 0.04, ease.outCubic)), 18, 22) : '');
      arrows[i].setAttribute('opacity', (adv * 0.95).toFixed(3));
    });
    objClip.firstChild.setAttribute('width', (936 * range(t, P1_OUT + 0.2, P1_OUT + 0.95, ease.inOutCubic)).toFixed(1));
    objective.setAttribute('stroke-width', (3 + 2.5 * adv).toFixed(2));
    objective.setAttribute('stroke-dashoffset', (t * 14).toFixed(2));
    capObj.style.opacity = range(t, P1_OUT + 0.7, P1_OUT + 1.0).toFixed(3);

    // başkomutan
    pen.g.setAttribute('transform', `translate(0,${((1 - ease.spring(clamp((t - T.bas + 0.06) / 0.7), 8, 5)) * -70).toFixed(2)})`);
    pen.g.setAttribute('opacity', clamp(penK * 2.5).toFixed(3));
    pen.set(Math.sin(t * 5.2) * 4);
    tBas.n.style.opacity = range(t, T.bas + 0.05, T.bas + 0.35).toFixed(3);
    tBas.n.style.transform = TX((1 - range(t, T.bas + 0.05, T.bas + 0.4, ease.outCubic)) * -16);
    const sk = range(t, T.gibi - 0.02, T.gibi + 0.3, ease.outBack);
    tBas.p.style.opacity = clamp(sk * 2).toFixed(3); tBas.p.style.transform = SC(sk);

    // emir hattı: başkomutan → mareşal
    const c1 = range(t, T.gibi + 0.45, T.ana - 0.25, ease.inOutCubic);
    cmd1Clip.firstChild.setAttribute('height', ((MY - MR - 14 - PB - 10) * c1).toFixed(1));
    cmd1.setAttribute('stroke-dashoffset', (-t * 26).toFixed(2));
    // mareşal: önce boş yuva, "mareşal" sözünde rozet damgalanır
    const stamp = range(t, T.mar - 0.05, T.mar + 0.32, ease.outExpo);
    const sl = sk0 * (1 - clamp(stamp * 3));
    slot.setAttribute('opacity', sl.toFixed(3));
    slot.setAttribute('r', (MR + 4 * Math.sin(t * 5)).toFixed(2));
    slot.setAttribute('stroke-dashoffset', (-t * 18).toFixed(2));
    slotStar.setAttribute('opacity', (sl * (0.6 + 0.4 * Math.sin(t * 5))).toFixed(3));
    waves.forEach((w, i) => {
      const u = ((((t - T.gibi - 0.3) / 1.1 + i * 0.5) % 1) + 1) % 1;
      const on = t > T.gibi + 0.3 + i * 0.55 && t < T.mar + 0.2;
      w.setAttribute('r', (10 + 46 * u).toFixed(2));
      w.setAttribute('opacity', on ? (0.7 * (1 - u)).toFixed(3) : 0);
    });
    badge.g.setAttribute('transform', `translate(${MX},${MY}) scale(${lerp(1.9, 1, stamp).toFixed(4)}) translate(${-MX},${-MY})`);
    badge.g.setAttribute('opacity', clamp(stamp * 2.2).toFixed(3));
    const spin = (1 - range(t, T.mar - 0.05, T.mar + 0.6, ease.outCubic)) * -72;
    badge.star.setAttribute('transform', `rotate(${spin.toFixed(2)} ${MX} ${MY}) translate(${MX},${MY}) scale(${(1 + 0.08 * Math.sin(t * 3) * stamp).toFixed(4)}) translate(${-MX},${-MY})`);
    const sh = range(t, T.mar + 0.12, T.mar + 0.8, ease.outCubic);
    shock.setAttribute('r', (MR + 90 * sh).toFixed(2));
    shock.setAttribute('opacity', sh > 0 && sh < 1 ? (0.8 * (1 - sh)).toFixed(3) : 0);
    orbit.setAttribute('opacity', range(t, T.mar + 0.3, T.mar + 0.7).toFixed(3));
    orbit.setAttribute('stroke-dashoffset', (-t * 16).toFixed(2));
    const ak = range(t, T.ajan - 0.02, T.ajan + 0.3, ease.outBack);
    tMar.p.style.opacity = clamp(ak * 2).toFixed(3); tMar.p.style.transform = SC(ak);
    const mk = range(t, T.mar + 0.02, T.mar + 0.36, ease.outCubic);
    tMar.n.style.opacity = mk.toFixed(3);
    tMar.n.style.transform = TX((1 - mk) * -18);
    const gk = range(t, T.mar + 0.55, T.mar + 0.95, ease.outCubic);
    gauge.el.style.opacity = gk.toFixed(3);
    gauge.el.style.transform = TX((1 - gk) * 16);

    // emir hatları: mareşal → ordular
    fans.forEach((f, i) => {
      const k = range(t, T.emrine + i * 0.07, T.emrine + 0.6 + i * 0.07, ease.inOutCubic);
      f.base.setAttribute('stroke-dasharray', `${k.toFixed(4)} 1`);
      f.base.setAttribute('opacity', k > 0 ? 1 : 0);
      f.flow.setAttribute('opacity', k >= 1 ? 0.75 : 0);
      f.flow.setAttribute('stroke-dashoffset', (-t * 60).toFixed(2));
      f.head.setAttribute('opacity', range(k, 0.9, 1).toFixed(3));
    });
  }

  // ses: hepsi konuşmanın altında; vurgular söz aralarına ya da kısa tutulur
  const sfx = [
    { t: T.tavsiye - 0.05, name: 'pop', gain: 0.3 }, { t: T.boyle - 0.1, name: 'whoosh-short', gain: 0.22 },
    { t: FIG_OUT, name: 'whoosh', gain: 0.26 }, { t: FIG_OUT + 0.3, name: 'drop', gain: 0.3 },
    { t: T.bolun - 0.02, name: 'anlatim-crack', gain: 0.32 }, ...TASKS.map((_, i) => ({ t: T.bolun + 0.3 + i * 0.06, name: 'tick', gain: 0.26 })),
    { t: T.yon + 0.2, name: 'anlatim-stretch', gain: 0.3 }, ...TASKS.map((_, i) => ({ t: T.bag + 0.38 + i * 0.13, name: 'tick', gain: 0.22 })),
    { t: T.tutun + 0.28, name: 'ping', gain: 0.3 },
    { t: P1_OUT, name: 'whoosh', gain: 0.26 },
    ...AXS.map((_, i) => ({ t: A0 + i * A_STEP, name: 'drop', gain: 0.24 })),
    { t: T.bas - 0.04, name: 'anlatim-flag', gain: 0.36 }, { t: T.gibi, name: 'pop', gain: 0.3 },
    { t: T.ajan, name: 'pop', gain: 0.3 }, { t: T.mar - 0.55, name: 'swell', gain: 0.22 }, { t: T.mar, name: 'anlatim-stamp', gain: 0.32 },
    { t: T.emrine, name: 'whoosh', gain: 0.24 },
    ...AXS.map((_, i) => ({ t: T.ordular + i * 0.07, name: 'tick', gain: 0.3 })),
    { t: T.verin + 0.3, name: 'anlatim-march', gain: 0.4 },
  ];
  return { el, update, sfx, subtitleY: 1372, extend: { after: 0.28 } };
}
