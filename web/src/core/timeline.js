// Zaman çizelgesi (CONTRACT §6). Her şeyi tek parametre sürer: tod (günün saati, ondalık saat).
// Saf fonksiyonlar — saat, rastgelelik, dış durum yok.
//
// Kurgu ajanı KEYS dizisini ince ayarlayabilir; imzalar (FPS, DURATION, todAt, stateAt) sabittir.
import { Vector3 } from 'three';

export const FPS = 30;
export const DURATION = 40; // sn → 1200 kare (kurgu ajanı tur 6: 36 → 40, kullanıcı isteğiyle uzun alacakaranlık)
export const FRAMES = FPS * DURATION;

// [film saniyesi, tod] — t artan, tod azalmayan olmalı.
export const KEYS = [
  [0, 15.0], // sert gündüz (viyadük altı)
  [12.5, 18.5], // altın saat (Trump'ın yanından geçiş)
  [16.3, 19.0], // gün batımı camda … (güneş 6.7° → ufuk)
  [19.8, 19.6], // … güneş ufukta; ALACAKARANLIK başlar (mezarlık, Cevahir) — uzun tutulur …
  [25.5, 20.0], // … mavi saat, ilk ışıklar; Torun'a dönüş …
  [31, 20.4], // … gece oldu (night = 1)
  [34.5, 20.85], // bütün ışıklar yandı
  [40, 22.5], // gece, kapak karesi
];

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// Monoton kübik (Fritsch–Carlson / PCHIP): anahtar karelerden geçer, hız süreklidir,
// aşma yapmaz → tod hiçbir zaman geri gitmez.
function pchipSlopes(keys) {
  const n = keys.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const h0 = keys[i][0] - keys[i - 1][0];
      const h1 = keys[i + 1][0] - keys[i][0];
      const w1 = 2 * h1 + h0;
      const w2 = h1 + 2 * h0;
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return m;
}

/** Film saniyesi → tod. [0, DURATION] dışında uçlara kenetlenir. */
export function todAt(t) {
  const K = KEYS;
  const n = K.length;
  if (!(t > K[0][0])) return K[0][1];
  if (t >= K[n - 1][0]) return K[n - 1][1];
  const m = pchipSlopes(K);
  let i = 0;
  while (i < n - 2 && t >= K[i + 1][0]) i++;
  const h = K[i + 1][0] - K[i][0];
  const u = (t - K[i][0]) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * K[i][1] +
    (u3 - 2 * u2 + u) * h * m[i] +
    (-2 * u3 + 3 * u2) * K[i + 1][1] +
    (u3 - u2) * h * m[i + 1]
  );
}

// ---- Güneş: İstanbul, haziran sonu ---------------------------------------------------
// Standart saat açısı modeli (enlem φ, deklinasyon δ). tod, filmin "hikâye saati"dir:
// öğle anı sözleşmedeki batış ≈ 19.7'yi verecek biçimde 12.2'ye ayarlı (gerçek duvar
// saatiyle İstanbul'da öğle ≈ 13:07, batış ≈ 20:40 olurdu). Gün uzunluğu ve azimut gerçek:
// batış azimutu ≈ 302° (batı-kuzeybatı), öğle yüksekliği ≈ 72°.
export const SUN = {
  lat: 41.066, // derece
  decl: 23.3, // derece (haziran sonu)
  noon: 12.2, // tod cinsinden güneş öğlesi
};
const D2R = Math.PI / 180;

/**
 * tod → güneş. dir: sahneden GÜNEŞE doğru birim vektör (+X doğu, +Y yukarı, +Z güney).
 * elev: radyan (ufuk altı negatif). azim: radyan, kuzeyden saat yönünde (doğu = π/2).
 */
export function sunAt(tod, out = new Vector3()) {
  const phi = SUN.lat * D2R;
  const del = SUN.decl * D2R;
  const H = (tod - SUN.noon) * 15 * D2R;
  const up = Math.sin(phi) * Math.sin(del) + Math.cos(phi) * Math.cos(del) * Math.cos(H);
  const east = -Math.cos(del) * Math.sin(H);
  const north = Math.cos(phi) * Math.sin(del) - Math.sin(phi) * Math.cos(del) * Math.cos(H);
  out.set(east, up, -north).normalize();
  const elev = Math.asin(clamp(up, -1, 1));
  let azim = Math.atan2(east, north);
  if (azim < 0) azim += 2 * Math.PI;
  return { dir: out, elev, azim };
}

// Sözleşme eğrileri (akşam). Sabah için öğleye göre ayna — film bunu kullanmaz ama
// serbest kipteki 0–24 kaydırıcısı tutarlı kalsın.
export function nightAt(tod) {
  return tod >= SUN.noon ? smoothstep(19.0, 20.4, tod) : 1 - smoothstep(2 * SUN.noon - 20.4, 2 * SUN.noon - 19.0, tod);
}
export function litAt(tod) {
  return tod >= SUN.noon ? smoothstep(19.3, 20.8, tod) : 1 - smoothstep(2 * SUN.noon - 20.8, 2 * SUN.noon - 19.3, tod);
}

/**
 * Kare durumu. tod verilmezse todAt(t).
 * → { t, tod, sunDir:Vector3 (yeni nesne), sunElev (rad), sunAzim (rad), day, night, lit }
 * İskelet buna dt ve film alanlarını ekler.
 */
export function stateAt(t, tod = todAt(t)) {
  const s = sunAt(tod);
  const night = nightAt(tod);
  return { t, tod, sunDir: s.dir, sunElev: s.elev, sunAzim: s.azim, day: 1 - night, night, lit: litAt(tod) };
}
