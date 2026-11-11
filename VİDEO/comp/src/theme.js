// Ortak görsel dil — açılıştaki topografya haritasının dünyası: koyu orman/yosun yeşili zemin, ince eş yükselti çizgileri,
// gri bina izleri, krem-sarı yollar; vurgu haritanın pembesi (magenta), ikincil vurgular turuncu-kırmızı hat, camgöbeği, mavi.
// Sahneler renk/yazı/eğri/ölçüyü buradan alır; kendi sabitlerini uydurmaz. Belirteç adları eski (navy, window…) — değerleri yeşil.
// ---- Ölçü ----
export const W = 1080, H = 1920;
/** Instagram arayüzü üst 220 px ve alt 420 px'i kapatır; önemli yazı SAFE içinde kalır. */
export const SAFE = { top: 220, bottom: 1500, left: 72, right: 1008, width: 936, height: 1280, cx: 540, cy: 860 };
export const SUBTITLE_Y = 1372; // altyazı bloğunun varsayılan dikey merkezi (sahne `subtitleY` ile değiştirebilir)

// ---- Renk ----
// (Adlar geriye uyum için korunur: navy* = yeşil zemin tonları, window = krem-sarı yol rengi.)
export const C = {
  night: '#0F1B13',      // en koyu zemin (gölgeli vadi)
  navy: '#22382A',       // ana zemin (koyu orman yeşili)
  navy2: '#1A2B20',      // yüzey / kart (opak gerekiyorsa; tercihen C.glass)
  navy3: '#4A6650',      // ince çizgi, ayraç, eş yükselti
  ink: '#F4EFDF',        // ana yazı (krem / kırık beyaz)
  dim: '#B7C2A6',        // ikincil yazı (açık adaçayı)
  faint: 'rgba(244,239,223,0.45)',
  window: '#F1D488',     // haritadaki krem-sarı yol — 1. sıcak vurgu
  sunset: '#F28A3A',     // haritadaki turuncu hat
  ember: '#E5483A',      // haritadaki kırmızı hat (uyarı, "saçmalama")
  pink: '#FF4FD8',       // haritanın pembesi (magenta) — ANA vurgu (altyazıda söylenen kelime)
  sky: '#6F8FEA',        // haritadaki mavi yapılar
  ok: '#8FE0A0',         // onay
  // yeni belirteçler
  cyan: '#4CD3F2',       // haritadaki camgöbeği (metrobüs)
  moss: '#5F7D4E',       // açık yosun (sırt)
  forest: '#2C4532',     // orman (orta ton)
  building: '#A3A39C',   // gri bina izi
  road: '#F1D488',       // = window
  line: 'rgba(16,26,19,0.38)',   // eş yükselti çizgisi (zemin üstünde koyu ince çizgi)
  glass: 'rgba(14,24,17,0.80)',  // koyu yarı saydam kart zemini (yazı her yerde okunur)
  glassStrong: 'rgba(11,20,14,0.88)', // yazı yoğun kartlar için daha opak cam
  glassLine: 'rgba(244,239,223,0.14)',
  hair: 'rgba(244,239,223,0.34)',     // kartografik ince çerçeve / ayraç (krem kıl çizgi)
  shadow: 'rgba(5,12,7,0.55)',        // gölge
  paper: '#F2EDE0',      // polaroid / kâğıt
  paperInk: '#1B241D',   // kâğıt üstü yazı
  street: '#D8D8CF',     // haritadaki açık gri ara sokak
  park: '#3E6B3C',       // haritadaki park yeşili
  topoLow: '#1A2B20',    // fon: vadi
  topoMid: '#2E4733',    // fon: yamaç
  topoHigh: '#56744B',   // fon: sırt
};
/** Belirteçten saydam renk: alpha(C.pink, 0.3) → 'rgba(255,79,216,0.3)' (yalnız #RRGGBB belirteçler) */
export const alpha = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
/** Ekip renkleri (senaryo/sonuc sahneleri tutarlı kullanır). */
export const TEAM = { fable: C.pink, opus: C.cyan };
/** Altyazıda söylenen kelimenin rengi: krem-sarı (yol rengi). Pembe/camgöbeği OLMAZ: onlar kadro renkleri (TEAM.fable / TEAM.opus);
 *  "Opus'un" sözcüğü Fable renginde yanmasın. */
