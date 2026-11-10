// ATMO B — palet. Her şey güneş yüksekliğinin (derece) saf fonksiyonu; anahtarlar arası
// doğrusal ara değer (doğrusal renk uzayı). Sıçrama yok, durum yok.
//
// Renkler doğrusal RGB, sahne-göreli HDR (güneşli açık yüzey ≈ 0.9).

const KEYS = [
  {
    // sert gündüz — berrak, serin gök, sıcak güneş
    e: 40,
    zen: [0.02, 0.1, 0.42], mid: [0.06, 0.22, 0.7], midSun: [0.1, 0.3, 0.76],
    hor: [0.24, 0.47, 0.9], horSun: [0.42, 0.6, 0.92],
    glow: [0.3, 0.26, 0.2], glowPow: 260,
    disc: [30, 27, 22], discR: 0.014,
    sun: [1.0, 0.84, 0.6], sunI: 4.2,
    hemiSky: [0.19, 0.27, 0.55], hemiGnd: [0.85, 0.7, 0.52], hemiI: 1.0, envI: 0.6,
    exposure: 1.08,
    fogK: 0.00003, fogR: 3600, fogLow: 0.0, fogTint: [1, 1, 1],
    bloomS: 0.5, bloomT: 1.3, bloomR: 0.35, streak: 0.05,
    split: 0.35, sat: 1.12, con: 1.16, vig: 0.26,
    cloudLit: [1.25, 1.22, 1.18], cloudDark: [0.62, 0.72, 0.9], cloudOp: 0.42, cloudCov: 0.16,
    bloomClamp: 1.6, bloomCap: 0.6, bounce: 0.34, cloudUnder: 0.0,
  },
  {
    // altın saat
    e: 11,
    zen: [0.03, 0.1, 0.38], mid: [0.16, 0.28, 0.62], midSun: [0.6, 0.44, 0.5],
    hor: [0.36, 0.42, 0.72], horSun: [0.95, 0.6, 0.3],
    glow: [0.5, 0.26, 0.08], glowPow: 60,
    disc: [24, 16, 7], discR: 0.019,
    sun: [1.0, 0.6, 0.26], sunI: 4.4,
    hemiSky: [0.24, 0.3, 0.65], hemiGnd: [0.7, 0.48, 0.32], hemiI: 0.7, envI: 0.75,
    exposure: 1.2,
    fogK: 0.00003, fogR: 3300, fogLow: 0.0002, fogTint: [1, 1, 1],
    bloomS: 0.55, bloomT: 1.25, bloomR: 0.35, streak: 0.12,
    split: 0.45, sat: 1.15, con: 1.14, vig: 0.3,
    cloudLit: [1.25, 0.82, 0.5], cloudDark: [0.36, 0.34, 0.6], cloudOp: 0.6, cloudCov: 0.22,
    bloomClamp: 1.5, bloomCap: 0.6, bounce: 0.3, cloudUnder: 0.25,
  },
  {
    // alçak güneş — turuncu/macenta başlıyor
    e: 4.5,
    zen: [0.03, 0.035, 0.24], mid: [0.55, 0.26, 0.5], midSun: [0.85, 0.25, 0.36],
    hor: [0.8, 0.5, 0.46], horSun: [1.0, 0.25, 0.04],
    glow: [0.5, 0.12, 0.02], glowPow: 40,
    disc: [18, 8.5, 1.8], discR: 0.024,
    sun: [1.0, 0.46, 0.17], sunI: 3.3,
    hemiSky: [0.3, 0.26, 0.85], hemiGnd: [0.42, 0.24, 0.3], hemiI: 0.58, envI: 0.6,
    exposure: 1.15,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0004, fogTint: [1, 1, 1],
    bloomS: 0.6, bloomT: 1.2, bloomR: 0.35, streak: 0.22,
    split: 0.5, sat: 1.1, con: 1.12, vig: 0.34,
    cloudLit: [1.9, 0.75, 0.4], cloudDark: [0.3, 0.16, 0.42], cloudOp: 0.78, cloudCov: 0.3,
    bloomClamp: 1.3, bloomCap: 0.55, bounce: 0.12, cloudUnder: 0.7,
  },
  {
    // gün batımı doruğu — macenta → turuncu → mor
    e: 1.2,
    zen: [0.028, 0.022, 0.2], mid: [0.72, 0.2, 0.44], midSun: [0.95, 0.15, 0.34],
    hor: [0.95, 0.46, 0.34], horSun: [1.0, 0.18, 0.03],
    glow: [0.45, 0.08, 0.02], glowPow: 30,
    disc: [14, 5.5, 0.8], discR: 0.028,
    sun: [1.0, 0.36, 0.1], sunI: 3.4,
    hemiSky: [0.26, 0.2, 0.85], hemiGnd: [0.38, 0.18, 0.32], hemiI: 0.52, envI: 0.6,
    exposure: 1.15,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0006, fogTint: [1, 1, 1],
    bloomS: 0.6, bloomT: 1.15, bloomR: 0.35, streak: 0.3,
    split: 0.5, sat: 1.1, con: 1.14, vig: 0.38,
    cloudLit: [1.9, 0.5, 0.3], cloudDark: [0.24, 0.1, 0.34], cloudOp: 0.85, cloudCov: 0.32,
    bloomClamp: 1.2, bloomCap: 0.5, bounce: 0.06, cloudUnder: 1.0,
  },
  {
    // güneş battı — kor ufuk, mor gök
    e: -2.5,
    zen: [0.02, 0.016, 0.14], mid: [0.38, 0.09, 0.36], midSun: [0.7, 0.08, 0.32],
    hor: [0.55, 0.22, 0.3], horSun: [0.85, 0.13, 0.04],
    glow: [0.3, 0.06, 0.02], glowPow: 14,
    disc: [0, 0, 0], discR: 0.028,
    sun: [1.0, 0.3, 0.1], sunI: 0.0,
    hemiSky: [0.24, 0.2, 0.85], hemiGnd: [0.3, 0.15, 0.3], hemiI: 0.42, envI: 0.7,
    exposure: 1.2,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0009, fogTint: [1, 1, 1],
    bloomS: 0.7, bloomT: 1.05, bloomR: 0.35, streak: 0.34,
    split: 0.55, sat: 1.12, con: 1.12, vig: 0.42,
    cloudLit: [1.2, 0.24, 0.28], cloudDark: [0.1, 0.04, 0.2], cloudOp: 0.85, cloudCov: 0.32,
    bloomClamp: 1.2, bloomCap: 0.5, bounce: 0.0, cloudUnder: 0.8,
  },
  {
    // mavi saat — ışıklar tek tek yanıyor
    e: -6.5,
    zen: [0.01, 0.014, 0.09], mid: [0.06, 0.04, 0.2], midSun: [0.2, 0.05, 0.24],
    hor: [0.035, 0.06, 0.2], horSun: [0.42, 0.1, 0.14],
    glow: [0.16, 0.04, 0.05], glowPow: 10,
    disc: [0, 0, 0], discR: 0.028,
    sun: [0.4, 0.6, 1.0], sunI: 0.0,
    hemiSky: [0.2, 0.3, 0.9], hemiGnd: [0.3, 0.18, 0.22], hemiI: 0.26, envI: 1.0,
    exposure: 1.35,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0011, fogTint: [1, 1, 1],
    bloomS: 0.8, bloomT: 1.0, bloomR: 0.35, streak: 0.3,
    split: 0.7, sat: 1.2, con: 1.1, vig: 0.46,
    cloudLit: [0.3, 0.08, 0.2], cloudDark: [0.03, 0.025, 0.1], cloudOp: 0.82, cloudCov: 0.32,
    bloomClamp: 1.2, bloomCap: 0.5, bounce: 0.0, cloudUnder: 0.25,
  },
  {
    // gece başlangıcı
    e: -12,
    zen: [0.003, 0.006, 0.03], mid: [0.008, 0.018, 0.06], midSun: [0.02, 0.02, 0.07],
    hor: [0.012, 0.04, 0.07], horSun: [0.035, 0.04, 0.08],
    glow: [0, 0, 0], glowPow: 10,
    disc: [0, 0, 0], discR: 0.028,
    sun: [0.4, 0.6, 1.0], sunI: 0.0,
    hemiSky: [0.1, 0.42, 0.7], hemiGnd: [0.3, 0.2, 0.14], hemiI: 0.2, envI: 1.0,
    exposure: 1.4,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0013, fogTint: [1, 1, 1],
    bloomS: 0.85, bloomT: 1.0, bloomR: 0.35, streak: 0.24,
    split: 0.9, sat: 1.22, con: 1.08, vig: 0.5,
    cloudLit: [0.03, 0.05, 0.09], cloudDark: [0.005, 0.01, 0.03], cloudOp: 0.8, cloudCov: 0.32,
    bloomClamp: 1.2, bloomCap: 0.5, bounce: 0.0, cloudUnder: 0.0,
  },
  {
    // derin gece — lacivert-siyah, teal
    e: -20,
    zen: [0.0015, 0.004, 0.02], mid: [0.004, 0.013, 0.04], midSun: [0.004, 0.013, 0.04],
    hor: [0.01, 0.036, 0.058], horSun: [0.01, 0.036, 0.058],
    glow: [0, 0, 0], glowPow: 10,
    disc: [0, 0, 0], discR: 0.028,
    sun: [0.4, 0.6, 1.0], sunI: 0.0,
    hemiSky: [0.08, 0.42, 0.62], hemiGnd: [0.3, 0.2, 0.12], hemiI: 0.2, envI: 1.0,
    exposure: 1.4,
    fogK: 0.00004, fogR: 3000, fogLow: 0.0014, fogTint: [1, 1, 1],
    bloomS: 0.85, bloomT: 1.0, bloomR: 0.35, streak: 0.22,
    split: 1.0, sat: 1.22, con: 1.08, vig: 0.52,
    cloudLit: [0.02, 0.045, 0.075], cloudDark: [0.003, 0.008, 0.024], cloudOp: 0.8, cloudCov: 0.32,
    bloomClamp: 1.2, bloomCap: 0.5, bounce: 0.0, cloudUnder: 0.0,
  },
];

