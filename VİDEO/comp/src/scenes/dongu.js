// dongu — "modeller nasıl yapıyor?… kare kare üretiyor… sonra kendi ürettikleri kareleri inceleyerek ilerliyor"
// Tek metafor: ÜRET → BAK → DÜZELT döngüsü, gerçek kanıtla.
//   A) Sonuç videosu oynar; "nasıl?" sözünde çapraz bir silme altındaki KODU açar (kod satırları üst projenin gerçek kaynağından).
//   B) Kareler koddan tek tek taranarak çıkar, sağdaki film şeridine düşer; sayaç 1455'e (48,5 sn × 30 kare) koşar.
//   C) Dört bulgu, dört "önce → sonra" çifti; her çift farkın en iyi göründüğü bakıştan, hepsi gerçek tur kareleri:
//      tur 1→2 "çevre boş"          : genel 18:45 bakışı   critic1/shot-genel-18.75  → critic2/b-genel-1845
//      tur 2→3 "pencereler tekdüze" : genel 21:30 (yakın)  critic2/b-genel-2130      → critic3/full/b-genel-2130
//      tur 3→4 "açılış zayıf"       : videonun ilk karesi  critic3/full/b-video-0_0s → critic4/s1/01
//      tur 4→5 "Cevahir karanlık"   : Cevahir              orch4/b-plan-2130 (kırpma) → critic5/full-26
//      İlkinde odak çerçevesi kareyi tarar, kusuru işaretler, not düşer; düzeltilmiş kare silerek gelir. Sonrakiler hızlanır.
//      Karelere filtre uygulanmadı (yalnız kırpma/ölçekleme). Bulgular tur commit'lerinden (üst proje git log: Round 2…5).
import { C, FONT, SAFE, W, H, ease, range, clamp, lerp } from '../theme.js';
import { h, s } from '../kit.js';
import { rgba, mixc, ticksD, label } from './baglam.js';

const CW = 640, CH = 800, CY0 = 330, CXA = 220, CXB = 72;   // ana kart
const SX = 756, SW = 252, PITCH = 160, TW = 204, TH = 136;  // film şeridi
const CODE = ['export async function create(ctx) {', '  const { THREE, heightAt } = ctx;', '  const root = new THREE.Group();', '',
  '  const steel = std(0x8b9298, 0.38, 0.85);', '  const concrete = std(0x9c978e, 0.85, 0);', '  const paving = std(0xb3aa9c, 0.82, 0);', '',
  "  const tt = byKey('trump_towers');", '  function trumpTower(fp, H, residential, seed) {', '    const b = obb(fp.footprint);', '    const fr = frame(b.cx, b.cz, b.angle);',
  '    for (let y = base + 2 * FH; y < whiteTop; y += FH) {', '      const r = interpRect(wN, y);', '    }', '  }', '',
  '  const trumpLed = glow(0xfff1dc, 3.5, 0.2);', '  const top = (x, z) => heightAt(x, z) + 14;', '  const poly = cleanPoly(pod.footprint);', '  const avGeo = new THREE.SphereGeometry(0.5, 10, 8);'];
// tur n denetiminin bulgusu → tur n+1'de kapanır. box: kusurun "önce" karesindeki yeri (kart koordinatı: x, y, en, boy)
const FIX = [
  { a: 's1a', b: 's1b', note: 'çevre boş', box: [10, 318, 286, 232] },
  { a: 's2a', b: 's2b', note: 'pencereler tekdüze', box: [26, 60, 588, 300] },
  { a: 's3a', b: 's3b', note: 'açılış zayıf', box: [10, 10, 470, 330] },
  { a: 's4a', b: 's4b', note: 'Cevahir karanlık', box: [70, 250, 430, 400] },
];
const NOTES = FIX.map((f) => f.note);
const STEPS = ['ÜRET', 'BAK', 'DÜZELT'];

function codeHTML(line) {
  const esc = line.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return esc.replace(/('[^']*')|\b(0x[0-9a-f]+|\d+(?:\.\d+)?)\b|\b(export|async|function|const|for|let|new|return)\b/g,
    (m, str, num, kw) => `<span style="color:${str ? C.ok : num ? C.window : C.cyan}">${m}</span>`) || '&nbsp;';
}

