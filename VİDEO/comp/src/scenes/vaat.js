// vaat — "Evet, bu güzel ve kaotik semtin simülasyonunu Claude Code kullanarak gerçekleştirdim. Üstelik bunu nasıl yaptığım,
// ortaya çıkan sonuç kadar ilginç. Sonucu görmek için videonun sonuna kadar bekle."
// Kodla üretilmiş sahneden kareler polaroid çerçeveyle ikişer ikişer düşer (her düşüş bir kelimeye bağlı, deklanşör + çarpma).
// "Sonucu görmek için…"de yığın kenarlara açılır, ortaya henüz BANYO EDİLMEMİŞ (bulanık, perdeli) son polaroid düşer:
// asıl sonuç videonun sonunda. Kök saydam: arkada ortak topografya fonu. Her şey t'nin saf fonksiyonu.
import { C, FONT, SAFE, W, H, alpha, clamp, ease, lerp, range } from '../theme.js';
import { h } from '../kit.js';

const PW = 410, PAD = 20, PB = 82;                 // polaroid: genişlik, kenar, alt pay
const IW = PW - 2 * PAD, IH = Math.round(IW * 4 / 3), PH = PAD + IH + PB;
const FW = 540, FPAD = 24, FB = 104;               // son (büyük) polaroid
const FIW = FW - 2 * FPAD, FIH = Math.round(FIW * 4 / 3), FH = FPAD + FIH + FB;
const CPS = 30;
const OUT = 0.45;                                  // sahne sınırından sonra solma süresi
/** Tam ekran katman solması: 1'e/0'a çok yakın saydamlıklar tam değere yuvarlanır (GPU harmanlama yuvarlaması kareyi oynatmasın). */
const snap = (o) => (o > 0.985 ? 1 : o < 0.015 ? 0 : o);
const CHIP = 'CLAUDE CODE İLE ÜRETİLDİ — FOTOĞRAF DEĞİL, KOD';

