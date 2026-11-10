// KAMERA ROTASI — saf matematik (three yok, durum yok): poseAt(t) → { pos, target, fov }.
// Koordinatlar yerel metre (+X doğu, +Z güney, +Y yukarı). İki çekim, TEK kesme (t = 20.4 sn).
//
// ÇEKİM 1 — gündüz → gün batımı (0–20.4)
//   0–1.5   Viyadük altı: Büyükdere Cd. trafiğinin ~4.5 m üstünde, ayak sıralarının arasından düz bir
//           çaprazla 53 m/sn; bakış ileride ışığa açılan güney kenarda (tabliye üst üçte birde).
//   1.5–3.5 Işığa çıkış: Torun Center kuleleri (C·B·A) dipten yukarı.
//   3.5–11  Şehir açılır: viyadük → D-100 üstünde batıya (≈78 m/sn, hiperlaps), Trump öne gelir.
//   11–16   Trump'ın güneyinden geçerken kuleyi izleyen yay; yumuşak yavaşlama.
//   16.3–20.4 DORUK: Trump Residence batı cephesinin AYNA doğrultusu. Kamera D-100'ü çaprazlayarak
//           batı-güneybatıya ~15 m/sn süzülür (durmaz); batan güneşin yansıması camda alçalır.
//           Süzülme yönü, yansımayı cephede tutacak biçimde seçildi (check.mjs "doruk").
//           Not: cepheler eksenlere paralel; gerçek güneş ile yansıması arasında ≥40° var,
//           9:16 kadraja ikisi birden sığmaz → kadrajdaki "alçak güneş" camdaki yansımadır.
// KESME (20.4): yansıma ufukta söner → alacakaranlıkta geniş plan. Gerekçe: bölüm değişimi
//           (gün batımı → ışıklar) + 900 m yer değişimi; ikinci kule grubu ancak böyle girer.
// ÇEKİM 2 — ışıklar → gece (20.4–36)
//   20.4–28 Torun'un kuzeydoğusunda yüksekten geniş plan: önde apartman dokusu, ortada viyadük,
//           arkada Torun kuleleri; ışıklar tek tek yanar. Kamera ~22 m/sn süzülerek alçalır.
//   28–34.5 Viyadük / metrobüs şeridine doğru alçalan yay; şerit kadrajın orta bandına yükselir.
//   34.5–36 Kapak: Torun kuleleri üst-ortada, ışık nehri orta bantta, altta çatı dokusu.
//
// Düğümler çekim başına zaman-parametreli C2 kübik spline ile geçilir (hız ve ivme sürekli).
// Doğrulama: node web/src/camera/check.mjs

export const DURATION = 36;
const CUT = 20.4; // kare 612
export const CUTS = [CUT];

// Bakış anahtarları: { t, az, pitch, d } (pusula°, eğim°, uzaklık m) ya da { t, p:[x,y,z] }.
export const SHOTS = [
  {
    t0: 0,
    t1: CUT,
    posV0: [-48.8, -0.8, 20.5],
    posV1: [-13, 1.6, 8],
    tgtV0: [-40, -2, 36],
    tgtV1: [0, 0, 0],
    // [t, x, y, z]
    pos: [
      // Viyadük altı: DÜZ çapraz (pusula 247°). Güney ayak sırasını (844,41) ile (812,43) ayaklarının
      // ortasından keser; her ayağa ≥5 m (ayak konumları şehir modülünden; check.mjs denetler).
      [0.0, 880, -3.2, 20.2],
      [0.5, 855.6, -3.7, 30.4],
      [1.0, 831.2, -4.0, 40.7],
      [1.5, 806.8, -3.2, 50.9],
      [2.2, 770, 2.2, 60],
      [2.9, 729, 11.5, 62.5],
      [3.7, 678, 25.5, 61.5],
      [4.5, 625, 39, 61],
      [5.3, 568, 51, 60],
      [6.2, 499, 61.5, 56.5],
      [7.2, 422, 71, 50],
      [8.2, 344, 78.5, 44.5],
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
      [19.4, -210, 45, -14.5],
      [20.4, -223.5, 46, -7],
    ],
    look: [
      { t: 0.0, az: 244, pitch: -8, d: 110 }, // ileride ışığa açılan güney kenar + Torun
      { t: 0.5, az: 239, pitch: -5, d: 115 },
      { t: 1.0, az: 229, pitch: 6, d: 125 },
      { t: 1.5, az: 217, pitch: 25, d: 140 }, // ışığa çıkış: Torun C · B · A yelpazesi
      { t: 2.2, az: 212, pitch: 36, d: 140 }, // dipten yukarı
      { t: 2.9, az: 217, pitch: 28, d: 150 },
      { t: 3.6, az: 234, pitch: 9, d: 200 },
      { t: 4.3, az: 254, pitch: -4, d: 240 },
      { t: 5.3, az: 269, pitch: -6, d: 260 },
      { t: 6.2, az: 278, pitch: -5, d: 280 },
      { t: 7.2, az: 286, pitch: -4, d: 300 },
      { t: 8.2, az: 293, pitch: -4, d: 300 },
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
      { t: 20.4, p: [44, 66, -112] },
    ],
    fov: [
      [0.0, 66],
      [2.2, 66],
      [3.7, 62],
      [5.3, 55],
      [7.2, 50],
      [12.1, 50],
      [14.8, 46],
      [16.6, 44],
      [20.4, 44],
    ],
  },
  {
    t0: CUT,
    t1: DURATION,
    posV0: [-19.7, -5.8, 12.5],
    posV1: [0, 0, 0],
    tgtV0: [-6, 2, 4],
    tgtV1: [0, 0, 0],
    pos: [
      [20.4, 937.8, 166.7, -399],
      [22.4, 898.4, 155.2, -374],
      [24.4, 859, 143.7, -349],
      [26.4, 819.7, 132.2, -324.1],
      [28.4, 780.3, 120.7, -299.1],
      [30.0, 749.6, 111.1, -278],
      [31.0, 732.3, 105.5, -264.7],
      [32.0, 717.8, 100.8, -253.7],
      [33.0, 707.2, 97.35, -245.5],
      [33.8, 702, 95.65, -241.5],
      [34.5, 700, 95, -240],
      [35.2, 699.9, 94.97, -239.93],
      [36.0, 699.85, 94.95, -239.9],
    ],
    look: [
      { t: 20.4, p: [750, -5, 20] }, // önde apartman dokusu, ortada viyadük, üstte Torun
      { t: 26.4, p: [722, 8, 40] },
      { t: 30.0, p: [700, 15, 55] },
      { t: 33.0, p: [693, 20, 60] },
      { t: 34.5, p: [692, 21, 60] }, // kapak: kuleler üst-orta, ışık nehri orta bant
      { t: 36.0, p: [692, 21.1, 60] },
    ],
    fov: [
      [20.4, 46],
      [26.4, 48],
      [30.0, 52],
      [33.0, 55.5],
      [34.5, 56],
      [36.0, 56],
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
