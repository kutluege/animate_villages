// ATMO A — "sıcak, nemli, gerçek İstanbul". Palet: güneş yüksekliğine (derece) göre anahtarlar.
// Her değer doğrusal (sahne-referanslı) renk/şiddet; aralar Catmull-Rom ile sürekli.
// Tek girdi güneş yüksekliği olduğundan sabah/akşam simetrik ve tümüyle `tod`'un saf fonksiyonu.
//
// Alanlar
//   zen, hor, horS   gök: başucu, ufuk (güneşin tersi), ufuk (güneş yönü)
//   band, bandS      ufka yapışık pus katmanı (sis rengi de budur): ters yön / güneş yönü
//   glow             güneş çevresi Mie parlaması
//   sun, sunI, disc  yön ışığı rengi, şiddeti; görünen disk parlaklığı
//   amb              yukarıdan gelen gök ışığı (gölgeli başucu ışığı + yarıküre)
//   gnd              zeminden yansıyan/çıkan ışık (yarıküre alt rengi, env'in ufuk altı)
//   cLit, cDark      bulut: aydınlık kenar / koyu gövde
//   fog              sis yoğunluğu (1/m, zemin kotunda)
//   exp              pozlama
//   bloom            bloom şiddeti
//   azp              ufuk renginin güneş azimutuna toplanma üssü
//   moon, stars      ay ve yıldız görünürlüğü
const K = [
  {
    e: 60,
    zen: [0.1, 0.25, 0.64], hor: [0.6, 0.74, 0.95], horS: [0.95, 0.98, 1.0],
    band: [1.45, 1.47, 1.46], bandS: [1.75, 1.7, 1.6], glow: [0.5, 0.47, 0.42],
    sun: [1.0, 0.955, 0.89], sunI: 5.6, disc: 34,
    amb: [0.38, 0.47, 0.66], gnd: [0.3, 0.28, 0.25],
    cLit: [1.1, 1.08, 1.04], cDark: [0.62, 0.66, 0.74],
    fog: 0.00026, exp: 1.08, bloom: 0.14, azp: 1.4, moon: 0, stars: 0,
  },
  {
    e: 25,
    zen: [0.1, 0.24, 0.61], hor: [0.62, 0.72, 0.9], horS: [1.0, 0.95, 0.85],
    band: [1.3, 1.27, 1.18], bandS: [1.6, 1.45, 1.18], glow: [0.6, 0.5, 0.36],
    sun: [1.0, 0.9, 0.76], sunI: 5.2, disc: 32,
    amb: [0.38, 0.46, 0.63], gnd: [0.3, 0.26, 0.21],
    cLit: [1.2, 1.1, 0.96], cDark: [0.6, 0.62, 0.7],
    fog: 0.0003, exp: 1.06, bloom: 0.15, azp: 1.6, moon: 0, stars: 0,
  },
  {
    e: 11, // altın saat
    zen: [0.09, 0.21, 0.54], hor: [0.58, 0.56, 0.6], horS: [1.0, 0.75, 0.42],
    band: [0.9, 0.67, 0.4], bandS: [1.3, 0.88, 0.4], glow: [1.1, 0.65, 0.25],
    sun: [1.0, 0.7, 0.38], sunI: 4.4, disc: 26,
    amb: [0.46, 0.52, 0.72], gnd: [0.3, 0.22, 0.14],
    cLit: [1.5, 1.15, 0.75], cDark: [0.55, 0.5, 0.55],
    fog: 0.00044, exp: 1, bloom: 0.18, azp: 2.0, moon: 0, stars: 0,
  },
  {
    e: 6,
    zen: [0.1, 0.21, 0.5], hor: [0.52, 0.44, 0.5], horS: [1.15, 0.68, 0.3],
    band: [0.76, 0.5, 0.35], bandS: [1.5, 0.8, 0.28], glow: [1.4, 0.65, 0.2],
    sun: [1.0, 0.56, 0.24], sunI: 3.7, disc: 20,
    amb: [0.4, 0.43, 0.62], gnd: [0.26, 0.16, 0.1],
    cLit: [1.7, 0.95, 0.5], cDark: [0.45, 0.38, 0.48],
    fog: 0.00048, exp: 1.02, bloom: 0.2, azp: 2.3, moon: 0, stars: 0,
  },
  {
    e: 2, // gün batımı camda
    zen: [0.075, 0.15, 0.4], hor: [0.44, 0.33, 0.43], horS: [1.2, 0.52, 0.18],
    band: [0.6, 0.36, 0.3], bandS: [1.5, 0.6, 0.16], glow: [1.6, 0.55, 0.13],
    sun: [1.0, 0.42, 0.13], sunI: 3.0, disc: 13,
    amb: [0.3, 0.32, 0.52], gnd: [0.18, 0.11, 0.08],
    cLit: [1.8, 0.7, 0.36], cDark: [0.34, 0.26, 0.38],
    fog: 0.0005, exp: 1.05, bloom: 0.22, azp: 2.6, moon: 0, stars: 0,
  },
  {
    e: -0.5,
    zen: [0.055, 0.11, 0.33], hor: [0.34, 0.26, 0.39], horS: [1.1, 0.45, 0.17],
    band: [0.42, 0.27, 0.3], bandS: [1.35, 0.5, 0.15], glow: [1.0, 0.32, 0.09],
    sun: [1.0, 0.34, 0.1], sunI: 0.9, disc: 6,
    amb: [0.22, 0.25, 0.44], gnd: [0.1, 0.075, 0.07],
    cLit: [1.6, 0.55, 0.38], cDark: [0.24, 0.19, 0.32],
    fog: 0.0005, exp: 1.08, bloom: 0.22, azp: 2.8, moon: 0.05, stars: 0,
  },
  {
    e: -3,
    zen: [0.022, 0.06, 0.23], hor: [0.07, 0.105, 0.28], horS: [0.5, 0.3, 0.25],
    band: [0.08, 0.11, 0.26], bandS: [0.95, 0.4, 0.16], glow: [0.4, 0.14, 0.05],
    sun: [1.0, 0.3, 0.1], sunI: 0, disc: 0,
    amb: [0.1, 0.15, 0.36], gnd: [0.04, 0.04, 0.055],
    cLit: [0.75, 0.3, 0.3], cDark: [0.08, 0.085, 0.2],
    fog: 0.00046, exp: 1.1, bloom: 0.22, azp: 3.0, moon: 0.3, stars: 0,
  },
  {
    e: -6, // mavi saat
    zen: [0.0092, 0.0299, 0.149], hor: [0.0276, 0.0575, 0.207], horS: [0.161, 0.127, 0.23],
    band: [0.046, 0.0633, 0.172], bandS: [0.632, 0.299, 0.161], glow: [0.287, 0.115, 0.0575],
    sun: [1.0, 0.3, 0.1], sunI: 0, disc: 0,
    amb: [0.04, 0.075, 0.24], gnd: [0.02, 0.022, 0.035],
    cLit: [0.184, 0.115, 0.196], cDark: [0.023, 0.0345, 0.103],
    fog: 0.0004, exp: 1.08, bloom: 0.2, azp: 3.2, moon: 0.7, stars: 0.08,
  },
  {
    e: -10,
    zen: [0.00625, 0.0163, 0.0875], hor: [0.02, 0.0325, 0.119], horS: [0.05, 0.05, 0.125],
    band: [0.04, 0.04, 0.0938], bandS: [0.2, 0.106, 0.0938], glow: [0.0625, 0.025, 0.025],
    sun: [1.0, 0.3, 0.1], sunI: 0, disc: 0,
    amb: [0.022, 0.036, 0.12], gnd: [0.022, 0.017, 0.018],
    cLit: [0.0625, 0.05, 0.0875], cDark: [0.0137, 0.0175, 0.05],
    fog: 0.00034, exp: 1.04, bloom: 0.18, azp: 3.0, moon: 1, stars: 0.25,
  },
  {
    e: -14,
    zen: [0.0066, 0.0106, 0.0475], hor: [0.0343, 0.029, 0.0594], horS: [0.066, 0.0449, 0.0594],
    band: [0.066, 0.0422, 0.0475], bandS: [0.0792, 0.0475, 0.0475], glow: [0, 0, 0],
    sun: [1.0, 0.3, 0.1], sunI: 0, disc: 0,
    amb: [0.028, 0.026, 0.05], gnd: [0.03, 0.02, 0.014],
    cLit: [0.066, 0.0449, 0.0475], cDark: [0.0132, 0.0132, 0.029],
    fog: 0.0003, exp: 1, bloom: 0.17, azp: 2.0, moon: 1, stars: 0.35,
  },
  {
    e: -19, // gece: kirli turuncu-mor kubbe
    zen: [0.0119, 0.00924, 0.0343], hor: [0.0528, 0.0317, 0.0475], horS: [0.0475, 0.029, 0.0396],
    band: [0.099, 0.0528, 0.037], bandS: [0.099, 0.0528, 0.037], glow: [0, 0, 0],
    sun: [1.0, 0.3, 0.1], sunI: 0, disc: 0,
    amb: [0.036, 0.027, 0.032], gnd: [0.036, 0.022, 0.014],
    cLit: [0.0818, 0.0502, 0.0422], cDark: [0.0158, 0.0132, 0.0238],
    fog: 0.00028, exp: 1, bloom: 0.17, azp: 1.0, moon: 1, stars: 0.4,
  },
];

