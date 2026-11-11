// ekip — "bir ekip kurdum… yönetici model işi böldü: veri, şehir, kuleler, ışık, kamera… kısa bir rapor sundu"
// Tek metafor: harita üstünde bir kavşak. Ortada yönetici; ondan beş ajana yollar ayrılır. Her görev adı söylendiği anda
// kartı açılır; kartlarda gerçek sahne kareleri vardır ve ajan o karenin üstünde çalışır (tel kafes → dolu görüntü).
// Sonunda her ajandan yöneticiye küçük bir rapor kâğıdı aynı yoldan geri döner; yöneticinin BAĞLAM çubuğu düşük kalır.
// Sahne bittikten sonra şema, maresal sahnesinin ilk cümlesi boyunca tam boy ve canlı (görev iner, rapor çıkar) kalır (extend.after).
import { C, FONT, SAFE, W, H, ease, range, clamp, lerp, hash01 } from '../theme.js';
import { h, s } from '../kit.js';
import { rgba, mixc, svgLayer, ticksD, makePath, scaleBar, label } from './baglam.js';

const MX = 540, MY = 356, MR = 54;             // yönetici düğümü
const CWD = 288, CHT = 318, R1 = 530, R2 = 886; // kart ölçüsü, satır üstleri
const VH = 216;                                 // kart içindeki görüntü yüksekliği
// maresal sahnesindeki (yerel) anlar: şema o sahnenin ilk yarısında "şekil" olarak kalır
const Q2 = (v) => Math.round(v / 2) * 2;         // çift piksele oturt: ince çizgilerin kenar yumuşatması kare geçmişine bağlı kalmasın
const M_BOYLE = 2.86;                           // maresal'deki "böyle" sözü (yerel sn)
const M_OUT = 3.5;                              // şema o cümle boyunca tam boy ve canlı kalır, sonra çekilir

const AGENTS = [
  { key: 'veri', name: 'VERİ', cap: 'arazi verisi', word: 'veri', fb: 3.51, x: 216, y: R1, mode: 'down', img: 'veri' },
  { key: 'sehir', name: 'ŞEHİR', cap: 'şehir dokusu', word: 'şehir', fb: 4.23, x: 540, y: R1, mode: 'down', img: 'sehir' },
  { key: 'kule', name: 'KULELER', cap: 'simge yapılar', word: 'kuleler', fb: 4.75, x: 864, y: R1, mode: 'up', img: 'kule' },
  { key: 'isik', name: 'IŞIK', cap: 'atmosfer', word: 'ışık', fb: 5.21, x: 378, y: R2, mode: 'light', img: 'isik' },
  { key: 'kamera', name: 'KAMERA', cap: 'kamera · kurgu', word: 'kamera', fb: 5.65, x: 702, y: R2, mode: 'film', img: null },
];

function roadFor(a) {
  const y0 = MY + MR + 8;
  if (a.y === R1) return a.x === MX ? makePath([MX, y0], ['L', MX, R1 - 6]) : makePath([MX, y0], ['C', MX, y0 + 78, a.x, R1 - 92, a.x, R1 - 6]);
  return makePath([MX, y0], ['C', MX, y0 + 60, a.x, y0 + 14, a.x, y0 + 92], ['L', a.x, R2 - 6]);
}