export const SUB_HI = C.window;
/** Yol / hat çizgi stilleri (kit.route(d, { kind }) bunları kullanır). width px; casing = koyu dış kontur; core = iç çizgi. */
export const ROUTE = {
  road:   { color: C.road, width: 14, casing: alpha(C.night, 0.6) },            // krem-sarı ana yol
  street: { color: C.street, width: 6, casing: alpha(C.night, 0.45) },          // açık gri ara sokak
  rail:   { color: C.sunset, width: 16, core: C.ember, casing: alpha(C.night, 0.5) }, // turuncu şerit + kırmızı hat
  bus:    { color: C.cyan, width: 8, casing: alpha(C.night, 0.5) },             // camgöbeği metrobüs
  march:  { color: C.pink, width: 7, dash: [22, 16] },                          // harekât / görev oku (kesikli pembe)
  link:   { color: C.ink, width: 3, dash: [4, 10] },                            // ince noktalı bağlantı / sınır
};
/** Fonun ve koordinat etiketlerinin dayandığı konum (Mecidiyeköy) */
export const GEO = { lat: 41.0672, lon: 28.9925 };

export const GRAD = {
  dusk: `linear-gradient(180deg, ${C.night} 0%, ${C.navy} 50%, ${C.forest} 100%)`,
  night: `radial-gradient(120% 80% at 50% 30%, ${C.forest} 0%, ${C.navy} 45%, ${C.night} 100%)`,
  warm: `linear-gradient(135deg, ${C.window} 0%, ${C.sunset} 100%)`,
  /** kart/etiket altında yazıyı okutmak için koyu, yarı saydam yeşil */
  glass: `linear-gradient(180deg, rgba(14,24,17,0.84) 0%, rgba(14,24,17,0.74) 100%)`,
};

// ---- Yazı ----
export const FONT = {
  display: `'Inter Tight', 'Segoe UI', sans-serif`, // güçlü grotesk, Türkçe tam (OFL)
  mono: `'JetBrains Mono', ui-monospace, monospace`, // teknik etiketler, ajan adları, rakamlar (OFL)
};
/** Hazır tipografi ölçekleri (px, 1080 genişliğe göre). */
export const TYPE = {
  hero:  { fontFamily: FONT.display, fontWeight: 850, fontSize: '148px', lineHeight: '0.95', letterSpacing: '-0.035em' },
  title: { fontFamily: FONT.display, fontWeight: 800, fontSize: '96px', lineHeight: '1.0', letterSpacing: '-0.025em' },
  head:  { fontFamily: FONT.display, fontWeight: 700, fontSize: '64px', lineHeight: '1.08', letterSpacing: '-0.015em' },
  body:  { fontFamily: FONT.display, fontWeight: 500, fontSize: '42px', lineHeight: '1.25', letterSpacing: '-0.005em' },
  label: { fontFamily: FONT.mono, fontWeight: 600, fontSize: '28px', lineHeight: '1.2', letterSpacing: '0.08em', textTransform: 'uppercase' },
  sub:   { fontFamily: FONT.display, fontWeight: 800, fontSize: '80px', lineHeight: '1.08', letterSpacing: '-0.02em' },
};

let fontsPromise = null;
export function loadFonts() {
  if (fontsPromise) return fontsPromise;
  const u = (f) => `url("${new URL(`../assets/fonts/${f}`, import.meta.url)}")`;
  const faces = [
    new FontFace('Inter Tight', u('InterTight-wght.ttf'), { weight: '100 900', style: 'normal' }),
    new FontFace('JetBrains Mono', u('JetBrainsMono-wght.ttf'), { weight: '100 800', style: 'normal' }),
  ];
  fontsPromise = Promise.all(faces.map((f) => f.load().then((ff) => document.fonts.add(ff))))
    .then(() => document.fonts.ready);
  return fontsPromise;
}

