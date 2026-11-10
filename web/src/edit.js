// Kamera rotası + kurgu — "Mecidiyeköy'de bir gün, gündüzden geceye" (CONTRACT §6).
// Saf modül: içe aktarma yok, durum yok. shotAt(t) yalnızca t'nin fonksiyonudur.
//
// Tek kesintisiz plan (kesme yok), dört bölüm:
//   A  0–6 sn    Viyadüğün kuzey kenarı altında, Büyükdere Cd. trafik hizasında (yer+5 m, otobüs tavanı üstü) batıya hızla;
//                kavşakta gölgeden çıkıp Mecidiyeköy Yolu üstünden yükselerek Trump Towers'ın dibine fırlar.
//   B  6–14 sn   Konut kulesine dipten bakıp kule boyunca vinç gibi yükselir, güneyinden batı cephesine döner.
//   C  14–20 sn  Batı cephesi karşısında yavaş yanal kaydırma: alçalan güneş camda (ayna açısı veride doğrulanır).
//   D  20–36 sn  Geri ve yukarı çekilme (geniş, sakin) — pencereler/lambalar yanar; doğuya bakan son kare:
//                metrobüs hattı alttan derinliğe akan ışık şeridi, Trump kuleleri ve uzakta Torun Center.
// Eğriler: konum/bakış/fov için zamana göre doğal kübik spline (C2: hız ve ivme sürekli); son uçta hız 0.
// tod: pozitif genlikli quintic smootherstep'lerin toplamı → monoton ve C2.

export const DURATION = 36;

// [t, konum x,y,z, bakış x,y,z, fov(dikey, derece)]
const KEYS = [
  [0.0,  612,  -6.8, -20.6,   450,  -6.0, -23.0, 74],
  [1.5,  523,  -5.3, -22.0,   360,  -3.0, -26.0, 74],
  [3.0,  433,  -2.6, -26.5,   270,   4.0, -37.0, 72],
  [4.3,  352,   1.5, -33.8,   190,  20.0, -50.0, 68],
  [5.6,  280,  12.0, -38.0,   100,  45.0,  -90,  64],
  [7.2,  190,  24.0, -42.0,    40,  85.0, -140,  60],
  [9.0,  100,  36.0, -48.0,    30, 105.0, -150,  58],
  [10.8,  25,  50.0, -58.0,    28, 112.0, -152,  56],
  [12.6, -50,  64.0, -76.0,    28, 104.0, -156,  53],
  [14.4, -105, 72.0, -104.0,   26,  92.0, -162,  50],
  [16.5, -140, 73.0, -128.0,   25,  86.0, -166,  47],
  [19.0, -172, 75.0, -140.0,   28,  83.0, -166,  47],
  [21.5, -240, 82.0, -146.0,   50,  79.0, -162,  49],
  [24.0, -325, 95.0, -136.0,  125,  62.0, -162,  56],
  [27.0, -388, 102.5, -122.0, 205,  42.0, -160,  64],
  [30.0, -420, 106.2, -115.0, 245,  33.0, -158,  69],
  [33.0, -436, 107.8, -112.4, 257,  30.3, -157,  70.6],
  [34.5, -439.4, 108.0, -112.05, 259.6, 30.0, -157, 71],
  [36.0, -440, 108.0, -112.0, 260,  30.0, -157,  71],
];

// ───────── doğal kübik spline (başta doğal, sonda hız=0 kelepçeli) ─────────
function spline(ts, ys, endSlope) {
  const n = ts.length, h = [], al = [], l = new Array(n), mu = new Array(n), z = new Array(n), c = new Array(n);
  for (let i = 0; i < n - 1; i++) h[i] = ts[i + 1] - ts[i];
  for (let i = 1; i < n - 1; i++) al[i] = (3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  // başlangıç: doğal (y''=0); bitiş: y'=endSlope
  l[0] = 1; mu[0] = 0; z[0] = 0;
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (ts[i + 1] - ts[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (al[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  const aN = 3 * endSlope - (3 / h[n - 2]) * (ys[n - 1] - ys[n - 2]);
  l[n - 1] = h[n - 2] * (2 - mu[n - 2]);
  z[n - 1] = (aN - h[n - 2] * z[n - 2]) / l[n - 1];
  c[n - 1] = z[n - 1];
  const b = [], d = [];
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  return (t) => {
    let i = 0;
    if (t <= ts[0]) i = 0; else if (t >= ts[n - 1]) i = n - 2;
    else while (i < n - 2 && t > ts[i + 1]) i++;
    const x = Math.min(Math.max(t, ts[0]), ts[n - 1]) - ts[i];
    return ys[i] + x * (b[i] + x * (c[i] + x * d[i]));
  };
}

const T = KEYS.map((k) => k[0]);
const CH = [1, 2, 3, 4, 5, 6, 7].map((j) => spline(T, KEYS.map((k) => k[j]), 0));

// ───────── günün saati ─────────
const smoother = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (u * (u * 6 - 15) + 10));
// [genlik (saat), başlangıç sn, bitiş sn]
const TOD_SEGS = [
  [2.15, 0.0, 14.5],  // 16:30 parlak ikindi → ~18:45 altın saat (açılış hızlı)
  [0.50, 11.0, 23.5], // altın saat → batış 19:20 (camda yansıma, yavaş)
  [0.60, 20.5, 29.0], // batış → mavi saat 19:50 → ~20:00: lightsOn yükselişi geniş planda
  [1.75, 26.0, 34.0], // → 21:30 tam gece
];
export function todAt(t) {
  let v = 16.5 + 0.005 * t;
  for (const [A, s, e] of TOD_SEGS) v += A * smoother((t - s) / (e - s));
  return v;
}

export function shotAt(t) {
  t = Math.min(Math.max(Number(t) || 0, 0), DURATION);
  const v = CH.map((f) => f(t));
  return {
    position: [v[0], v[1], v[2]],
    target: [v[3], v[4], v[5]],
    fov: v[6],
    tod: todAt(t),
    roll: 0,
  };
}
