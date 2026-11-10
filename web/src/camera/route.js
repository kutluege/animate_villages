// KAMERA ROTASI — saf matematik (three yok, durum yok): poseAt(t) → { pos, target, fov }.
// Koordinatlar yerel metre (+X doğu, +Z güney, +Y yukarı). TEK sürekli çekim, kesme yok, 40 sn.
//
//   0–1.3   Viyadük altı: Büyükdere Cd. trafiğinin ~4.5 m üstünde, ayak sıralarının arasından düz çapraz.
//   1.3–3   Işığa çıkış: Torun Center kuleleri dipten yukarı; sonra viyadüğün üstüne dönüş.
//   3–12    D-100 / metrobüs boyunca batıya hiperlaps (≈78 m/sn); Trump öne gelir, güneyinden geçilir.
//   12–16   Kuleyi izleyen yay, yumuşak yavaşlama.
//   16.3–19.8 DORUK: Trump Residence batı cephesinin ayna doğrultusu; batan güneşin yansıması camda
//           alçalır (check.mjs "doruk"). Gerçek güneş kadraja sığmaz (≥40° ayrık) → yansıma.
//   19.8–25 Sola dönüp D-100'ü aşar, MEZARLIĞIN üstünde yükselir; bakış sağa kayar: CEVAHİR (alacakaranlık).
//   25–32.5 Kuzeydoğuya, TORUN'a doğru süzülür (kuleler yelpaze açar); alacakaranlık → gece, ışıklar yanar.
//   32.5–38.2 Yavaşlayıp alçalarak viyadüğün üstüne, metrobüs eksenine oturur; bakış ışık nehrinin
//           üstünden (dik bakışla) kuzey üzerinden batıya döner — nehir dönüş boyunca kadrajda.
//   38.5–40 Kapak: D-100 ekseni boyunca batıya, alçaktan; ışık nehri ortada alttan ufka, sağda TRUMP.
//
// Düğümler zaman-parametreli C2 kübik spline ile geçilir (hız ve ivme sürekli).
// Doğrulama: node web/src/camera/check.mjs

export const DURATION = 40;
export const CUTS = []; // kesme yok: tek sürekli uçuş

