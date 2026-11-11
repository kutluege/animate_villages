// gercek — "Evet, burası her gün yüz binlerce insanın geçtiği Mecidiyeköy."
// Bilmece çözülür: gerçek Mecidiyeköy fotoğrafları (Wikimedia Commons, serbest lisans — assets/gercek/SOURCES.md).
// Kurgu: her fotoğraf önce BÜYÜK düşer (ekran genişliğinde fiş, söze bağlı kesme); bir sonraki fotoğraf üstüne çarptığı anda
// öndeki, arkadaki dört gözlü paftadaki yerine oturur. "Mecidiyeköy" sözcüğünde son büyük fiş çekilir: dört fotoğraf ekranı
// dolduran dengeli bir pafta olur, ortasına yer adı etiketi basılır. Her fotoğrafın künyesi (24 px, "Foto: yazar · lisans")
// hem büyük fişte hem paftadaki gözünde durur → atıf sahne sonuna kadar okunur.
// Harita `hook` sahnesinden gelir (hook.extend.after ile altta çizilmeye devam eder). Her şey t'nin saf fonksiyonu;
// hareket eden katmanlarda küçük yazı çizilmez (yazı fiş oturunca basılır) → kare tekrarlanabilir.
import { C, FONT, alpha, clamp, ease, lerp, range } from '../theme.js';
import { h } from '../kit.js';

const CPS = 30;
/** Tam ekran katman solması: 1'e/0'a çok yakın saydamlıklar tam değere yuvarlanır (GPU harmanlama yuvarlaması kareyi oynatmasın). */
const snap = (o) => (o > 0.985 ? 1 : o < 0.015 ? 0 : o);

// Pafta: 2 × 2 göz (y 236 → 1294; altyazı 1372'de serbest kalır); iki sıra arasındaki bant yer adı etiketine ayrılır,
// böylece etiket hiçbir fotoğrafı ya da künyeyi kapatmaz.
const GX = [22, 548], CW = 510, CB = 10, CS = 50;          // sütun x'leri, göz genişliği, kenar, künye şeridi
const CELLS = {
  TL: { x: GX[0], y: 236, ph: 398 }, BL: { x: GX[0], y: 836, ph: 398 },
  TR: { x: GX[1], y: 236, ph: 398 }, BR: { x: GX[1], y: 836, ph: 398 },
};
const BIG = { x: 60, y: 250, w: 960, b: 12, strip: 60, ph: 660 }; // büyük fiş

