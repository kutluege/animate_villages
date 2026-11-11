// hook — SEÇENEK B "TEK PLAN": kesintisiz tek kamera hamlesi.
// İlk kare: Trump Towers'ın pembe kuleleri çok yakından, tepeden; kuleler yükseklikleriyle (perspektif) kameraya doğru uzanır —
// soyut, "bu ne?" dedirten bir görüntü. Kamera "Burası neresi? Tanıyabildiniz mi?" boyunca dönerek geri çekilir (uzun yükselen ton);
// "mi?"nin bittiği anda (1,45 sn) çerçeve oturur, üç pembe alan aynı anda yanar: TEK güçlü vuruş. Sessizlikte adlar sırayla açılır;
// "Burası çok tanıdık."tan sonra kamera Trump Towers'a dalar ve `gercek` sahnesinin ilk fotoğrafı (Trump + viyadük) tam o anda düşer.
// Harita `gercek` boyunca altta kalır (extend.after). Her şey t'nin saf fonksiyonu.
import { C, FONT, SAFE, SUB_HI, W, H, alpha, clamp, ease, lerp, range } from '../theme.js';
import { h, s as svgEl } from '../kit.js';
import { loadWorld, camera, camLerp, camVia, aim, cpuCanvas, snap } from './hook.kit.js';

const T_LAND = 1.56;        // "mi?" biter (voice.wav: ~1,57): çerçeve oturur + vuruş
const T_DIVE = 4.78;        // "tanıdık." biter: dalış başlar
const LABEL_T = [1.82, 2.14, 2.46];

