// hook — "Burası neresi? Tanıyabildiniz mi?  Bir dakika ya. Burası çok tanıdık."
// Gizemli harita (animate_villages2 verisinden yeniden çizim: assets/hook/map.jpg), yavaş itiş; pembe simge yapılar tek tek
// parlar ve adları daktilo gibi yazılır. Harita `gercek` sahnesi boyunca da (extend.after) altta kalır: fotoğraf kartları
// bu haritaya iğnelenir; `vaat` başlarken ortak topografya fonuna erir. Her şey t'nin saf fonksiyonu.
import { C, FONT, SAFE, SUB_HI, W, H, alpha, clamp, ease, lerp, range } from '../theme.js';
import { h, s, scaleBar } from '../kit.js';

// ---- ortak kamera (gercek.js de kullanır): t = global saniye ----
/** Harita kamerası: s = ekran pikseli / metre, (cx, cz) = ekran merkezindeki nokta (metre; x doğu, z güney). */
// Kadraj, haritanın dolu kısmının (veri sınırı: x −900…946, z −842…1038 m) İÇİNDE kalır: ilk kareden itibaren ekranın
// tamamı şehir dokusuyla dolu, altta/üstte boş arazi bandı yok. Üç pembe alan ekranın orta-alt kısmında, yazılar üstte.
const DATA_Z1 = 1034;
export function camAt(t) {
  const e = 1 - Math.pow(1 - clamp(t / 10), 1.5);
  const f = e / 0.7048;                       // hook sonunda (5,57 sn) 1
  const s = 1.04 + 0.06 * f;
  return { s, cx: 380 + 12 * f, cz: Math.min(100 + 65 * f, DATA_Z1 - 960 / s) };
}
export const toScreen = (cam, x, z) => [W / 2 + (x - cam.cx) * cam.s, H / 2 + (z - cam.cz) * cam.s];

// Pembe alanlar: build_data.py LANDMARK_IDS; adlar OSM etiketlerinden (Trump Alışveriş Merkezi + Residence/Office Tower →
// wikipedia "Trump Towers"; "Torun Center"; "İstanbul Cevahir AVM", loc_name "Cevahir AVM").
const LANDMARKS = [
  // Parlama anları konuşma aralarına denk getirildi (ses efekti sözün üstüne binmesin): 1,45–2,78 sn duraklama, 3,25–3,41 sn nefes.
  { key: 'trump', label: 'TRUMP TOWERS', T: 1.5, side: 'right', dy: 52, gain: 1 },   // etiket alanın altına doğru: üstteki başlıktan uzak
  { key: 'torun', label: 'TORUN CENTER', T: 2.2, side: 'left', gain: 1 },
  { key: 'cevahir', label: 'CEVAHİR AVM', T: 3.28, side: 'right', dy: -46, gain: 0.5 },
];
const CPS = 30;            // daktilo hızı (harf/sn)
/** Tam ekran katman solması: 1'e/0'a çok yakın saydamlıklar tam değere yuvarlanır (GPU harmanlama yuvarlaması kareyi oynatmasın). */
const snap = (o) => (o > 0.985 ? 1 : o < 0.015 ? 0 : o);
const TYPE_DELAY = 0.2;    // parlamadan sonra yazının başlaması

