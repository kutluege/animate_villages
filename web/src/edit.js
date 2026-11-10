// Kamera rotası + kurgu — "Mecidiyeköy'de bir gün, gündüzden geceye" (CONTRACT §6).
// Saf modül: içe aktarma yok, durum yok. shotAt(t) yalnızca t'nin fonksiyonudur.
//
// Tek kesintisiz plan (kesme yok), 50 sn:
//   A  0–4      Metrobüs şeridinin üstünden, D100 trafiğinin hemen üstünde dik yukarı bakışla kulelerin dibine.
//   B  4–10     Konut kulesi ile Medianova arasından kuzeye, ikiz kulelerin arasından batıya.
//   C  10–14    Apartman denizinin üstünde, batan güneş kadrajda; kuleye dönüş.
//   D  14–17    Batı cephesi önünde yay: yansıma cam boyunca kayar.
//   E  17–23    Alacakaranlık: Trump'tan dönüp metrobüs hattının üstünden doğuya.
//   F  23–29    Güneye, mezarlıkların koyu selvileri üstünden Cevahir'e.
//   G  29–35    Cevahir'in cam çatısı üstünden çapraz geçiş.
//   H  35–42    Torun Center'a dönerken gece iner.
//   I  42–50    Son dönüş: viyadük üstünden Trump ikizine; ışık şeridi gözü kulelere taşır, son 1.5 sn sakin.
// Eğriler: konum/bakış/fov için zamana göre doğal kübik spline (C2: hız ve ivme sürekli); son uçta hız 0.
// tod: pozitif genlikli quintic smootherstep'lerin toplamı → monoton ve C2.

export const DURATION = 50;

// [t, konum x,y,z, bakış x,y,z, fov(dikey, derece)]
const KEYS = [
  // A — metrobüs şeridinin üstünden (yer+5.5 m), D100'ü dik yukarı bakışla geçip kulelerin dibine
  [0.0,   -14,   6.6, -46.5,    22,  41.0, -165,  74],
  [1.2,    -8,  10.0, -62.0,    26,  58.0, -168,  72],
  [2.6,     8,  15.5, -80.0,    32,  82.0, -175,  68],
  [4.0,    34,  21.0, -96.0,    42,  85.0, -200,  70],
  // B — konut kulesi ile Medianova arasından kuzeye, ikiz kulelerin arasından batıya
  [5.6,    66,  27.0, -115.0,   45,  65.0, -240,  72],
  [6.7,    63,  29.0, -162.0,    5,  45.0, -255,  74],
  [7.9,    38,  32.0, -210.0,  -70,  38.0, -240,  74],
  [9.1,   -15,  35.0, -226.0, -130,  45.0, -170,  72],
  // C — apartman denizinin üstünde, batan güneşe doğru; güneye kıvrılırken kuleye dönüş (yayılmış)
  [10.6,  -88,  42.0, -224.0, -150,  50.0, -130,  68],
  [12.3, -150,  50.0, -213.0,  -90,  62.0,  -80,  64],
  // D — batı cephesi önünde yay: yansıma cam boyunca kayar
  [14.0, -180,  56.0, -186.0,   25,  80.0, -170,  54],
  [15.5, -190,  60.0, -150.0,   25,  82.0, -158,  48],
  [17.0, -182,  63.0, -108.0,   25,  80.0, -146,  50],
  // E — alacakaranlık: Trump'tan dönüp metrobüs hattının üstünden doğuya (hat kadrajın solunda)
  [19.8, -150,  34.0, -44.0,    60,   4.0, -46,   62],
  [22.6,  -62,  28.0, -28.0,   110,   4.0,  40,   64],
  // F — güneye: mezarlıkların (Ermeni Katolik, Metamorfos) koyu selvileri üstünden Cevahir'e
  [25.4,  -12,  40.0,  55.0,    60,   0.0, 330,   64],
  [28.6,   12,  52.0, 175.0,    95,   8.0, 420,   62],
  // G — Cevahir: cam çatının üstünden çapraz geçiş
  [31.8,   45,  64.0, 290.0,   130,   5.0, 440,   62],
  [35.0,  150,  72.0, 360.0,   330,  20.0, 380,   64],
  // H — Torun Center'a dönerken gece
  [38.4,  270,  80.0, 300.0,   600,  70.0, 140,   62],
  [42.0,  400,  86.0, 200.0,   944,  70.0, -54,   62],
  // I — son dönüş: viyadük üstüne, Trump ikizine; metrobüs/D100 ışık şeridi gözü kulelere taşır
  [45.0,  440,  85.0,  90.0,   388,  45.0, -508,  63],
  [47.6,  466,  85.0,   0.0,   -54,  20.0, -300,  65],
  [48.6,  469.7, 85.0, -7.6,    21, -12.0, -141.6, 66],
  [50.0,  470,  85.0, -8.0,     20, -12.5, -142,  66],
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
  [1.15, 0.0, 13.5],  // 17:30 sıcak geç ikindi, alçak yandan güneş → ~18:45 altın saat
  [0.45, 10.0, 20.0], // altın saat → batış 19:20 (yay boyunca camda kayan yansıma)
  [0.50, 18.0, 36.0], // alacakaranlık / mavi saat 19:20–19:50, yavaş: ilk pencereler, lambalar
  [1.75, 36.0, 46.0], // Torun dönüşünde geceye → 21:30
]
export function todAt(t) {
  let v = 17.5 + 0.004 * t;
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