export async function create(ctx) {
  const [world, tl] = await Promise.all([loadWorld(ctx), ctx.json('work/timeline.json').catch(() => null)]);
  const gEnd = tl?.scenes?.find((x) => x.id === 'gercek')?.end ?? 9.5;
  const END = ctx.duration, FADE = 0.5;
  const [trump, torun, cevahir] = world.landmarks;
  const LM = world.landmarks;

  // ---- kamera anahtar kareleri ----
  const TW = [51, -176];                                                                     // iki kulenin ortası
  const K0 = aim({ s: 4.6, rot: -0.42, F: 1600, px: 360, py: 520 }, TW, [560, 930]);        // makro: kuleler sağ-aşağı uzanır (başlıktan uzak)
  const K1 = camera({ s: 1.0, cx: 400, cz: 172, rot: 0, py: 1010 });                          // üç alan kadrajda
  const K2 = camera({ s: 0.975, cx: 396, cz: 178, rot: 0.016, py: 1010 });                    // nefes alan yavaş kayma
  const K3 = aim({ s: 3.6, rot: 0.14, F: 2400 }, TW, [560, 700]);                             // dalış: Trump Towers (gercek'in ilk fotoğrafının altı)
  const T_GER = END + 0.05;
  const A_ = 0.86, V0 = 0.1;
  const F_ = (u) => V0 * u + (u <= A_ ? u ** 3 / 3 : A_ ** 3 / 3 + A_ ** 2 * (u - A_) - A_ ** 2 * (u - A_) ** 2 / (2 * (1 - A_)));
  const flight = (u) => F_(u) / F_(1);
  function camAt(t) {
    if (t <= T_LAND) {
      // yavaş başlar, hızlanır, "mi?" bitişinde kararlı oturur
      // hız eğrisi: ilk kareden hafif hareket, sona doğru hızlanır, son 0,2 sn'de sert ama yumuşak durur (vuruş = duruş)
      const k = flight(clamp(t / T_LAND));
      return camVia(K0, K1, k, TW);
    }
    const a0 = camLerp(K1, K2, range(t, T_LAND, T_DIVE, ease.outCubic));
    const dl = t - T_LAND, a = { ...a0, s: a0.s * (1 + 0.022 * Math.exp(-dl * 7) * Math.cos(dl * 22)) };   // vuruşta kısa sarsıntı
    // dalış: hızlanarak gercek'in ilk fotoğrafına (5,59 sn) yetişir, sonra fotoğrafların altında yavaşlar
    const d = t < T_GER ? 0.78 * Math.pow(range(t, T_DIVE, T_GER), 2.3) : 0.78 + 0.22 * range(t, T_GER, T_GER + 1.2, ease.outCubic);
    return d > 0 ? camVia(a, K3, d, TW) : a;
  }

  const el = h('div', { class: 'scene' });
  const [mapCv, mg] = cpuCanvas(W, H);
  const [lmCv, lg] = cpuCanvas(W, H);
  const shade = h('div', { class: 'abs', style: { inset: '0', background: [
    `linear-gradient(180deg, ${alpha(C.night, 0.78)} 0px, ${alpha(C.night, 0.5)} 300px, ${alpha(C.night, 0)} 640px)`,
    `linear-gradient(0deg, ${alpha(C.night, 0.55)} 0px, ${alpha(C.night, 0)} 420px)`,
    `radial-gradient(85% 66% at 50% 52%, ${alpha(C.night, 0)} 48%, ${alpha(C.night, 0.36)} 100%)`,
  ].join(',') } });
  // vuruş anında beyaz-pembe parlama + halka dalgaları
  const bloom = h('div', { class: 'abs', style: { inset: '0', background: `radial-gradient(60% 45% at 50% 52%, ${alpha(C.pink, 0.35)} 0%, ${alpha(C.pink, 0)} 70%)` } });
  const ringSvg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', left: '0', top: '0' } });
  const rings = LM.map(() => [0, 1].map(() => { const c = svgEl('circle', { fill: 'none', stroke: C.pink }); ringSvg.append(c); return c; }));

  // ---- etiketler: ince çağrı çizgisi + cam plaka; soldan sağa silinerek açılır ----
  const lineSvg = svgEl('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: { position: 'absolute', left: '0', top: '0', overflow: 'visible' } });
  const SIDE = { trump: { side: 'right', dy: 40 }, torun: { side: 'left', dy: -60 }, cevahir: { side: 'right', dy: -40 } };
  const labels = LM.map((L, i) => {
    const leader = svgEl('path', { fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const dot = svgEl('circle', { r: 6, fill: C.ink, stroke: C.pink, 'stroke-width': 3 });
    lineSvg.append(leader, dot);
    const plate = h('div', { class: 'abs', lang: 'tr', style: { left: '0', top: '0', whiteSpace: 'nowrap', padding: '16px 22px 16px 20px', background: C.glassStrong,
      border: `1.5px solid ${C.hair}`, borderLeft: `6px solid ${C.pink}`, borderRadius: '4px', font: `700 42px/1 ${FONT.mono}`, letterSpacing: '0.03em', color: C.ink,
      boxShadow: `0 18px 50px ${C.shadow}` } },
    h('span', { style: { color: C.pink, marginRight: '16px', fontWeight: '600' } }, `0${i + 1}`), L.name);
    return { L, T: LABEL_T[i], ...SIDE[L.key], leader, dot, plate, pw: 0, ph: 0 };
  });
  const plates = h('div', { class: 'abs', style: { inset: '0' } }, labels.map((l) => l.plate));

  // ---- soru (ilk kareden ekranda) ----
  const shadowTxt = `0 4px 0 ${alpha(C.night, 0.55)}, 0 10px 34px ${alpha(C.night, 0.8)}`;
  const qw = ctx.words.filter((w) => w.start < 1.6);
  const mkW = (w) => { const sp = h('span', { style: { display: 'inline-block', transformOrigin: '50% 70%' } }, w.text); sp.w = w; return sp; };
  const l1 = qw.slice(0, 2).map(mkW), l2 = qw.slice(2).map(mkW);
  const sep = (arr) => arr.flatMap((x, i) => (i ? [' ', x] : [x]));
  const q1 = h('div', { lang: 'tr', style: { font: `850 124px/1 ${FONT.display}`, letterSpacing: '-0.035em', whiteSpace: 'nowrap' } }, sep(l1));
  const q2 = h('div', { lang: 'tr', style: { marginTop: '14px', font: `800 72px/1 ${FONT.display}`, letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, sep(l2));
  const question = h('div', { class: 'abs', style: { left: SAFE.left + 'px', width: SAFE.width + 'px', top: '292px', textAlign: 'center', color: C.ink, textShadow: shadowTxt, transformOrigin: '50% 40%' } }, q1, q2);
  const Q_OUT = 2.5;

  el.append(mapCv, lmCv, shade, bloom, ringSvg, lineSvg, plates, question);

  // ---- ses: tek yükselen ton → tek vuruş; adlarda ince parıltı; dalışta hava ----
  const sfx = [
    { t: 0, name: 'hook-b-rise', gain: 0.9 },   // dosya 1,55 sn: sonu vuruşa (T_LAND) denk
    { t: T_LAND - 0.012, name: 'hook-b-boom', gain: 1 },
    ...LABEL_T.map((t, i) => ({ t: t + 0.02, name: 'hook-b-glint', gain: 0.55 - 0.08 * i })),
    { t: T_DIVE + 0.02, name: 'hook-b-dive', gain: 0.75 },
  ];

  let measured = false;
  function update(t) {
    if (!measured) { for (const l of labels) { l.pw = l.plate.offsetWidth; l.ph = l.plate.offsetHeight; } measured = true; }
    const out = range(t, gEnd, gEnd + FADE, ease.inOutCubic);
    const vis = snap(1 - out);
    el.style.opacity = vis.toFixed(4);
    el.style.display = vis <= 0 ? 'none' : '';
    if (vis <= 0) return;
    const cam = camAt(t);
    world.drawMap(mg, cam);

    // pembe yapılar: başta yalnız Trump (kadrajda); geri çekilirken diğerleri kadraja girer. Vuruşta üçü birden parlar.
    const land = t - T_LAND;
    const flash = land < 0 ? 0 : 0.9 * (1 - range(land, 0.0, 0.55, ease.outCubic));
    const breath = 0.5 + 0.5 * Math.sin(t * 3.1);
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
    const uiOut = range(t, END - 0.2, END + 0.15, ease.inCubic);
    LM.forEach((L, i) => {
      const pre = land < 0;
      const glow = pre ? 0.35 + 0.25 * breath : lerp(1, 0.55 + 0.25 * breath, range(land, 0.1, 1.0));
      const lt = t - LABEL_T[i];
      const kick = lt >= 0 ? 0.45 * (1 - range(lt, 0, 0.5, ease.outCubic)) : 0;
      const pop = 1 + (land >= 0 ? 0.06 * Math.sin(clamp(land / 0.4) * Math.PI) : 0);
      world.drawLandmark(lg, cam, L, { fill: pre ? 0.9 : 1, glow: Math.min(1, glow + kick), flash: Math.max(flash, lt >= 0 ? 0.5 * (1 - range(lt, 0, 0.3)) : 0), edge: land >= 0 ? 0.5 : 0.6, pop });
      // halka dalgaları (vuruş)
      const c = world.project(cam, L.c[0], L.c[1], L.top * 0.5);
      rings[i].forEach((cc, j) => {
        const p = range(land - j * 0.16 - i * 0.05, 0, 1.1, ease.outCubic);
        cc.setAttribute('cx', c[0].toFixed(1)); cc.setAttribute('cy', c[1].toFixed(1));
        cc.setAttribute('r', (40 + 330 * p).toFixed(1));
        cc.setAttribute('stroke-width', lerp(6, 1, p).toFixed(2));
        cc.setAttribute('opacity', (land - j * 0.16 - i * 0.05 < 0 ? 0 : 0.85 * (1 - p)).toFixed(4));
      });
    });
    bloom.style.opacity = (land < 0 ? 0 : 1 - range(land, 0.05, 0.9, ease.outCubic)).toFixed(4);

    // etiketler
    labels.forEach((l) => {
      const dt = t - l.T;
      const box = world.screenBox(cam, l.L);
      const a = l.side === 'right' ? [box.x1 - 6, lerp(box.y0, box.y1, 0.45)] : [box.x0 + 6, lerp(box.y0, box.y1, 0.4)];
      let px, py, pts;
      if (l.side === 'right') { px = a[0] + 80; py = a[1] + l.dy - l.ph / 2; pts = [[a[0], a[1]], [a[0] + 46, a[1] + l.dy], [px, a[1] + l.dy]]; }
      else { px = a[0] - 80 - l.pw; py = a[1] + l.dy - l.ph / 2; pts = [[a[0], a[1]], [a[0] - 46, a[1] + l.dy], [px + l.pw, a[1] + l.dy]]; }
      px = clamp(px, 40, W - 40 - l.pw);
      const lp = range(dt, 0.0, 0.2, ease.outCubic);
      const len = pts.slice(1).reduce((acc, p, i) => acc + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
      l.leader.setAttribute('d', 'M' + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'));
      l.leader.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${len.toFixed(1)}`);
      l.leader.setAttribute('stroke-dashoffset', (len * (1 - lp)).toFixed(2));
      l.leader.setAttribute('opacity', dt < 0 ? 0 : (1 - uiOut).toFixed(4));
      l.dot.setAttribute('cx', a[0].toFixed(1)); l.dot.setAttribute('cy', a[1].toFixed(1));
      l.dot.setAttribute('opacity', (range(dt, 0, 0.08) * (1 - uiOut)).toFixed(3));
      const wipe = range(dt, 0.12, 0.42, ease.outQuint);
      l.plate.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      l.plate.style.opacity = (dt < 0.12 ? 0 : 1 - uiOut).toFixed(4);
      l.plate.style.clipPath = l.side === 'right' ? `inset(0 ${((1 - wipe) * 100).toFixed(2)}% 0 0)` : `inset(0 0 0 ${((1 - wipe) * 100).toFixed(2)}%)`;
    });

    // soru
    const qOut = range(t, Q_OUT - 0.25, Q_OUT, ease.inCubic);
    const punch = land >= 0 ? 0.035 * Math.sin(clamp(land / 0.3) * Math.PI) * (1 - range(land, 0.3, 0.6)) : 0;
    question.style.opacity = (1 - qOut).toFixed(4);
    question.style.transform = `translateY(${(-18 * qOut).toFixed(2)}px) scale(${(lerp(1.03, 1, range(t, 0, 0.8, ease.outCubic)) + punch).toFixed(5)})`;
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
    shade.style.opacity = '1';
  }

  return { el, update, sfx, backdrop: false, extend: { after: gEnd - ctx.end + FADE },
    subtitles: (tl) => tl >= Q_OUT - 0.05, subtitleY: 360 };
}