// Bakış anahtarları: { t, az, pitch, d } (pusula°, eğim°, uzaklık m) ya da { t, p:[x,y,z] }.
export const SHOTS = [
  {
    t0: 0,
    t1: DURATION,
    posV0: [-41.3, -0.6, 11.5],
    posV1: [0, 0, 0],
    tgtV0: [-30, 2, 34],
    tgtV1: [0, 0, 0],
    // [t, x, y, z]
    pos: [
      // Viyadük altı: DÜZ çapraz (pusula 247°). Güney ayak sırasını (844,41) ile (812,43) ayaklarının
      // ortasından keser; her ayağa ≥5 m (ayak konumları şehir modülünden; check.mjs denetler).
      // t=0 noktası, karşıdan gelen minibüs şeridinin (z≈26) güneyinde: ilk karelerde araç tavanı sıyrılmaz
      [0.0, 860.5, -3.5, 30.8],
      [0.433, 842.6, -3.8, 35.9],
      [0.867, 824.7, -3.9, 43.4],
      [1.3, 806.8, -2.9, 50.9],
      // çıkıştan sonra hız ~48 m/sn'ye iner (kuleler okunur, dönüş ivmesi düşer), sonra yeniden hızlanır
      [2.1, 770.5, 4.5, 58],
      [2.95, 729, 18, 52.5],
      // sağa: viyadüğün ÜSTÜNE (tabliye +30 m), D-100 sıkışıklığı boyunca batıya
      [3.8, 678, 32, 43.5],
      [4.55, 626, 45.5, 40],
      [5.3, 570, 54.5, 40],
      [6.15, 504, 61.5, 40],
      [7.15, 424, 70.5, 42],
      [8.2, 344, 78.5, 42],
      [9.2, 267, 84, 40.5],
      [10.2, 190, 87, 39.5],
      [11.2, 114, 87, 40],
      [12.1, 48, 83.5, 36],
      [13.0, -13, 76.5, 26],
      [13.9, -67, 68, 12.5],
      [14.8, -111, 59.5, -2],
      [15.6, -140.5, 53, -13.5],
      [16.4, -161.5, 48.5, -21.5],
      [17.4, -181, 46, -25.5],
      [18.4, -196.5, 45, -21.5],
      [19.4, -208, 46, -11],
      [20.4, -214, 50, 8],
      [21.26, -212, 57, 34],
      [22.12, -200, 65, 67],
      [22.99, -176, 73, 105],
      [23.85, -141, 80, 141],
      [24.71, -100, 86, 172],
      [25.57, -54, 91, 196],
      [26.43, -5, 95, 214],
      [27.3, 46, 98, 224],
      [28.16, 98, 100, 221], // kuzeydoğuya: meydanın üstünden viyadük eksenine; Torun yelpazesi açılır
      [29.01, 145, 101, 205],
      [29.86, 190, 101, 181],
      [30.71, 234, 100.5, 154],
      [31.41, 270, 100, 131.5],
      [32.5, 323, 99, 103], // yumuşak fren + alçalma: ışık nehrinin üstüne dalış
      [33.58, 366.5, 95, 79],
      [34.66, 402, 87, 60],
      [35.74, 428, 76, 46],
      [36.68, 443, 64, 38],
      [37.48, 449.5, 55.5, 34],
      [38.15, 451, 51, 32.9], // kapak: viyadüğün ~48 m üstü, metrobüs ekseni
      [39.0, 451, 50.1, 32.65],
      [40.2, 451, 50, 32.6],
    ],
    look: [
      { t: 0.0, az: 250, pitch: -5, d: 110 }, // ileride ışığa açılan güney kenar + trafik derinliği
      { t: 0.4, az: 242, pitch: -3, d: 115 },
      { t: 0.8, az: 230, pitch: 7, d: 125 },
      { t: 1.3, az: 217, pitch: 25, d: 140 }, // ışığa çıkış: Torun C · B · A yelpazesi
      { t: 2.0, az: 213, pitch: 35, d: 140 }, // dipten yukarı
      { t: 2.6, az: 229, pitch: 15, d: 160 },
      { t: 3.2, az: 251, pitch: -6, d: 210 }, // erken dönüş: viyadük üstü D-100 sıkışıklığı
      { t: 3.8, az: 262, pitch: -10, d: 240 },
      { t: 4.4, az: 266, pitch: -10, d: 250 },
      { t: 5.3, az: 268, pitch: -9, d: 260 },
      { t: 6.15, az: 276, pitch: -6, d: 280 },
      { t: 7.15, az: 284, pitch: -5, d: 300 },
      { t: 8.2, az: 292, pitch: -4, d: 300 },
      { t: 9.2, p: [55, 72, -105] }, // Trump Residence izlenir
      { t: 10.2, p: [52, 82, -110] },
      { t: 11.2, p: [50, 91, -112] },
      { t: 12.1, p: [49, 98, -113] },
      { t: 13.0, p: [48, 99, -113] },
      { t: 13.9, p: [47, 93, -113] },
      { t: 14.8, p: [46, 84, -112] },
      { t: 15.6, p: [45, 76, -112] },
      { t: 16.4, p: [44, 71, -111] },
      { t: 17.4, p: [44, 69, -111] },
      { t: 19.6, p: [44, 66, -112] },
      { t: 20.4, az: 78, pitch: 2, d: 300 },
      { t: 21.26, az: 98, pitch: -1, d: 320 },
      { t: 22.12, az: 118, pitch: -4, d: 360 },
      { t: 22.99, az: 135, pitch: -9, d: 400 }, // Cevahir
      { t: 23.85, az: 142, pitch: -11.5, d: 400 },
      { t: 24.71, az: 143, pitch: -12, d: 380 },
      { t: 25.57, az: 133, pitch: -10, d: 400 },
      { t: 26.43, az: 116, pitch: -8, d: 450 },
      { t: 27.3, az: 100, pitch: -6, d: 500 },
      { t: 28.16, p: [690, 68, 192] }, // Torun
      { t: 30.71, p: [690, 70, 192] },
      { t: 32.5, az: 98, pitch: -6, d: 380 },
      { t: 33.58, az: 70, pitch: -12, d: 300 }, // sola dönüş: viyadük (ışık nehri) kadrajda kalır
      { t: 34.66, az: 38, pitch: -42, d: 130 }, // nehrin üstünde dik bakış
      { t: 35.3, az: 10, pitch: -58, d: 100 },
      { t: 35.9, az: 345, pitch: -62, d: 90 },
      { t: 36.5, az: 318, pitch: -48, d: 110 }, // nehir boyunca batıya doğrulur, Trump girer
      { t: 37.1, az: 298, pitch: -28, d: 200 },
      { t: 37.6, az: 286, pitch: -14, d: 350 },
      { t: 38.15, az: 281.8, pitch: -8.5, d: 480 },
      { t: 38.6, az: 280.6, pitch: -7.1, d: 500 }, // kapak: D-100 ekseni boyunca batıya; sağda Trump
      { t: 40.2, az: 280.5, pitch: -7, d: 500 },
    ],
    fov: [
      [0.0, 60],
      [1.3, 66],
      [2.2, 66],
      [3.7, 62],
      [5.3, 55],
      [7.2, 50],
      [12.1, 50],
      [14.8, 46],
      [16.6, 44],
      [19.6, 44],
      [22.12, 48],
      [24.71, 42],
      [28.16, 46],
      [32.5, 48],
      [35.2, 58],
      [38.15, 54],
      [40.2, 54],
    ],
  },
];

