// senaryo — harekât haritası üstünde iki cephe: Senaryo 01 = Opus general + Fable askerler, Senaryo 02 = tam tersi.
// Önce rol şeması (general → askerler) tek başına kurulur, "iki farklı senaryo"da ikiye bölünür, "tam tersini yaptım"da
// roller manevra oklarıyla çapraz yer değiştirir. Her şey update(t)'nin saf fonksiyonu.
// Bu dosya kapanış sahnelerinin ortak parçalarını da dışa verir (sonuc.js ve final.js kullanır).
import { C, TEAM, FONT, alpha, clamp, ease, lerp, range } from '../theme.js';
import { coordLabel, h, mapCard, mapSvg, route, s } from '../kit.js';

// ---------------------------------------------------------------- ortak sabitler
export const NAMES = { fable: 'Fable 5.2', opus: 'Opus 5.5' };
/** Cephe sütunu (ölçek 1): iki sütun yan yana, arada cephe hattı. */
export const COL = { w: 400, h: 680, xL: 72, xR: 608, y: 322 };
/** Final'deki iki video çerçevesi (sonuc bu çerçeveleri "perde" olarak açar, final devralır). */
export const PANEL = { w: 532, h: 1444, xL: 4, xR: 544, y: 150, stripTop: 70, stripH: 112 }; // 2 px çerçeve → iç alan 528×1440 (kıyas kareleri 1:1 piksel, 3/4 ölçek)
const TOKENS = 5, TOK = 62, TOK_H = 46, TOK_STEP = (COL.w - TOK) / (TOKENS - 1);
const Y_G = 50, H_G = 240, Y_LINES = Y_G + H_G, H_LINES = 130, Y_TOK = Y_LINES + H_LINES, Y_S = Y_TOK + TOK + 24, H_S = 170;
const FLOW_PERIOD = 2.6;

const setText = (el, txt) => { if (el.textContent !== txt) el.textContent = txt; };
const f2 = (x) => Number(x).toFixed(3);
/** Yarım sinüs tümseği: [t0, t0+dur] içinde 0→1→0 */
export const bump = (t, t0, dur = 0.5) => (t <= t0 || t >= t0 + dur ? 0 : Math.sin(Math.PI * (t - t0) / dur));

/** Rütbe yıldızı (5 köşe) yolu */
export function starPath(cx, cy, R, r = R * 0.44) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`;
  }
  return d + 'Z';
}
/** Rütbe rozeti (maresal sahnesindeki dil): halka içinde yıldız; küçük boyda yalın yıldız. el.fill / el.line katmanları (dolu ↔ boş yuva) */
export function starIcon(size = 40, ringed = size >= 34) {
  const m = size / 2, R = ringed ? m * 0.56 : m * 0.92;
  const line = s('g', {},
    ringed ? s('circle', { cx: m, cy: m, r: m - 1.5, fill: 'none', stroke: C.hair, 'stroke-width': 2 }) : null,
    s('path', { d: starPath(m, m, R), fill: 'none', stroke: C.hair, 'stroke-width': ringed ? 1.6 : 2, 'stroke-linejoin': 'round' }));
  const fill = s('g', {},
    ringed ? s('circle', { cx: m, cy: m, r: m - 1.5, fill: C.night, 'fill-opacity': 0.82, stroke: 'currentColor', 'stroke-width': 2.6 }) : null,
    s('path', { d: starPath(m, m, R), fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));
  const ring = s('circle', { cx: m, cy: m, r: m, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, opacity: 0 });
  const el = s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { display: 'block', overflow: 'visible', flex: 'none' } }, ring, line, fill);
  el.line = line; el.fill = fill; el.ring = ring;
  return el;
}
/** Birlik simgesi (maresal sahnesindeki birlik kutusu): çapraz çizgili dikdörtgen */
export function chevronIcon(size = 36, weight = 2.6) {
  const w = size, hh = Math.round(size * 0.68), y = (size - hh) / 2, o = weight / 2;
  return s('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}`, style: { display: 'block', overflow: 'visible', flex: 'none' } },
    s('rect', { x: o, y: y + o, width: w - weight, height: hh - weight, fill: 'none', stroke: 'currentColor', 'stroke-width': weight }),
    s('path', { d: `M${o} ${y + o}L${w - o} ${y + hh - o}M${w - o} ${y + o}L${o} ${y + hh - o}`, fill: 'none', stroke: 'currentColor', 'stroke-width': weight * 0.62 }));
}

