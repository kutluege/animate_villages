// Kamera rotası + kurgu — "Mecidiyeköy'de bir gün, gündüzden geceye" (CONTRACT §6).
// Saf modül: içe aktarma yok, durum yok. shotAt(t) yalnızca t'nin fonksiyonudur.
//
// Tek kesintisiz plan (kesme yok):
//   A  0–4 sn    Viyadük tabliyesinin üstünde, metrobüs şeridi boyunca 50 m/s batıya; Trump kuleleri ilk kareden kadrajda.
//   B  4–10 sn   Viyadük ucundan düşüp konut kulesi ile Medianova arasından kuzeye, ikiz kulelerin arasından batıya.
//   C  10–15 sn  Apartman denizinin üstünde alçak geçiş (batan güneş kadrajda), güneye kıvrılıp kuleye dönüş.
//   D  15–20 sn  Batı cephesi karşısında nefes: alçalan güneş camda (ayna açısı check-route ile doğrulanır).
//   E  20–36 sn  Geniş, sakin geri/yukarı çekilme — pencereler/lambalar yanar; doğuya bakan son kare:
//                Trump ikizi + Torun Center, metrobüs/D100 ışık şeridi alttan kulelere; üstte ~%25 gök.
// Eğriler: konum/bakış/fov için zamana göre doğal kübik spline (C2: hız ve ivme sürekli); son uçta hız 0.
// tod: pozitif genlikli quintic smootherstep'lerin toplamı → monoton ve C2.

export const DURATION = 36;

// [t, konum x,y,z, bakış x,y,z, fov(dikey, derece)]
const KEYS = [
  // A — viyadük tabliyesi üstü, metrobüs şeridi boyunca, Trump kuleleri kadrajın sağ üstünde büyük
  [0.0,   345,  12.0, -14.0,   120,  62.0, -128,  60],
  [1.5,   270,  12.8, -16.5,    60,  80.0, -145,  63],
  [3.0,   195,  16.5, -22.0,    40,  86.0, -135,  68],
  // B — viyadük ucundan düşüp konut kulesi ile Medianova arasından kuzeye, ikiz kulelerin arasından batıya
  [4.9,   100,  24.0, -55.0,    55,  60.0, -185,  70],
  [6.3,    66,  26.0, -115.0,   48,  62.0, -235,  72],
  [7.4,    64,  28.0, -160.0,   10,  45.0, -255,  74],
  [8.7,    38,  31.0, -210.0,  -70,  38.0, -240,  74],
  [10.0,  -15,  34.0, -226.0, -140,  42.0, -200,  72],
  // C — apartman denizinin üstünde alçak geçiş, güneye kıvrılıp batı cepheye dönüş
  [11.8,  -92,  41.0, -219.0, -170,  52.0, -130,  66],
  [13.6, -162,  52.0, -194.0,  -90,  70.0, -100,  56],
  // D — gün batımı camda (batı cephesi, ayna açısı)
  [15.2, -196,  60.0, -163.0,   25,  82.0, -158,  46],
  [17.6, -210,  63.0, -158.0,   25,  80.0, -160,  45],
  [20.0, -235,  70.0, -150.0,   40,  76.0, -160,  47],
  // E — geniş ve sakin geri/yukarı çekilme: pencereler, lambalar, metrobüs ışık şeridi
  [23.0, -310,  86.0, -134.0,  130,  30.0, -158,  58],
  [26.5, -390, 101.0, -119.0,  220, -50.0, -154,  70],
  [30.0, -428, 106.5, -113.5,  255, -95.0, -152,  76],
  [33.0, -438, 107.8, -112.2,  261, -108.0, -152, 77.7],
  [34.5, -439.6, 108.0, -112.0, 261.8, -110.0, -152, 78],
  [36.0, -440, 108.0, -112.0,  262, -110.0, -152,  78],
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