// ---- zaman-parametreli kenetli (clamped) C2 kübik spline -------------------------------
function buildSpline(ts, ys, d0, d1) {
  const n = ts.length;
  const h = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) h[i] = ts[i + 1] - ts[i];
  const a = new Array(n).fill(0);
  const b = new Array(n).fill(0);
  const c = new Array(n).fill(0);
  const r = new Array(n).fill(0);
  b[0] = 2 * h[0];
  c[0] = h[0];
  r[0] = 6 * ((ys[1] - ys[0]) / h[0] - d0);
  for (let i = 1; i < n - 1; i++) {
    a[i] = h[i - 1];
    b[i] = 2 * (h[i - 1] + h[i]);
    c[i] = h[i];
    r[i] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
  }
  a[n - 1] = h[n - 2];
  b[n - 1] = 2 * h[n - 2];
  r[n - 1] = 6 * (d1 - (ys[n - 1] - ys[n - 2]) / h[n - 2]);
  for (let i = 1; i < n; i++) {
    const w = a[i] / b[i - 1];
    b[i] -= w * c[i - 1];
    r[i] -= w * r[i - 1];
  }
  const m = new Array(n);
  m[n - 1] = r[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) m[i] = (r[i] - c[i] * m[i + 1]) / b[i];
  return { ts, ys, h, m };
}

function evalSpline(s, t) {
  const { ts, ys, h, m } = s;
  const n = ts.length;
  if (t <= ts[0]) return ys[0];
  if (t >= ts[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  const A = (ts[lo + 1] - t) / h[lo];
  const B = (t - ts[lo]) / h[lo];
  return (
    A * ys[lo] + B * ys[lo + 1] + (((A * A * A - A) * m[lo] + (B * B * B - B) * m[lo + 1]) * h[lo] * h[lo]) / 6
  );
}

function track(keys, dims, v0, v1) {
  const ts = keys.map((k) => k[0]);
  const splines = [];
  for (let d = 0; d < dims; d++) {
    splines.push(
      buildSpline(
        ts,
        keys.map((k) => k[d + 1]),
        v0[d],
        v1[d],
      ),
    );
  }
  return (t) => splines.map((s) => evalSpline(s, t));
}

const D2R = Math.PI / 180;
const TRACKS = SHOTS.map((sh) => {
  const posAt = track(sh.pos, 3, sh.posV0, sh.posV1);
  const tgt = sh.look.map((k) => {
    if (k.p) return [k.t, k.p[0], k.p[1], k.p[2]];
    const c = posAt(k.t);
    const h = Math.cos(k.pitch * D2R) * k.d;
    return [k.t, c[0] + Math.sin(k.az * D2R) * h, c[1] + Math.sin(k.pitch * D2R) * k.d, c[2] - Math.cos(k.az * D2R) * h];
  });
  return { t0: sh.t0, t1: sh.t1, posAt, tgtAt: track(tgt, 3, sh.tgtV0, sh.tgtV1), fovAt: track(sh.fov, 1, [0], [0]) };
});

/** t hangi çekimde? Kesme anı (t === CUT) ikinci çekime aittir. */
export function shotIndexAt(t) {
  for (let i = TRACKS.length - 1; i > 0; i--) if (t >= TRACKS[i].t0 - 1e-9) return i;
  return 0;
}

/** Film saniyesi → kamera pozu. Saf; [0, DURATION] dışında uçlara kenetlenir. */
export function poseAt(t) {
  const u = Math.min(DURATION, Math.max(0, Number.isFinite(t) ? t : 0));
  const i = shotIndexAt(u);
  const k = TRACKS[i];
  return { pos: k.posAt(u), target: k.tgtAt(u), fov: k.fovAt(u)[0], shot: i };
}
