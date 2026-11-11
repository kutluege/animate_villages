// hook — SEÇENEK C "TESPİT": harita bir keşif ekranına dönüşür.
// İlk kare: koyulaştırılmış harita, merkezden dönen tarama kolu (geçtiği yer bir an aydınlanır), mesafe halkaları, arayan üç nişangâh,
// akan koordinatlar ve "Burası neresi?". Soru boyunca tarama kolu pembe alanların üstünden geçtikçe "temas" bip'i; nişangâhlar arar.
// Sessizlikte (1,45–2,78) üç nişangâh sırayla kilitlenir (kilit sesi), adlar okunur. "Bir dakika ya." ile üç alan nirengi
// çizgileriyle bağlanır, koordinatlar oturur; "tanıdık."ta "EŞLEŞME" (onay akoru) — ad yine söylenmez: cevabı `gercek` verir.
// Harita `gercek` boyunca altta kalır (extend.after). Her şey t'nin saf fonksiyonu.
import { C, FONT, SAFE, SUB_HI, W, H, alpha, clamp, ease, hash01, lerp, range } from '../theme.js';
import { h } from '../kit.js';
import { loadWorld, camera, cpuCanvas, snap } from './hook.kit.js';

const PERIOD = 1.3;                 // tarama kolunun turu (sn)
const LOCK_T = [1.68, 2.02, 2.36];  // kilitlenme anları (söz boşluğu: 1,57–2,77)
const TRI_T = 2.8;                  // nirengi ("Bir dakika ya.")
const MATCH_T = 4.8;                // eşleşme ("tanıdık." bittikten sonra; voice.wav ~4,75)