export async function create(ctx) {
  const at = (w, fb, n = 0) => ctx.at(w, n)?.start ?? fb;
  const D = ctx.duration;
  // Düşüş anları (yerel sn) — kelimelere bağlı
  const tGuzel = at('güzel', 0.55), tKaotik = at('kaotik', 0.97), tSim = at('simülasyonunu', 1.89), tClaude = at('Claude', 2.65),
    tGer = at('gerçekleştirdim', 3.61), tUst = at('Üstelik', 5.42), tNasil = at('nasıl', 5.87), tOrtaya = at('ortaya', 6.55),
    tSonuc = at('sonuç', 7.13), tSonucu = at('Sonucu', 8.75), tVideonun = at('videonun', 9.51), tBekle = at('bekle', 10.27);
  const SHOTS = [
    { f: 'p1-gunbatimi.jpg', cap: 'gün batımı', T: tGuzel, x: 290, y: 628, r: -5 },
    { f: 'p2-trafik.jpg', cap: 'akşam trafiği', T: tKaotik, x: 782, y: 668, r: 4 },
    { f: 'p3-kule-gunduz.jpg', cap: 'gündüz', T: tSim, x: 318, y: 872, r: 3.5 },
    { f: 'p4-yansima.jpg', cap: 'cam yansıması', T: tSim + 0.36, x: 768, y: 846, r: -4.5 },
    { f: 'p9-sehir-aksam.jpg', cap: 'akşamüstü', T: tGer, x: 262, y: 640, r: 2.5 },
    { f: 'p5-mavi-saat.jpg', cap: 'mavi saat', T: tGer + 0.36, x: 800, y: 612, r: -3 },
    { f: 'p6-gece-genel.jpg', cap: 'gece', T: tUst, x: 300, y: 870, r: -3.5 },
    { f: 'p7-torun-ay.jpg', cap: 'dolunay', T: tNasil, x: 790, y: 884, r: 5 },
    { f: 'p10-kule-isik.jpg', cap: 'ışıklar', T: tOrtaya, x: 336, y: 742, r: -2 },
    { f: 'p8-isik-izleri.jpg', cap: 'ışık izleri', T: tSonuc, x: 748, y: 760, r: 2.5 },
  ];
  // Son polaroid "ilginç." ile "Sonucu" arasındaki duraklamaya düşer (çarpma sesi sözün üstüne binmesin)
  const TF = tSonucu - 0.22, TS = TF - 0.5;         // son polaroidin düşüşü, yığının açılması
  const [imgs, finalImg, tl] = await Promise.all([
    Promise.all(SHOTS.map((sh) => ctx.image(sh.f))), ctx.image('son-kapak.jpg'), ctx.json('work/timeline.json').catch(() => null),
  ]);
  // Sonucun videodaki yeri (zaman çizelgesinden; uydurma değil)
  const total = tl?.totalDuration ?? 152, fin = tl?.scenes?.find((x) => x.id === 'final');
  const finalStart = fin?.start ?? total * 0.79;
  const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

  const el = h('div', { class: 'scene' });
  const vig = h('div', { class: 'abs', style: { inset: '0', background: `radial-gradient(85% 62% at 50% 40%, ${alpha(C.night, 0.18)} 0%, ${alpha(C.night, 0.6)} 100%)` } });
  const pile = h('div', { class: 'abs', style: { inset: '0' } });
  el.append(vig, pile);

  const shadow = (lift) => `0 2px 0 ${alpha(C.night, 0.18)}, 0 ${(18 + 60 * lift).toFixed(1)}px ${(44 + 90 * lift).toFixed(1)}px ${alpha(C.night, 0.62 - 0.2 * lift)}`;
  const pols = SHOTS.map((sh, i) => {
    const img = imgs[i];
    Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover' });
    const flash = h('div', { class: 'abs', style: { inset: '0', background: C.ink } });
    const photo = h('div', { class: 'abs', style: { left: PAD + 'px', top: PAD + 'px', width: IW + 'px', height: IH + 'px', overflow: 'hidden', background: C.night,
      boxShadow: `inset 0 0 0 1px ${alpha(C.night, 0.3)}` } }, img, flash);
    const cap = h('div', { class: 'abs', lang: 'tr', style: { left: PAD + 4 + 'px', right: PAD + 4 + 'px', bottom: '0', height: PB + 'px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', color: C.paperInk, font: `600 30px/1 ${FONT.display}`, letterSpacing: '-0.01em' } },
    sh.cap, h('span', { style: { font: `500 24px/1 ${FONT.mono}`, color: alpha(C.paperInk, 0.6), letterSpacing: '0.02em' } }, String(i + 1).padStart(2, '0')));
    const veil = h('div', { class: 'abs', style: { inset: '0', background: C.night, borderRadius: '5px', opacity: '0' } });
    const frame = h('div', { class: 'abs', style: { left: -PW / 2 + 'px', top: -PH / 2 + 'px', width: PW + 'px', height: PH + 'px', background: C.paper, borderRadius: '5px' } }, photo, cap, veil);
    const wrap = h('div', { class: 'abs', style: { left: '0', top: '0', width: '0', height: '0' } }, frame);
    pile.append(wrap);
    // son düzen: iki yanda küçük şeritler
    const row = Math.floor(i / 2), left = i % 2 === 0;
    const sx = left ? 132 : W - 132, sy = 402 + row * 157, sr = (left ? -1 : 1) * (3 + (row % 2) * 2.5) * (row % 2 ? -1 : 1);
    return { ...sh, i, img, flash, veil, frame, wrap, cap, sx, sy, sr };
  });

  // ---- son polaroid: henüz banyo edilmemiş ----
  Object.assign(finalImg.style, { position: 'absolute', left: '-4%', top: '-4%', width: '108%', height: '108%', objectFit: 'cover' });
  const fVeil = h('div', { class: 'abs', style: { inset: '0', background: `linear-gradient(160deg, ${C.navy3} 0%, ${C.forest} 45%, ${C.navy2} 100%)` } });
  const BARW = 380;
  const k0 = clamp(finalStart / total);
  const barDone = h('div', { class: 'abs', style: { left: '0', top: '-1px', height: '6px', borderRadius: '3px', background: C.ink } });
  const barFinal = h('div', { class: 'abs', style: { left: BARW * k0 + 'px', width: BARW * (1 - k0) + 'px', top: '-3px', height: '10px', borderRadius: '5px', background: C.pink } });
  const head = h('div', { class: 'abs', style: { top: '-9px', width: '22px', height: '22px', marginLeft: '-11px', borderRadius: '50%', background: C.ink, boxShadow: `0 0 0 4px ${alpha(C.night, 0.45)}` } });
  const bar = h('div', { style: { position: 'relative', width: BARW + 'px', height: '4px', borderRadius: '2px', background: alpha(C.ink, 0.28), margin: '34px 0 0' } }, barDone, barFinal, head);
  const barLbl = h('div', { style: { position: 'relative', width: BARW + 'px', height: '30px', marginTop: '18px', font: `600 24px/1 ${FONT.mono}`, letterSpacing: '0.06em', color: C.dim } },
    h('span', { class: 'abs', lang: 'tr', style: { left: '0' } }, 'ŞİMDİ'), h('span', { class: 'abs t-num', style: { right: '0', color: C.pink } }, `SONUÇ ${mmss(finalStart)}`));
  const fTitle = h('div', { style: { font: `800 76px/1 ${FONT.display}`, letterSpacing: '-0.02em', color: C.ink } }, 'Sonuç');
  const fSub = h('div', { lang: 'tr', style: { marginTop: '14px', font: `600 24px/1 ${FONT.mono}`, letterSpacing: '0.14em', color: C.pink } }, 'VİDEONUN SONUNDA');
  const fInfo = h('div', { class: 'abs', style: { inset: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } }, fTitle, fSub, bar, barLbl);
  const fFlash = h('div', { class: 'abs', style: { inset: '0', background: C.ink } });
  const fPhoto = h('div', { class: 'abs', style: { left: FPAD + 'px', top: FPAD + 'px', width: FIW + 'px', height: FIH + 'px', overflow: 'hidden', background: C.night } }, finalImg, fVeil, fInfo, fFlash);
  const dots = [0, 1, 2].map(() => h('i', { style: { width: '9px', height: '9px', borderRadius: '50%', background: C.paperInk, display: 'block' } }));
  const fCap = h('div', { class: 'abs', lang: 'tr', style: { left: FPAD + 6 + 'px', right: FPAD + 6 + 'px', bottom: '0', height: FB + 'px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    color: C.paperInk, font: `600 34px/1 ${FONT.display}`, letterSpacing: '-0.01em' } },
  h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '14px' } }, 'banyo ediliyor', h('span', { style: { display: 'inline-flex', gap: '7px', paddingTop: '10px' } }, dots)),
  h('span', { style: { font: `500 24px/1 ${FONT.mono}`, color: alpha(C.paperInk, 0.6), letterSpacing: '0.04em' } }, 'SON KARE'));
  const fFrame = h('div', { class: 'abs', style: { left: -FW / 2 + 'px', top: -FH / 2 + 'px', width: FW + 'px', height: FH + 'px', background: C.paper, borderRadius: '6px' } }, fPhoto, fCap);
  const fWrap = h('div', { class: 'abs', style: { left: '0', top: '0', width: '0', height: '0' } }, fFrame);
  el.append(fWrap);

  // ---- "Claude Code" satırı (yalnız metin) ----
  const typed = h('span'), cur = h('span', { style: { color: C.pink } }, '▌');
  const chip = h('div', { class: 'chip abs', lang: 'tr', style: { left: SAFE.left + 'px', top: SAFE.top + 18 + 'px', background: C.glassStrong, textTransform: 'none', fontSize: '25px', letterSpacing: '0.04em', gap: '12px', padding: '14px 20px' } },
    h('span', { class: 'dot' }), h('span', {}, typed, cur));
  const screenFlash = h('div', { class: 'abs', style: { inset: '0', background: C.ink, opacity: '0', pointerEvents: 'none' } });
  el.append(chip, screenFlash);

  // ---- ses ----
  const sfx = [];
  // Düşüşler kelime başlarına denk gelir → düzeyler seslendirmenin belirgin altında
  pols.forEach((p) => { sfx.push({ t: +(p.T - 0.04).toFixed(3), name: 'shutter', gain: 0.26 }, { t: +p.T.toFixed(3), name: 'drop', gain: 0.34 }); });
  for (let i = 0; i < CHIP.length; i += 3) sfx.push({ t: +(tClaude + i / CPS).toFixed(3), name: `type-${(i / 3) % 3 + 1}`, gain: 0.15 });
  sfx.push({ t: TS + 0.05, name: 'whoosh-short', gain: 0.26 }, { t: TF - 0.06, name: 'shutter', gain: 0.4 }, { t: TF, name: 'thud', gain: 0.36 }, { t: tBekle, name: 'ping', gain: 0.26 });

  const FALL = 0.24;
  function update(t, tg) {
    const m = range(t, TS, TS + 0.6, ease.inOutCubic);              // yığın → kenar şeritleri
    let fl = 0;
    pols.forEach((p) => {
      const dt = t - p.T;
      if (dt < -FALL) { p.wrap.style.display = 'none'; return; }
      p.wrap.style.display = '';
      const fall = range(dt, -FALL, 0, ease.inCubic);                 // hızlanarak düşer
      const hit = dt >= 0 ? Math.exp(-dt * 11) * Math.sin(dt * 34) : 0; // çarpma esnemesi
      const life = Math.max(0, dt);
      const sway = Math.sin(life * 0.8 + p.i * 1.7);
      const x = lerp(p.x, p.sx, m), y = lerp(p.y + sway * 2.5, p.sy, m) - (1 - fall) * 60;
      const r = lerp(p.r + sway * 0.35, p.sr, m) + (1 - fall) * (p.i % 2 ? 9 : -9) + hit * 0.9;
      const sc = lerp(1.6, 1, fall) * (1 - hit * 0.022) * lerp(1, 0.6, m);
      p.wrap.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(5)})`;
      p.wrap.style.opacity = range(dt, -FALL, -FALL + 0.07).toFixed(3);
      p.frame.style.boxShadow = shadow(1 - fall);
      // alt yazı kare oturunca belirir; yığın açılırken silinir (hareket halindeki küçük yazı çizilmez)
      p.cap.style.opacity = (range(dt, 0, 0.12) * (1 - range(t, TS - 0.1, TS))).toFixed(4);
      p.img.style.transform = `scale(${(1.12 - 0.012 * Math.min(life, 8)).toFixed(5)})`;
      const f = dt < -0.02 ? 0 : 1 - range(dt, 0, 0.42, ease.outCubic);
      p.flash.style.opacity = (0.92 * f).toFixed(4);
      fl = Math.max(fl, dt < 0 ? 0 : 1 - range(dt, 0, 0.16));
      // üstüne yeni kareler geldikçe eskiler bir kademe koyulaşır; sonda hepsi geri çekilir
      const later = pols.filter((q) => q.i > p.i + 1 && Math.floor(q.i / 2) > Math.floor(p.i / 2) && t >= q.T).length;
      p.veil.style.opacity = lerp(Math.min(0.26, later * 0.07), 0.5, m).toFixed(4);
    });

    // son polaroid
    const fdt = t - TF;
    if (fdt < -FALL) fWrap.style.display = 'none';
    else {
      fWrap.style.display = '';
      const fall = range(fdt, -FALL, 0, ease.inCubic);
      const hit = fdt >= 0 ? Math.exp(-fdt * 10) * Math.sin(fdt * 30) : 0;
      const life = Math.max(0, fdt);
      fWrap.style.transform = `translate(540px, ${(716 - (1 - fall) * 70).toFixed(2)}px) rotate(${(-1.6 + (1 - fall) * 7 + hit * 0.8 + Math.sin(life * 0.7) * 0.25).toFixed(3)}deg) scale(${(lerp(1.5, 1, fall) * (1 - hit * 0.02) * (1 + 0.006 * life)).toFixed(5)})`;
      fWrap.style.opacity = range(fdt, -FALL, -FALL + 0.07).toFixed(3);
      fFrame.style.boxShadow = shadow(1 - fall);
      fCap.style.opacity = range(fdt, 0, 0.14).toFixed(4);
      fFlash.style.opacity = (fdt < -0.02 ? 0 : 0.92 * (1 - range(fdt, 0, 0.45, ease.outCubic))).toFixed(4);
      fl = Math.max(fl, fdt < 0 ? 0 : 1 - range(fdt, 0, 0.18));
      // yavaş yavaş beliriyor ama bitmiyor: perde %100 → %60, bulanıklık 26 → 14 px
      const dev = range(t, TF + 0.2, D, ease.outCubic);
      fVeil.style.opacity = lerp(1, 0.5, dev).toFixed(4);
      finalImg.style.filter = `blur(${lerp(26, 14, dev).toFixed(2)}px) saturate(${lerp(0.5, 0.85, dev).toFixed(3)})`;
      // bilgi: "videonun" ile başlık + zaman çubuğu
      const a = range(t, tVideonun - 0.25, tVideonun + 0.1, ease.outCubic);
      fTitle.style.opacity = range(fdt, 0.1, 0.4).toFixed(4);
      fTitle.style.transform = `translateY(${((1 - range(fdt, 0.1, 0.5, ease.outCubic)) * 14).toFixed(2)}px)`;
      fSub.style.opacity = a.toFixed(4);
      const grow = range(t, tVideonun, tVideonun + 0.6, ease.inOutCubic);
      bar.style.opacity = barLbl.style.opacity = a.toFixed(4);
      bar.style.clipPath = `inset(-20px ${((1 - grow) * 100).toFixed(2)}% -20px -20px)`;
      const now = clamp((tg ?? ctx.start + t) / total);
      barDone.style.width = (BARW * now).toFixed(2) + 'px';
      head.style.left = (BARW * now).toFixed(2) + 'px';
      const pulse = t >= tBekle ? 0.5 + 0.5 * Math.cos((t - tBekle) * 7) * Math.exp(-(t - tBekle) * 1.6) : 0;
      barFinal.style.boxShadow = `0 0 ${(10 + 22 * pulse).toFixed(1)}px ${alpha(C.pink, 0.55 + 0.4 * pulse)}`;
      barFinal.style.transform = `scaleY(${(1 + 0.5 * pulse).toFixed(4)})`;
      dots.forEach((d, i) => { d.style.opacity = (0.25 + 0.75 * clamp(Math.sin((life * 2.6 - i * 0.7)) * 0.5 + 0.5)).toFixed(3); });
    }

    // "Claude Code" satırı
    const cd = t - tClaude;
    chip.style.opacity = range(cd, -0.14, 0).toFixed(4);
    chip.style.transform = `translateY(${((1 - range(cd, -0.14, 0.04, ease.outCubic)) * -10).toFixed(2)}px)`;
    const n = clamp(Math.floor(cd * CPS), 0, CHIP.length);
    typed.textContent = CHIP.slice(0, n);
    const after = cd - CHIP.length / CPS;
    cur.style.visibility = after < 0 || (after < 1.2 && after % 0.4 < 0.22) ? 'visible' : 'hidden';

    screenFlash.style.opacity = (0.09 * fl).toFixed(4);
    vig.style.opacity = snap(range(t, 0, 0.5)).toFixed(4);
    // sahne sonu: sınıra kadar ekranda kalır, sonraki sahnenin girişi altında solar (extend.after) → arada boş kare yok
    const out = range(t, D, D + OUT, ease.inOutCubic);
    el.style.opacity = snap(1 - out).toFixed(4);
  }

  return { el, update, sfx, extend: { after: OUT } };
}