export async function create(ctx) {
  const tw = (w, n, fb) => ctx.at(w, n)?.start ?? fb;
  const D = ctx.duration;
  const T = {
    ekip: tw('ekip', 0, 0.93), yonetici: tw('yönetici', 0, 2.21), isi: tw('işi', 0, 2.77), her: tw('her', 0, 8.21),
    odak: tw('odaklandı', 0, 9.83), yon2: tw('yöneticisine', 0, 10.64), rapor: tw('rapor', 0, 11.79),
  };
  AGENTS.forEach((a, i) => {
    a.t = tw(a.word, 0, a.fb);
    a.g0 = Math.min(0.46 + i * 0.09, T.ekip - 0.05 + i * 0.1);   // yer tutucusunun belirdiği an
    a.done = T.her + 0.42 + i * 0.4;          // işini bitirdiği an
    a.send = T.yon2 + 0.02 + i * 0.19;        // raporu yola çıkardığı an
    a.road = roadFor(a);
  });
  const FLY = 0.86;

  const el = h('div', { class: 'scene' });
  const root = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: `${MX}px 236px` } });
  el.append(root);

  // --- yollar ---
  const svg = svgLayer();
  const roads = AGENTS.map((a) => {
    const casing = s('path', { d: a.road.d, fill: 'none', 'stroke-width': 15, 'stroke-linecap': 'round', pathLength: 1, style: { stroke: rgba(C.night, 0.7) } });
    const fill = s('path', { d: a.road.d, fill: 'none', 'stroke-width': 6, 'stroke-linecap': 'round', pathLength: 1, style: { stroke: C.road } });
    const pin = s('circle', { cx: a.x, cy: a.y - 6, r: 9, 'stroke-width': 3, style: { fill: C.night, stroke: C.road } });
    const gRect = s('rect', { x: a.x - CWD / 2, y: a.y, width: CWD, height: CHT, 'stroke-width': 2, 'stroke-dasharray': '8 9', style: { stroke: rgba(C.ink, 0.7), fill: rgba(C.night, 0.28) } });
    const gNum = s('text', { x: a.x, y: a.y + CHT / 2 + 20, 'text-anchor': 'middle', style: { font: `700 58px ${FONT.mono}`, fill: rgba(C.ink, 0.4) } }, '0' + (AGENTS.indexOf(a) + 1));
    const ghost = s('g', {}, gRect, gNum);
    const brk = s('path', { fill: 'none', 'stroke-width': 2.5, style: { stroke: C.window } });
    svg.append(ghost, casing, fill, brk);
    return { casing, fill, pin, ghost, gRect, brk };
  });
  // yönetici düğümü (kavşak simgesi)
  const mg = s('g', {});
  const mPulse = Array.from({ length: 5 }, () => s('circle', { cx: MX, cy: MY, r: MR, fill: 'none', 'stroke-width': 3, opacity: 0, style: { stroke: C.window } }));
  const mDash = s('circle', { cx: MX, cy: MY, r: MR + 14, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '3 11', style: { stroke: rgba(C.window, 0.7) } });
  const mRing = s('circle', { cx: MX, cy: MY, r: MR, 'stroke-width': 4, style: { fill: rgba(C.night, 0.82), stroke: C.window } });
  const mIn = s('circle', { cx: MX, cy: MY, r: MR - 14, fill: 'none', 'stroke-width': 1.5, style: { stroke: rgba(C.ink, 0.45) } });
  const mCore = s('circle', { cx: MX, cy: MY, r: 11, style: { fill: C.window } });
  const spokes = s('path', { fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', style: { stroke: C.window },
    d: [-90, -18, 54, 126, 198].map((dg) => { const a = dg * Math.PI / 180; return `M${MX + Math.cos(a) * 18},${MY + Math.sin(a) * 18}L${MX + Math.cos(a) * 30},${MY + Math.sin(a) * 30}`; }).join('') });
  mg.append(...mPulse, mDash, mRing, mIn, spokes, mCore);
  svg.append(mg, ...roads.map((r) => r.pin));
  root.append(svg);

  // yönetici etiketi + bağlam çubuğu
  const mTitle = h('div', { style: { font: `800 40px/1 ${FONT.display}`, letterSpacing: '0.01em', color: C.ink } }, 'YÖNETİCİ');
  const mName = h('div', { style: { position: 'absolute', left: MX + MR + 30 + 'px', top: MY - 38 + 'px', whiteSpace: 'nowrap', transformOrigin: '0 50%' } },
    mTitle,
    h('div', { style: { marginTop: '10px', font: `600 27px/1 ${FONT.mono}`, letterSpacing: '-0.01em', color: C.dim } }, 'işi böler · raporu okur'));
  const GW = 244, GX = MX - MR - 30 - GW;
  const gauge = scaleBar({ width: GW, height: 12, segs: 10, title: 'BAĞLAM', small: true });
  gauge.el.style.left = GX + 'px'; gauge.el.style.top = MY - 44 + 'px';
  const pips = Array.from({ length: 5 }, (_, i) => h('div', { style: { position: 'absolute', left: GX + i * 26 + 'px', top: MY + 26 + 'px', width: '17px', height: '22px',
    boxSizing: 'border-box', border: `1.5px solid ${rgba(C.ink, 0.5)}` } }));
  const pipLbl = label('rapor', { left: GX + 5 * 26 + 8 + 'px', top: MY + 24 + 'px', fontSize: '26px' });
  const cap = label('GÖREV DAĞILIMI', { left: SAFE.left + 'px', top: '238px', color: rgba(C.dim, 0.9) });
  root.append(mName, gauge.el, ...pips, pipLbl, cap);

  // --- kartlar ---
  const cross = () => s('svg', { viewBox: '-14 -14 28 28', width: 28, height: 28, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' } },
    s('path', { d: 'M-12,0H-3M3,0H12M0,-12V-3M0,3V12', fill: 'none', 'stroke-width': 2.5, style: { stroke: C.pink } }), s('circle', { r: 2, style: { fill: C.pink } }));
  const kam = await ctx.frames('kamera');
  kam.el.decoding = 'sync';                     // kare değişince eski kare boyanmasın
  for (let i = 0; i < AGENTS.length; i++) {
    const a = AGENTS[i];
    const view = h('div', { style: { position: 'relative', height: VH + 'px', overflow: 'hidden', background: C.night } });
    const scan = h('div', { class: 'abs', style: { background: C.cyan, boxShadow: `0 0 18px 3px ${rgba(C.cyan, 0.7)}`, display: 'none' } });
    const cur = cross();
    if (a.mode === 'film') {
      a.seq = kam;
      kam.el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;';
      a.wire = h('div', { class: 'abs', style: { left: '0', top: '0', width: '100%', height: '100%', background: C.night } });
      // rota çizgisi + vizör köşeleri
      a.route = s('path', { d: `M34,${VH - 30} C90,${VH - 110} 150,${VH - 40} 250,60`, fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round', style: { stroke: C.pink } });
      a.routePath = makePath([34, VH - 30], ['C', 90, VH - 110, 150, VH - 40, 250, 60]);
      a.dot = s('circle', { r: 6, style: { fill: C.pink } });
      a.finder = s('path', { d: ticksD(14, 14, CWD - 28, VH - 28, 22), fill: 'none', 'stroke-width': 2.5, style: { stroke: C.ink } });
      const ov = s('svg', { viewBox: `0 0 ${CWD} ${VH}`, width: CWD, height: VH, style: { position: 'absolute', left: '0', top: '0' } }, a.finder, a.route, a.dot);
      view.append(kam.el, a.wire, ov);
    } else {
      a.im = await ctx.image(`${a.img}.jpg`, { style: 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;' });
      if (a.mode === 'light') {
        a.dimIm = await ctx.image(`${a.img}.jpg`, { style: 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.34) saturate(0.35);' });
        view.append(a.dimIm, a.im);
      } else {
        // tel kafes: kenar maskesi (alfa) tuvale çizilip tema rengiyle boyanır. (CSS mask-image eşzamansız çözülüyordu:
        // bazı karelerde maske hazır olmadan boyanabiliyordu → tuval her zaman hazır.)
        const e = await ctx.image(`${a.img}-e.png`);
        const cv = h('canvas', { width: e.naturalWidth, height: e.naturalHeight, style: 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;' });
        const g = cv.getContext('2d');
        g.drawImage(e, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = C.cyan; g.fillRect(0, 0, cv.width, cv.height);
        a.wire = cv;
        view.append(a.wire, a.im);
      }
      if (a.key === 'veri') {
        a.dots = [[0.33, 0.3], [0.74, 0.22], [0.9, 0.66], [0.42, 0.9], [0.12, 0.55], [0.6, 0.48], [0.82, 0.4]];
        a.dotEls = a.dots.map(([x, y]) => h('div', { class: 'abs', style: { left: x * CWD - 5 + 'px', top: y * VH - 5 + 'px', width: '10px', height: '10px', background: C.pink, boxShadow: `0 0 0 2px ${C.night}`, display: 'none' } }));
        view.append(...a.dotEls);
      }
    }
    view.append(scan, cur);
    const check = h('div', { style: { font: `800 24px/1 ${FONT.display}`, color: C.ok, opacity: '0' } }, '✓');
    const head = h('div', { style: { height: '50px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 14px', boxSizing: 'border-box' } },
      h('span', { style: { font: `700 24px/1 ${FONT.mono}`, color: C.pink, letterSpacing: '0.02em' } }, '0' + (i + 1)),
      h('span', { style: { font: `700 27px/1 ${FONT.mono}`, color: C.ink, letterSpacing: '0.08em', flex: '1' } }, a.name), check);
    const stat = h('span', { style: { font: `600 27px/1 ${FONT.mono}`, color: C.ink, letterSpacing: '-0.01em', whiteSpace: 'nowrap' } }, a.cap);
    const prog = h('div', { style: { position: 'absolute', left: '0', top: '0', height: '100%', width: '0', background: C.window } });
    const foot = h('div', { style: { position: 'relative', height: CHT - 50 - VH + 'px', boxSizing: 'border-box', padding: '5px 14px 0' } }, stat,
      h('div', { style: { position: 'absolute', left: '14px', right: '14px', bottom: '5px', height: '4px', background: rgba(C.ink, 0.16) } }, prog));
    const card = h('div', { class: 'abs', style: { left: a.x - CWD / 2 + 'px', top: a.y + 'px', width: CWD + 'px', height: CHT + 'px', background: C.glass, transformOrigin: '50% 0',
      boxShadow: `0 0 0 1.5px ${rgba(C.ink, 0.5)}, 0 22px 50px ${rgba(C.night, 0.55)}`, display: 'none' } }, head, view, foot);
    const paper = h('div', { class: 'abs', style: { left: '0', top: '0', width: '34px', height: '42px', marginLeft: '-17px', marginTop: '-21px', display: 'none',
      background: `linear-gradient(225deg, transparent 8px, ${C.ink} 8.5px)`, boxShadow: `0 4px 0 ${rgba(C.night, 0.45)}` } },
      ...[12, 20, 28].map((y, k) => h('div', { class: 'abs', style: { left: '6px', top: y + 'px', width: (k === 2 ? 13 : 22) + 'px', height: '3px', background: rgba(C.night, 0.6) } })));
    const packet = h('div', { class: 'abs', style: { left: '0', top: '0', width: '16px', height: '16px', marginLeft: '-8px', marginTop: '-8px', background: C.pink, boxShadow: `0 0 0 3px ${C.night}`, display: 'none' } });
    root.append(card);
    Object.assign(a, { card, view, scan, cur, check, prog, paper, packet });
  }
  for (const a of AGENTS) root.append(a.packet, a.paper);

  function update(t) {
    const tail = t - D;                                   // > 0: maresal sahnesinin içindeyiz
    // ---- kök: giriş, sonra küçülüp "şekil" olma, en sonda çıkış ----
    const bye = range(tail, M_OUT, M_OUT + 0.45, ease.inCubic);
    root.style.transform = bye <= 0 ? 'none' : `translateY(${(-40 * bye).toFixed(2)}px) scale(${(1 - 0.06 * bye).toFixed(4)})`;
    root.style.opacity = (1 - bye).toFixed(4);
    cap.style.opacity = (range(t, 0.15, 0.5) * (1 - range(tail, 0.1, 0.4))).toFixed(3);

    // ---- yönetici ----
    const mIn = range(t, -0.16, 0.3, ease.outBack);
    mg.setAttribute('transform', `translate(${MX},${MY}) scale(${mIn.toFixed(4)}) translate(${-MX},${-MY})`);
    mg.setAttribute('opacity', clamp(mIn * 2.5).toFixed(3));
    mDash.setAttribute('stroke-dashoffset', (-t * 16).toFixed(2));
    const nm = range(t, 0.12, 0.45, ease.outCubic);
    const said = t >= T.yonetici - 0.05 ? Math.exp(-(t - T.yonetici + 0.05) * 2.2) : 0;
    mName.style.opacity = nm.toFixed(3);
    mName.style.transform = nm >= 1 && said < 0.004 ? 'none' : `translateX(${((1 - nm) * -18).toFixed(2)}px) scale(${(1 + 0.07 * said).toFixed(4)})`;
    mTitle.style.color = mixc(C.ink, C.window, said);
    const gIn = range(t, T.yon2 - 0.5, T.yon2 - 0.1, ease.outCubic);
    gauge.el.style.opacity = gIn.toFixed(3);
    gauge.el.style.transform = gIn >= 1 ? 'none' : `translateX(${((1 - gIn) * 18).toFixed(2)}px)`;
    pipLbl.style.opacity = (gIn * 0.9).toFixed(3);
    let got = 0;
    AGENTS.forEach((a, i) => {
      const arr = a.send + FLY;
      const k = range(t, arr, arr + 0.25, ease.outBack);
      got += clamp(k);
      pips[i].style.opacity = gIn.toFixed(3);
      pips[i].style.background = t >= arr ? C.ink : 'transparent';
      pips[i].style.transform = t >= arr && k < 0.999 ? `scale(${(0.6 + 0.4 * k).toFixed(3)})` : 'none';
      const pp = range(t, arr, arr + 0.6, ease.outCubic);
      mPulse[i].setAttribute('r', (MR + 44 * pp).toFixed(2));
      mPulse[i].setAttribute('opacity', pp > 0 && pp < 1 ? (0.9 * (1 - pp)).toFixed(3) : 0);
    });
    gauge.set(0.06 + 0.034 * got, { color: C.ok, status: 'temiz', statusColor: C.ok });
    // "işi böldü" ve rapor varışlarında düğüm hafifçe atar
    const beat = Math.max(...AGENTS.map((a) => { const x = t - (a.send + FLY); return x >= 0 ? Math.exp(-x * 9) : 0; }), t >= T.isi ? Math.exp(-(t - T.isi) * 6) : 0, said * 0.8);
    mCore.setAttribute('r', (11 + 6 * beat).toFixed(2));
    mRing.setAttribute('stroke-width', (4 + 3 * beat).toFixed(2));

    // ---- ajanlar ----
    AGENTS.forEach((a, i) => {
      const R = roads[i];
      // yer tutucu + iğne ("bir ekip kurdum")
      const g0 = a.g0;
      const gk = range(t, g0, g0 + 0.3, ease.outBack);
      const open = range(t, a.t - 0.04, a.t + 0.42, ease.outCubic);
      R.pin.setAttribute('r', (9 * gk).toFixed(2));
      R.ghost.setAttribute('opacity', (clamp(gk) * (1 - clamp(open * 2)) * (0.8 + 0.2 * Math.sin(t * 5 + i))).toFixed(3));
      R.ghost.setAttribute('transform', `translate(${a.x},${a.y}) scale(${(0.86 + 0.14 * clamp(gk)).toFixed(4)}) translate(${-a.x},${-a.y})`);
      R.gRect.setAttribute('stroke-dashoffset', (-t * 12).toFixed(2));
      // yol ("işi böldü")
      const rd = range(t, T.isi + i * 0.07, T.isi + 0.5 + i * 0.07, ease.inOutCubic);
      const h1 = tail > 0 ? Math.exp(-Math.pow((tail - (M_BOYLE + i * 0.09)) / 0.2, 2)) : 0;   // "böyle çalışın": kartlar sırayla bir kez parlar
      const focus = range(t, T.her, T.her + 0.4) * (1 - range(t, T.yon2 - 0.2, T.yon2 + 0.1));
      for (const p of [R.casing, R.fill]) p.setAttribute('stroke-dasharray', `${rd.toFixed(4)} 1`);
      R.casing.setAttribute('opacity', rd > 0 ? 1 : 0);
      R.fill.setAttribute('opacity', rd > 0 ? (1 - 0.55 * focus).toFixed(3) : 0);
      R.fill.setAttribute('stroke-width', (6 + 5 * h1).toFixed(2));
      // görev paketi: yöneticiden karta
      const pk = range(t, a.t - 0.44, a.t - 0.02, ease.inOutCubic);
      const sd = range(t, g0 - 0.42, g0, ease.outCubic);                 // tohum: tek kutudan beş ajana
      const loopU = tail > 0.35 && tail < M_OUT + 0.2 ? ((tail - 0.35) / 1.7 + i * 0.2) % 1 : -1;   // şekilde: görev iner, rapor çıkar
      let pp = null;
      if (sd > 0 && sd < 1) pp = { x: lerp(MX, a.x, sd), y: lerp(MY, a.y - 6, sd) - 46 * Math.sin(sd * Math.PI) };
      else if (pk > 0 && pk < 1) pp = a.road.at(pk);
      else if (loopU >= 0 && loopU < 0.42) pp = a.road.at(ease.inOutCubic(loopU / 0.42));
      if (pp) { a.packet.style.display = ''; a.packet.style.transform = `translate(${pp.x.toFixed(2)}px, ${pp.y.toFixed(2)}px) rotate(45deg)`; }
      else a.packet.style.display = 'none';

      // kart
      if (open <= 0) { a.card.style.display = 'none'; R.brk.setAttribute('opacity', 0); a.paper.style.display = 'none'; return; }
      a.card.style.display = '';
      const doneK = range(t, a.done, a.done + 0.3, ease.outCubic);
      const flash = t >= a.done ? Math.exp(-(t - a.done) * 5) : 0;
      a.card.style.opacity = clamp(open * 2.2).toFixed(3);
      const cs = lerp(0.9, 1, ease.outBack(clamp((t - a.t + 0.04) / 0.46))) + 0.035 * (flash > 0.01 ? flash : 0) + 0.04 * (h1 > 0.01 ? h1 : 0);
      a.card.style.transform = open >= 1 && Math.abs(cs - 1) < 0.0005 ? 'none' : `translateY(${((1 - open) * -26).toFixed(2)}px) scale(${cs.toFixed(4)})`;
      const line = h1 > 0.02 ? mixc(C.ink, C.window, h1) : flash > 0.02 ? mixc(C.ink, C.ok, flash) : rgba(C.ink, 0.5);
      a.card.style.boxShadow = `0 0 0 ${(1.5 + 2.5 * Math.max(flash, h1)).toFixed(2)}px ${line}, 0 22px 50px ${rgba(C.night, 0.55)}`;
      // odak köşeleri ("yalnızca kendi işine odaklandı")
      const off = lerp(26, 9, ease.outCubic(focus));
      R.brk.setAttribute('d', ticksD(a.x - CWD / 2 - off, a.y - off, CWD + 2 * off, CHT + 2 * off, 26));
      R.brk.setAttribute('opacity', (focus * (1 - 0.5 * doneK)).toFixed(3));

      // iş: tel kafesten dolu görüntüye
      const w0 = a.t + 0.38;
      const lin = range(t, w0, a.done);
      const p = clamp(lin + 0.035 * Math.sin(lin * Math.PI * 6) * (1 - lin));  // hafif duraksamalı ilerleme
      const working = t >= w0 && t < a.done;
      a.prog.style.width = (p * 100).toFixed(2) + '%';
      a.prog.style.background = t >= a.done ? C.ok : C.window;
      a.check.style.opacity = doneK.toFixed(3);
      a.check.style.transform = t >= a.done + 0.3 ? 'none' : `scale(${(0.4 + 0.6 * ease.outBack(clamp((t - a.done) / 0.3))).toFixed(3)})`;
      if (a.mode === 'down' || a.mode === 'up') {
        a.im.style.clipPath = p >= 1 ? 'none' : a.mode === 'down' ? `inset(0 0 ${((1 - p) * 100).toFixed(2)}% 0)` : `inset(${((1 - p) * 100).toFixed(2)}% 0 0 0)`;
        a.wire.style.opacity = (range(t, a.t + 0.1, a.t + 0.5) * (0.7 + 0.3 * Math.sin(t * 9 + i))).toFixed(3);
        const y = a.mode === 'down' ? p * VH : (1 - p) * VH;
        a.scan.style.display = working ? '' : 'none';
        Object.assign(a.scan.style, { left: '0', top: Q2(y) - 2 + 'px', width: '100%', height: '4px' });
        a.cur.style.transform = `translate(${Q2(CWD * (0.5 + 0.38 * Math.sin(t * 2.3 + i * 2)))}px, ${Q2(clamp(y + (a.mode === 'down' ? 16 : -16), 10, VH - 10))}px)`;
        if (a.dotEls) a.dotEls.forEach((d, k) => { const on = p > a.dots[k][1] + 0.04; d.style.display = on ? '' : 'none'; });
      } else if (a.mode === 'light') {
        a.im.style.clipPath = p >= 1 ? 'none' : `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
        a.scan.style.display = working ? '' : 'none';
        Object.assign(a.scan.style, { top: '0', left: Q2(p * CWD) - 2 + 'px', height: '100%', width: '4px' });
        a.scan.style.background = C.window; a.scan.style.boxShadow = `0 0 22px 5px ${rgba(C.window, 0.75)}`;
        a.cur.style.transform = `translate(${Q2(clamp(p * CWD + 18, 10, CWD - 10))}px, ${Q2(VH * (0.5 + 0.32 * Math.sin(t * 2.1)))}px)`;
      } else {
        // kamera: gerçek kareler ileri-geri oynar; rota üstünde nokta ilerler
        const dur = a.seq.duration - 0.07;
        const ph = ((t - a.t) * 0.8) % (2 * dur);
        a.seq.at(clamp(ph < dur ? ph : 2 * dur - ph, 0, dur));
        a.wire.style.opacity = (1 - range(t, a.t + 0.25, a.t + 0.6)).toFixed(3);
        const q = a.routePath.at(p);
        a.dot.setAttribute('cx', Q2(q.x)); a.dot.setAttribute('cy', Q2(q.y));
        a.route.setAttribute('opacity', (0.95 - 0.5 * doneK).toFixed(3));
        a.finder.setAttribute('opacity', (0.6 + 0.4 * Math.sin(t * 6) * (working ? 1 : 0)).toFixed(3));
        a.cur.style.transform = `translate(${Q2(q.x)}px, ${Q2(q.y)}px)`;
      }
      a.cur.style.display = working ? '' : 'none';

      // rapor kâğıdı: karttan yöneticiye (aynı yoldan geri)
      const f = range(t, a.send, a.send + FLY, ease.inOutCubic);
      if (t >= a.send - 0.25 && f < 1) {
        const pop = range(t, a.send - 0.25, a.send, ease.outBack);
        const q = a.road.at(1 - f);
        a.paper.style.display = '';
        a.paper.style.opacity = (1 - range(f, 0.9, 1)).toFixed(3);
        a.paper.style.transform = `translate(${q.x.toFixed(2)}px, ${(q.y - 4 - 16 * Math.sin(f * Math.PI)).toFixed(2)}px) rotate(${(Math.sin(f * 9 + i) * 9).toFixed(2)}deg) scale(${(pop * (1 - 0.3 * range(f, 0.75, 1))).toFixed(3)})`;
      } else if (loopU > 0.5) {
        const u = ease.inOutCubic((loopU - 0.5) / 0.5), q = a.road.at(1 - u);
        a.paper.style.display = '';
        a.paper.style.opacity = (Math.min(1, u * 8) * (1 - range(u, 0.88, 1))).toFixed(3);
        a.paper.style.transform = `translate(${q.x.toFixed(2)}px, ${(q.y - 4).toFixed(2)}px) rotate(${(Math.sin(u * 9 + i) * 8).toFixed(2)}deg)`;
      } else a.paper.style.display = 'none';
    });
  }

  const sfx = [{ t: 0.0, name: 'pop', gain: 0.36 }];
  AGENTS.forEach((a, i) => {
    sfx.push({ t: a.g0, name: 'tick', gain: 0.22 });
    sfx.push({ t: a.t - 0.42, name: 'whoosh-short', gain: 0.18 }, { t: a.t - 0.02, name: 'pop', gain: 0.3 });
    sfx.push({ t: a.t + 0.4, name: 'anlatim-scan', gain: 0.22 });
    sfx.push({ t: a.done, name: 'tick', gain: 0.34 });
    sfx.push({ t: a.send - 0.05, name: 'anlatim-paper', gain: 0.36 }, { t: a.send + FLY, name: 'tick', gain: 0.3 });
  });
  sfx.push({ t: T.yonetici - 0.05, name: 'ping', gain: 0.26 }, { t: T.isi, name: 'whoosh', gain: 0.26 }, { t: AGENTS[4].send + FLY + 0.05, name: 'chime', gain: 0.3 });

  return { el, update, sfx, subtitleY: 1372, extend: { before: 0.18, after: M_OUT + 0.5 } };
}
