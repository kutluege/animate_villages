// final — sessiz kapanış. Sahne, sonuc'un son cümlesinin üstüne erken girer (extend.before): iki pencere ortadaki dikişten
// açılır; içlerinde buzlu cam ardında ön görüntü ve başlıklar birlikte gelir, ortada bir ışık çizgisi yanar ve t = 0'da
// perde bu çizgiden iki yana açılır (yumuşak kenar + iki ince ışık çizgisi).
// (1) Kıyas: iki ekibin videosu yan yana, ekranı dolduran iki uzun pencere (videonun orta %65'i, 3/4 ölçek, 1:1 piksel);
//     başlık şeridi ve an etiketi güvenli alanda, pencereler arayüz bölgelerinin altına da uzanır. Seçilen kadro işaretlidir.
//     Üç karşılaştırılabilir an: gün batımı / alacakaranlık / gece.
// (2) Kazanan (Fable general · Opus askerler) penceresi tam ekrana büyür. Kıyasta görülmemiş kesitler: gün batımı ufku →
//     kuledeki yansıma → alacakaranlık → ışıklar → gece → kapanış karesi; son saniyelerde çok hafif yaklaşma + kapak başlığı.
// Kaynak videolar kare dizisidir (comp/assets/final/*, bkz. SOURCES.md).
import { C, TEAM, FONT, alpha, clamp, ease, lerp, range } from '../theme.js';
import { coordLabel, h } from '../kit.js';
import { NAMES, PANEL, panelFrame, starIcon } from './senaryo.js';

const f2 = (x) => Number(x).toFixed(3);
const setText = (el, txt) => { if (el.textContent !== txt) el.textContent = txt; };

// ---- kurgu (yerel saniye; t < 0 = sonuc'un son cümlesi) ----
export const PRE = 2.6;                     // erken giriş
const BEAT = 3.2, XF = 0.4;                 // kıyas: 3 an × 3,2 sn, aralarında 0,4 sn geçiş
const CMP_END = 3 * BEAT;                   // 9,6
const GROW = [CMP_END + 0.05, CMP_END + 1.25]; // kazanan pencere tam ekrana büyür
const LEN = { a: 5.6, b: 7.5, c: 8.5 }, DISS = 0.8; // kazanan parçaları (sn) ve aralarındaki erime
const WIN_A = CMP_END, WIN_B = WIN_A + LEN.a - DISS, WIN_C = WIN_B + LEN.b - DISS;
const WIN_END = WIN_C + LEN.c;              // kaynak videonun son karesi (29,6); sonrası kapak
const BEATS = ['GÜN BATIMI', 'ALACAKARANLIK', 'GECE'];
const BD = 2, IW = PANEL.w - 2 * BD, IH = PANEL.h - 2 * BD; // iç alan 528×1440 = kıyas karelerinin boyutu
const FEATHER = 22;                         // perde kenarının yumuşaklığı (px)

