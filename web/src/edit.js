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
  // A — viyadük tabliyesinin altında, kuzey yol ekseninde (ayak çiftinin arası), gölgede; Trump ikizi tabliye kenarının altından ışıkta
  [0.0,   332,  -2.0, -21.7,    40,  70.0, -148,  66],
  [0.8,   292,   1.6, -33.0,    40,  78.0, -150,  66],
  [1.7,   248,  10.5, -42.5,    40,  85.0, -150,  66],
  [2.4,   210,  13.0, -47.5,    40,  90.0, -158,  67],
  // B — Mecidiyeköy Yolu üstünden yükselip konut kulesi ile Medianova arasından kuzeye, ikiz kulelerin arasından batıya
  [3.2,   168,  19.0, -60.0,    45,  95.0, -165,  68],
  [4.4,   102,  24.0, -72.0,    50,  80.0, -200,  70],
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
  // E — geri ve aşağı çekilme (koridor boyunca batıya), ışıklar yanarken genişleyen kadraj
  [19.5, -262,  58.0, -82.0,    60,  60.0, -140,  58],
  [22.0, -360,  54.0, -60.0,   120,  30.0, -140,  68],
  [24.0, -412,  55.0, -42.0,   170,  10.0, -145,  72],
  // F — yükselip ileri (doğuya) süzülerek kapak kadrajına oturma
  [27.0, -400,  70.0, -80.0,   220, -25.0, -155,  76],
  [30.5, -350,  90.0, -140.0,  250, -45.0, -163,  79],
  [33.5, -322,  99.4, -168.2,  261, -54.0, -167,  80],
  [34.5, -320.3, 99.9, -169.8, 261.8, -54.8, -168, 80],
  [36.0, -320,  100.0, -170.0, 262, -55.0, -168,  80],
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
  [0.75, 17.5, 27.0], // batış → mavi saat 19:50 → ~20:00: lightsOn yükselişi geniş planda
  [1.50, 24.0, 33.0], // → 21:30 tam gece
];
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