const FIELDS = Object.keys(K[0]).filter((k) => k !== 'e');

const cr = (p0, p1, p2, p3, u) => {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
};

export function makePalette() {
  const out = {};
  for (const f of FIELDS) out[f] = Array.isArray(K[0][f]) ? [0, 0, 0] : 0;
  return out;
}

/** elevDeg → palet (out üzerine yazar). Anahtarlar azalan yükseklikte sıralı. */
export function samplePalette(elevDeg, out) {
  const n = K.length;
  let i = 0;
  let u = 0;
  if (elevDeg >= K[0].e) {
    i = 0;
    u = 0;
  } else if (elevDeg <= K[n - 1].e) {
    i = n - 2;
    u = 1;
  } else {
    while (i < n - 2 && elevDeg < K[i + 1].e) i++;
    u = (K[i].e - elevDeg) / (K[i].e - K[i + 1].e);
  }
  const a = K[Math.max(0, i - 1)];
  const b = K[i];
  const c = K[i + 1];
  const d = K[Math.min(n - 1, i + 2)];
  for (const f of FIELDS) {
    const vb = b[f];
    if (Array.isArray(vb)) {
      for (let k = 0; k < 3; k++) {
        const lo = Math.min(vb[k], c[f][k]);
        const hi = Math.max(vb[k], c[f][k]);
        // Aşmayı kıs: değer iki komşu anahtarın biraz dışına taşabilir ama negatife düşmez.
        const v = cr(a[f][k], vb[k], c[f][k], d[f][k], u);
        out[f][k] = Math.max(0, Math.min(hi + 0.08 * (hi - lo), Math.max(lo - 0.08 * (hi - lo), v)));
      }
    } else {
      const lo = Math.min(vb, c[f]);
      const hi = Math.max(vb, c[f]);
      const v = cr(a[f], vb, c[f], d[f], u);
      out[f] = Math.max(0, Math.min(hi + 0.08 * (hi - lo), Math.max(lo - 0.08 * (hi - lo), v)));
    }
  }
  return out;
}