const FIELDS = Object.keys(KEYS[0]).filter((k) => k !== 'e');

function makeOut() {
  const o = { e: 0 };
  for (const f of FIELDS) o[f] = Array.isArray(KEYS[0][f]) ? [0, 0, 0] : 0;
  return o;
}

/** Güneş yüksekliği (derece) → palet. `out` yeniden kullanılır. */
export function paletteAt(elevDeg, out = makeOut()) {
  const n = KEYS.length;
  let i = 0;
  let u = 0;
  if (elevDeg >= KEYS[0].e) {
    i = 0;
    u = 0;
  } else if (elevDeg <= KEYS[n - 1].e) {
    i = n - 2;
    u = 1;
  } else {
    while (i < n - 2 && elevDeg < KEYS[i + 1].e) i++;
    u = (KEYS[i].e - elevDeg) / (KEYS[i].e - KEYS[i + 1].e);
  }
  const a = KEYS[i];
  const b = KEYS[i + 1];
  out.e = elevDeg;
  for (const f of FIELDS) {
    const va = a[f];
    const vb = b[f];
    if (Array.isArray(va)) {
      const o = out[f];
      o[0] = va[0] + (vb[0] - va[0]) * u;
      o[1] = va[1] + (vb[1] - va[1]) * u;
      o[2] = va[2] + (vb[2] - va[2]) * u;
    } else out[f] = va + (vb - va) * u;
  }
  return out;
}

export const smooth = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// Ay: sabit konum (doğu-güneydoğu, ~30° yükseklik) — gece arkadan/yandan teal kenar ışığı.
// +X doğu, +Z güney.
export const MOON_DIR = (() => {
  const az = (100 * Math.PI) / 180;
  const el = (30 * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
})();
export const MOON_COLOR = [0.36, 0.7, 1.0];
export const MOON_INTENSITY = 0.85;
/** Ay ışığı/diski görünürlüğü: güneş −6°…−13° arası açılır (güneş ışığı −2.5°'de sıfır). */
export const moonK = (elevDeg) => smooth(-6, -13, elevDeg);