/** Kartografik boş çerçeve (final'in video çerçevesi ile aynı): el.body kırpma kabı */
export function panelFrame(x, y, w = PANEL.w, hh = PANEL.h) {
  const card = mapCard({ x, y, w, h: hh, pad: 0, strong: true });
  card.style.borderWidth = '2px'; card.style.borderRadius = '0';
  Object.assign(card.body.style, { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', overflow: 'hidden', borderRadius: '0', padding: '0' });
  return card;
}

// ---------------------------------------------------------------- cephe (general plakası + emir hatları + askerler)
function plate({ y, hh, role, sub, icon, nameSize, nameTop }) {
  const card = mapCard({ x: 0, y, w: COL.w, h: hh, pad: 0, strong: true });
  card.style.border = '0';
  const slot = h('div', { class: 'abs', style: { left: '0', top: '0', right: '0', bottom: '0', border: `2px dashed ${C.hair}`, borderRadius: '6px', boxSizing: 'border-box' } });
  const fill = h('div', { class: 'abs', style: { left: '0', top: '0', right: '0', bottom: '0', border: '2.5px solid currentColor', borderRadius: '6px', boxSizing: 'border-box' } });
  const tint = h('div', { class: 'abs', style: { left: '0', top: '0', right: '0', bottom: '0', background: 'currentColor', borderRadius: '6px', opacity: '0' } });
  const bar = h('div', { class: 'abs', style: { left: '0', top: '0', bottom: '0', width: '10px', background: 'currentColor', borderRadius: '6px 0 0 6px' } });
  const roleEl = h('div', { class: 'abs', style: { left: '86px', top: '30px', font: `600 24px/1 ${FONT.mono}`, letterSpacing: '0.16em', color: C.dim, whiteSpace: 'nowrap' } }, role);
  const iconBox = h('div', { class: 'abs', style: { left: '26px', top: '18px', width: '46px', height: '46px', transformOrigin: '50% 50%' } }, icon);
  const name = h('div', { class: 'abs', style: { left: '26px', top: nameTop + 'px', font: `800 ${nameSize}px/1 ${FONT.display}`, letterSpacing: '-0.03em', color: C.ink, whiteSpace: 'nowrap', transformOrigin: '0 60%' } });
  const ghost = h('div', { class: 'abs', style: { left: '28px', top: nameTop + nameSize * 0.42 + 'px', width: '190px', height: '0', borderTop: `3px dashed ${C.hair}` } });
  const subEl = h('div', { class: 'abs', style: { left: '28px', bottom: hh > 200 ? '24px' : '17px', font: `500 24px/1 ${FONT.mono}`, letterSpacing: '0.02em', color: C.dim, whiteSpace: 'nowrap' } }, sub);
  card.append(tint, slot, fill, bar, iconBox, roleEl, name, ghost, subEl);
  Object.assign(card, { slotEl: slot, fillEl: fill, tintEl: tint, barEl: bar, roleEl, iconBox, nameEl: name, ghostEl: ghost, subEl });
  return card;
}

/** Bir cephe sütunu. front.apply({...}) her karede çağrılır; front.place(x, y, ölçek, opaklık). */
export function makeFront(no) {
  const el = h('div', { class: 'abs', style: { left: '0', top: '0', width: COL.w + 'px', height: COL.h + 'px', transformOrigin: '0 0' } });
  const head = h('div', { class: 'abs', style: { left: '2px', top: '4px' } }, coordLabel(`SENARYO ${no}`, { size: 24, color: C.dim }));
  const star = starIcon(46);
  const G = plate({ y: Y_G, hh: H_G, role: 'GENERAL', sub: 'planlar · işi böler', icon: star, nameSize: 76, nameTop: 88 });
  const chev = chevronIcon(44, 2.8);
  const S = plate({ y: Y_S, hh: H_S, role: 'ASKERLER', sub: 'uygular · rapor verir', icon: chev, nameSize: 54, nameTop: 60 });
  S.roleEl.style.top = '27px'; S.iconBox.style.top = '14px'; S.iconBox.style.left = '27px';

  // emir hatları
  const svg = s('svg', { width: COL.w, height: H_LINES, viewBox: `0 0 ${COL.w} ${H_LINES}`, style: { position: 'absolute', left: '0', top: Y_LINES + 'px', overflow: 'visible' } });
  const mid = COL.w / 2, BUS = 58, END = H_LINES - 2;
  const cx = (i) => TOK / 2 + i * TOK_STEP;
  const ln = (d) => s('path', { d, fill: 'none', stroke: C.hair, 'stroke-width': 2.5, pathLength: 1, 'stroke-dasharray': '0 1', 'stroke-linecap': 'round' });
  const trunk = ln(`M${mid} 2V${BUS}`), busL = ln(`M${mid} ${BUS}H${cx(0)}`), busR = ln(`M${mid} ${BUS}H${cx(TOKENS - 1)}`);
  const drops = [], heads = [], orders = [], reports = [];
  for (let i = 0; i < TOKENS; i++) {
    drops.push(ln(`M${cx(i)} ${BUS}V${END}`));
    heads.push(s('path', { d: `M${cx(i) - 7} ${END - 9}L${cx(i)} ${END + 3}L${cx(i) + 7} ${END - 9}`, fill: 'none', stroke: C.hair, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    orders.push(s('circle', { r: 5.5, fill: 'currentColor' }));
    reports.push(s('rect', { x: -4, y: -4, width: 8, height: 8, fill: 'currentColor' }));
  }
  const gO = s('g', {}, orders), gR = s('g', {}, reports);
  svg.append(trunk, busL, busR, ...drops, ...heads, gO, gR);
  /** hat üstünde konum: u 0..1 (general → asker i) */
  const along = (i, u) => {
    const dx = Math.abs(cx(i) - mid), L = BUS + dx + (END - BUS), a = clamp(u) * L;
    if (a < BUS) return [mid, a];
    if (a < BUS + dx) return [mid + Math.sign(cx(i) - mid) * (a - BUS), BUS];
    return [cx(i), BUS + (a - BUS - dx)];
  };

  // asker birlikleri: çapraz çizgili birlik kutuları
  const tokens = [];
  for (let i = 0; i < TOKENS; i++) {
    const box = { left: '0', top: '0', right: '0', bottom: '0', borderRadius: '3px', boxSizing: 'border-box' };
    const slot = h('div', { class: 'abs', style: { ...box, border: `2px dashed ${C.hair}` } });
    const fill = h('div', { class: 'abs', style: { ...box, border: '3px solid currentColor' } });
    const tint = h('div', { class: 'abs', style: { ...box, background: 'currentColor' } });
    const ic = s('svg', { width: TOK, height: TOK_H, viewBox: `0 0 ${TOK} ${TOK_H}`, style: { position: 'absolute', left: '0', top: '0' } },
      s('path', { d: `M2 2L${TOK - 2} ${TOK_H - 2}M${TOK - 2} 2L2 ${TOK_H - 2}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }));
    const tok = h('div', { class: 'abs', style: { left: i * TOK_STEP + 'px', top: Y_TOK + (TOK - TOK_H) / 2 + 'px', width: TOK + 'px', height: TOK_H + 'px', background: C.glassStrong, borderRadius: '3px', transformOrigin: '50% 50%' } }, tint, ic, slot, fill);
    Object.assign(tok, { slotEl: slot, fillEl: fill, tintEl: tint, ic });
    tokens.push(tok);
  }
  el.append(head, svg, G, ...tokens, S);

  const D = { head: 1, gIn: 1, gFill: 1, gName: '', gColor: C.ink, gStamp: 1, gGlow: 0, sIn: 1, sFill: 1, sName: '', sColor: C.ink, sGlow: 0,
    lines: 1, flow: 0, flowA: 1, slotHi: 0, subs: 1, roles: 1 };
  function apply(p0) {
    const p = { ...D, ...p0 };
    head.style.opacity = f2(p.head);
    // ---- general plakası
    G.style.opacity = f2(p.gIn);
    G.style.transform = `translateY(${f2((1 - p.gIn) * 22)}px)`;
    G.style.color = p.gColor;
    G.fillEl.style.opacity = f2(p.gFill);
    G.barEl.style.opacity = f2(p.gFill);
    G.slotEl.style.opacity = f2((1 - p.gFill) * (0.6 + 0.4 * p.slotHi));
    G.tintEl.style.opacity = f2(p.gFill * (0.07 + 0.16 * p.gGlow));
    G.style.boxShadow = `0 26px 70px ${C.shadow}, 0 0 ${f2(70 * p.gGlow)}px ${alpha(p.gColor.startsWith('#') ? p.gColor : C.ink, 0.55 * p.gGlow * p.gFill)}`;
    setText(G.nameEl, p.gName);
    G.nameEl.style.opacity = f2(p.gFill);
    G.nameEl.style.transform = `translateY(${f2((1 - ease.outCubic(p.gFill)) * 14)}px) scale(${f2(1 + 0.04 * p.gGlow)})`;
    G.ghostEl.style.opacity = f2((1 - p.gFill) * 0.8);
    G.subEl.style.opacity = f2(p.subs * (0.55 + 0.45 * p.gFill));
    G.roleEl.style.color = p.gFill > 0.5 ? C.ink : C.dim; G.roleEl.style.opacity = f2(p.roles);
    star.fill.style.opacity = f2(p.gFill);
    star.line.style.opacity = f2(1 - p.gFill);
    const st = clamp(p.gStamp);
    G.iconBox.style.transform = `scale(${f2(1 + 0.9 * Math.sin(Math.PI * Math.min(1, st * 1.6)) * (1 - st))}) rotate(${f2((1 - ease.outCubic(st)) * -72)}deg)`;
    star.ring.setAttribute('r', f2(23 + 46 * ease.outCubic(st)));
    star.ring.setAttribute('opacity', f2(st > 0 && st < 1 ? (1 - st) * 0.9 : 0));
    // ---- hatlar
    const k = clamp(p.lines);
    trunk.setAttribute('stroke-dasharray', `${f2(range(k, 0, 0.32))} 1`);
    const kb = range(k, 0.3, 0.68);
    busL.setAttribute('stroke-dasharray', `${f2(kb)} 1`); busR.setAttribute('stroke-dasharray', `${f2(kb)} 1`);
    busL.style.visibility = busR.style.visibility = kb > 0 ? 'visible' : 'hidden';
    trunk.style.visibility = k > 0 ? 'visible' : 'hidden';
    for (let i = 0; i < TOKENS; i++) {
      const far = Math.abs(i - (TOKENS - 1) / 2) / ((TOKENS - 1) / 2);
      const kd = range(k, 0.42 + 0.22 * far, 0.82 + 0.16 * far);
      drops[i].setAttribute('stroke-dasharray', `${f2(kd)} 1`);
      drops[i].style.visibility = kd > 0 ? 'visible' : 'hidden';
      heads[i].style.opacity = f2(range(kd, 0.85, 1));
    }
    // ---- akan emirler (aşağı) ve raporlar (yukarı)
    gO.style.color = p.gFill > 0.5 ? p.gColor : C.dim;
    gR.style.color = p.sFill > 0.5 ? p.sColor : C.dim;
    const work = [];
    for (let i = 0; i < TOKENS; i++) {
      const ph = (((p.flow - i * 0.11) / FLOW_PERIOD) % 1 + 1) % 1;
      const a = p.flowA * (k >= 1 ? 1 : 0);
      const uo = ph / 0.4, ur = (ph - 0.52) / 0.4;
      const [ox, oy] = along(i, uo), [rx, ry] = along(i, 1 - ur);
      const oa = uo >= 0 && uo <= 1 ? Math.sin(Math.PI * uo) ** 0.5 : 0, ra = ur >= 0 && ur <= 1 ? Math.sin(Math.PI * ur) ** 0.5 : 0;
      orders[i].setAttribute('transform', `translate(${f2(ox)} ${f2(oy)})`); orders[i].setAttribute('opacity', f2(oa * a));
      reports[i].setAttribute('transform', `translate(${f2(rx)} ${f2(ry)}) rotate(45)`); reports[i].setAttribute('opacity', f2(ra * a * 0.9));
      work.push(a * bump(ph, 0.38, 0.16));
    }
    // ---- askerler
    S.style.opacity = f2(range(p.sIn, 0.45, 1));
    S.style.transform = `translateY(${f2((1 - range(p.sIn, 0.45, 1, ease.outCubic)) * 22)}px)`;
    S.style.color = p.sColor;
    S.fillEl.style.opacity = f2(p.sFill);
    S.barEl.style.opacity = f2(p.sFill);
    S.slotEl.style.opacity = f2((1 - p.sFill) * (0.6 + 0.4 * p.slotHi));
    S.tintEl.style.opacity = f2(p.sFill * (0.07 + 0.16 * p.sGlow));
    S.style.boxShadow = `0 26px 70px ${C.shadow}, 0 0 ${f2(60 * p.sGlow)}px ${alpha(p.sColor.startsWith('#') ? p.sColor : C.ink, 0.5 * p.sGlow * p.sFill)}`;
    setText(S.nameEl, p.sName);
    S.nameEl.style.opacity = f2(p.sFill);
    S.nameEl.style.transform = `translateY(${f2((1 - ease.outCubic(p.sFill)) * 12)}px) scale(${f2(1 + 0.04 * p.sGlow)})`;
    S.ghostEl.style.opacity = f2((1 - p.sFill) * 0.8);
    S.subEl.style.opacity = f2(p.subs * (0.55 + 0.45 * p.sFill));
    S.roleEl.style.color = p.sFill > 0.5 ? C.ink : C.dim; S.roleEl.style.opacity = f2(p.roles);
    S.iconBox.style.color = p.sFill > 0.5 ? p.sColor : C.dim;
    for (let i = 0; i < TOKENS; i++) {
      const tk = tokens[i];
      const tin = range(p.sIn, i * 0.09, 0.45 + i * 0.09, ease.outCubic);
      const tf = clamp(p.sFill * 1.7 - i * 0.17);
      tk.style.opacity = f2(tin);
      tk.style.color = p.sColor;
      tk.style.transform = `translateY(${f2((1 - tin) * 16 - 5 * work[i] * tf)}px) scale(${f2(0.85 + 0.15 * tin + 0.1 * bump(tf, 0.05, 0.9) + 0.06 * p.sGlow)})`;
      tk.fillEl.style.opacity = f2(tf);
      tk.slotEl.style.opacity = f2((1 - tf) * (0.6 + 0.4 * p.slotHi));
      tk.tintEl.style.opacity = f2(tf * (0.14 + 0.3 * work[i] + 0.2 * p.sGlow));
      tk.ic.style.color = tf > 0.5 ? p.sColor : C.hair;
    }
  }
  function place(x, y, sc = 1, op = 1) {
    el.style.transform = `translate(${f2(x)}px, ${f2(y)}px) scale(${f2(sc)})`;
    el.style.opacity = f2(op);
    el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
  }
  return { el, apply, place, G, S, tokens };
}

/** Lejant şeridi (renk = model, simge = rol) */
export function teamLegend() {
  const item = (icon, label) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '12px' } }, icon, label);
  const sw = (c) => h('i', { style: { display: 'block', width: '22px', height: '22px', background: c, borderRadius: '3px' } });
  const star = starIcon(24); star.line.style.opacity = '0'; star.style.color = C.dim;
  const chev = chevronIcon(26, 2.2); chev.style.color = C.dim;
  return h('div', { class: 'abs', style: { left: '0', width: '1080px', display: 'flex', justifyContent: 'center', gap: '38px',
    font: `500 24px/1 ${FONT.mono}`, letterSpacing: '0.04em', color: C.dim, whiteSpace: 'nowrap' } },
  item(sw(TEAM.opus), NAMES.opus), item(sw(TEAM.fable), NAMES.fable), item(star, 'general'), item(chev, 'asker'));
}

/** Cephe hattı + ortadaki "VS" baklavası */
export function frontLine() {
  const svg = mapSvg();
  const line = route(`M540 ${COL.y + 6}V${COL.y + COL.h - 4}`, { kind: 'link', color: C.hair });
  svg.append(line);
  const diamond = h('div', { class: 'abs', style: { left: '506px', top: COL.y + 304 + 'px', width: '68px', height: '68px', transformOrigin: '50% 50%' } },
    h('div', { class: 'abs', style: { left: '8px', top: '8px', width: '52px', height: '52px', transform: 'rotate(45deg)', background: C.glassStrong, border: `2px solid ${C.window}`, boxSizing: 'border-box' } }),
    h('div', { class: 'abs', style: { left: '0', top: '0', width: '68px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 20px/1 ${FONT.mono}`, letterSpacing: '0.04em', color: C.window } }, 'VS'));
  return { svg, line, diamond,
    apply(draw, vs, op = 1) {
      line.draw(draw); svg.style.opacity = f2(op);
      diamond.style.opacity = f2(clamp(vs * 3) * op);
      diamond.style.transform = `scale(${f2(vs <= 0 ? 0.4 : 0.4 + 0.6 * ease.spring(vs, 7, 5))})`;
    } };
}

// ---------------------------------------------------------------- sahne
export async function create(ctx) {
  const at = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const T = {
    general: at('general', 0, 3.33), askerler: at('askerler', 0, 5.33), iki: at('iki', 0, 8.01),
    opusG: at('Opus', 0, 10.63), general1: at('general', 1, 11.01), fableS: at('Fable', 0, 11.83),
    ikinci: at('İkincisini', 0, 12.89), tam: at('tam', 0, 13.71), fableG: at('Fable', 1, 14.59), general2: at('general', 2, 14.85),
    opusS: at('Opus', 1, 15.39),
  };
  const el = h('div', { class: 'scene' });

  // başlık şeridi (iki hâl) + sağda koordinat
  const title1 = h('div', { class: 'abs', style: { left: '72px', top: '238px' } }, coordLabel('AJAN ORKESTRASYONU · ROL ŞEMASI', { size: 26, color: C.ink }));
  const title2 = h('div', { class: 'abs', style: { left: '72px', top: '238px' } }, coordLabel('İKİ SENARYO · AYNI GÖREV', { size: 26, color: C.ink }));
  const coord = h('div', { class: 'abs', style: { right: '72px', top: '240px' } }, coordLabel(undefined, { size: 20, cross: false }));

  const fl = frontLine();
  const A = makeFront('01'), B = makeFront('02');

  // manevra okları: roller çapraz yer değiştirir
  const yG = COL.y + Y_G + H_G / 2, yS = COL.y + Y_S + H_S / 2, x0 = COL.xL + COL.w + 8, x1 = COL.xR - 16;
  const svg = mapSvg();
  const arrF = route(`M${x0} ${yS}C${x0 + 104} ${yS} ${x1 - 104} ${yG} ${x1} ${yG}`, { kind: 'march', color: TEAM.fable, arrow: true });
  const arrO = route(`M${x0} ${yG}C${x0 + 104} ${yG} ${x1 - 104} ${yS} ${x1} ${yS}`, { kind: 'march', color: TEAM.opus, arrow: true });
  svg.append(arrO, arrF);
  const chip = (name, color, size = 30) => h('div', { class: 'abs', style: { left: '0', top: '0', padding: '10px 16px 11px', background: C.glassStrong, border: `2.5px solid ${color}`, borderRadius: '5px',
    font: `800 ${size}px/1 ${FONT.display}`, letterSpacing: '-0.02em', color: C.ink, whiteSpace: 'nowrap', boxShadow: `0 14px 40px ${C.shadow}` } }, name);
  const chF = chip(NAMES.fable, TEAM.fable), chO = chip(NAMES.opus, TEAM.opus);

  const legend = teamLegend();
  legend.style.top = '1052px';

  // açılış: iki aday model sahaya girer, rotasını çizer ve rolüne yerleşir ("farklı modelleri general… asker")
  const S1 = 1.3, X1 = 540 - COL.w * S1 / 2, Y1 = 290;
  const gy = Y1 + (Y_G + H_G / 2) * S1, sy = Y1 + (Y_S + H_S / 2) * S1, xl = X1 - 114, xr = X1 + COL.w * S1 + 114;
  const svg0 = mapSvg();
  const rtA = route(`M${xl} ${gy + 190}C${xl} ${gy + 80} ${xl + 20} ${gy} ${X1 - 14} ${gy}`, { kind: 'march', color: C.ink, arrow: true });
  const rtB = route(`M${xr} ${sy - 230}C${xr} ${sy - 100} ${xr - 20} ${sy} ${X1 + COL.w * S1 + 14} ${sy}`, { kind: 'march', color: C.building, arrow: true });
  svg0.append(rtA, rtB);
  const cA = chip('Model A', C.ink, 38), cB = chip('Model B', C.building, 38);

  el.append(title1, title2, coord, fl.svg, svg0, B.el, A.el, svg, fl.diamond, cA, cB, chF, chO, legend);


  function update(t, tg = t) {
    const split = range(t, T.iki - 0.22, T.iki + 0.72, ease.inOutCubic);
    const generic = t < T.iki + 0.6;
    const genOut = 1 - range(t, T.iki - 0.4, T.iki + 0.1);

    title1.style.opacity = f2(range(t, -0.05, 0.3) * (1 - range(t, T.iki - 0.3, T.iki)));
    title1.style.transform = `translateX(${f2((1 - range(t, 0.05, 0.5, ease.outCubic)) * -24)}px)`;
    title2.style.opacity = f2(range(t, T.iki + 0.1, T.iki + 0.5));
    title2.style.transform = `translateX(${f2((1 - range(t, T.iki + 0.1, T.iki + 0.6, ease.outCubic)) * -24)}px)`;
    coord.style.opacity = f2(range(t, 0.3, 0.8) * 0.8);

    // ---- cephe A (önce genel şema, sonra Senaryo 01)
    A.place(lerp(X1, COL.xL, split), lerp(Y1, COL.y, split), lerp(S1, 1, split));
    A.apply(generic ? {
      head: 0, gIn: range(t, -0.1, 0.32, ease.outCubic), lines: range(t, 0.2, 1.0, ease.inOutCubic), sIn: range(t, 0.55, 1.4),
      gName: 'Model A', gColor: C.ink, gFill: range(t, T.general - 0.14, T.general + 0.22, ease.outCubic) * genOut, gStamp: range(t, T.general - 0.1, T.general + 0.6),
      gGlow: bump(t, T.general - 0.1, 0.9) * 0.8,
      sName: 'Model B', sColor: C.building, sFill: range(t, T.askerler - 0.14, T.askerler + 0.5) * genOut, sGlow: bump(t, T.askerler - 0.05, 0.9) * 0.7,
      flow: tg, flowA: range(t, 1.0, 1.5), subs: 1,
      slotHi: Math.max(bump(t, 1.4, 0.9), bump(t, 2.3, 0.9), bump(t, T.general + 0.4, 0.9) * (t < T.askerler ? 1 : 0), bump(t, T.askerler - 1.0, 0.9)),
    } : {
      head: range(t, T.iki + 0.6, T.iki + 1.0),
      gName: NAMES.opus, gColor: TEAM.opus, gFill: range(t, T.opusG - 0.1, T.opusG + 0.28, ease.outCubic), gStamp: range(t, T.general1 - 0.08, T.general1 + 0.62),
      gGlow: bump(t, T.opusG - 0.1, 1.1) * 0.9,
      sName: NAMES.fable, sColor: TEAM.fable, sFill: range(t, T.fableS - 0.1, T.fableS + 0.5), sGlow: bump(t, T.fableS - 0.05, 1.0) * 0.8,
      slotHi: bump(t, T.opusG - 0.9, 0.8), flow: tg,
    });

    // ---- aday modeller: girer → rota çizilir → rolüne yürür
    const cand = (c, rt, tIn, tDraw, tGo, seed) => {
      const k = range(t, tGo - 0.55, tGo - 0.03, ease.inOutCubic), p = rt.pointAt(k), enter = range(t, tIn, tIn + 0.5, ease.outCubic);
      const bob = (1 - k) * 6 * Math.sin(2 * Math.PI * (t + seed) / 2.3), hi = Math.max(bump(t, tDraw - 0.15, 0.7), bump(t, tGo - 0.75, 0.5));
      rt.draw(range(t, tDraw, tDraw + 0.9, ease.inOutCubic));
      rt.style.opacity = f2(1 - range(t, tGo - 0.05, tGo + 0.4));
      c.style.transform = `translate(${f2(p.x + (1 - enter) * (seed ? 60 : -60))}px, ${f2(p.y + (1 - k) * (seed ? -38 : 38) + bob)}px) translate(-50%, -50%) scale(${f2(1 + 0.1 * hi)})`;
      c.style.opacity = f2(enter * (1 - range(t, tGo - 0.12, tGo + 0.12)));
      c.style.visibility = t > tGo + 0.2 ? 'hidden' : 'visible';
    };
    cand(cA, rtA, 0.55, 1.35, T.general, 0);
    cand(cB, rtB, 1.9, T.general + 0.45, T.askerler, 1.1);

    // ---- cephe B (Senaryo 02) A'nın altından çıkar
    B.place(lerp(X1, COL.xR, split), lerp(Y1, COL.y, split), lerp(S1, 1, split),
      range(t, T.iki - 0.12, T.iki + 0.2) * lerp(0.6, 1, range(t, T.ikinci - 0.25, T.ikinci + 0.2)));
    B.apply({
      head: range(t, T.iki + 0.75, T.iki + 1.15),
      gName: NAMES.fable, gColor: TEAM.fable, gFill: range(t, T.fableG - 0.1, T.fableG + 0.28, ease.outCubic), gStamp: range(t, T.general2 - 0.08, T.general2 + 0.62),
      gGlow: bump(t, T.fableG - 0.1, 1.1) * 0.9,
      sName: NAMES.opus, sColor: TEAM.opus, sFill: range(t, T.opusS - 0.1, T.opusS + 0.5), sGlow: bump(t, T.opusS - 0.05, 1.0) * 0.8,
      slotHi: Math.max(bump(t, T.ikinci - 0.05, 0.8), bump(t, T.tam - 0.1, 0.9) * 0.6), flow: tg,
    });

    // ---- cephe hattı + VS
    fl.apply(range(t, T.iki + 0.4, T.iki + 1.2, ease.inOutCubic), range(t, T.opusS + 0.55, T.opusS + 1.25));

    // ---- çapraz manevra
    const kA = range(t, T.tam - 0.08, T.tam + 0.72, ease.inOutCubic);
    arrF.draw(kA); arrO.draw(range(t, T.tam + 0.02, T.tam + 0.86, ease.inOutCubic));
    svg.style.opacity = f2(1 - range(t, T.opusS + 0.35, T.opusS + 1.0));
    const kF = range(t, T.tam, T.tam + 0.82, ease.inOutCubic), kO = range(t, T.tam + 0.1, T.tam + 1.0, ease.inOutCubic);
    const pF = arrF.pointAt(kF), pO = arrO.pointAt(kO);
    chF.style.transform = `translate(${f2(pF.x)}px, ${f2(pF.y)}px) translate(-50%, -50%) scale(${f2(0.8 + 0.2 * range(t, T.tam - 0.1, T.tam + 0.2, ease.outCubic))})`;
    chF.style.opacity = f2(range(kF, 0.04, 0.24) * (1 - range(t, T.fableG - 0.08, T.fableG + 0.18)));
    chO.style.transform = `translate(${f2(pO.x)}px, ${f2(pO.y)}px) translate(-50%, -50%) scale(${f2(0.8 + 0.2 * range(t, T.tam, T.tam + 0.3, ease.outCubic))})`;
    chO.style.opacity = f2(range(kO, 0.04, 0.24) * (1 - range(t, T.opusS - 0.08, T.opusS + 0.18)));

    legend.style.opacity = f2(range(t, T.opusG - 0.5, T.opusG));
    legend.style.transform = `translateY(${f2((1 - range(t, T.opusG - 0.5, T.opusG + 0.1, ease.outCubic)) * 14)}px)`;
  }

  return {
    el, update,
    sfx: [
      { t: 0.1, name: 'whoosh-short', gain: 0.5 },
      { t: 0.6, name: 'pop', gain: 0.35 }, { t: 1.95, name: 'pop', gain: 0.35 },
      { t: T.general - 0.5, name: 'whoosh-short', gain: 0.4 }, { t: T.general - 0.03, name: 'pop', gain: 0.5 }, { t: T.askerler - 0.5, name: 'whoosh-short', gain: 0.4 },
      { t: T.askerler - 0.02, name: 'tick', gain: 0.55 }, { t: T.askerler + 0.09, name: 'tick', gain: 0.5 }, { t: T.askerler + 0.2, name: 'tick', gain: 0.45 },
      { t: T.iki - 0.2, name: 'whoosh', gain: 0.65 },
      { t: T.opusG - 0.03, name: 'thud', gain: 0.5 },
      { t: T.fableS - 0.02, name: 'pop', gain: 0.45 },
      { t: T.tam - 0.12, name: 'whoosh', gain: 0.7 },
      { t: T.fableG - 0.03, name: 'thud', gain: 0.5 },
      { t: T.opusS - 0.02, name: 'pop', gain: 0.45 },
      { t: T.opusS + 0.6, name: 'ping', gain: 0.4 },
    ],
  };
}