export async function create(ctx) {
  const at = (w, fb) => ctx.at(w)?.start ?? fb;
  const tName = at('Mecidiyeköy', 3.02);
  // Kesmeler sözlere bağlı. Büyük fişler: "Evet" → Trump + viyadük, "her gün" → trafik, "yüz binlerce" → metrobüs kalabalığı,
  // "insanın" → gün batımı. Gözler: önce alttakiler dolar (büyük fişin altında görünür kalırlar).
  const SHOTS = [
    { file: '1-trump-viyaduk.jpg', T: Math.max(0.02, at('Evet', 0.19) - 0.17), cell: 'BL', pos: '50% 50%', r: -0.9, pan: [-10, 6],
      label: 'TRUMP TOWERS · VİYADÜK', author: 'Mister No', lic: 'CC BY 3.0', hit: 0.5 },
    { file: '2-d100-trafik.jpg', T: at('her', 1.24) - 0.24, cell: 'BR', pos: '50% 50%', r: 0.8, pan: [12, 0],
      label: 'MECİDİYEKÖY · TRAFİK', author: 'Ibrahimferhadli', lic: 'CC BY-SA 4.0', hit: 0.4 },
    { file: '3-metrobus.jpg', T: at('yüz', 1.64) - 0.05, cell: 'TL', pos: '50% 50%', r: -0.7, pan: [-12, 4],
      label: 'METROBÜS DURAĞI', author: 'Myrat', lic: 'CC BY-SA 3.0', hit: 0.4 },
    { file: '4-gunbatimi.jpg', T: at('insanın', 2.28) - 0.05, cell: 'TR', pos: '50% 50%', r: 0.6, pan: [0, -8],
      label: 'GÜN BATIMI', author: 'Alex Francis Burchard', lic: 'CC BY-SA 4.0', hit: 0.38 },
  ];
  const TAG = 'MECİDİYEKÖY';
  const D = ctx.duration, OUT = 0.45;
  const REVEAL = tName - 0.12;                                // son büyük fiş çekilir, pafta ortaya çıkar
  const imgs = await Promise.all(SHOTS.flatMap((c) => [ctx.image(c.file), ctx.image(c.file)]));

  const el = h('div', { class: 'scene' });
  const dim = h('div', { class: 'abs', style: { inset: '0', background: `radial-gradient(90% 70% at 50% 40%, ${alpha(C.night, 0.5)} 0%, ${alpha(C.night, 0.74)} 100%)` } });
  const grid = h('div', { class: 'abs', style: { inset: '0' } });
  const bigs = h('div', { class: 'abs', style: { inset: '0' } });
  el.append(dim, grid, bigs);

  const credit = (c) => `Foto: ${c.author} · ${c.lic}`;
  const fill = (img, pos = '50% 50%') => Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos });
  const paper = { background: C.paper, borderRadius: '5px' };

  const shots = SHOTS.map((c, i) => {
    // --- paftadaki göz: boş yuva (ince çerçeve + numara) → fotoğraf oturur ---
    const g = CELLS[c.cell], ch = CS + g.ph + CB;
    const slot = h('div', { class: 'abs', style: { left: g.x + 'px', top: g.y + 'px', width: CW + 'px', height: ch + 'px', boxSizing: 'border-box',
      border: `2px dashed ${alpha(C.ink, 0.5)}`, borderRadius: '5px', background: alpha(C.night, 0.4) } },
    h('div', { class: 'abs t-num', style: { left: '18px', top: '14px', font: `600 24px/1 ${FONT.mono}`, letterSpacing: '0.08em', color: C.dim } }, `0${i + 1}`));
    const cImg = imgs[i * 2]; fill(cImg, c.pos);
    const cFlash = h('div', { class: 'abs', style: { inset: '0', background: C.ink } });
    const cPhoto = h('div', { class: 'abs', style: { left: CB + 'px', top: CS + 'px', width: CW - 2 * CB + 'px', height: g.ph + 'px', overflow: 'hidden', background: C.night } }, cImg, cFlash);
    const cStrip = h('div', { class: 'abs', lang: 'tr', style: { left: CB + 4 + 'px', right: CB + 'px', top: '0', height: CS + 'px', display: 'flex', alignItems: 'center', gap: '10px',
      whiteSpace: 'nowrap', color: C.paperInk, font: `600 24px/1 ${FONT.display}`, letterSpacing: '0' } },
    h('i', { style: { flex: 'none', width: '11px', height: '11px', background: C.pink, display: 'block' } }), credit(c));
    const cFrame = h('div', { class: 'abs', style: { left: -CW / 2 + 'px', top: -ch / 2 + 'px', width: CW + 'px', height: ch + 'px', ...paper,
      boxShadow: `0 2px 0 ${alpha(C.night, 0.2)}, 0 18px 44px ${alpha(C.night, 0.6)}` } }, cPhoto, cStrip);
    const cWrap = h('div', { class: 'abs', style: { left: '0', top: '0', width: '0', height: '0' } }, cFrame);
    grid.append(slot, cWrap);

    // --- büyük fiş ---
    const bw = BIG.w, pw = bw - 2 * BIG.b, bh = BIG.strip + BIG.ph + BIG.b;
    const bImg = imgs[i * 2 + 1]; fill(bImg);
    const bFlash = h('div', { class: 'abs', style: { inset: '0', background: C.ink } });
    const bPhoto = h('div', { class: 'abs', style: { left: BIG.b + 'px', top: BIG.strip + 'px', width: pw + 'px', height: BIG.ph + 'px', overflow: 'hidden', background: C.night,
      boxShadow: `inset 0 0 0 1px ${alpha(C.night, 0.35)}` } }, bImg, bFlash);
    const bStrip = h('div', { class: 'abs', lang: 'tr', style: { left: BIG.b + 6 + 'px', right: BIG.b + 6 + 'px', top: '0', height: BIG.strip + 'px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', whiteSpace: 'nowrap', color: C.paperInk } },
    h('span', { style: { font: `700 24px/1 ${FONT.mono}`, letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '12px' } },
      h('i', { style: { width: '12px', height: '12px', background: C.pink, display: 'block' } }), c.label),
    h('span', { style: { font: `600 24px/1 ${FONT.display}`, letterSpacing: '0' } }, credit(c)));
    const bFrame = h('div', { class: 'abs', style: { left: -bw / 2 + 'px', top: -bh / 2 + 'px', width: bw + 'px', height: bh + 'px', ...paper,
      boxShadow: `0 2px 0 ${alpha(C.night, 0.2)}, 0 34px 80px ${alpha(C.night, 0.75)}` } }, bPhoto, bStrip);
    const bWrap = h('div', { class: 'abs', style: { left: '0', top: '0', width: '0', height: '0' } }, bFrame);
    bigs.append(bWrap);
    return { ...c, i, g, ch, bh, slot, cImg, cFlash, cStrip, cWrap, bImg, bFlash, bStrip, bWrap,
      cx: g.x + CW / 2, cy: g.y + ch / 2, bx: BIG.x + bw / 2, by: BIG.y + bh / 2 };
  });
  // Büyük fişin ekrandan kalktığı an: bir sonraki çarptığında (üstü kapanmışken); sonuncusu REVEAL'de çekilir
  shots.forEach((c, i) => { c.S = i < shots.length - 1 ? shots[i + 1].T + 0.1 : REVEAL; });

  // Yer adı etiketi (cevap): paftanın ortasına basılan pembe harita etiketi
  const typed = h('span'), cur = h('span', {}, '▌'), rest = h('span', { style: { visibility: 'hidden' } }, TAG);
  const tagBox = h('div', { lang: 'tr', style: { position: 'absolute', left: '0', top: '0', padding: '22px 12px 22px 30px', background: C.pink, color: C.night, whiteSpace: 'nowrap',
    font: `800 84px/1 ${FONT.mono}`, letterSpacing: '0.01em', borderRadius: '5px', boxShadow: `0 20px 50px ${alpha(C.night, 0.65)}, 0 0 0 4px ${alpha(C.night, 0.35)}` } }, typed, cur, rest);
  const tag = h('div', { class: 'abs', style: { left: '0', top: '0', width: '0', height: '0' } }, tagBox);
  el.append(tag);

  // Ses: düzeyler seslendirmenin altında (cümle boyunca duraklama yok); yalnız ilk fiş "Evet"ten önceki sessizliğe düşer.
  const sfx = [];
  shots.forEach((c, i) => {
    sfx.push({ t: Math.max(0, c.T - 0.04), name: 'whoosh-short', gain: 0.22 });
    sfx.push({ t: c.T + 0.1, name: i === shots.length - 1 ? 'thud' : 'drop', gain: c.hit });
    sfx.push({ t: c.T + 0.08, name: 'shutter', gain: 0.16 });
  });
  for (let i = 0; i < TAG.length; i += 2) sfx.push({ t: +(tName + 0.06 + i / CPS).toFixed(3), name: `type-${(i / 2) % 3 + 1}`, gain: 0.2 });
  sfx.push({ t: D - 0.1, name: 'whoosh-short', gain: 0.36 });   // "Mecidiyeköy." bittikten sonra

  let tw = 0, th = 0;
  function update(t) {
    if (!tw) { tw = tagBox.offsetWidth; th = tagBox.offsetHeight; tagBox.style.left = -tw / 2 + 'px'; tagBox.style.top = -th / 2 + 'px'; }
    const out = range(t, D - 0.04, D + OUT - 0.1, ease.inOutCubic);        // çıkış: her şey yerinde solar
    dim.style.opacity = snap(range(t, 0, 0.3, ease.outCubic) * (1 - range(t, D, D + OUT))).toFixed(4);
    grid.style.opacity = snap(1 - out).toFixed(4);
    const slotIn = range(t, 0.02, 0.3, ease.outCubic);

    shots.forEach((c) => {
      // göz: büyük fiş kalktığı anda (c.S) dolu görünür; küçük bir oturma hareketi
      const sd = t - c.S;
      const filled = sd >= 0;
      c.slot.style.opacity = (filled ? 0 : slotIn).toFixed(4);
      c.cWrap.style.display = filled ? '' : 'none';
      if (filled) {
        const p = range(sd, 0, 0.3, ease.outExpo);
        c.cWrap.style.transform = `translate(${c.cx}px, ${c.cy}px) scale(${lerp(1.07, 1, p).toFixed(5)})`;
        c.cFlash.style.opacity = (0.55 * (1 - range(sd, 0, 0.32, ease.outCubic))).toFixed(4);
        c.cStrip.style.opacity = range(sd, 0.2, 0.34).toFixed(4);
      }
      // büyük fiş
      const dt = t - c.T;
      const last = c.i === shots.length - 1;
      const gone = last ? range(t, REVEAL, REVEAL + 0.26, ease.inOutCubic) : (t >= c.S + 0.22 ? 1 : 0);
      if (dt < 0 || gone >= 1) { c.bWrap.style.display = 'none'; return; }
      c.bWrap.style.display = '';
      const p = range(dt, 0, 0.36, ease.outExpo);
      const settle = Math.exp(-dt * 9) * Math.sin(dt * 26) * 0.012;          // çarpma sonrası küçük esneme
      const sc = lerp(1.3, 1, p) * (1 + settle) * lerp(1, 0.94, gone);
      c.bWrap.style.transform = `translate(${c.bx}px, ${(c.by - (1 - p) * 46).toFixed(2)}px) rotate(${(c.r * (1 - p) * 6 + c.r).toFixed(3)}deg) scale(${sc.toFixed(5)})`;
      c.bWrap.style.opacity = (range(dt, 0, 0.05) * (1 - gone)).toFixed(4);
      const kb = 1.12 - 0.03 * Math.min(dt, 2);                               // fotoğraf içinde hafif hareket (Ken Burns)
      c.bImg.style.transform = `translate(${(c.pan[0] * dt).toFixed(2)}px, ${(c.pan[1] * dt).toFixed(2)}px) scale(${kb.toFixed(5)})`;
      c.bFlash.style.opacity = (0.9 * (1 - range(dt, 0.02, 0.3, ease.outCubic))).toFixed(4);
      // künye fiş oturunca basılır; fiş kalkmadan hemen önce silinir (hareket halindeki küçük yazı çizilmez)
      c.bStrip.style.opacity = (range(dt, 0.2, 0.32) * (last ? 1 - range(t, REVEAL - 0.1, REVEAL) : 1)).toFixed(4);
    });

    // etiket: "Mecidiyeköy" sözcüğüyle paftanın ortasında açılır, ad daktilo ile yazılır
    const dt = t - (tName - 0.06);
    const open = range(dt, 0, 0.16, ease.outCubic);
    tag.style.display = dt < 0 ? 'none' : '';
    tag.style.opacity = (open * (1 - out)).toFixed(4);
    tag.style.transform = `translate(540px, 765px) rotate(-2deg) scale(${lerp(1.25, 1, open).toFixed(5)})`;
    const n = clamp(Math.floor((dt - 0.16) * CPS), 0, TAG.length);
    typed.textContent = TAG.slice(0, n);
    rest.textContent = TAG.slice(n);
    const after = dt - 0.16 - TAG.length / CPS;
    cur.style.visibility = dt >= 0.16 && (after < 0 || after % 0.4 < 0.22) ? 'visible' : 'hidden';
  }

  return { el, update, sfx, backdrop: false, extend: { after: OUT } };
}