export async function create(ctx) {
  const [world, tl] = await Promise.all([loadWorld(ctx), ctx.json('work/timeline.json').catch(() => null)]);
  const gEnd = tl?.scenes?.find((x) => x.id === 'gercek')?.end ?? 9.5;
  const END = ctx.duration, FADE = 0.5;
  const LM = world.landmarks;

  const camAt = (t) => {
    const k = range(t, 0, END + 4, (x) => x);
    const kick = LOCK_T.reduce((a, T) => a + (t >= T ? 0.012 * Math.exp(-(t - T) * 10) : 0), 0) + (t >= MATCH_T ? 0.02 * Math.exp(-(t - MATCH_T) * 6) : 0);
    return camera({ s: lerp(0.95, 1.12, k) * (1 + kick), cx: 398, cz: 176, rot: 0, py: 1010 });
  };
  const SC = [540, 1010];           // tarama merkezi (ekran; üç alanın ortası)
  const sweepAng = (t) => -Math.PI * 0.62 + (2 * Math.PI * t) / PERIOD;
  const angOf = (p) => Math.atan2(p[1] - SC[1], p[0] - SC[0]);
  /** son geçişten bu yana süre (kol bu açıdan en son ne zaman geçti) */
  const sinceSweep = (t, a) => { const d = (((sweepAng(t) - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); const s = d / (2 * Math.PI) * PERIOD; return s <= t ? s : 99; };

  const el = h('div', { class: 'scene' });
  const [mapCv, mg] = cpuCanvas(W, H);
  const [dkCv, dg] = cpuCanvas(W, H);
  const [lmCv, lg] = cpuCanvas(W, H);
  const [hudCv, hg] = cpuCanvas(W, H);
  const shade = h('div', { class: 'abs', style: { inset: '0', background: [
    `linear-gradient(180deg, ${alpha(C.night, 0.8)} 0px, ${alpha(C.night, 0.5)} 320px, ${alpha(C.night, 0)} 640px)`,
    `linear-gradient(0deg, ${alpha(C.night, 0.55)} 0px, ${alpha(C.night, 0)} 420px)`,
  ].join(',') } });
  // ince tarama satırları (ekran dokusu; sabit)
  const lines = h('div', { class: 'abs', style: { inset: '0', backgroundImage: `repeating-linear-gradient(0deg, ${alpha(C.night, 0.16)} 0px, ${alpha(C.night, 0.16)} 1px, transparent 1px, transparent 4px)` } });

  // ---- üst bant: durum + akan koordinat ----
  const dot = h('span', { class: 'dot' });
  const status = h('span', { class: 't-num' }, 'KONUM ARANIYOR');
  const chipS = h('div', { class: 'chip abs', lang: 'tr', style: { left: SAFE.left + 'px', top: SAFE.top + 18 + 'px', background: C.glassStrong, font: `600 26px/1 ${FONT.mono}`, letterSpacing: '0.08em' } }, dot, status);
  const coordEl = h('div', { class: 'abs t-num', lang: 'tr', style: { right: W - SAFE.right + 'px', top: SAFE.top + 22 + 'px', textAlign: 'right', font: `600 26px/1.35 ${FONT.mono}`, letterSpacing: '0.06em', color: C.ink } });
  const latEl = h('div'), lonEl = h('div', { style: { color: C.dim } });
  coordEl.append(latEl, lonEl);

  // ---- soru ----
  const qw = ctx.words.filter((w) => w.start < 1.6);
  const mkW = (w) => { const sp = h('span', { style: { display: 'inline-block', transformOrigin: '50% 70%' } }, w.text); sp.w = w; return sp; };
  const l1 = qw.slice(0, 2).map(mkW), l2 = qw.slice(2).map(mkW);
  const sep = (arr) => arr.flatMap((x, i) => (i ? [' ', x] : [x]));
  const q1 = h('div', { lang: 'tr', style: { font: `850 116px/1 ${FONT.display}`, letterSpacing: '-0.035em', whiteSpace: 'nowrap' } }, sep(l1));
  const q2 = h('div', { lang: 'tr', style: { marginTop: '10px', font: `800 68px/1 ${FONT.display}`, letterSpacing: '-0.02em', whiteSpace: 'nowrap' } }, sep(l2));
  const question = h('div', { class: 'abs', style: { left: SAFE.left + 'px', width: SAFE.width + 'px', top: '330px', textAlign: 'center', color: C.ink,
    textShadow: `0 4px 0 ${alpha(C.night, 0.55)}, 0 10px 34px ${alpha(C.night, 0.8)}` } }, q1, q2);
  const Q_OUT = 2.55;

  // ---- kilit etiketleri (DOM: keskin yazı) ----
  const tags = LM.map((L, i) => {
    const name = h('span'), rest = h('span', { style: { visibility: 'hidden' } }, L.name);
    const pct = h('span', { class: 't-num', style: { color: C.pink, marginLeft: '14px' } });
    const el2 = h('div', { class: 'abs', lang: 'tr', style: { left: '0', top: '0', whiteSpace: 'nowrap', padding: '10px 16px 10px 14px', background: C.glassStrong,
      border: `1.5px solid ${alpha(C.pink, 0.8)}`, borderRadius: '3px', font: `700 34px/1 ${FONT.mono}`, letterSpacing: '0.04em', color: C.ink } },
    h('span', { style: { color: C.pink, marginRight: '12px' } }, `0${i + 1}`), name, rest, pct);
    return { L, T: LOCK_T[i], el: el2, name, rest, pct, w: 0, hh: 0, side: ['right', 'left', 'right'][i] };
  });
  const tagBox = h('div', { class: 'abs', style: { inset: '0' } }, tags.map((x) => x.el));

  el.append(mapCv, dkCv, lmCv, lines, shade, hudCv, tagBox, question, chipS, coordEl);

  // ---- ses ----
  const sfx = [];
  for (let k = 0; k * PERIOD < MATCH_T; k++) sfx.push({ t: +(k * PERIOD).toFixed(3), name: 'hook-c-sweep', gain: k === 0 ? 0.9 : 0.5 });
  // temas bip'leri: kol bir pembe alanın üstünden geçtiğinde (arama evresi)
  const cam0 = camAt(0.5);
  const lmAng = LM.map((L) => angOf(world.project(cam0, L.c[0], L.c[1])));
  const contacts = [];
  LM.forEach((L, i) => { for (let t = 0.02; t < LOCK_T[0] - 0.05; t += 1 / 120) if (sinceSweep(t, lmAng[i]) < 1 / 120) { contacts.push({ t, i }); t += 0.3; } });
  for (const c of contacts) sfx.push({ t: +c.t.toFixed(3), name: 'hook-c-blip', gain: 0.65 });
  sfx.push({ t: 0.04, name: 'hook-c-data', gain: 0.55 });
  LOCK_T.forEach((T) => sfx.push({ t: T - 0.11, name: 'hook-c-lock', gain: 0.85 }));
  sfx.push({ t: TRI_T, name: 'hook-c-data', gain: 0.5 }, { t: MATCH_T, name: 'hook-c-match', gain: 0.9 });

  // ---- nişangâh arama yolu (tohumlu) ----
  const hunt = (i, t) => {
    const step = 0.2 + 0.05 * i, n = Math.floor(t / step), f = (t - n * step) / step;
    const pt = (k) => [lerp(140, 940, hash01(k * 3 + 1, 70 + i)), lerp(640, 1420, hash01(k * 3 + 2, 70 + i)), lerp(90, 170, hash01(k * 3 + 3, 70 + i))];
    const a = pt(n), b = pt(n + 1), e = ease.outExpo(clamp(f * 1.6));
    return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
  };
  const bracket = (g, x0, y0, x1, y1, len, col, lw) => {
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'square'; g.beginPath();
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) { g.moveTo(x, y + sy * len); g.lineTo(x, y); g.lineTo(x + sx * len, y); }
    g.stroke();
  };

  const target = { lat: world.map.lat0, lon: world.map.lon0 };
  const fmt = (v, hemi, t, seed, settleT) => {
    // derece° dakika.binde′ — rakamlar soldan sağa sırayla oturur (önce akar)
    const a = Math.abs(v), d = Math.floor(a), m = ((a - d) * 60).toFixed(3).padStart(6, '0');
    const s = `${String(d).padStart(2, '0')}°${m}′${hemi}`;
    const fi = Math.floor(t * 30);
    let out = '', di = 0;
    for (const ch of s) {
      if (/\d/.test(ch)) { const fixAt = di < 2 ? -1 : settleT + (di - 2) * 0.17; /* derece hep sabit (41° / 28°): dakikalar akar */ out += t >= fixAt ? ch : String(Math.floor(hash01(fi * 13 + di, seed) * 10)); di++; }
      else out += ch;
    }
    return out;
  };

  let measured = false;
  function update(t) {
    if (!measured) { for (const x of tags) { x.rest.textContent = x.L.name; x.w = x.el.offsetWidth; x.hh = x.el.offsetHeight; } measured = true; }
    const out = range(t, gEnd, gEnd + FADE, ease.inOutCubic);
    const vis = snap(1 - out);
    el.style.opacity = vis.toFixed(4);
    el.style.display = vis <= 0 ? 'none' : '';
    if (vis <= 0) return;
    const cam = camAt(t);
    world.drawMap(mg, cam);
    const uiOut = range(t, END - 0.2, END + 0.15, ease.inCubic);
    const hudOn = 1 - uiOut;
    const found = range(t, MATCH_T, MATCH_T + 0.6, ease.outCubic);

    // koyulaştırma: tarama kolunun arkasında aydınlık iz; eşleşmede harita normale döner
    const th = sweepAng(t), trail = 1.7;
    dg.setTransform(1, 0, 0, 1, 0, 0); dg.globalCompositeOperation = 'source-over'; dg.clearRect(0, 0, W, H);
    dg.fillStyle = alpha(C.night, lerp(0.66, 0.12, Math.max(found, uiOut))); dg.fillRect(0, 0, W, H);
    if (hudOn > 0) {
      dg.globalCompositeOperation = 'destination-out';
      const cg = dg.createConicGradient(th - trail, SC[0], SC[1]);
      const fr = trail / (2 * Math.PI);
      cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(fr * 0.6, 'rgba(0,0,0,0.25)'); cg.addColorStop(fr, `rgba(0,0,0,${(0.9 * hudOn * (1 - found)).toFixed(3)})`);
      cg.addColorStop(Math.min(1, fr + 0.0005), 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      dg.fillStyle = cg; dg.fillRect(0, 0, W, H);
      dg.globalCompositeOperation = 'source-over';
    }

    // pembe alanlar: arama evresinde sönük; kol geçince "temas" parlaması; kilitte tam pembe
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, W, H);
    LM.forEach((L, i) => {
      const lk = t - LOCK_T[i];
      const ss = sinceSweep(t, lmAng[i]);
      const ping = lk < 0 ? Math.exp(-ss * 4) : 0;
      const locked = range(lk, 0, 0.12, ease.outCubic);
      const breath = 0.5 + 0.5 * Math.sin(t * 3.2 + i);
      world.drawLandmark(lg, cam, L, {
        fill: lerp(0.38 + 0.55 * ping, 1, locked), glow: lerp(0.15 + 0.8 * ping, 0.55 + 0.3 * breath, locked) + (lk >= 0 ? 0.5 * (1 - range(lk, 0, 0.4)) : 0),
        flash: lk >= 0 ? 0.7 * (1 - range(lk, 0, 0.25, ease.outCubic)) : 0.35 * ping * ping, edge: 0.5 });
    });

    // HUD
    hg.setTransform(1, 0, 0, 1, 0, 0); hg.clearRect(0, 0, W, H);
    hg.globalAlpha = hudOn;
    // mesafe halkaları + eksenler
    const mPx = cam.s;                                   // px / m
    hg.strokeStyle = alpha(C.ink, 0.22); hg.lineWidth = 1.5; hg.setLineDash([2, 8]);
    for (const r of [250, 500, 750]) { hg.beginPath(); hg.arc(SC[0], SC[1], r * mPx, 0, Math.PI * 2); hg.stroke(); }
    hg.setLineDash([]);
    hg.strokeStyle = alpha(C.ink, 0.14);
    hg.beginPath(); hg.moveTo(SC[0], 230); hg.lineTo(SC[0], 1700); hg.moveTo(40, SC[1]); hg.lineTo(W - 40, SC[1]); hg.stroke();
    hg.font = `600 22px ${FONT.mono}`; hg.fillStyle = alpha(C.ink, 0.5); hg.textAlign = 'left';
    for (const r of [250, 500]) hg.fillText(`${r} m`, SC[0] + 8, SC[1] - r * mPx - 8);
    // tarama kolu (eşleşmede söner) + kolun arkasında pembe ışık izi
    const armA = hudOn * (1 - found);
    if (armA > 0) {
      const pg = hg.createConicGradient(th - 0.9, SC[0], SC[1]), fr2 = 0.9 / (2 * Math.PI);
      pg.addColorStop(0, alpha(C.pink, 0)); pg.addColorStop(fr2, alpha(C.pink, 0.13 * armA)); pg.addColorStop(Math.min(1, fr2 + 0.0005), alpha(C.pink, 0)); pg.addColorStop(1, alpha(C.pink, 0));
      hg.fillStyle = pg; hg.fillRect(0, 0, W, H);
      const R = 1500;
      hg.save(); hg.globalAlpha = armA;
      hg.strokeStyle = alpha(C.ink, 0.85); hg.lineWidth = 2.5; hg.shadowColor = C.pink; hg.shadowBlur = 18;
      hg.beginPath(); hg.moveTo(SC[0], SC[1]); hg.lineTo(SC[0] + Math.cos(th) * R, SC[1] + Math.sin(th) * R); hg.stroke();
      hg.restore();
      hg.globalAlpha = hudOn;
    }
    // merkez
    hg.fillStyle = C.pink; hg.beginPath(); hg.arc(SC[0], SC[1], 6, 0, Math.PI * 2); hg.fill();
    // nirengi: üç alan birbirine bağlanır, merkez işaretlenir
    const ctr = LM.map((L) => world.project(cam, L.c[0], L.c[1], L.top * 0.5));
    const tp = range(t, TRI_T, TRI_T + 0.6, ease.inOutCubic);
    if (tp > 0) {
      hg.strokeStyle = alpha(C.pink, 0.9); hg.lineWidth = 2.5; hg.setLineDash([10, 8]);
      let remain = tp * 3;
      hg.beginPath(); hg.moveTo(ctr[0][0], ctr[0][1]);
      for (let i = 0; i < 3 && remain > 0; i++) { const a = ctr[i], b = ctr[(i + 1) % 3], f = Math.min(1, remain); hg.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f)); remain -= 1; }
      hg.stroke(); hg.setLineDash([]);
      const cx = (ctr[0][0] + ctr[1][0] + ctr[2][0]) / 3, cy = (ctr[0][1] + ctr[1][1] + ctr[2][1]) / 3;
      const cp = range(t, TRI_T + 0.5, TRI_T + 0.8, ease.outBack);
      if (cp > 0) {
        hg.save(); hg.translate(cx, cy); hg.scale(cp, cp);
        hg.strokeStyle = C.ink; hg.lineWidth = 3;
        hg.beginPath(); hg.arc(0, 0, 26, 0, Math.PI * 2); hg.moveTo(-44, 0); hg.lineTo(-14, 0); hg.moveTo(14, 0); hg.lineTo(44, 0); hg.moveTo(0, -44); hg.lineTo(0, -14); hg.moveTo(0, 14); hg.lineTo(0, 44); hg.stroke();
        hg.restore();
      }
      // eşleşme halkası
      if (found > 0) {
        hg.strokeStyle = alpha(C.pink, 0.9 * (1 - found)); hg.lineWidth = 4;
        hg.beginPath(); hg.arc(cx, cy, 30 + 420 * found, 0, Math.PI * 2); hg.stroke();
      }
    }
    // nişangâhlar
    LM.forEach((L, i) => {
      const lk = t - LOCK_T[i];
      const box = world.screenBox(cam, L);
      const pad = 22;
      const T0 = [box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad];
      const hp = hunt(i, t);
      const H0 = [hp[0] - hp[2] / 2, hp[1] - hp[2] / 2, hp[0] + hp[2] / 2, hp[1] + hp[2] / 2];
      const k = range(lk, -0.16, 0, ease.inOutCubic);
      const tight = lk >= 0 ? 1 + 0.12 * Math.exp(-lk * 12) * Math.cos(lk * 40) : 1;
      const cxB = lerp((H0[0] + H0[2]) / 2, (T0[0] + T0[2]) / 2, k), cyB = lerp((H0[1] + H0[3]) / 2, (T0[1] + T0[3]) / 2, k);
      const hw = lerp((H0[2] - H0[0]) / 2, (T0[2] - T0[0]) / 2, k) * tight, hh2 = lerp((H0[3] - H0[1]) / 2, (T0[3] - T0[1]) / 2, k) * tight;
      const appear = range(t, 0.0 + i * 0.08, 0.12 + i * 0.08);
      hg.globalAlpha = hudOn * appear;
      const col = lk >= 0 ? C.pink : alpha(C.ink, 0.85);
      bracket(hg, cxB - hw, cyB - hh2, cxB + hw, cyB + hh2, Math.min(28, hw * 0.5), col, lk >= 0 ? 4 : 2.5);
      if (lk < 0) { // arama artısı
        hg.strokeStyle = alpha(C.ink, 0.6); hg.lineWidth = 1.5; hg.beginPath();
        hg.moveTo(cxB - 10, cyB); hg.lineTo(cxB + 10, cyB); hg.moveTo(cxB, cyB - 10); hg.lineTo(cxB, cyB + 10); hg.stroke();
      }
      hg.globalAlpha = hudOn;
      // etiket
      const tg = tags[i];
      if (lk < 0.05) { tg.el.style.display = 'none'; return; }
      tg.el.style.display = '';
      const x = tg.side === 'right' ? cxB + hw + 16 : cxB - hw - 16 - tg.w;
      const y = clamp(cyB - hh2 + 4, SAFE.top + 350, SAFE.bottom - 120);
      tg.el.style.transform = `translate(${clamp(x, 30, W - 30 - tg.w).toFixed(1)}px, ${y.toFixed(1)}px)`;
      tg.el.style.opacity = (range(lk, 0.05, 0.12) * hudOn).toFixed(4);
      const n = clamp(Math.floor((lk - 0.08) * 40), 0, L.name.length);
      tg.name.textContent = L.name.slice(0, n); tg.rest.textContent = L.name.slice(n);
      const pc = Math.round(lerp(61, [97, 94, 98][i], range(lk, 0.08, 0.5, ease.outCubic)));
      tg.pct.textContent = `%${pc}`;
    });
    hg.globalAlpha = 1;

    // üst bant
    const phase = t < LOCK_T[0] - 0.1 ? 0 : t < MATCH_T ? 1 : 2;
    status.textContent = ['KONUM ARANIYOR', 'KİLİTLENİYOR', 'EŞLEŞME BULUNDU'][phase];
    status.style.color = phase === 2 ? C.pink : C.ink;
    dot.style.opacity = (phase === 2 ? 1 : 0.35 + 0.65 * (Math.floor(t * 4) % 2)).toFixed(2);
    chipS.style.opacity = hudOn.toFixed(4);
    chipS.style.transform = `scale(${(1 + (t >= MATCH_T ? 0.12 * Math.sin(clamp((t - MATCH_T) / 0.35) * Math.PI) : 0)).toFixed(4)})`;
    chipS.style.transformOrigin = '0 50%';
    latEl.textContent = fmt(target.lat, 'K', t, 11, LOCK_T[0]);
    lonEl.textContent = fmt(target.lon, 'D', t, 12, LOCK_T[1] + 0.1);
    coordEl.style.opacity = hudOn.toFixed(4);

    // soru
    const qOut = range(t, Q_OUT - 0.22, Q_OUT, ease.inCubic);
    question.style.opacity = (1 - qOut).toFixed(4);
    question.style.transform = `translateY(${(-18 * qOut).toFixed(2)}px) scale(${lerp(1.04, 1, range(t, 0, 0.6, ease.outCubic)).toFixed(5)})`;
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
  }

  return { el, update, sfx, backdrop: false, extend: { after: gEnd - ctx.end + FADE },
    subtitles: (tl) => tl >= Q_OUT - 0.05, subtitleY: 400 };
}