export async function create(ctx) {
  const names = ['f1', 'f2', 'f3', 'o1', 'o2', 'o3', 'wa', 'wb', 'wc'];
  const seqs = {};
  for (const n of names) seqs[n] = await ctx.frames(n);
  const stillO = await ctx.image('teaser-o.jpg'), stillF = await ctx.image('teaser-f.jpg');
  // Her görsel kendi piksel boyutunda (1:1) durur; ölçek gerekirse bileşimci verir → kare her koşulda aynı.
  const fixed = (img, w, hh) => { img.decoding = 'sync'; Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: hh + 'px', maxWidth: 'none' }); return img; };
  const small = (seq) => fixed(seq.el, IW, IH), native = (seq) => fixed(seq.el, 1080, 1920);

  const el = h('div', { class: 'scene' });
  const pO = panelFrame(PANEL.xL, PANEL.y), pF = panelFrame(PANEL.xR, PANEL.y);
  const box = { left: '0', top: '0', width: IW + 'px', height: IH + 'px' };
  const curtO = h('div', { class: 'abs', style: box }, small(seqs.o1), small(seqs.o2), small(seqs.o3));
  const curtF = h('div', { class: 'abs', style: box }, small(seqs.f1), small(seqs.f2), small(seqs.f3));
  const winBox = h('div', { class: 'abs', style: { left: '0', top: '0', width: '1080px', height: '1920px', transformOrigin: '0 0', willChange: 'transform' } }, native(seqs.wa), native(seqs.wb), native(seqs.wc));
  const edge = () => h('div', { class: 'abs', style: { left: '0', top: '0', width: '2px', height: IH + 'px', background: C.ink, transformOrigin: '50% 50%' } });
  const edges = [edge(), edge(), edge(), edge()];

  // ---- pencere başlıkları (opak şerit: fonun yazıları araya girmez)
  const who = (general, soldiers, size = 29) => {
    const st = starIcon(Math.round(size * 0.86)); st.line.style.opacity = '0'; st.style.color = TEAM[general];
    return h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', font: `700 ${size}px/1 ${FONT.display}`, letterSpacing: '-0.015em', color: C.ink, whiteSpace: 'nowrap' } },
      st, h('span', {}, h('span', { style: { color: TEAM[general] } }, NAMES[general].split(' ')[0]), ' general',
        h('span', { style: { color: C.dim, margin: '0 9px' } }, '·'), h('span', { style: { color: TEAM[soldiers] } }, NAMES[soldiers].split(' ')[0]), ' askerler'));
  };
  const pill = (txt) => h('span', { style: { display: 'inline-block', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: C.paperInk, background: C.ink, padding: '5px 10px 6px', borderRadius: '3px', transformOrigin: '0 50%' } }, txt);
  const mine = pill('SEÇİMİM');
  const strip = (no, general, soldiers, cost, extra) => h('div', { class: 'abs', style: { left: '0', top: PANEL.stripTop + 'px', width: IW + 'px', height: PANEL.stripH + 'px', boxSizing: 'border-box', padding: '14px 16px 0', background: C.glassStrong, borderTop: `1.5px solid ${C.hair}`, borderBottom: `1.5px solid ${C.hair}` } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', height: '36px' } }, coordLabel(`SENARYO ${no}`, { size: 26 }), extra,
      h('span', { class: 't-num', style: { marginLeft: 'auto', font: `700 26px/1 ${FONT.mono}`, letterSpacing: '0.02em', color: C.ink, padding: '4px 9px 5px', border: `1.5px solid ${C.hair}`, borderRadius: '3px' } }, cost)),
    h('div', { style: { height: '10px' } }), who(general, soldiers));
  const stripO = strip('01', 'opus', 'fable', '$150', null), stripF = strip('02', 'fable', 'opus', '$90', mine);
  const mark = h('div', { class: 'abs', style: { left: '0', top: PANEL.stripTop + 'px', width: IW + 'px', height: '4px', background: C.ink, transformOrigin: '0 50%' } }); // seçilen pencerenin başlık çizgisi
  const innerO = h('div', { class: 'abs', style: box }, fixed(stillO, IW, IH), curtO, edges[0], edges[1], stripO);
  const innerF = h('div', { class: 'abs', style: box }, fixed(stillF, IW, IH), curtF, edges[2], edges[3], stripF, mark);
  pO.body.append(innerO); pF.body.append(innerF, winBox);
  const seam = h('div', { class: 'abs', style: { left: '539px', top: PANEL.y + 'px', width: '2px', height: PANEL.h + 'px', background: C.hair, transformOrigin: '50% 50%' } });

  // ---- an etiketi (iki pencerenin ortasında, altta)
  const beatName = h('div', { style: { font: `700 28px/1 ${FONT.mono}`, letterSpacing: '0.16em', color: C.ink } });
  const segs = BEATS.map(() => { const f = h('div', { style: { height: '100%', width: '0', background: C.ink } }); const b = h('div', { style: { width: '92px', height: '5px', background: alpha(C.ink, 0.22) } }, f); b.fill = f; return b; });
  const caption = h('div', { class: 'abs', style: { left: '0', top: '1358px', width: '1080px', display: 'flex', justifyContent: 'center' } },
    h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '18px 28px 18px', background: C.glassStrong, border: `1.5px solid ${C.hair}`, borderRadius: '4px', boxShadow: `0 18px 50px ${C.shadow}` } },
      h('div', { style: { display: 'flex', gap: '10px' } }, segs), beatName,
      h('div', { style: { font: `500 26px/1 ${FONT.mono}`, letterSpacing: '0.02em', color: C.dim } }, 'aynı görev · iki ekibin videosu')));

  // ---- kazanan etiketi + kapak başlığı
  const pick = h('div', { class: 'abs', style: { left: '72px', top: '244px', display: 'flex', alignItems: 'center', gap: '14px' } },
    h('div', { style: { padding: '10px 15px 11px', background: C.ink, color: C.paperInk, borderRadius: '4px', font: `700 24px/1 ${FONT.mono}`, letterSpacing: '0.12em' } }, 'SEÇİMİM'),
    h('div', { style: { padding: '8px 16px 10px', background: C.glassStrong, border: `1.5px solid ${C.hair}`, borderRadius: '4px' } }, who('fable', 'opus', 31)));
  const rule = h('div', { class: 'abs', style: { left: '0', top: '0', width: '250px', height: '3px', background: C.ink, transformOrigin: '0 50%' } });
  const titleIn = h('div', { style: { font: `800 66px/1.08 ${FONT.display}`, letterSpacing: '-0.03em', color: C.ink, whiteSpace: 'nowrap' } }, 'Mecidiyeköy');
  const title = h('div', { class: 'abs', style: { left: '-6px', top: '10px', padding: '0 6px 4px', overflow: 'hidden' } }, titleIn);
  const tagline = h('div', { class: 'abs', style: { left: '2px', top: '88px', font: `600 26px/1 ${FONT.display}`, letterSpacing: '0', color: C.ink, whiteSpace: 'nowrap' } }, 'Claude ile, kod yazarak');
  // ortadaki 1080×1080 (y 420–1500) içinde; sol gökyüzü boşluğu: x 72–468, y 434–548
  const sign = h('div', { class: 'abs', style: { left: '72px', top: '434px', width: '400px', height: '116px', filter: `drop-shadow(0 2px 14px ${C.night})` } }, rule, title, tagline);

  el.append(seam, pO, pF, caption, pick, sign);

  const show = (node, op) => { node.style.opacity = f2(op); node.style.visibility = op <= 0.002 ? 'hidden' : 'visible'; };
  /** dizi görünürse karesini göster; değilse gizle (gereksiz decode yok) */
  const play = (seq, on, sec, op = 1) => {
    seq.el.style.display = on ? 'block' : 'none';
    if (on) { seq.at(clamp(sec, 0, seq.duration - 1 / seq.fps)); seq.el.style.opacity = f2(op); }
  };
  const END = ctx.duration;

  function update(t) {
    // ---- ön hazırlık (t < 0): dikiş → pencereler açılır (içlerinde buzlu ön görüntü + başlık) → ortada ışık çizgisi
    const seamK = range(t, -2.5, -2.15, ease.inOutCubic), K = range(t, -2.25, -1.45, ease.inOutCubic);
    const wv = Math.round(PANEL.w * K);
    show(seam, seamK * (1 - range(K, 0.05, 0.3)));
    seam.style.transform = `scaleY(${f2(seamK)})`;
    const heads = range(t, -1.9, -1.4, ease.outCubic), tease = range(t, -2.1, -1.4);
    for (const st of [stillO, stillF]) { st.style.display = t < 1 ? 'block' : 'none'; st.style.opacity = f2(0.85 * tease); }

    // ---- perde: t = 0'da ışık çizgisinden iki yana açılır
    const open = range(t, 0, 0.95, ease.inOutCubic);
    const half = Math.round(open * (IW / 2 + FEATHER));
    const a = IW / 2 - half, b = IW / 2 + half;
    const mask = open >= 1 ? 'none' : `linear-gradient(90deg, ${alpha(C.night, 0)} ${a}px, ${C.night} ${a + FEATHER}px, ${C.night} ${b - FEATHER}px, ${alpha(C.night, 0)} ${b}px)`;
    for (const c of [curtO, curtF]) { c.style.display = open > 0 ? 'block' : 'none'; c.style.webkitMaskImage = mask; c.style.maskImage = mask; }
    const lit = range(t, -1.2, -0.55, ease.inOutCubic), glow = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t + 1.2) / 1.1 - Math.PI / 2);
    const edgeOp = lit * (1 - range(open, 0.72, 0.98));
    edges.forEach((e, i) => {
      const x = clamp(i % 2 ? b - FEATHER / 2 : a + FEATHER / 2, 0, IW - 2);
      e.style.left = Math.round(open > 0 ? x : IW / 2 - 1) + 'px';
      e.style.transform = `scaleY(${f2(lit)})`;
      e.style.boxShadow = `0 0 ${f2(10 + 16 * (open > 0 ? 1 : glow))}px ${alpha(C.ink, 0.75)}`;
      show(e, edgeOp);
    });

    // ---- kıyas: üç an
    for (let i = 0; i < 3; i++) {
      const b0 = i * BEAT, b1 = b0 + BEAT;
      const on = (i === 0 ? open > 0 : t >= b0 - XF / 2) && (i === 2 ? t < GROW[1] + 0.1 : t < b1 + XF / 2);
      const op = i === 0 ? 1 : range(t, b0 - XF / 2, b0 + XF / 2, ease.inOutCubic);
      const sec = t - b0 + XF / 2;
      play(seqs['o' + (i + 1)], on, sec, op);
      play(seqs['f' + (i + 1)], on && t < WIN_A + 0.6, sec, op);
      segs[i].fill.style.width = Math.round(range(t, b0, b1) * 92) + 'px';
    }
    const bi = clamp(Math.floor(t / BEAT), 0, 2), bl = t - bi * BEAT;
    setText(beatName, BEATS[bi]);
    beatName.style.opacity = f2(Math.min(range(bl, 0, 0.25), bi === 2 ? 1 : 1 - range(bl, BEAT - 0.2, BEAT)));

    // ---- kazanan: üç parça, yumuşak erime
    play(seqs.wa, t >= WIN_A && t < WIN_B + DISS, t - WIN_A, range(t, WIN_A, WIN_A + 0.5, ease.inOutCubic));
    play(seqs.wb, t >= WIN_B && t < WIN_C + DISS, t - WIN_B, range(t, WIN_B, WIN_B + DISS, ease.inOutCubic));
    play(seqs.wc, t >= WIN_C, t - WIN_C, range(t, WIN_C, WIN_C + DISS, ease.inOutCubic));

    // ---- çerçeveler
    const G = range(t, GROW[0], GROW[1], ease.inOutCubic);
    const leave = range(t, CMP_END - 0.35, CMP_END + 0.05);
    const go = range(t, CMP_END - 0.15, CMP_END + 0.5, ease.inOutCubic);
    const pw = G > 0 ? Math.round(lerp(PANEL.w, 1080, G)) : wv, ph = Math.round(lerp(PANEL.h, 1920, G)), bd = G >= 1 ? 0 : G > 0 ? 1 : BD;
    pO.style.left = PANEL.xL + PANEL.w - wv + 'px'; pO.style.width = wv + 'px';
    innerO.style.left = wv - PANEL.w + 'px';   // içerik ekranda sabit durur; pencere dikişten dışa doğru açılır
    show(pO, clamp(K * 12) * (1 - go));
    pO.style.transform = `translateX(${Math.round(-70 * go)}px)`;
    pF.style.left = Math.round(lerp(PANEL.xR, 0, G)) + 'px'; pF.style.top = Math.round(lerp(PANEL.y, 0, G)) + 'px';
    pF.style.width = pw + 'px'; pF.style.height = ph + 'px';
    show(pF, clamp(K * 12));
    // seçilen pencere: başlık çizgisi + "SEÇİMİM" + belirgin çerçeve (videoya dokunmadan)
    const mk = range(t, 1.0, 1.55);
    const chosen = mk * (1 - leave);
    mark.style.transform = `scaleX(${f2(ease.outCubic(mk))})`; show(mark, chosen);
    mine.style.transform = `scale(${f2(mk <= 0 ? 0.6 : 0.6 + 0.4 * ease.spring(mk, 7, 5))})`; mine.style.opacity = f2(clamp(mk * 3));
    pF.style.borderColor = alpha(C.ink, lerp(0.34, 0.95, chosen) * (1 - G));
    pF.style.borderWidth = bd + 'px';
    pF.style.boxShadow = G >= 1 ? 'none' : '';
    for (const tick of pF.querySelectorAll(':scope > .tick')) tick.style.opacity = f2(0.9 * (1 - range(G, 0, 0.3)));
    // tam ekranda son saniyeler: çok hafif, kesilmeyen yaklaşma (videonun kendi duraksamasını ve kapak beklemesini taşır)
    const zx = range(t, WIN_END - 2.6, END), za = 0.3, zp = zx < za ? zx * zx / (za * (2 - za)) : (2 * zx - za) / (2 - za);
    const zoom = 1 + 0.04 * zp;
    const ks = Math.max((pw - 2 * bd) / 1080, (ph - 2 * bd) / 1920);
    winBox.style.display = t >= WIN_A ? 'block' : 'none';
    winBox.style.transform = G >= 1
      ? (zoom > 1 ? `translate(${f2(-(zoom - 1) * 1080 * 0.5)}px, ${f2(-(zoom - 1) * 1920 * 0.25)}px) scale(${zoom.toFixed(5)})` : 'none')
      : `translate(${f2((pw - 2 * bd - 1080 * ks) / 2)}px, ${f2((ph - 2 * bd - 1920 * ks) / 2)}px) scale(${ks.toFixed(5)})`;
    show(stripO, heads * (1 - leave)); show(stripF, heads * (1 - leave));
    const cap = range(t, 0.15, 0.65, ease.outCubic);
    show(caption, cap * (1 - leave));
    caption.style.transform = `translateY(${Math.round((1 - cap) * 12)}px)`;

    // ---- kazanan etiketi (kısa), kapak başlığı
    const pk = Math.min(range(t, GROW[1] - 0.1, GROW[1] + 0.5, ease.outCubic), 1 - range(t, GROW[1] + 3.4, GROW[1] + 4.1));
    show(pick, pk);
    pick.style.transform = `translateY(${f2((1 - range(t, GROW[1] - 0.1, GROW[1] + 0.5, ease.outCubic)) * -12)}px)`;
    const r1 = range(t, WIN_END - 0.9, WIN_END - 0.2, ease.inOutCubic), r2 = range(t, WIN_END - 0.5, WIN_END + 0.35, ease.outCubic), r3 = range(t, WIN_END + 0.1, WIN_END + 0.7, ease.outCubic);
    show(sign, clamp(r1 * 20));
    rule.style.transform = `scaleX(${f2(r1)})`;
    titleIn.style.transform = `translateY(${f2((1 - r2) * 112)}%)`;
    show(tagline, r3); tagline.style.transform = `translateX(${f2((1 - r3) * -14)}px)`;
  }

  return { el, update, subtitles: false, grain: false, sfx: [], extend: { before: PRE } };
}