// ---- Hareket: yumuşatma eğrileri (girdi 0..1 → çıktı) ----
export const ease = {
  linear: (x) => x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  outBack: (x, s = 1.4) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  /** Sönümlü yay (hafif zıplama, düşen polaroid vb.) */
  spring: (x, k = 7, damp = 5.5) => (x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(k * x)),
};
/** Standart süreler (sn): sakin ama kendinden emin; acele yok. */
export const DUR = { fast: 0.18, base: 0.45, slow: 0.9, scene: 0.5 };

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, x) => a + (b - a) * x;
/** t'nin [a,b] aralığındaki ilerlemesi, 0..1'e kıstırılmış; isteğe bağlı eğriyle. */
export const range = (t, a, b, fn = ease.linear) => fn(clamp((t - a) / (b - a || 1e-9)));
/** Gir-çık zarfı: [a, a+inDur] içinde 0→1, [b-outDur, b] içinde 1→0. */
export const envelope = (t, a, b, inDur = DUR.base, outDur = DUR.base, fn = ease.outCubic) =>
  Math.min(range(t, a, a + inDur, fn), 1 - range(t, b - outDur, b, ease.inCubic));

/** Tohumlu, deterministik rastgele (Math.random YASAK). const r = rng(42); r() → 0..1 */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
/** Tek atımlık deterministik gürültü: hash01(i, seed) → 0..1 */
export const hash01 = (i, seed = 0) => rng((i * 2654435761) ^ (seed * 40503) ^ 0x9e3779b9)();