export async function create(ctx) {
  const [map, img, tl] = await Promise.all([
    ctx.json('comp/assets/hook/map.json'), ctx.image('map.jpg'), ctx.json('work/timeline.json').catch(() => null),
  ]);
  const gEnd = tl?.scenes?.find((x) => x.id === 'gercek')?.end ?? 9.5;   // haritanın eridiği an (global)
  const END = ctx.duration;                                              // hook'un kendi sonu
  const FADE = 0.5;
  const { x0, z0 } = map.window, MS = map.scale;
  const m2 = ([px, pz]) => [px / MS + x0, pz / MS + z0];

  const el = h('div', { class: 'scene' });

  // ---- harita ----
  // Harita <img> + CSS transform ile değil, yazılım tuvaline (CPU) her karede yeniden örneklenerek çizilir: tarayıcının görsel
  // önbelleği / mip seçimi kareler arasında durum taşımaz → aynı t her zaman aynı pikselleri verir. Alt piksel kayma korunur.
  const src = h('canvas', { width: img.naturalWidth, height: img.naturalHeight });
  src.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  const mapLayer = h('canvas', { width: W, height: H, style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const mg = mapLayer.getContext('2d', { willReadFrequently: true, alpha: false });
  const shade = h('div', { class: 'abs', style: { inset: '0', background: [
    `linear-gradient(180deg, ${alpha(C.night, 0.74)} 0px, ${alpha(C.night, 0.5)} 300px, ${alpha(C.night, 0)} 620px)`,
    `linear-gradient(0deg, ${alpha(C.night, 0.5)} 0px, ${alpha(C.night, 0)} 380px)`,
    `radial-gradient(85% 66% at 50% 50%, ${alpha(C.night, 0)} 50%, ${alpha(C.night, 0.3)} 100%)`,
    `linear-gradient(${alpha(C.night, 0.1)}, ${alpha(C.night, 0.1)})`,
  ].join(',') } });
  const sweep = h('div', { class: 'abs', style: { left: '0', top: '0', width: W + 'px', height: '260px',
    background: `linear-gradient(180deg, ${alpha(C.ink, 0)} 0%, ${alpha(C.ink, 0.1)} 82%, ${alpha(C.ink, 0.34)} 100%)`, borderBottom: `2px solid ${alpha(C.ink, 0.5)}` } });

  // ---- pembe alanlar: ekran uzayında, her karede kameradan yeniden çizilir. Yazılım tuvali (willReadFrequently → CPU raster):
  // poligon kenarları ve parıltı GPU kenar yumuşatmasına bağlı kalmaz, kare bit düzeyinde tekrarlanabilir. ----
  const mkSvg = (style = {}) => s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible', ...style } });
  const cv = h('canvas', { width: W, height: H, style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px' } });
  const g2 = cv.getContext('2d', { willReadFrequently: true });
  const svgMain = mkSvg();
  const svgLine = mkSvg();
  const groups = LANDMARKS.map((L, i) => {
    const parts = (map.landmarks[L.key] || []).slice().sort((a, b) => a.height - b.height);
    const rings = parts.map((b) => b.ring.map(m2));
    const all = rings.flat();
    const xs = all.map((p) => p[0]), zs = all.map((p) => p[1]);
    const bb = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
    const c = [(bb.x0 + bb.x1) / 2, (bb.z0 + bb.z1) / 2];
    let anchor = [bb.x1, lerp(bb.z0, bb.z1, 0.42)];
    if (L.side === 'left') { // ana kütlenin (yüksek blokların) en batıdaki köşesi — kenardaki ince ek yapı değil
      const tall = rings.filter((_, j) => parts[j].height >= 100);
      const west = tall.sort((a, b) => Math.min(...a.map((p) => p[0])) - Math.min(...b.map((p) => p[0])))[0] || all;
      const wz = west.map((p) => p[1]);
      anchor = [Math.min(...west.map((p) => p[0])), lerp(Math.min(...wz), Math.max(...wz), 0.35)];
    }
    const pulses = [0, 1].map(() => s('circle', { fill: 'none', stroke: C.pink, 'stroke-width': 3 }));
    svgMain.append(...pulses);
    // çağrı çizgisi + etiket plakası
    const leader = s('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const dot = s('circle', { r: 6, fill: C.ink, stroke: C.pink, 'stroke-width': 3 });
    svgLine.append(leader, dot);
    const num = h('span', { style: { color: C.pink, marginRight: '16px', fontWeight: '600' } }, `0${i + 1}`);
    const typed = h('span'), cursor = h('span', { style: { color: C.pink } }, '▌'), rest = h('span', { style: { visibility: 'hidden' } });
    const plate = h('div', { class: 'abs', lang: 'tr', style: { left: '0', top: '0', whiteSpace: 'nowrap', padding: '16px 4px 16px 20px',
      background: C.glassStrong, border: `1.5px solid ${C.hair}`, borderLeft: `6px solid ${C.pink}`, borderRadius: '4px',
      font: `700 42px/1 ${FONT.mono}`, letterSpacing: '0.03em', color: C.ink, boxShadow: `0 18px 50px ${C.shadow}`, transformOrigin: L.side === 'right' ? '0 50%' : '100% 50%' } },
    num, typed, cursor, rest);
    return { ...L, rings, bb, c, anchor, pulses, leader, dot, plate, typed, cursor, rest, pw: 0, ph: 0 };
  });

  // ---- arayüz: soru etiketi, ipucu sayacı, koordinat, ölçek ----
  const qMarks = h('span', { style: { color: C.pink, letterSpacing: '0.16em' } }, '???');
  const chipQ = h('div', { class: 'chip abs', style: { left: SAFE.left + 'px', top: SAFE.top + 18 + 'px', background: C.glassStrong } },
    h('span', { class: 'dot' }), 'KONUM', qMarks);
  const cnt = h('span', { class: 't-num', style: { color: C.pink } }, '0');
  const chipN = h('div', { class: 'chip abs', lang: 'tr', style: { right: W - SAFE.right + 'px', top: SAFE.top + 18 + 'px', background: C.glassStrong, transformOrigin: '100% 50%' } },
    'İPUCU', h('span', {}, cnt, h('span', { style: { color: C.dim } }, '/3')));
  const sbar = scaleBar({ w: 200, label: '200 m' });
  sbar.style.color = C.ink; sbar.style.alignItems = 'flex-end'; sbar.style.fontSize = '24px';
  const scale = h('div', { class: 'abs', style: { right: W - SAFE.right + 'px', top: '1440px' } }, sbar);
  const ui = h('div', { class: 'abs', style: { inset: '0' } }, chipQ, chipN);
  const mapUi = h('div', { class: 'abs', style: { inset: '0' } }, scale);
  const plates = h('div', { class: 'abs', style: { inset: '0' } }, groups.map((g) => g.plate));

  // ---- soru: ilk kareden itibaren büyük puntoyla ekranda (kaydıranı durduran şey); kelimeler söylenirken vurgulanır.
  // Bu sırada çatı altyazısı kapalıdır (aynı söz iki kez yazılmasın); "Bir dakika ya" ile altyazı aynı yerde devam eder. ----
  const shadow = `0 4px 0 ${alpha(C.night, 0.55)}, 0 10px 34px ${alpha(C.night, 0.8)}`;
  const qw = ctx.words.filter((w) => w.start < 1.6);                       // Burası · neresi? · Tanıyabildiniz · mi?
  const mkW = (w) => { const sp = h('span', { style: { display: 'inline-block', transformOrigin: '50% 70%' } }, w.text); sp.w = w; return sp; };
  const l1 = qw.slice(0, 2).map(mkW), l2 = qw.slice(2).map(mkW);
  const sep = (arr) => arr.flatMap((x, i) => (i ? [' ', x] : [x]));
  const q1 = h('div', { lang: 'tr', style: { font: `850 116px/1 ${FONT.display}`, letterSpacing: '-0.035em', whiteSpace: 'nowrap' } }, sep(l1));
  const q2 = h('div', { lang: 'tr', style: { marginTop: '10px', font: `800 68px/1 ${FONT.display}`, letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, sep(l2));
  const question = h('div', { class: 'abs', style: { left: SAFE.left + 'px', width: SAFE.width + 'px', top: '300px', textAlign: 'center', color: C.ink, textShadow: shadow, transformOrigin: '50% 40%' } }, q1, q2);
  const Q_OUT = 2.32;                                                      // soru çekilir, çatı altyazısı devralır

  el.append(mapLayer, shade, sweep, cv, svgMain, svgLine, mapUi, plates, question, ui);

  // ---- ses ----
  // Düzeyler seslendirmenin altında tutulur; sözle çakışanlar (3. ipucu) ayrıca kısılır.
  const sfx = [{ t: 0.0, name: 'hit', gain: 0.22 }];
  for (const g of groups) {
    sfx.push({ t: g.T, name: 'ping', gain: 0.5 * g.gain }, { t: g.T - 0.05, name: 'pop', gain: 0.32 * g.gain });
    for (let i = 0; i < g.label.length; i += 2) sfx.push({ t: +(g.T + TYPE_DELAY + i / CPS).toFixed(3), name: `type-${(i / 2) % 3 + 1}`, gain: 0.34 * g.gain });
  }
  sfx.push({ t: 4.72, name: 'riser', gain: 0.22 });   // "tanıdık." bittikten sonraki duraklamada

  let measured = false;
  function update(t) {
    if (!measured) { for (const g of groups) { g.rest.textContent = g.label; g.pw = g.plate.offsetWidth; g.ph = g.plate.offsetHeight; } measured = true; }
    const cam = camAt(t);
    const P = (p) => toScreen(cam, p[0], p[1]);

    // harita: çevir + ölçekle; vaat başlarken erir
    const out = range(t, gEnd, gEnd + FADE, ease.inOutCubic);
    const vis = snap(1 - out);
    el.style.opacity = vis.toFixed(4);
    el.style.display = vis <= 0 ? 'none' : '';
    if (vis <= 0) return;
    const k = cam.s / MS;                                   // ekran pikseli / harita pikseli
    mg.fillStyle = C.night; mg.fillRect(0, 0, W, H);
    mg.imageSmoothingEnabled = true; mg.imageSmoothingQuality = 'high';
    mg.drawImage(src, (cam.cx - x0) * MS - W / (2 * k), (cam.cz - z0) * MS - H / (2 * k), W / k, H / k, 0, 0, W, H);

    // tarama çizgisi (ilk saniye)
    const sw = range(t, 0.0, 1.35, ease.inOutCubic);
    sweep.style.transform = `translateY(${lerp(-40, H + 20, sw).toFixed(1)}px)`;
    sweep.style.opacity = (Math.min(1, range(t, 0, 0.2) * 1.2) * (1 - range(t, 1.1, 1.35))).toFixed(4);

    // arayüzün hook'a ait kısmı: sahne sonunda çekilir
    const uiOut = range(t, END - 0.22, END + 0.12, ease.inCubic);
    ui.style.opacity = (1 - uiOut).toFixed(4);
    plates.style.opacity = (1 - uiOut).toFixed(4);
    svgLine.style.opacity = (1 - uiOut).toFixed(4);
    mapUi.style.opacity = (1 - range(t, END + 0.1, END + 0.5)).toFixed(4);
    sbar.firstChild.style.width = (200 * cam.s).toFixed(1) + 'px';

    let lit = 0;
    g2.clearRect(0, 0, W, H);
    g2.lineJoin = 'round';
    // nirengi üçgeni: üçüncü ipucu yazıldıktan sonra üç alan birbirine bağlanır ("konum kilitlendi") — pembe alanların altında
    const T3 = groups[2].T + 0.75;
    const tp = range(t, T3, T3 + 0.7, ease.inOutCubic);
    if (tp > 0 && uiOut < 1) {
      const c3 = groups.map((g) => P(g.c));
      g2.save(); g2.globalAlpha = 1 - uiOut;
      g2.beginPath(); c3.forEach((p, i) => (i ? g2.lineTo(p[0], p[1]) : g2.moveTo(p[0], p[1]))); g2.closePath();
      g2.fillStyle = alpha(C.pink, 0.08 * range(t, T3 + 0.5, T3 + 1.0)); g2.fill();
      let remain = tp * c3.reduce((acc, p, i) => acc + Math.hypot(p[0] - c3[(i + 1) % 3][0], p[1] - c3[(i + 1) % 3][1]), 0);
      g2.setLineDash([3, 11]); g2.lineCap = 'round'; g2.lineWidth = 2.5; g2.strokeStyle = alpha(C.ink, 0.75);
      g2.beginPath(); g2.moveTo(c3[0][0], c3[0][1]);
      for (let i = 0; i < 3 && remain > 0; i++) {
        const a = c3[i], b = c3[(i + 1) % 3], L = Math.hypot(b[0] - a[0], b[1] - a[1]), f = Math.min(1, remain / L);
        g2.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f); remain -= L;
      }
      g2.stroke(); g2.restore();
    }
    groups.forEach((g, gi) => {
      const dt = t - g.T;
      const on = range(dt, 0, 0.16, ease.outCubic);
      if (dt >= 0) lit++;
      const breath = 0.5 + 0.5 * Math.sin((t - g.T) * 3.4);
      const pop = 1 + 0.07 * Math.sin(clamp(dt / 0.42) * Math.PI) * (dt >= 0 ? 1 : 0);
      const cs = P(g.c);
      const trace = (edge = false) => { // grubun bütün halkaları tek yol (her halka ayrı alt yol; sarım yönü fark etmesin diye tek tek doldurulur)
        for (const r of g.rings) {
          g2.beginPath();
          r.forEach((p, j) => { const q = P(p); const X = cs[0] + (q[0] - cs[0]) * pop, Y = cs[1] + (q[1] - cs[1]) * pop; if (j) g2.lineTo(X, Y); else g2.moveTo(X, Y); });
          g2.closePath(); g2.fill();
          if (edge) g2.stroke();
        }
      };
      // ilk saniyede üç alan sırayla bir kez "nabız" atar: göz pembeye gitsin (ipuçları henüz açılmadan)
      const beat = Math.sin(clamp((t - 0.12 - gi * 0.16) / 0.7) * Math.PI) ** 2;
      const fillA = lerp(0.62 + 0.05 * Math.sin(t * 2.2 + gi * 2.1) + 0.3 * beat, 1, on);
      const glowA = dt < 0 ? 0.14 + 0.6 * beat : lerp(1, 0.62 + 0.22 * breath, range(dt, 0.15, 0.9));
      const flashA = dt < 0 ? 0 : 0.95 * (1 - range(dt, 0.02, 0.5, ease.outCubic));
      // 1) parıltı (gölge bulanıklığı), 2) dolgu + ince krem kontur, 3) beyaz parlama
      g2.save(); g2.globalAlpha = glowA; g2.shadowColor = C.pink; g2.shadowBlur = 46; g2.fillStyle = C.pink; g2.strokeStyle = 'transparent'; trace(); g2.restore();
      g2.save(); g2.globalAlpha = fillA; g2.fillStyle = C.pink; g2.strokeStyle = on > 0 ? alpha(C.ink, 0.55 * on) : 'transparent'; g2.lineWidth = 1.5; trace(on > 0); g2.restore();
      if (flashA > 0) { g2.save(); g2.globalAlpha = flashA; g2.fillStyle = C.ink; g2.strokeStyle = 'transparent'; trace(); g2.restore(); }
      g.pulses.forEach((c, i) => {
        const pd = dt - i * 0.22, p = range(pd, 0, 0.9, ease.outCubic);
        c.setAttribute('cx', cs[0].toFixed(1)); c.setAttribute('cy', cs[1].toFixed(1));
        c.setAttribute('r', (30 + 250 * p).toFixed(1));
        c.setAttribute('opacity', (pd < 0 ? 0 : 0.85 * (1 - p)).toFixed(4));
        c.setAttribute('stroke-width', lerp(5, 1, p).toFixed(2));
      });

      // çağrı çizgisi + plaka
      const a = P(g.anchor);
      let px, py, pts;
      if (g.side === 'right') {
        const dy = g.dy ?? -46;
        px = a[0] + 86; py = a[1] + dy - g.ph / 2;
        pts = [[a[0] + 4, a[1]], [a[0] + 50, a[1] + dy], [px, a[1] + dy]];
      } else {
        px = a[0] - 86 - g.pw; py = a[1] - 46 - g.ph / 2;
        pts = [[a[0] - 4, a[1]], [a[0] - 50, a[1] - 46], [px + g.pw, a[1] - 46]];
      }
      const lp = range(dt, 0.06, 0.24, ease.outCubic);
      const len = pts.slice(1).reduce((acc, p, i) => acc + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
      g.leader.setAttribute('d', 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'));
      g.leader.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
      g.leader.setAttribute('stroke-dashoffset', (len * (1 - lp)).toFixed(2));
      g.leader.setAttribute('opacity', dt < 0.06 ? 0 : 1);
      g.dot.setAttribute('cx', a[0].toFixed(1)); g.dot.setAttribute('cy', a[1].toFixed(1));
      g.dot.setAttribute('opacity', range(dt, 0.02, 0.1).toFixed(3));
      const pin = range(dt, 0.14, 0.3, ease.outCubic);
      g.plate.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scaleX(${lerp(0.82, 1, pin).toFixed(4)})`;
      g.plate.style.opacity = pin.toFixed(4);
      const n = clamp(Math.floor((dt - TYPE_DELAY) * CPS), 0, g.label.length);
      g.typed.textContent = g.label.slice(0, n);
      g.rest.textContent = g.label.slice(n);             // görünmez kalan → plaka genişliği sabit
      const after = dt - TYPE_DELAY - g.label.length / CPS; // yazı bittikten sonra geçen süre
      g.cursor.style.visibility = dt > 0.14 && (after < 0 || (after < 0.9 && after % 0.4 < 0.22)) ? 'visible' : 'hidden';
    });

    // soru
    const qOut = range(t, Q_OUT - 0.22, Q_OUT, ease.inCubic);
    question.style.opacity = (1 - qOut).toFixed(4);
    question.style.transform = `translateY(${(-18 * qOut).toFixed(2)}px) scale(${lerp(1.045, 1, range(t, 0, 0.7, ease.outCubic)).toFixed(5)})`;
    q2.style.opacity = range(t, l2[0].w.start - 0.16, l2[0].w.start + 0.02, ease.outCubic).toFixed(4);
    q2.style.transform = `translateY(${((1 - range(t, l2[0].w.start - 0.16, l2[0].w.start + 0.06, ease.outCubic)) * 18).toFixed(2)}px)`;
    const qAll = [...l1, ...l2];
    let active = -1;
    qAll.forEach((sp, i) => { if (t >= sp.w.start - 0.02) active = i; });
    if (active >= 0 && t > qAll[qAll.length - 1].w.end + 0.3) active = -1;
    qAll.forEach((sp, i) => {
      const a = i === active ? range(t, sp.w.start - 0.02, sp.w.start + 0.07, ease.outCubic) : 0;
      sp.style.color = a > 0 ? `color-mix(in srgb, ${SUB_HI} ${(a * 100).toFixed(1)}%, ${C.ink})` : C.ink;
      sp.style.transform = a > 0 ? `translateY(${(-4 * a).toFixed(2)}px) scale(${(1 + 0.04 * a).toFixed(4)})` : 'none';
    });

    // sayaç
    cnt.textContent = String(lit);
    const lastT = lit ? groups[lit - 1].T : -9;
    chipN.style.transform = `scale(${(1 + 0.16 * Math.sin(clamp((t - lastT) / 0.36) * Math.PI)).toFixed(4)})`;
    qMarks.style.opacity = (0.55 + 0.45 * (0.5 + 0.5 * Math.cos(t * 4.2))).toFixed(3);

  }

  return { el, update, sfx, backdrop: false, extend: { after: gEnd - ctx.end + FADE },
    subtitles: (tl) => tl >= Q_OUT, subtitleY: 360 };
}
