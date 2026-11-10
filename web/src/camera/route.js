// KAMERA ROTASI — saf matematik (three yok, durum yok): poseAt(t) → { pos, target, fov }.
// Tek kesintisiz çekim, KESME YOK. Koordinatlar yerel metre (+X doğu, +Z güney, +Y yukarı).
//
// Yay (t = film saniyesi):
//   0–1.4   Viyadüğün altı: Büyükdere Cd. şeridinin (w1459601395) ~4.5 m üstünde, tabliyenin
//           gölgesinde, ayak sıralarının arasından batıya 52 m/sn; güney kenardan ışığa çıkış.
//   1.4–4   Torun Center kulelerinin dibinden yukarı bakış; kuleler solda akarken tırmanış.
//   4–11    Şehir açılır: viyadük → D-100 üstünde batıya (≈77 m/sn, hiperlaps), Trump öne gelir.
//   11–16.7 Trump'ın güneyinden geçerken kuleyi izleyen yay; geri-geri çekilerek yavaşlama.
//   16.7–20.6 DORUK: kamera Trump Residence batı cephesinin AYNA doğrultusunda neredeyse durur.
//           Batan güneşin yansıması camın içinde alçalır (geometri: check.mjs "doruk" bölümü).
//           Not: cepheler eksenlere paralel; gerçek güneş ile yansıması arasında ≥40° var,
//           9:16 kadraja ikisi birden sığmaz → kadrajdaki "alçak güneş" camdaki yansımadır.
//   20.6–27 Sakin vinç: geri ve yukarı; iki kule + şehir, ışıklar tek tek yanar.
//   27–34.5 D-100 / metrobüs ekseninin üstüne süzülerek alçalma; bakış yol eksenine döner.
//   34.5–36 Kapak karesi: ışık nehri ortada, solda Trump, sağda uzakta Torun, üst %40 gece göğü.
//
// Düğümler zaman-parametreli C2 kübik spline ile geçilir (hız ve ivme sürekli).
// Doğrulama: node web/src/camera/check.mjs  (çarpışma, zemin/tabliye açıklığı, hız/ivme,
// dönüş hızı, doruk ayna geometrisi).

export const DURATION = 36;
export const CUTS = []; // kesme yok

// [t, x, y, z]
export const POS = [
  // Viyadük altı: DÜZ bir çapraz (pusula 247°). Kuzey ayak sırasının güneyinden başlar, güney
  // sırayı (844,41) ile (812,43) ayaklarının tam ortasından keser; her ayağa ≥5.4 m, başlık
  // kirişlerinin ucuna ≥0.4 m yatay + 2 m düşey (ayak konumları şehir modülünden; check.mjs denetler).
  [0.0, 880, -3.2, 20.2],
  [0.5, 855.6, -3.7, 30.4],
  [1.0, 831.2, -4.1, 40.7],
  [1.5, 806.8, -3.3, 50.9],
  [2.2, 770, 3.5, 60],
  [2.9, 729, 14, 62.5],
  [3.7, 678, 27.5, 61.5],
  [4.5, 625, 40, 61],
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
  [15.6, -142.5, 53, -14],
  [16.4, -166, 48, -23],
  [17.3, -186, 44, -27.5],
  [18.2, -198, 41.5, -28.5],
  [19.2, -207.5, 40.2, -27.5],
  [20.6, -218.5, 40.5, -24.5],
  [22.6, -240, 52, -20],
  [25.0, -279, 80, -20.5],
  [27.0, -317, 96, -22.2],
  [29.0, -362, 91, -24.8],
  [31.0, -411, 68, -27.5],
  [32.0, -436.3, 58, -28.8],
  [33.0, -454.4, 51, -29.8],
  [33.8, -462.8, 47.6, -30.25],
  [34.5, -465.5, 46.3, -30.4],
  [35.2, -465.9, 46.05, -30.4],
  [36.0, -466, 46.0, -30.4],
];