// ---- Ortak CSS (main.js sayfaya ekler) ----
export const CSS = `
:root { --night:${C.night}; --navy:${C.navy}; --navy2:${C.navy2}; --navy3:${C.navy3}; --ink:${C.ink}; --dim:${C.dim};
  --window:${C.window}; --sunset:${C.sunset}; --ember:${C.ember}; --pink:${C.pink}; --sky:${C.sky}; --ok:${C.ok};
  --cyan:${C.cyan}; --moss:${C.moss}; --forest:${C.forest}; --building:${C.building}; --road:${C.road};
  --glass:${C.glass}; --glassStrong:${C.glassStrong}; --glassLine:${C.glassLine}; --hair:${C.hair}; --shadow:${C.shadow};
  --paper:${C.paper}; --paperInk:${C.paperInk}; --street:${C.street}; --park:${C.park};
  --display:${FONT.display}; --mono:${FONT.mono}; }
.scene { position:absolute; left:0; top:0; width:${W}px; height:${H}px; overflow:hidden; color:var(--ink);
  font-family:var(--display); background:transparent; } /* saydam: arkada ortak topografya fonu var */
.abs { position:absolute; }
.t-hero { font:850 148px/0.95 var(--display); letter-spacing:-0.035em; }
.t-title { font:800 96px/1.0 var(--display); letter-spacing:-0.025em; }
.t-head { font:700 64px/1.08 var(--display); letter-spacing:-0.015em; }
.t-body { font:500 42px/1.25 var(--display); }
.t-label { font:600 28px/1.2 var(--mono); letter-spacing:0.08em; text-transform:uppercase; color:var(--dim); }
.t-num { font-variant-numeric: tabular-nums; }
.accent { color:var(--pink); } .accent2 { color:var(--window); } .accent3 { color:var(--sunset); } .accent4 { color:var(--cyan); }
/* Kart: ekran görüntüsü / kare çerçevesi */
.card { border-radius:22px; overflow:hidden; background:var(--glass);
  box-shadow: 0 30px 80px rgba(5,12,7,0.55), 0 0 0 1px var(--glassLine); }
.glass { background:var(--glass); border-radius:22px; box-shadow:0 0 0 1px var(--glassLine), 0 24px 60px rgba(5,12,7,0.45); }
.card img, .fill { width:100%; height:100%; object-fit:cover; display:block; }
/* Polaroid */
.polaroid { background:var(--paper); padding:22px 22px 86px; border-radius:6px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.08), 0 30px 70px rgba(5,12,7,0.6); }
.polaroid img { width:100%; height:100%; object-fit:cover; display:block; }
.polaroid .cap { position:absolute; left:22px; right:22px; bottom:22px; font:500 30px/1.2 var(--display); color:var(--paperInk); }
/* Etiket hapı */
.chip { display:inline-flex; align-items:center; gap:14px; padding:12px 22px; border-radius:999px;
  font:600 26px/1 var(--mono); letter-spacing:0.06em; text-transform:uppercase;
  background:var(--glass); color:var(--ink); box-shadow:0 0 0 1px var(--glassLine) inset; }
.chip .dot { width:12px; height:12px; border-radius:50%; background:var(--pink); box-shadow:0 0 16px var(--pink); }
/* ---- Kartografik yapı taşları (kit.js: mapCard, coordLabel, legend, marker, scaleBar, route) ---- */
.mapcard { position:absolute; box-sizing:border-box; background:var(--glass); border:1.5px solid var(--hair); border-radius:6px;
  box-shadow:0 26px 70px var(--shadow); color:var(--ink); }
.mapcard.strong { background:var(--glassStrong); }
.mapcard > .tick { position:absolute; width:20px; height:20px; border:0 solid var(--ink); opacity:0.9; pointer-events:none; }
.mapcard > .tick.tl { left:-11px; top:-11px; border-left-width:2px; border-top-width:2px; }
.mapcard > .tick.tr { right:-11px; top:-11px; border-right-width:2px; border-top-width:2px; }
.mapcard > .tick.bl { left:-11px; bottom:-11px; border-left-width:2px; border-bottom-width:2px; }
.mapcard > .tick.br { right:-11px; bottom:-11px; border-right-width:2px; border-bottom-width:2px; }
.mapcard-head { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:16px 22px 15px;
  border-bottom:1px solid var(--hair); font:600 22px/1 var(--mono); letter-spacing:0.1em; text-transform:uppercase; color:var(--dim); white-space:nowrap; }
.mapcard-head .ttl { display:flex; align-items:center; gap:12px; color:var(--ink); }
.mapcard-head .ttl i { width:12px; height:12px; background:var(--pink); display:block; }
.mapcard-body { position:relative; box-sizing:border-box; }
.coord { display:inline-flex; align-items:center; gap:10px; font:500 22px/1 var(--mono); letter-spacing:0.06em; color:var(--dim);
  font-variant-numeric:tabular-nums; white-space:nowrap; }
.legend { display:flex; flex-direction:column; gap:16px; }
.legend-title { font:600 22px/1 var(--mono); letter-spacing:0.1em; text-transform:uppercase; color:var(--dim); margin-bottom:4px; }
.legend-row { display:flex; align-items:center; gap:18px; font:500 32px/1.15 var(--display); color:var(--ink); }
.legend-row .sw { flex:none; width:36px; height:24px; border-radius:3px; box-sizing:border-box; }
.legend-row .sw.line { height:7px; border-radius:4px; }
.legend-row .sw.dash { height:0; border-radius:0; background:none!important; border-top:6px dashed; }
.legend-row .sw.dot { width:20px; height:20px; border-radius:50%; margin:0 8px; }
.legend-row .sw.ring { width:22px; height:22px; border-radius:50%; margin:0 7px; background:none!important; border:4px solid; }
.legend-row .val { margin-left:auto; padding-left:24px; font:600 26px/1 var(--mono); color:var(--dim); font-variant-numeric:tabular-nums; }
.marker { position:absolute; width:0; height:0; }
.marker .ring { position:absolute; border-radius:50%; border:3px solid; box-sizing:border-box; }
.marker .dot { position:absolute; border-radius:50%; }
.marker .lbl { position:absolute; top:0; white-space:nowrap; padding:9px 16px 10px; border-radius:4px; background:var(--glassStrong);
  border:1.5px solid var(--hair); font:700 30px/1 var(--display); color:var(--ink); }
.scalebar { display:inline-flex; flex-direction:column; gap:8px; font:500 20px/1 var(--mono); letter-spacing:0.06em; color:var(--dim); }
.scalebar .bar { height:8px; border:1.5px solid var(--ink); box-sizing:border-box;
  background:linear-gradient(90deg, var(--ink) 0 25%, transparent 25% 50%, var(--ink) 50% 75%, transparent 75% 100%); opacity:0.85; }
`;