export async function create(ctx) {
  const tw = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const D = ctx.duration;
  const T = {
    yaz: tw('yazılımcılara', 0, 1.15), sim: tw('simülasyonu', 0, 3.19), nasil: tw('modeller', 0, 3.91), yapiyor: tw('yapıyor', 0, 4.99),
    mod2: tw('modeller', 1, 6.59), kare1: tw('kare', 0, 8.67), kare2: tw('kare', 1, 8.95), sonra: tw('sonrasında', 0, 10.91),
    kendi: tw('kendi', 0, 11.53), incele: tw('inceleyerek', 0, 12.91), ilerle: tw('ilerliyor', 0, 13.59), sasir: tw('şaşırtıcı', 0, 15.29),
  };
  // B: üretim anları (hızlanır; "kare kare" sözleri tam vuruşa gelir)
  const P = [T.mod2 + 0.1, T.mod2 + 0.82, T.mod2 + 1.48, T.kare1, T.kare2, T.kare2 + 0.24];
  for (let d = 0.2; P[P.length - 1] < T.sonra - 0.22; d = Math.max(0.085, d * 0.86)) P.push(P[P.length - 1] + d);
  const NF = P.length - 1;                      // üretilen kare sayısı (şeride düşenler)
  // C: BT[k] = k. bulgunun "önce" karesinin geldiği an, WP[k] = düzeltilmiş karenin silerek gelmeye başladığı an
  const LOCK = T.incele - 0.2, WD = 0.36;
  const BT = [T.sonra - 0.08], WP = [T.incele + 0.25];
  for (let k = 1; k < 4; k++) { BT.push(WP[k - 1] + WD + 0.08); WP.push(BT[k] + 0.38); }

  const el = h('div', { class: 'scene' });
  const all = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '540px 730px' } });
  el.append(all);

  // ---------------- ana kart ----------------
  const card = h('div', { class: 'abs', style: { left: '0', top: CY0 + 'px', width: CW + 'px', height: CH + 'px', overflow: 'hidden', background: C.night } });
  const codeEl = h('div', { class: 'abs', style: { left: '0', top: '0', width: '100%', height: '100%', boxSizing: 'border-box', padding: '84px 0 0 26px',
    font: `500 24px/38px ${FONT.mono}`, color: C.dim, whiteSpace: 'pre', background: `linear-gradient(180deg, ${rgba(C.forest, 0.55)}, ${rgba(C.night, 0.9)})` } });
  const codeHi = h('div', { class: 'abs', style: { left: '0', width: '100%', height: '38px', background: rgba(C.cyan, 0.13), borderLeft: `4px solid ${C.cyan}` } });
  const codeLines = h('div', { html: CODE.map((l) => `<div>${codeHTML(l)}</div>`).join('') });
  codeEl.append(codeHi, codeLines);
  const imgStyle = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:none;';
  // A: sonuç videosundan gerçek kareler (out/final/mecidiyekoy.mp4, 41,9–48,4 sn) — durağan değil, oynar
  const hero = await ctx.frames('hero');
  const finalIm = hero.el;
  finalIm.style.cssText = imgStyle;
  finalIm.decoding = 'sync';                    // kare değişince eski kare boyanmasın
  const rest = await Promise.all([
    ...Array.from({ length: 14 }, (_, i) => ctx.image(`k${String(i).padStart(2, '0')}.jpg`, { style: imgStyle })),
    ...FIX.flatMap((f) => [ctx.image(`${f.a}.jpg`, { style: imgStyle }), ctx.image(`${f.b}.jpg`, { style: imgStyle })])]);
  const K = rest.slice(0, 14), R = rest.slice(14);
  const IA = FIX.map((_, k) => R[2 * k]), IB = FIX.map((_, k) => R[2 * k + 1]);   // önce / sonra
  const shade = h('div', { class: 'abs', style: { left: '0', top: '0', width: '100%', height: '100%', background: `linear-gradient(180deg, ${rgba(C.night, 0.5)} 0%, ${rgba(C.night, 0)} 16%)` } });
  // kart üstü çizimler: silme çizgisi, odak çerçevesi, kusur kutusu
  const ov = s('svg', { viewBox: `0 0 ${CW} ${CH}`, width: CW, height: CH, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' } });
  const wipeLine = s('line', { 'stroke-width': 4, style: { stroke: C.ink }, opacity: 0 });
  const wipeGlow = s('line', { 'stroke-width': 18, style: { stroke: rgba(C.window, 0.35) }, opacity: 0 });
  const flaw = s('rect', { fill: 'none', 'stroke-width': 4, opacity: 0 });
  const flawFill = s('rect', { opacity: 0 });
  const ret = s('path', { fill: 'none', 'stroke-width': 4, 'stroke-linecap': 'square', style: { stroke: C.window }, opacity: 0 });
  const retScan = s('line', { 'stroke-width': 2, style: { stroke: rgba(C.window, 0.9) }, opacity: 0 });
  const retDim = s('path', { 'fill-rule': 'evenodd', style: { fill: rgba(C.night, 0.42) }, opacity: 0 });
  const leader = s('path', { fill: 'none', 'stroke-width': 3, style: { stroke: C.ember }, opacity: 0 });
  ov.append(retDim, flawFill, flaw, leader, retScan, ret, wipeGlow, wipeLine);
  const retTag = h('div', { class: 'abs', style: { left: '0', top: '0', padding: '8px 12px 7px', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.04em', background: C.window, color: C.night, whiteSpace: 'nowrap', opacity: '0' } }, 'MODEL BAKIYOR');
  const tag = h('div', { class: 'abs', style: { left: '22px', top: '22px', padding: '10px 14px 9px', font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.06em', background: C.ink, color: C.night, whiteSpace: 'nowrap' } });
  const tagR = h('div', { class: 'abs', style: { right: '22px', top: '22px', padding: '10px 14px 9px', font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.06em', background: C.cyan, color: C.night, whiteSpace: 'nowrap', opacity: '0' } }, 'KOD');
  const info = h('div', { class: 'abs', style: { left: '22px', bottom: '22px', padding: '11px 14px 10px', font: `600 26px/1 ${FONT.mono}`, letterSpacing: '0', background: rgba(C.night, 0.82), color: C.ink, whiteSpace: 'nowrap', opacity: '0' } }, '48,5 sn · 1455 kare · tamamı kod');
  // bulgu listesi (tur denetimlerinin notları)
  const notes = NOTES.map((txt, i) => {
    const mark = h('span', { style: { display: 'inline-block', width: '30px', font: `800 26px/1 ${FONT.display}` } }, '✕');
    const box = h('div', { class: 'abs', style: { left: '24px', top: 516 + i * 62 + 'px', padding: '12px 18px 12px 13px', font: `700 28px/1 ${FONT.display}`, letterSpacing: '0.01em', whiteSpace: 'nowrap',
      transformOrigin: '0 50%', opacity: '0', boxShadow: `0 3px 0 ${rgba(C.night, 0.45)}` } }, mark, txt);
    return { box, mark };
  });
  card.append(codeEl, ...K, finalIm, ...R, shade, ov, retTag, tag, tagR, info, ...notes.map((n) => n.box));
  const frameSvg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' } });
  const cTicks = s('path', { fill: 'none', 'stroke-width': 3, style: { stroke: C.ink } });
  const cLine = s('rect', { fill: 'none', 'stroke-width': 2 });
  frameSvg.append(cLine, cTicks);
  const capTop = label('SONUÇ · mecidiyekoy.mp4', { left: '0', top: '258px', color: C.dim, textTransform: 'none' });

  // ---------------- döngü göstergesi ----------------
  const chips = STEPS.map((txt) => h('div', { style: { padding: '13px 18px 12px', font: `700 27px/1 ${FONT.mono}`, letterSpacing: '0.08em', whiteSpace: 'nowrap', boxSizing: 'border-box' } }, txt));
  const arrow = () => h('div', { style: { font: `700 26px/1 ${FONT.mono}`, color: rgba(C.ink, 0.6), padding: '0 12px' } }, '→');
  // dönen ok vektör çizilir (yazı karakteri döndürülünce raster önceki karelere bağlı kalıyordu)
  const loopArc = s('path', { d: 'M9.5,-5.5 A11,11 0 1 0 11,0', fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round' });
  const loopHead = s('path', { d: 'M4.5,-9.5 L10.5,-4.5 L12.5,-12 Z' });
  const loopG = s('g', {}, loopArc, loopHead);
  const loopBack = s('svg', { viewBox: '-16 -16 32 32', width: 34, height: 34, style: { marginLeft: '14px', overflow: 'visible' } }, loopG);
  const loopRow = h('div', { class: 'abs', style: { left: SAFE.left + 'px', top: '238px', display: 'flex', alignItems: 'center' } }, chips[0], arrow(), chips[1], arrow(), chips[2], loopBack);
  const counter = h('div', { class: 'abs', style: { right: W - SAFE.right + 'px', top: '248px', font: `700 28px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } });

  // ---------------- film şeridi ----------------
  const strip = h('div', { class: 'abs', style: { left: SX + 'px', top: CY0 + 'px', width: SW + 'px', height: CH + 'px', background: rgba(C.night, 0.72), overflow: 'hidden',
    boxShadow: `0 0 0 1.5px ${rgba(C.ink, 0.35)}` } });
  const perf = (left) => h('div', { class: 'abs', style: { left: left + 'px', top: '-40px', width: '12px', height: CH + 80 + 'px',
    background: `repeating-linear-gradient(180deg, ${rgba(C.ink, 0.5)} 0 12px, transparent 12px 32px)` } });
  const perfL = perf(7), perfR = perf(SW - 19);
  strip.append(perfL, perfR);
  // B: üretilen karelerin küçükleri (karttan şeride uçar)
  const thumbs = [];
  for (let j = 0; j < NF; j++) {
    const im = await ctx.image(`k${String(j % 14).padStart(2, '0')}.jpg`, { style: 'width:100%;height:100%;object-fit:cover;display:block;' });
    const box = h('div', { class: 'abs', style: { left: '0', top: '0', overflow: 'hidden', display: 'none', boxShadow: `0 0 0 1.5px ${rgba(C.ink, 0.55)}` } }, im);
    thumbs.push(box);
  }
  // C: tur yuvaları
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const im = await ctx.image(`t${i + 1}.jpg`, {   // t1 = tur 1 karesi, t2…t5 = her düzeltmenin "sonra" karesi (204×136)
      style: 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;' });
    const lbl = h('div', { class: 'abs', style: { left: '0', top: '0', padding: '7px 10px 6px', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.04em', whiteSpace: 'nowrap' } }, i === 4 ? 'FİNAL' : `TUR ${i + 1}`);
    const box = h('div', { class: 'abs', style: { left: SX + (SW - TW) / 2 + 'px', top: CY0 + 12 + i * PITCH + 'px', width: TW + 'px', height: TH + 'px', overflow: 'hidden', background: rgba(C.night, 0.6) } }, im, lbl);
    slots.push({ box, im, lbl });
  }
  all.append(capTop, loopRow, counter, strip, card, frameSvg, ...slots.map((x) => x.box), ...thumbs);

  let tagText = '', cntText = '';
  const setTag = (txt, bg, fg) => { if (tagText !== txt) { tagText = txt; tag.textContent = txt; } tag.style.background = bg; tag.style.color = fg; };
  const setCnt = (txt) => { if (cntText !== txt) { cntText = txt; counter.textContent = txt; } };
  const show = (im, on) => { im.style.display = on ? '' : 'none'; };

  function update(t) {
    // ---- genel giriş/çıkış ----
    const inK = range(t, 0.08, 0.8, ease.outCubic);
    const bye = range(t, D - 0.3, D, ease.inCubic);
    all.style.opacity = (range(t, 0.08, 0.5) * (1 - bye)).toFixed(4);
    all.style.transform = inK >= 1 && bye <= 0 ? 'none' : `translateY(${((1 - inK) * 50).toFixed(2)}px) scale(${(1 - 0.03 * bye).toFixed(4)})`;
    const slide = range(t, T.yapiyor + 0.5, T.yapiyor + 1.3, ease.inOutCubic);       // kart sola, şerit içeri
    const cx = lerp(CXA, CXB, slide);
    card.style.left = cx.toFixed(2) + 'px';
    const phaseB = t >= P[0] - 0.05 && t < T.sonra - 0.1;
    const phaseC = t >= T.sonra - 0.1;
    const done5 = range(t, WP[3] + WD * 0.6, WP[3] + WD + 0.4, ease.outCubic);

    // ---- A: sonuç karesi + kod silmesi ----
    const wA = 0.5 * range(t, T.nasil - 0.05, T.nasil + 0.85, ease.inOutCubic) + 0.5 * range(t, T.yapiyor + 0.45, T.yapiyor + 1.2, ease.inOutCubic)
      + (t > T.nasil + 0.85 && t < T.yapiyor + 0.45 ? 0.018 * Math.sin((t - T.nasil - 0.85) * 5) : 0);
    const showFinal = wA < 0.999 && t < P[0] + 0.2;
    show(finalIm, showFinal);
    const X = lerp(CW + 90, -90, wA);
    if (showFinal) {
      finalIm.style.clipPath = `polygon(0 0, ${(X + 80).toFixed(1)}px 0, ${(X - 80).toFixed(1)}px 100%, 0 100%)`;
      hero.at(clamp(t - 0.05, 0, hero.duration - 0.06));
    }
    const codeRow = Math.floor(t * 5) % CODE.length;
    codeHi.style.top = 84 + codeRow * 38 + 'px';
    capTop.style.left = cx + 'px';
    capTop.style.opacity = (range(t, 0.5, 0.9) * (1 - range(t, T.yapiyor + 0.4, T.yapiyor + 0.8))).toFixed(3);
    tagR.style.opacity = (range(t, T.nasil + 0.45, T.nasil + 0.7) * (1 - range(t, T.sonra - 0.2, T.sonra + 0.1))).toFixed(3);
    info.style.opacity = (range(t, T.yaz, T.yaz + 0.3) * (1 - range(t, T.nasil + 0.2, T.nasil + 0.5))).toFixed(3);
    info.style.transform = t >= T.yaz + 0.35 ? 'none' : `translateY(${((1 - range(t, T.yaz, T.yaz + 0.35, ease.outCubic)) * 14).toFixed(2)}px)`;

    // silme çizgisi (A'da çapraz, C'de dikey)
    let wl = null;
    if (showFinal && wA > 0.001) wl = [X + 80, 0, X - 80, CH];

    // ---- B: kare kare üretim ----
    let cur = -1;
    for (let j = 0; j < P.length; j++) if (t >= P[j]) cur = j;
    K.forEach((im) => show(im, false));
    let scanY = -1;
    if (phaseB && cur >= 0) {
      const nxt = cur < NF ? P[cur + 1] : T.sonra;
      const q = nxt - P[cur] < 0.3 ? 1 : range(t, P[cur], P[cur] + Math.min(0.5, (nxt - P[cur]) * 0.8), ease.inOutCubic);
      const im = K[cur % 14];
      show(im, true);
      im.style.clipPath = q >= 1 ? 'none' : `inset(0 0 ${((1 - q) * 100).toFixed(2)}% 0)`;
      im.style.transform = 'none'; im.style.opacity = '1';
      if (q < 1) scanY = q * CH;
    } else if (phaseC && cur >= 0) {
      // son üretilen kare, tur 1 karesi gelene kadar altta kalır
      const im = K[cur % 14];
      const hold = t < T.sonra + 0.35;
      show(im, hold); im.style.clipPath = 'none';
    }
    // küçükler: karttan şeride uçar, şerit aşağı akar
    let sc = 0;
    for (let j = 0; j < NF; j++) sc += range(t, P[j + 1], P[j + 1] + 0.2, ease.outCubic);
    const stripGone = range(t, T.sonra - 0.12, T.sonra + 0.3, ease.inCubic);
    for (let j = 0; j < NF; j++) {
      const b = thumbs[j];
      const f = range(t, P[j + 1], P[j + 1] + 0.24, ease.inOutCubic);
      if (f <= 0 || stripGone >= 1) { b.style.display = 'none'; continue; }
      let before = 0;
      for (let m = j + 1; m < NF; m++) before += range(t, P[m + 1], P[m + 1] + 0.2, ease.outCubic);
      const ty = CY0 + 12 + before * PITCH + stripGone * 900;
      if (ty > CY0 + CH - 20) { b.style.display = 'none'; continue; }
      const tx = SX + (SW - TW) / 2;
      const fast = P[j + 1] - P[j] < 0.3;                       // hızlı karelerde uçuş yok: şeritte belirir
      const g = fast ? 1 : f;
      b.style.display = '';
      b.style.left = lerp(cx, tx, g).toFixed(2) + 'px';
      b.style.top = lerp(CY0, ty, g).toFixed(2) + 'px';
      b.style.width = lerp(CW, TW, g).toFixed(2) + 'px';
      b.style.height = lerp(CH, Math.min(TH, CY0 + CH - ty), g).toFixed(2) + 'px';
      b.style.opacity = fast ? f.toFixed(3) : '1';
      b.style.boxShadow = `0 0 0 ${g < 1 ? 3 : 1.5}px ${g < 1 ? C.window : rgba(C.ink, 0.55)}, 0 ${(30 * (1 - g)).toFixed(1)}px ${(60 * (1 - g)).toFixed(1)}px ${rgba(C.night, 0.6)}`;
    }
    const perfOff = ((sc * PITCH) % 32) + (stripGone * 900) % 32;
    perfL.style.transform = perfR.style.transform = `translateY(${perfOff.toFixed(2)}px)`;
    const stripIn = range(t, T.yapiyor + 0.7, T.yapiyor + 1.3, ease.outCubic);
    strip.style.opacity = stripIn.toFixed(3);
    strip.style.transform = stripIn >= 1 ? 'none' : `translateX(${((1 - stripIn) * 70).toFixed(2)}px)`;

    // ---- C: bak → düzelt, tur tur ----
    let round = 1;                         // şu an ekranda tam görünen tur
    let step = 0;                          // şu an işlenen bulgu
    let slideIn = 1;                       // "önce" karesinin yandan gelişi (ilk bulguda yok)
    R.forEach((im) => show(im, false));
    if (phaseC) {
      for (let k = 1; k < 4; k++) if (t >= BT[k]) step = k;
      for (let k = 0; k < 4; k++) if (t >= WP[k] + WD) round = k + 2;
      const A = IA[step], B = IB[step];
      const fixQ = range(t, WP[step], WP[step] + WD, ease.inOutCubic);
      slideIn = step === 0 ? 1 : range(t, BT[step], BT[step] + 0.2, ease.outCubic);
      // önceki bulgunun "sonra" karesi sola çekilirken yenisinin "önce" karesi sağdan girer
      if (slideIn < 1) {
        const P0 = IB[step - 1];
        show(P0, true); P0.style.opacity = '1'; P0.style.clipPath = 'none';
        P0.style.transform = `translateX(${(-slideIn * CW).toFixed(2)}px)`;
      }
      if (fixQ < 1) {
        show(A, true);
        A.style.opacity = step === 0 ? range(t, BT[0], BT[0] + 0.38, ease.outCubic).toFixed(3) : '1';
        A.style.clipPath = 'none';
        A.style.transform = slideIn < 1 ? `translateX(${((1 - slideIn) * CW).toFixed(2)}px)` : 'none';
      }
      if (fixQ > 0) {
        show(B, true); B.style.opacity = '1'; B.style.transform = 'none';
        B.style.clipPath = fixQ >= 1 ? 'none' : `inset(0 ${((1 - fixQ) * 100).toFixed(2)}% 0 0)`;
        if (fixQ < 1) wl = [fixQ * CW, 0, fixQ * CW, CH];
      }
    }
    if (scanY >= 0) wl = [0, scanY, CW, scanY];
    for (const ln of [wipeLine, wipeGlow]) {
      ln.setAttribute('opacity', wl ? 1 : 0);
      if (wl) { ln.setAttribute('x1', wl[0].toFixed(1)); ln.setAttribute('y1', wl[1].toFixed(1)); ln.setAttribute('x2', wl[2].toFixed(1)); ln.setAttribute('y2', wl[3].toFixed(1)); }
    }

    // odak çerçevesi: kareyi tarar, kusura kilitlenir
    const F0 = FIX[0].box, FB = { x: F0[0], y: F0[1], w: F0[2], h: F0[3] };   // tur 1'deki boş alan (kart koordinatı)
    const keys = [[T.sonra + 0.3, 470, 230], [T.kendi + 0.1, 430, 620], [T.kendi + 0.7, 220, 660], [LOCK, FB.x + FB.w / 2, FB.y + FB.h / 2]];
    let rx = keys[0][1], ry = keys[0][2];
    for (let i = 1; i < keys.length; i++) { const q = range(t, keys[i - 1][0], keys[i][0], ease.inOutCubic); rx = lerp(rx, keys[i][1], q); ry = lerp(ry, keys[i][2], q); }
    const lock = range(t, LOCK, LOCK + 0.22, ease.outCubic);
    const q2 = (v) => Math.round(v / 2) * 2;      // çift piksele oturt: kenar yumuşatması kare geçmişine bağlı kalmasın
    const rw = q2(lerp(190, FB.w, lock)), rh = q2(lerp(150, FB.h, lock));
    rx = q2(rx); ry = q2(ry);
    const rOn = range(t, T.sonra + 0.25, T.sonra + 0.5) * (1 - range(t, WP[0] + 0.1, WP[0] + 0.3));
    const fixed = range(t, WP[0] + WD * 0.4, WP[0] + WD);
    ret.setAttribute('d', ticksD(rx - rw / 2, ry - rh / 2, rw, rh, 26));
    ret.setAttribute('opacity', rOn.toFixed(3));
    ret.style.stroke = mixc(C.window, C.ember, lock);
    retDim.setAttribute('d', `M0,0H${CW}V${CH}H0Z M${(rx - rw / 2).toFixed(1)},${(ry - rh / 2).toFixed(1)}h${rw.toFixed(1)}v${rh.toFixed(1)}h${(-rw).toFixed(1)}Z`);
    retDim.setAttribute('opacity', (rOn * (1 - 0.6 * lock)).toFixed(3));
    const sy = q2(ry - rh / 2 + rh * (0.5 + 0.5 * Math.sin(t * 9))) + 1;
    retScan.setAttribute('x1', (rx - rw / 2).toFixed(1)); retScan.setAttribute('x2', (rx + rw / 2).toFixed(1));
    retScan.setAttribute('y1', sy.toFixed(1)); retScan.setAttribute('y2', sy.toFixed(1));
    retScan.setAttribute('opacity', (rOn * (1 - lock)).toFixed(3));
    retTag.style.opacity = (rOn * (1 - lock)).toFixed(3);
    retTag.style.left = Math.round(rx - rw / 2 - 2) + 'px'; retTag.style.top = Math.round(ry - rh / 2 - 50) + 'px';   // tam piksel: yazı rasteri kare sırasından bağımsız kalsın
    // kusur kutusu: her bulguda "önce" karesinin üstünde kırmızı; düzeltme silinirken yeşile döner
    const sb = FIX[step].box;
    const fOpen = step === 0 ? LOCK : BT[step] + 0.16;
    const fIn = step === 0 ? lock : range(t, fOpen, fOpen + 0.1);
    const fFix = range(t, WP[step] + WD * 0.4, WP[step] + WD);
    const fGone = step < 3 ? 1 : 1 - range(t, WP[3] + WD + 0.15, WP[3] + WD + 0.4);
    const blink = t >= fOpen && t < fOpen + 0.36 ? (Math.floor((t - fOpen) * 11) % 2 ? 0.4 : 1) : 1;
    const flawOn = phaseC ? fIn * fGone * (slideIn < 1 ? 0 : 1) : 0;
    for (const [k, v] of [['x', sb[0]], ['y', sb[1]], ['width', sb[2]], ['height', sb[3]]]) { flaw.setAttribute(k, v); flawFill.setAttribute(k, v); }
    flaw.style.stroke = mixc(C.ember, C.ok, fFix);
    flaw.setAttribute('opacity', (flawOn * blink).toFixed(3));
    flawFill.style.fill = mixc(C.ember, C.ok, fFix);
    flawFill.setAttribute('opacity', (flawOn * 0.16 * blink).toFixed(3));
    leader.setAttribute('d', `M40,${FB.y + FB.h}V516`);
    leader.setAttribute('opacity', (step === 0 ? range(t, LOCK + 0.12, LOCK + 0.3) * (1 - fixed) : 0).toFixed(3));

    // bulgu notları: açılır (✕), bir sonraki turda kapanır (✓)
    notes.forEach((nt, i) => {
      const open = i === 0 ? LOCK + 0.14 : BT[i] + 0.16;
      const close = WP[i] + WD * 0.75;
      const k = range(t, open, open + 0.28, ease.outBack);
      const ok = t >= close;
      const pulse = ok ? Math.exp(-(t - close) * 6) : 0;
      nt.box.style.opacity = clamp(k * 2.5).toFixed(3);
      nt.box.style.transform = k >= 1 && pulse < 0.01 ? 'none' : `translateX(${((1 - clamp(k)) * -20).toFixed(2)}px) scale(${(0.8 + 0.2 * k + 0.06 * pulse).toFixed(4)})`;
      nt.box.style.background = ok ? rgba(C.night, 0.82) : C.ember;
      nt.box.style.color = ok ? C.ok : C.ink;
      const m = ok ? '✓' : '✕';
      if (nt.mark.textContent !== m) nt.mark.textContent = m;
    });

    // tur yuvaları (şeritte)
    slots.forEach((sl, i) => {
      const appear = range(t, T.sonra + 0.05 + i * 0.05, T.sonra + 0.4 + i * 0.05, ease.outCubic);
      const fillAt = i === 0 ? T.sonra + 0.2 : WP[i - 1] + WD * 0.7;
      const f = range(t, fillAt, fillAt + 0.3, ease.outBack);
      const active = round === i + 1 && !(i < 4 && t >= WP[i]);
      sl.box.style.opacity = appear.toFixed(3);
      const bump = t >= fillAt ? Math.exp(-(t - fillAt) * 6) : 0;
      sl.box.style.transform = appear >= 1 && bump < 0.01 ? 'none' : `translateY(${((1 - appear) * 30).toFixed(2)}px) scale(${(1 + 0.04 * bump).toFixed(4)})`;
      sl.im.style.opacity = clamp(f).toFixed(3);
      sl.im.style.transform = f >= 1 ? 'none' : `scale(${(1.25 - 0.25 * clamp(f)).toFixed(4)})`;
      sl.box.style.boxShadow = active ? `0 0 0 3.5px ${i === 4 ? C.ok : C.window}` : f > 0 ? `0 0 0 1.5px ${rgba(C.ink, 0.55)}` : `inset 0 0 0 1.5px ${rgba(C.ink, 0.35)}`;
      sl.lbl.style.background = active ? (i === 4 ? C.ok : C.window) : f > 0 ? rgba(C.night, 0.78) : 'transparent';
      sl.lbl.style.color = active ? C.night : f > 0 ? C.ink : rgba(C.ink, 0.6);
    });

    // ---- kart etiketi + sayaç ----
    if (phaseC) setTag(round === 5 ? 'TUR 5 · FİNAL' : `TUR ${round}`, round === 5 ? C.ok : C.ink, C.night);
    else if (phaseB && cur >= 0) {
      const n = cur < 7 ? cur + 1 : Math.round(lerp(8, 1455, range(t, P[7], T.sonra - 0.12, (x) => x * x * x)));
      setTag(`KARE ${String(n).padStart(4, '0')} / 1455`, C.ink, C.night);
    } else setTag('MECİDİYEKÖY · SİMÜLASYON', C.ink, C.night);
    tag.style.opacity = range(t, 0.55, 0.85).toFixed(3);
    setCnt(phaseC ? `TUR ${round} / 5` : '');
    counter.style.opacity = range(t, T.sonra + 0.1, T.sonra + 0.4).toFixed(3);
    counter.style.color = round === 5 ? C.ok : C.ink;

    // ---- döngü göstergesi ----
    const loopIn = range(t, T.yapiyor + 0.9, T.yapiyor + 1.4, ease.outCubic);
    loopRow.style.opacity = loopIn.toFixed(3);
    loopRow.style.transform = loopIn >= 1 ? 'none' : `translateY(${((1 - loopIn) * -14).toFixed(2)}px)`;
    let act = -1;
    if (phaseC) {
      if (t < WP[0] - 0.12) act = t >= T.sonra + 0.25 ? 1 : 0;
      else if (done5 > 0.05) act = 3;                                           // hepsi yanık
      else {
        // her turda: düzelt (silme) → üret (yeni kare) → bak (kusur işaretlenir)
        let k = 0; for (let i = 0; i < 4; i++) if (t >= WP[i] - 0.12) k = i;
        act = t < WP[k] + WD ? 2 : k < 3 && t >= BT[k + 1] + 0.14 ? 1 : 0;
      }
    } else if (t >= P[0] - 0.1) act = 0;
    chips.forEach((c, i) => {
      const on = act === i || act === 3;
      c.style.background = on ? (act === 3 ? C.ok : C.window) : rgba(C.night, 0.6);
      c.style.color = on ? C.night : rgba(C.ink, 0.75);
      c.style.boxShadow = on ? 'none' : `inset 0 0 0 1.5px ${rgba(C.ink, 0.4)}`;
    });
    loopG.setAttribute('transform', `rotate(${(phaseC ? (t - T.sonra) * 150 * (1 - done5) : 0).toFixed(1)})`);
    const lc = act === 3 ? C.ok : rgba(C.ink, 0.7);
    loopArc.style.stroke = lc; loopHead.style.fill = lc;

    // ---- kart çerçevesi ----
    const glow = done5;
    cTicks.setAttribute('d', ticksD(cx - 14, CY0 - 14, CW + 28, CH + 28, 30));
    cTicks.style.stroke = mixc(C.ink, C.ok, glow);
    for (const [k, v] of [['x', cx], ['y', CY0], ['width', CW], ['height', CH]]) cLine.setAttribute(k, v);
    cLine.style.stroke = mixc(rgba(C.ink, 0.45), C.ok, glow);
    cLine.setAttribute('stroke-width', (2 + 2.5 * glow).toFixed(2));
  }

  const sfx = [
    { t: 0.1, name: 'whoosh-short', gain: 0.3 }, { t: T.yaz, name: 'tick', gain: 0.26 },
    { t: T.nasil - 0.05, name: 'whoosh', gain: 0.26 }, { t: T.nasil + 0.5, name: 'typing', gain: 0.18 }, { t: T.yapiyor + 0.5, name: 'whoosh-short', gain: 0.32 },
    ...P.slice(0, 7).map((p, i) => ({ t: p, name: 'shutter', gain: Math.max(0.2, 0.34 - i * 0.03) })),
    { t: P[7], name: 'anlatim-reel', gain: 0.34 },
    { t: T.sonra - 0.05, name: 'whoosh-short', gain: 0.26 }, { t: T.sonra + 0.3, name: 'anlatim-scan', gain: 0.3 }, { t: T.kendi + 0.75, name: 'anlatim-scan', gain: 0.24 },
    { t: LOCK, name: 'ping', gain: 0.3 }, { t: LOCK + 0.14, name: 'pop', gain: 0.26 },
    ...BT.slice(1).map((b) => ({ t: b + 0.16, name: 'pop', gain: 0.2 })),
    ...WP.map((w, i) => ({ t: w, name: 'whoosh-short', gain: 0.26 - i * 0.02 })), ...WP.map((w) => ({ t: w + WD * 0.75, name: 'tick', gain: 0.32 })),
    { t: WP[3] + WD * 0.7, name: 'chime', gain: 0.32 },
  ];
  return { el, update, sfx, subtitleY: 1372 };
}
