// sonuc — hüküm (kişisel görüş olarak), önerilen kadro, maliyet ($90 / $150 sayaç), "sıra sizde"; son cümlede maliyet satırları
// küçülüp final sahnesinin iki penceresinin başlığına gider (pencereleri final.js erken girerek açar).
// Senaryo sahnesinin bittiği düzenle başlar (iki cephe yan yana); final'in iki video çerçevesiyle biter.
import { C, TEAM, FONT, alpha, clamp, ease, lerp, range } from '../theme.js';
import { coordLabel, h, mapCard } from '../kit.js';
import { COL, NAMES, PANEL, bump, chevronIcon, frontLine, makeFront, starIcon, teamLegend } from './senaryo.js';

const f2 = (x) => Number(x).toFixed(3);
const setText = (el, txt) => { if (el.textContent !== txt) el.textContent = txt; };
const ROW_H = 318, ROW_Y1 = 318, ROW_Y2 = 670, BAR_MAX = 150;

function ledgerRow({ y, no, gen, sol, pick }) {
  const card = mapCard({ x: 72, y, w: 936, h: ROW_H, title: `SENARYO ${no}`, coord: pick ? 'SEÇİMİM' : ' ', accent: gen.color, pad: 0, strong: true });
  if (pick) Object.assign(card.head.lastChild.style, { color: C.paperInk, background: C.ink, padding: '7px 12px 8px', borderRadius: '3px', margin: '-7px 0 -8px', fontWeight: '700' });
  const line = (top, icon, who, role) => {
    icon.style.color = who.color;
    const name = h('span', { style: { font: `800 48px/1 ${FONT.display}`, letterSpacing: '-0.025em', color: C.ink, display: 'inline-block', transformOrigin: '0 70%' } }, who.name);
    const el = h('div', { class: 'abs', style: { left: '30px', top: top + 'px', display: 'flex', alignItems: 'center', gap: '16px', whiteSpace: 'nowrap' } },
      icon, name, h('span', { style: { font: `600 24px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: C.dim, marginTop: '12px' } }, role));
    el.name = name;
    return el;
  };
  const star = starIcon(36); star.line.style.opacity = '0';
  const lg = line(24, star, gen, 'GENERAL'), ls = line(96, chevronIcon(36, 3.2), sol, 'ASKERLER');
  const num = h('span', { class: 't-num', style: { font: `850 172px/1 ${FONT.display}`, letterSpacing: '-0.045em', color: C.ink } }, '0');
  const cur = h('span', { style: { font: `700 84px/1 ${FONT.display}`, color: gen.color, marginRight: '8px', transform: 'translateY(-58px)', display: 'inline-block' } }, '$');
  const price = h('div', { class: 'abs', style: { right: '32px', top: '10px', display: 'flex', alignItems: 'flex-end', transformOrigin: '100% 70%', whiteSpace: 'nowrap' } }, cur, num);
  const fill = h('div', { class: 'abs', style: { left: '0', top: '0', bottom: '0', width: '0', background: gen.color, overflow: 'hidden' } });
  const sheen = h('div', { class: 'abs', style: { top: '0', bottom: '0', width: '70px', background: `linear-gradient(90deg, ${alpha(C.ink, 0)}, ${alpha(C.ink, 0.75)}, ${alpha(C.ink, 0)})` } });
  fill.append(sheen);
  const bar = h('div', { class: 'abs', style: { left: '30px', right: '34px', bottom: '26px', height: '10px', background: alpha(C.ink, 0.12) } }, fill);
  const note = h('div', { class: 'abs', style: { left: '30px', bottom: '46px', font: `500 24px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.dim } }, 'BU İŞİN MALİYETİ');
  card.head.style.fontSize = '24px';
  card.body.style.height = ROW_H - 56 + 'px';
  card.body.append(lg, ls, price, note, bar);
  const W_BAR = 936 - 64;
  /** k: giriş 0..1, v: gösterilen değer, on: satır etkin mi 0..1, land: iniş tümseği, t: parıltı saati */
  card.apply = ({ k, v, target, on, land, t, hiG = 0, hiS = 0, mx = 0, my = 0, ms = 1, mo = 1 }) => {
    card.style.opacity = f2(k * lerp(0.5, 1, on) * mo);
    card.style.transform = `translate(${f2(mx)}px, ${f2((1 - k) * 60 + my)}px) scale(${f2(ms)})`;
    setText(num, String(Math.round(v)));
    num.style.opacity = f2(lerp(0.3, 1, clamp(v / target * 4)));
    price.style.transform = `scale(${f2(1 + 0.07 * land)})`;
    cur.style.opacity = f2(lerp(0.4, 1, clamp(v / target * 4)));
    const wv = Math.round((v / BAR_MAX) * W_BAR);
    fill.style.width = wv + 'px';
    const ph = ((t / 2.4) % 1 + 1) % 1;
    sheen.style.left = Math.round(-70 + ph * (wv + 70)) + 'px';
    sheen.style.opacity = f2(v >= target ? 0.9 * Math.sin(Math.PI * ph) : 0);
    lg.name.style.color = hiG > 0.02 ? gen.color : C.ink; lg.name.style.transform = `scale(${f2(1 + 0.06 * hiG)})`;
    ls.name.style.color = hiS > 0.02 ? sol.color : C.ink; ls.name.style.transform = `scale(${f2(1 + 0.06 * hiS)})`;
  };
  return card;
}

export async function create(ctx) {
  const at = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const T = {
    bana: at('Bana', 0, 1.77), fable: at('Fable', 0, 3.31), burada: at('Burada', 0, 6.22), size: at('Size', 0, 9.18),
    fableGen: at('Fable', 1, 10.57), opusAsk: at('Opus', 0, 11.61), oneri: at('öneriyorum', 0, 13.29), ayrica: at('Ayrıca', 0, 14.66),
    fable2: at('Fable', 2, 14.93), opus2: at('Opus', 1, 15.77), n90: at('90', 0, 16.51), opus3: at('Opus', 2, 17.67), fable3: at('Fable', 3, 19.01),
    n150: at('150', 0, 19.95), acidan: at('açıdan', 0, 21.52) - 0.09, gozden: at('gözden', 0, 22.74), gecir: at('geçirmenizi', 0, 23.02), sizi: at('sizi', 0, 24.63),
  };
  const el = h('div', { class: 'scene' });
  const mkTitle = (txt) => h('div', { class: 'abs', style: { left: '72px', top: '238px' } }, coordLabel(txt, { size: 26, color: C.ink }));
  const title1 = mkTitle('İKİ SENARYO · AYNI GÖREV'), title2 = mkTitle('HÜKÜM'), title3 = mkTitle('MALİYET · AYNI İŞ');
  const coord = h('div', { class: 'abs', style: { right: '72px', top: '240px' } }, coordLabel(undefined, { size: 20, cross: false }));
  const note = h('div', { class: 'abs', style: { right: '72px', top: '228px', padding: '9px 14px 10px', border: `1.5px dashed ${alpha(C.window, 0.75)}`, borderRadius: '4px',
    font: `500 24px/1 ${FONT.mono}`, letterSpacing: '0.02em', color: C.window, background: C.glassStrong, whiteSpace: 'nowrap', transformOrigin: '100% 50%' } }, 'kişisel görüş · ölçüm değil');

  // ---- cepheler (senaryo'nun son hâli)
  const fl = frontLine();
  const L = makeFront('01'), R = makeFront('02');
  const legend = teamLegend(); legend.style.top = '1052px';

  // ---- hüküm
  const WS = 1.25, WX = 1008 - COL.w * WS, WY = 318, LS = 0.6, LX = 72, LY = 372;
  const tag = h('div', { class: 'abs', style: { right: '72px', top: '312px', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px 10px', background: C.ink, color: C.paperInk, borderRadius: '4px',
    font: `700 24px/1 ${FONT.mono}`, letterSpacing: '0.12em', transformOrigin: '100% 50%', boxShadow: `0 12px 34px ${C.shadow}` } }, 'SEÇİMİM');
  const loserTag = h('div', { class: 'abs', style: { left: LX + 'px', top: LY - 22 + 'px' } }, coordLabel('SENARYO 01', { size: 26 }));
  const scan = h('div', { class: 'abs', style: { left: '72px', top: '0', width: '936px', height: '2px', background: C.ink, boxShadow: `0 0 18px ${alpha(C.ink, 0.7)}` } }); // "gözden geçirin": satırları tarayan çizgi
  const howTitle = h('div', { class: 'abs', style: { left: '72px', top: '806px' } }, coordLabel('KADRO NASIL ÇALIŞIR', { size: 24 }));
  const HOW = [['General planlar, işi böler', TEAM.fable], ['Askerler tek işe odaklanır', TEAM.opus], ['Kısa rapor geri döner', C.window]].map(([txt, color], i) => {
    const badge = h('div', { style: { flex: 'none', width: '46px', height: '46px', borderRadius: '50%', border: `2px solid ${C.hair}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
      font: `600 22px/1 ${FONT.mono}`, color: C.ink, background: C.glassStrong } }, String(i + 1));
    const text = h('div', { style: { font: `600 28px/1.18 ${FONT.display}`, letterSpacing: '-0.012em', whiteSpace: 'nowrap', color: C.ink, textShadow: `0 2px 14px ${C.night}` } }, txt);
    const row = h('div', { class: 'abs', style: { left: '72px', top: 864 + i * 84 + 'px', width: '420px', display: 'flex', alignItems: 'center', gap: '16px', transformOrigin: '0 50%' } }, badge, text);
    return { row, badge, text, color };
  });
  const stamp = h('div', { class: 'abs', style: { left: WX + COL.w * WS / 2 + 'px', top: WY + 355 * WS + 'px', padding: '13px 22px 14px', border: `4px solid ${C.window}`, borderRadius: '6px', background: C.glassStrong,
    font: `800 33px/1 ${FONT.mono}`, letterSpacing: '0.1em', color: C.window, whiteSpace: 'nowrap', boxShadow: `0 18px 50px ${C.shadow}` } }, 'ÖNERİLEN KADRO');

  // ---- maliyet defteri
  const row90 = ledgerRow({ y: ROW_Y1, no: '02', gen: { name: NAMES.fable, color: TEAM.fable }, sol: { name: NAMES.opus, color: TEAM.opus }, pick: true });
  const row150 = ledgerRow({ y: ROW_Y2, no: '01', gen: { name: NAMES.opus, color: TEAM.opus }, sol: { name: NAMES.fable, color: TEAM.fable }, pick: false });

  // ---- sıra sizde
  const slot = (icon, role) => {
    const q = h('div', { class: 'abs', style: { right: '16px', top: '8px', font: `800 62px/1 ${FONT.display}`, color: C.ink, transformOrigin: '50% 60%' } }, '?');
    const hi = h('div', { class: 'abs', style: { left: '-2px', top: '-2px', right: '-2px', bottom: '-2px', border: `3px solid ${C.window}`, borderRadius: '6px' } });
    icon.style.color = C.dim;
    const box = h('div', { style: { position: 'relative', flex: 'none', width: '158px', height: '112px', border: `2px dashed ${C.hair}`, borderRadius: '6px', boxSizing: 'border-box' } },
      h('div', { class: 'abs', style: { left: '14px', top: '16px' } }, icon), q,
      h('div', { class: 'abs', style: { left: '14px', bottom: '12px', font: `600 22px/1 ${FONT.mono}`, letterSpacing: '0.04em', color: C.dim } }, role), hi);
    box.q = q; box.hi = hi;
    return box;
  };
  const stStar = starIcon(34); stStar.fill.style.opacity = '0';
  const slotG = slot(stStar, 'GENERAL'), slotS = slot(chevronIcon(34, 3), 'ASKERLER');
  const prompt = mapCard({ x: 72, y: 1016, w: 936, h: 168, pad: 0, strong: true });
  prompt.body.append(
    h('div', { class: 'abs', style: { left: '30px', top: '28px' } }, coordLabel('SİZİN AKIŞINIZ', { size: 24, color: C.window })),
    h('div', { class: 'abs', style: { left: '30px', top: '68px', font: `700 36px/1.12 ${FONT.display}`, letterSpacing: '-0.015em', color: C.ink, whiteSpace: 'nowrap' } }, 'Kim yönetiyor,', h('br'), 'kim uyguluyor?'),
    h('div', { class: 'abs', style: { right: '28px', top: '27px', display: 'flex', gap: '18px' } }, slotG, slotS));
  prompt.body.style.height = '168px';

  el.append(title1, title2, title3, coord, note, fl.svg, L.el, R.el, fl.diamond, legend, tag, howTitle, ...HOW.map((x) => x.row), stamp,
    row90, row150, scan, prompt, loserTag);

  const show = (node, op) => { node.style.opacity = f2(op); node.style.visibility = op <= 0.002 ? 'hidden' : 'visible'; };

  function update(t, tg = t) {
    const V = range(t, T.fable - 0.12, T.fable + 0.75, ease.inOutCubic);     // hüküm: kazanan öne
    const X = range(t, T.ayrica - 0.64, T.ayrica - 0.3, ease.inOutCubic);     // maliyete geçiş: hüküm önce çıkar
    const Z = range(t, T.sizi - 0.35, T.sizi + 0.1, ease.inOutCubic);         // sadeleşme
    const M1 = range(t, T.sizi - 0.32, T.sizi + 0.28, ease.inOutCubic), M2 = range(t, T.sizi - 0.12, T.sizi + 0.5, ease.inOutCubic), MO = 1 - range(t, T.sizi + 0.2, T.sizi + 0.6); // satırlar pencere başlıklarına gider
    const tense = range(t, 0.25, 0.7) * (1 - range(t, T.fable - 0.5, T.fable - 0.05));
    const sw = Math.sin(2 * Math.PI * (t - 0.3) / (1.25 - 0.45 * range(t, 0.3, T.fable))); // sağ-sol tartı
    const eL = tense * clamp(0.5 + 0.9 * sw), eR = tense * clamp(0.5 - 0.9 * sw);

    // ---- başlıklar + not
    show(title1, 1 - range(t, T.bana - 0.2, T.bana + 0.1));
    show(title2, range(t, T.bana, T.bana + 0.35) * (1 - X));
    title2.style.transform = `translateX(${f2((1 - range(t, T.bana, T.bana + 0.45, ease.outCubic)) * -22)}px)`;
    show(title3, range(t, T.ayrica - 0.25, T.ayrica + 0.15) * (1 - Z));
    title3.style.transform = `translateX(${f2((1 - range(t, T.ayrica - 0.25, T.ayrica + 0.25, ease.outCubic)) * -22)}px)`;
    show(coord, 0.8 * (1 - range(t, T.bana - 0.35, T.bana - 0.05)));
    const nk = range(t, T.bana - 0.05, T.bana + 0.4);
    show(note, clamp(nk * 3) * (1 - X));
    note.style.transform = `rotate(-1.5deg) scale(${f2(nk <= 0 ? 0.6 : 0.6 + 0.4 * ease.spring(nk, 7, 5))})`;

    // ---- cepheler
    const out = 1 - X;
    L.place(lerp(COL.xL, LX, V), lerp(COL.y, LY, V) - 46 * X, lerp(1, LS, V), out * lerp(lerp(0.72, 1, Math.max(eL, 1 - tense)), 0.5, V) * lerp(1, 0.75, range(t, T.size - 0.3, T.size + 0.3)));
    L.el.style.filter = V > 0 ? `grayscale(${f2(0.7 * V)})` : '';
    L.apply({ gName: NAMES.opus, gColor: TEAM.opus, sName: NAMES.fable, sColor: TEAM.fable, gGlow: eL * 0.8, sGlow: eL * 0.6, flow: tg, flowA: 1 - V, subs: 1 - V, roles: 1 - V, head: 1 - V });
    show(loserTag, V * out * 0.8);
    R.place(lerp(COL.xR, WX, V), lerp(COL.y, WY, V) - 46 * X, lerp(1, WS, V), out * lerp(0.72, 1, Math.max(eR, 1 - tense, V)));
    R.apply({ gName: NAMES.fable, gColor: TEAM.fable, sName: NAMES.opus, sColor: TEAM.opus, flow: tg,
      gGlow: Math.max(eR * 0.8, bump(t, T.fable - 0.1, 1.5), bump(t, T.fableGen - 0.1, 1.0)),
      sGlow: Math.max(eR * 0.6, bump(t, T.fable + 0.15, 1.4) * 0.7, bump(t, T.opusAsk - 0.1, 1.0)),
      gStamp: t < T.fable ? 1 : range(t, T.fable + 0.35, T.fable + 1.05) });
    fl.apply(1, 1, (1 - V));
    show(legend, (1 - V));

    const tk = range(t, T.fable + 0.55, T.fable + 1.0);
    show(tag, clamp(tk * 3) * out);
    tag.style.transform = `scale(${f2(tk <= 0 ? 0.5 : 0.5 + 0.5 * ease.spring(tk, 7, 5))})`;

    // ---- kadro nasıl çalışır (soldaki lejant)
    show(howTitle, range(t, T.burada, T.burada + 0.35) * out);
    const hiT = [T.fableGen, T.opusAsk, T.opusAsk + 0.95];
    HOW.forEach((r, i) => {
      const k = range(t, T.burada + 0.3 + i * 0.75, T.burada + 0.75 + i * 0.75, ease.outCubic);
      const hi = bump(t, hiT[i] - 0.1, 1.0), on = t >= hiT[i] - 0.1;
      show(r.row, k * out);
      r.row.style.transform = `translateX(${f2((1 - k) * -26)}px) scale(${f2(1 + 0.05 * hi)})`;
      r.badge.style.borderColor = on ? r.color : C.hair;
      r.badge.style.color = on ? r.color : C.ink;
      r.badge.style.boxShadow = `0 0 ${f2(26 * hi)}px ${alpha(r.color, 0.7 * hi)}`;
    });
    const sk = range(t, T.oneri - 0.06, T.oneri + 0.28);
    show(stamp, clamp(sk * 4) * out);
    stamp.style.transform = `translate(-50%, -50%) rotate(-6deg) scale(${f2(lerp(1.9, 1, ease.outExpo(sk)) + 0.04 * bump(sk, 0.6, 0.4))})`;

    // ---- maliyet
    const k1 = range(t, T.ayrica - 0.3, T.ayrica + 0.25, ease.outCubic), k2 = range(t, T.ayrica - 0.12, T.ayrica + 0.43, ease.outCubic);
    const tx = PANEL.w / 2 + PANEL.xR - 540, ty = PANEL.y + 2 + PANEL.stripTop + PANEL.stripH / 2;
    const c90 = range(t, T.n90 - 0.5, T.n90 + 0.3, ease.outCubic), c150 = range(t, T.n150 - 0.55, T.n150 + 0.35, ease.outCubic);
    row90.apply({ k: k1, v: 90 * c90, target: 90, on: 1, land: Math.max(bump(t, T.n90 + 0.26, 0.45), 0.6 * bump(t, T.acidan + 0.62, 0.45), 0.6 * bump(t, T.acidan + 1.87, 0.45)), t, mx: tx * M1, my: (ty - (ROW_Y1 + ROW_H / 2)) * M1, ms: lerp(1, 0.5, M1), mo: MO,
      hiG: bump(t, T.fable2 - 0.08, 0.8), hiS: bump(t, T.opus2 - 0.08, 0.8) });
    row150.apply({ k: k2, v: 150 * c150, target: 150, on: range(t, T.opus3 - 0.25, T.opus3 + 0.15), land: Math.max(bump(t, T.n150 + 0.31, 0.45), 0.6 * bump(t, T.acidan + 1.12, 0.45), 0.6 * bump(t, T.acidan + 2.35, 0.45)), t: t + 0.9, mx: -tx * M2, my: (ty - (ROW_Y2 + ROW_H / 2)) * M2, ms: lerp(1, 0.5, M2), mo: MO,
      hiG: bump(t, T.opus3 - 0.08, 0.9), hiS: bump(t, T.fable3 - 0.08, 0.8) });
    row90.style.visibility = k1 * MO <= 0.002 ? 'hidden' : 'visible'; row150.style.visibility = k2 * MO <= 0.002 ? 'hidden' : 'visible';

    const sc1 = [T.acidan + 0.5, T.acidan + 1.6], sc2 = [T.acidan + 1.75, T.acidan + 2.8];
    const sp = t < sc2[0] ? range(t, sc1[0], sc1[1], ease.inOutCubic) : range(t, sc2[0], sc2[1], ease.inOutCubic);
    const sOn = Math.max(bump(t, sc1[0], sc1[1] - sc1[0]), bump(t, sc2[0], sc2[1] - sc2[0]));
    scan.style.transform = `translateY(${Math.round(lerp(ROW_Y1 + 56, ROW_Y2 + ROW_H - 6, sp))}px)`;
    show(scan, Math.min(1, sOn * 3) * 0.85);

    // ---- sıra sizde
    const pk = range(t, T.acidan - 0.05, T.acidan + 0.5, ease.outCubic) * (1 - Z);
    show(prompt, pk);
    prompt.style.transform = `translateY(${f2((1 - pk) * 50)}px)`;
    const hg = Math.max(bump(t, T.gozden - 0.1, 0.75), bump(t, T.gecir + 0.95, 0.7)), hs = bump(t, T.gecir + 0.2, 0.7);
    slotG.hi.style.opacity = f2(hg); slotS.hi.style.opacity = f2(hs);
    slotG.q.style.transform = `scale(${f2(1 + 0.22 * hg)})`; slotS.q.style.transform = `scale(${f2(1 + 0.22 * hs)})`;
    slotG.q.style.color = hg > 0.05 ? C.window : C.ink; slotS.q.style.color = hs > 0.05 ? C.window : C.ink;
  }

  return {
    el, update,
    sfx: [
      { t: T.bana - 0.03, name: 'pop', gain: 0.4 },
      { t: T.fable - 1.5, name: 'riser', gain: 0.75 },
      { t: T.fable - 0.02, name: 'thud', gain: 0.55 },
      { t: T.fable + 0.55, name: 'chime', gain: 0.4 },
      { t: T.burada + 0.32, name: 'tick', gain: 0.5 }, { t: T.burada + 1.07, name: 'tick', gain: 0.5 }, { t: T.burada + 1.82, name: 'tick', gain: 0.5 },
      { t: T.fableGen - 0.06, name: 'pop', gain: 0.4 }, { t: T.opusAsk - 0.06, name: 'pop', gain: 0.4 },
      { t: T.oneri - 0.04, name: 'thud', gain: 0.5 },
      { t: T.ayrica - 0.4, name: 'whoosh', gain: 0.65 },
      { t: T.n90 - 0.5, name: 'kapanis-counter', gain: 0.6 }, { t: T.n90 + 0.28, name: 'ping', gain: 0.5 },
      { t: T.n150 - 0.55, name: 'kapanis-counter', gain: 0.6 }, { t: T.n150 + 0.33, name: 'ping', gain: 0.5 },
      { t: T.acidan, name: 'pop', gain: 0.4 },
      { t: T.gozden - 0.08, name: 'tick', gain: 0.45 }, { t: T.gecir + 0.07, name: 'tick', gain: 0.45 },
      { t: T.sizi - 0.3, name: 'whoosh-short', gain: 0.55 },
      { t: ctx.duration - 2.3, name: 'kapanis-curtain', gain: 0.9 },   // final sahnesinin pencereleri açılır (final.js, t = -2.25)
      { t: ctx.duration - 1.45, name: 'swell', gain: 0.8 },             // perde aralanır; bitişi = final başlangıcı
    ],
  };
}
