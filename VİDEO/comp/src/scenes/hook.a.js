// hook — SEÇENEK A "KURGU": sözün ritmine oturan sert, temiz kesmeler.
// Her kelime bir kesme: "Burası" → Trump Towers, "neresi?" → Torun Center, "Tanıyabildiniz" → Cevahir AVM — sıkı yakın planlar
// (pembe kütleler yükseklikleriyle), ekranın üstünde o kelime dev puntoyla. "mi?"de kamera tek hamlede geri fırlar, üç alan
// birlikte görünür (iniş vuruşu). Sessizlikte üç ad plakası 0,4 sn arayla çakılır (damga). "Bir dakika ya." ve
// "Burası çok tanıdık." birer atlama kesmesi (jump cut); son kesme Trump Towers'a döner — gercek'in ilk fotoğrafı da o.
// Harita `gercek` boyunca altta kalır (extend.after). Her şey t'nin saf fonksiyonu.
import { C, FONT, SAFE, W, H, alpha, clamp, ease, lerp, range } from '../theme.js';
import { h } from '../kit.js';
import { loadWorld, camera, camLerp, camVia, aim, cpuCanvas, snap } from './hook.kit.js';

// Kesmeler ses kaydındaki gerçek hece başlarına göre (voice.wav ölçümü): "mi?" ~1,57'de biter, ikinci "Burası" 4,03'te başlar.
const CUT = { s2: 0.29, s3: 0.71, whip: 1.27, land: 1.55, j1: 2.77, j2: 4.02 };
const STAMP_T = [1.8, 2.14, 2.48];