// Bakış: { t, az, pitch, d } (kameradan pusula açısı°, eğim°, uzaklık m) ya da { t, p:[x,y,z] }.
// İkisi de bakış NOKTASINA çevrilir; noktalar C2 spline ile geçilir.
export const LOOK = [
  { t: 0.0, az: 242, pitch: 4, d: 110 },
  { t: 0.5, az: 234, pitch: 9, d: 120 }, // tabliye kenarının altından Torun kuleleri
  { t: 1.0, az: 225, pitch: 18, d: 130 },
  { t: 1.5, az: 216, pitch: 29, d: 140 }, // ışığa çıkış: Torun C · B · A yelpazesi
  { t: 2.2, az: 212, pitch: 38, d: 140 }, // dipten yukarı
  { t: 2.9, az: 214, pitch: 35, d: 150 },
  { t: 3.7, az: 229, pitch: 21, d: 180 },
  { t: 4.5, az: 250, pitch: 6, d: 230 },
  { t: 5.3, az: 265, pitch: -1, d: 260 },
  { t: 6.2, az: 277, pitch: -3, d: 280 },
  { t: 7.2, az: 286, pitch: -4, d: 300 },
  { t: 8.2, az: 293, pitch: -4, d: 300 },
  { t: 9.2, p: [55, 70, -105] }, // Trump Residence izlenir
  { t: 10.2, p: [52, 82, -110] },
  { t: 11.2, p: [50, 91, -112] },
  { t: 12.1, p: [49, 98, -113] },
  { t: 13.0, p: [48, 99, -113] },
  { t: 13.9, p: [47, 93, -113] },
  { t: 14.8, p: [46, 84, -112] },
  { t: 15.6, p: [45, 76, -112] },
  { t: 16.4, p: [44, 70, -111] },
  { t: 17.3, p: [44, 67, -111] },
  { t: 20.6, p: [44, 63, -112] },
  { t: 22.6, p: [44, 60, -125] },
  { t: 25.0, p: [42, 50, -160] },
  { t: 27.0, p: [40, 42, -175] },
  { t: 29.0, p: [80, 40, -120] },
  { t: 31.0, p: [110, 50, -60] },
  { t: 33.0, az: 89.6, pitch: 3.5, d: 600 },
  { t: 34.5, az: 90.7, pitch: 6, d: 600 },
  { t: 36.0, az: 90.7, pitch: 6.03, d: 600 },
];

// [t, dikey fov°]
export const FOV = [
  [0.0, 66],
  [2.2, 66],
  [3.7, 62],
  [5.3, 55],
  [7.2, 50],
  [12.1, 50],
  [14.8, 46],
  [16.6, 44],
  [20.6, 44],
  [23.0, 46],
  [27.0, 50],
  [31.0, 52],
  [34.5, 53],
  [36.0, 53],
];

// Uç türevleri: açılışta kamera zaten hızlı (duran kareden başlamaz); sonda durur.
const POS_V0 = [-48.8, -0.8, 20.5];
const TGT_V0 = [-34, 3, 48];
const ZERO = [0, 0, 0];

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

const posAt = track(POS, 3, POS_V0, ZERO);
const D2R = Math.PI / 180;
export const TGT = LOOK.map((k) => {
  if (k.p) return [k.t, k.p[0], k.p[1], k.p[2]];
  const c = posAt(k.t);
  const h = Math.cos(k.pitch * D2R) * k.d;
  return [k.t, c[0] + Math.sin(k.az * D2R) * h, c[1] + Math.sin(k.pitch * D2R) * k.d, c[2] - Math.cos(k.az * D2R) * h];
});
const tgtAt = track(TGT, 3, TGT_V0, ZERO);
const fovAt = track(FOV, 1, [0], [0]);

/** Film saniyesi → kamera pozu. Saf; [0, DURATION] dışında uçlara kenetlenir. */
export function poseAt(t) {
  const u = Math.min(DURATION, Math.max(0, Number.isFinite(t) ? t : 0));
  return { pos: posAt(u), target: tgtAt(u), fov: fovAt(u)[0] };
}