export async function create(ctx) {
  const [world, tl] = await Promise.all([loadWorld(ctx), ctx.json('work/timeline.json').catch(() => null)]);
  const gEnd = tl?.scenes?.find((x) => x.id === 'gercek')?.end ?? 9.5;
  const END = ctx.duration, FADE = 0.5;
  const LM = world.landmarks;
  const [trump, torun, cevahir] = LM;
  const TW = [51, -176];

  // ---- çekimler (her biri kendi içinde yavaş itiş) ----
  const close = (L, at, s, rot, scr = [540, 1010]) => [aim({ s, rot, F: 1700, py: 900 }, at, scr), aim({ s: s * 1.07, rot: rot + 0.015, F: 1700, py: 900 }, at, [scr[0], scr[1] - 14])];
  const SH1 = close(trump, TW, 3.1, -0.06, [540, 1020]);
  const SH2 = close(torun, torun.c, 2.35, 0.05, [600, 1000]);
  const SH3 = close(cevahir, cevahir.c, 2.5, -0.03, [530, 1010]);
  const WIDE = camera({ s: 1.0, cx: 400, cz: 172, rot: 0, py: 1010 });
  const J1 = aim({ s: 1.13, rot: 0.025 }, [398, 176], [540, 1000]);
  const J2 = aim({ s: 2.15, rot: -0.04, F: 2000, py: 900 }, TW, [600, 900]);
  const J2b = aim({ s: 2.3, rot: -0.03, F: 2000, py: 900 }, TW, [600, 880]);
  const J3 = aim({ s: 2.9, rot: 0.02, F: 2000, py: 900 }, TW, [560, 700]);
  const seg = (t, a, b, A, B) => camLerp(A, B, clamp((t - a) / (b - a)));
  /** kesme sonrası küçük "oturma" (yeni çekim %4 büyük başlar, 0,18 sn'de yerine oturur) */
  const settle = (cam, t0, t) => ({ ...cam, s: cam.s * (1 + 0.04 * (1 - range(t - t0, 0, 0.2, ease.outCubic))) });
  function camAt(t) {
    if (t < CUT.s2) return settle(seg(t, 0, CUT.s2, SH1[0], SH1[1]), -0.05, t);
    if (t < CUT.s3) return settle(seg(t, CUT.s2, CUT.s3, SH2[0], SH2[1]), CUT.s2, t);
    if (t < CUT.whip) return settle(seg(t, CUT.s3, CUT.whip, SH3[0], SH3[1]), CUT.s3, t);
    if (t < CUT.land) { const k = range(t, CUT.whip, CUT.land, (x) => (x < 0.5 ? 8 * x ** 4 : 1 - 8 * (1 - x) ** 4)); return camVia(SH3[1], WIDE, k, cevahir.c); }
    if (t < CUT.j1) {
      // vuruş + damgalarda küçük itmeler
      const kick = [CUT.land, ...STAMP_T].reduce((a, T, i) => a + (t >= T ? (i ? 0.018 : 0.035) * Math.exp(-(t - T) * 9) : 0), 0);
      const c = seg(t, CUT.land, CUT.j1, WIDE, { ...WIDE, s: 1.03 });
      return { ...c, s: c.s * (1 + kick) };
    }
    if (t < CUT.j2) return settle(seg(t, CUT.j1, CUT.j2, J1, { ...J1, s: J1.s * 1.04 }), CUT.j1, t);
    if (t < 4.9) return settle(seg(t, CUT.j2, 4.9, J2, J2b), CUT.j2, t);
    const k = t < END + 0.03 ? 0.75 * Math.pow(range(t, 4.9, END + 0.03), 2.4) : 0.75 + 0.25 * range(t, END + 0.03, END + 1.3, ease.outCubic);
    return camVia(J2b, J3, k, TW);
  }
  const camSpeed = (t) => { const a = camAt(t - 1 / 60), b = camAt(t + 1 / 60); return Math.abs(Math.log(b.s / a.s)) * 30; };

  const el = h('div', { class: 'scene' });
  const [mapCv, mg] = cpuCanvas(W, H);
  const [tmpCv, tg] = cpuCanvas(W, H);
  const [lmCv, lg] = cpuCanvas(W, H);
  const shade = h('div', { class: 'abs', style: { inset: '0', background: [
    `linear-gradient(180deg, ${alpha(C.night, 0.8)} 0px, ${alpha(C.night, 0.55)} 330px, ${alpha(C.night, 0)} 660px)`,
    `linear-gradient(0deg, ${alpha(C.night, 0.55)} 0px, ${alpha(C.night, 0)} 420px)`,
    `radial-gradient(85% 66% at 50% 55%, ${alpha(C.night, 0)} 50%, ${alpha(C.night, 0.34)} 100%)`,
  ].join(',') } });
  const flash = h('div', { class: 'abs', style: { inset: '0', background: C.ink, mixBlendMode: 'overlay' } });

  // ---- dev kelime (her kesmede bir kelime) ----
  const qw = ctx.words.filter((w) => w.start < 1.6);              // Burası · neresi? · Tanıyabildiniz · mi?
  const bigWords = qw.map((w) => h('div', { lang: 'tr', style: { position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', font: `850 176px/1 ${FONT.display}`,
    letterSpacing: '-0.04em', color: C.ink, textShadow: `0 5px 0 ${alpha(C.night, 0.55)}, 0 14px 44px ${alpha(C.night, 0.85)}`, transformOrigin: '50% 50%' } },
  w.text.toLocaleUpperCase('tr')));
  const bigBox = h('div', { class: 'abs', style: { inset: '0' } }, bigWords);
  const WORD_T = [0, CUT.s2, CUT.s3, CUT.whip + 0.02];             // ekrana geldiği an (kesme)
  // birleşik soru (iniş anında): iki satır, mevcut sahnedeki gibi
  const q1 = h('div', { lang: 'tr', style: { font: `850 116px/1 ${FONT.display}`, letterSpacing: '-0.035em', whiteSpace: 'nowrap' } }, `${qw[0].text} ${qw[1].text}`);
  const q2 = h('div', { lang: 'tr', style: { marginTop: '10px', font: `800 68px/1 ${FONT.display}`, letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, `${qw[2].text} ${qw[3].text}`);
  const question = h('div', { class: 'abs', style: { left: SAFE.left + 'px', width: SAFE.width + 'px', top: '300px', textAlign: 'center', color: C.ink,
    textShadow: `0 4px 0 ${alpha(C.night, 0.55)}, 0 10px 34px ${alpha(C.night, 0.8)}` } }, q1, q2);
  const Q_OUT = 2.55;

  // ---- çekim künyesi: sol üst sıra numarası, sağ üst koordinat (belgesel kurgusu) ----
  const { lat0, lon0 } = world.map;
  const dms = (v) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return `${d}°${m.toFixed(3).padStart(6, '0')}′`; };
  const coordOf = (L) => { const lat = lat0 - L.c[1] / 111320, lon = lon0 + L.c[0] / (111320 * Math.cos(lat0 * Math.PI / 180)); return `${dms(lat)}K  ${dms(lon)}D`; };
  const slate = h('div', { class: 'abs', style: { left: SAFE.left + 'px', right: W - SAFE.right + 'px', top: SAFE.top + 22 + 'px', display: 'flex', justifyContent: 'space-between',
    font: `600 26px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: C.ink } });
  const slateL = h('span', { class: 't-num' }), slateR = h('span', { class: 't-num', style: { color: C.dim } });
  slate.append(slateL, slateR);

  // ---- ad plakaları (damga) ----
  const SIDE = { trump: { side: 'right', dy: 40 }, torun: { side: 'left', dy: -70 }, cevahir: { side: 'right', dy: -40 } };
  const plates = LM.map((L, i) => {
    const el2 = h('div', { class: 'abs', lang: 'tr', style: { left: '0', top: '0', whiteSpace: 'nowrap', padding: '18px 24px 18px 22px', background: C.pink, color: C.night,
      borderRadius: '4px', font: `800 46px/1 ${FONT.mono}`, letterSpacing: '0.02em', boxShadow: `0 18px 50px ${alpha(C.night, 0.7)}, 0 0 0 3px ${alpha(C.night, 0.35)}` } },
    h('span', { style: { opacity: '0.6', marginRight: '14px' } }, `0${i + 1}`), L.name);
    return { L, T: STAMP_T[i], ...SIDE[L.key], el: el2, w: 0, h: 0, rot: [-2.2, 1.6, -1.4][i] };
  });
  const plateBox = h('div', { class: 'abs', style: { inset: '0' } }, plates.map((p) => p.el));

  el.append(mapCv, lmCv, shade, plateBox, bigBox, question, slate, flash);

  // ---- ses: kesmelerde kuru vuruş, geri fırlamada emme + iniş, adlarda yükselen üç damga ----
  const sfx = [
    { t: 0.0, name: 'hook-a-cut', gain: 1 },
    { t: CUT.s2 - 0.005, name: 'hook-a-cut', gain: 0.85 },
    { t: CUT.s3 - 0.005, name: 'hook-a-cut', gain: 0.85 },
    { t: CUT.land - 0.24, name: 'hook-a-whip', gain: 0.8 },
    { t: CUT.land, name: 'hook-a-impact', gain: 1 },
    ...STAMP_T.map((t, i) => ({ t: t - 0.005, name: `hook-a-stamp-${i + 1}`, gain: 0.85 })),
    { t: CUT.j1 - 0.005, name: 'hook-a-cut', gain: 0.6 },
    { t: CUT.j2 - 0.005, name: 'hook-a-cut', gain: 0.6 },
    { t: END - 0.25, name: 'hook-a-whip', gain: 0.7 },
  ];

  let measured = false;
  function update(t) {
    if (!measured) {
      for (const p of plates) { p.w = p.el.offsetWidth; p.h = p.el.offsetHeight; }
      for (const b of bigWords) { const w = b.offsetWidth; b.fit = Math.min(1, SAFE.width / w); b.w = w; b.hgt = b.offsetHeight; }
      measured = true;
    }
    const out = range(t, gEnd, gEnd + FADE, ease.inOutCubic);
    const vis = snap(1 - out);
    el.style.opacity = vis.toFixed(4);
    el.style.display = vis <= 0 ? 'none' : '';
    if (vis <= 0) return;

    // harita (hızlı kamera hareketinde 3 alt örnekli hareket bulanıklığı)
    const cam = camAt(t);
    const inWhip = (t > CUT.whip + 0.02 && t < CUT.land - 0.01) || (t > 5.2 && t < END + 0.1);   // kesmeler arasında bulanıklık yok
    const sp = inWhip ? camSpeed(t) : 0;
    if (sp > 1.2) {
      const n = 4, span = 1 / 30 * 0.8;
      for (let i = 0; i < n; i++) {
        const c = camAt(t - span / 2 + span * i / (n - 1));
        world.drawMap(tg, c);
        mg.globalAlpha = 1 / (i + 1); mg.drawImage(tmpCv, 0, 0); mg.globalAlpha = 1;
      }
    } else world.drawMap(mg, cam);

    // pembe yapılar
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
    const landD = t - CUT.land;
    const uiOut = range(t, END - 0.2, END + 0.12, ease.inCubic);
    LM.forEach((L, i) => {
      const st = t - plates[i].T;
      const hitF = landD >= 0 ? 0.8 * (1 - range(landD, 0, 0.45, ease.outCubic)) : 0;
      const stF = st >= 0 ? 0.55 * (1 - range(st, 0, 0.3, ease.outCubic)) : 0;
      const cutF = [-1, CUT.s2, CUT.s3].reduce((a, T, j) => (j === i && T >= 0 && t >= T && t < T + 0.16 ? 0.45 * (1 - range(t - T, 0, 0.16, ease.outCubic)) : a), 0);
      const breath = 0.5 + 0.5 * Math.sin(t * 3.3 + i * 2);
      world.drawLandmark(lg, cam, L, { fill: 1, glow: 0.45 + 0.25 * breath + Math.max(hitF, stF), flash: Math.max(hitF * 0.8, stF, cutF), edge: 0.45 });
    });

    // kesme parlaması (1–2 kare, overlay karışımı: renkler sertleşir, beyaz basmaz)
    const cuts = [CUT.s2, CUT.s3, CUT.land, CUT.j1, CUT.j2];
    let fl = 0;
    for (const T of cuts) if (t >= T && t < T + 0.12) fl = Math.max(fl, (T === CUT.land ? 0.7 : 0.45) * (1 - (t - T) / 0.12));
    flash.style.opacity = fl.toFixed(4);

    // dev kelimeler
    bigWords.forEach((b, i) => {
      const T0 = WORD_T[i], T1 = i < 3 ? WORD_T[i + 1] : CUT.land;
      const on = t >= T0 && t < T1;
      b.style.display = on ? '' : 'none';
      if (!on) return;
      const k = range(t - T0, 0, 0.16, ease.outCubic);
      const sc = b.fit * lerp(1.12, 1, k) * (i === 3 ? lerp(1, 1.6, range(t, CUT.whip + 0.1, CUT.land, ease.inCubic)) : 1);
      const y = 300 + (i === 3 ? -20 : 0);
      b.style.transform = `translate(${(540 - b.w / 2).toFixed(1)}px, ${y}px) scale(${sc.toFixed(4)})`;
      b.style.opacity = (i === 3 ? 1 - range(t, CUT.land - 0.08, CUT.land) : 1).toFixed(4);
    });
    const qa = t >= CUT.land ? 1 - range(t, Q_OUT - 0.22, Q_OUT, ease.inCubic) : 0;
    question.style.opacity = qa.toFixed(4);
    question.style.transform = `scale(${lerp(1.1, 1, range(t, CUT.land, CUT.land + 0.22, ease.outBack)).toFixed(4)})`;

    // künye
    const shot = t < CUT.s2 ? 0 : t < CUT.s3 ? 1 : t < CUT.whip ? 2 : -1;
    slate.style.opacity = (shot >= 0 ? 1 : 0).toFixed(3);
    if (shot >= 0) { slateL.textContent = `● ${String(shot + 1).padStart(2, '0')} / 03`; slateR.textContent = coordOf(LM[shot]); }
    slateL.style.color = C.pink;

    // damga plakaları
    plates.forEach((p) => {
      const dt = t - p.T;
      if (dt < 0 || uiOut >= 1) { p.el.style.display = 'none'; return; }
      p.el.style.display = '';
      const box = world.screenBox(cam, p.L);
      if (box.x1 < 0 || box.x0 > W || box.y1 < SAFE.top || box.y0 > SAFE.bottom) { p.el.style.display = 'none'; return; }
      const a = p.side === 'right' ? [box.x1 + 30, lerp(box.y0, box.y1, 0.45) + p.dy] : [box.x0 - 30 - p.w, lerp(box.y0, box.y1, 0.4) + p.dy];
      const x = clamp(a[0], 36, W - 36 - p.w), y = clamp(a[1] - p.h / 2, SAFE.top + 160, SAFE.bottom - 40);
      const k = range(dt, 0, 0.13, ease.inCubic);                 // yukarıdan çakılır
      const bounce = dt > 0.13 ? 0.04 * Math.exp(-(dt - 0.13) * 14) * Math.cos((dt - 0.13) * 40) : 0;
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${p.rot}deg) scale(${(lerp(1.7, 1, k) + bounce).toFixed(4)})`;
      p.el.style.opacity = (Math.min(1, dt / 0.05) * (1 - uiOut)).toFixed(4);
    });
  }

  return { el, update, sfx, backdrop: false, extend: { after: gEnd - ctx.end + FADE },
    subtitles: (tl) => tl >= Q_OUT - 0.05, subtitleY: 360 };
}
