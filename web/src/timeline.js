// tod (ondalık saat, yerel UTC+3) → sahne durumu. CONTRACT §5.
// Güneş: İstanbul (41.07 K), ilkbahar akşamı (~28 Mart, δ ≈ +3.3°). Gerçek güneş geometrisi;
// öğle saati, batış (görünür ufuk, ≈ −0.6°) tam 19:20'ye denk gelecek şekilde seçilir.
// Batış azimutu ≈ 274° (batının biraz kuzeyi) → sunDir −X tarafında, hafif −Z (kuzey).
import * as THREE from 'three';

export const LATITUDE = 41.0665;
export const DECLINATION = 3.3;          // derece
export const SUNSET_TOD = 19 + 20 / 60;  // 19:20
const SUNSET_ELEV = -0.6;                // kırılma dahil görünür batış

const D2R = Math.PI / 180;
const phi = LATITUDE * D2R, dec = DECLINATION * D2R;
// Batıştaki saat açısı → öğle saati
const H0 = Math.acos((Math.sin(SUNSET_ELEV * D2R) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
export const SOLAR_NOON = SUNSET_TOD - H0 / D2R / 15; // ≈ 13:11

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** e0→e1 arası yumuşak geçiş (e0 > e1 de olabilir). */
export function smoothstep(e0, e1, x) {
  const u = clamp01((x - e0) / (e1 - e0));
  return u * u * (3 - 2 * u);
}

/** Güneşin yüksekliği ve azimutu (derece; azimut kuzeyden saat yönüne). */
export function sunPosition(tod) {
  const H = (tod - SOLAR_NOON) * 15 * D2R;
  const sinE = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H);
  const elev = Math.asin(sinE);
  // Azimut: atan2(sinH, cosH·sinφ − tanδ·cosφ) güneyden batıya → kuzeyden saat yönüne çevir
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const az = (azS / D2R + 180 + 360) % 360;
  return { elev: elev / D2R, az };
}

/** Azimut/yükseklik → sahne birim vektörü (+X doğu, +Y yukarı, −Z kuzey). */
export function dirFromAzEl(azDeg, elDeg, target = new THREE.Vector3()) {
  const a = azDeg * D2R, e = elDeg * D2R;
  return target.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
}

/**
 * Saf fonksiyon: aynı (tod, t) → aynı durum.
 * Eğri dayanakları (sunElev): 16:30 ≈ 32° · 18:45 ≈ 5° · 19:20 ≈ −0.6° · 19:50 ≈ −5.6° · 21:30 ≈ −21°
 */
export function timeState(tod, t = 0) {
  tod = ((Number(tod) % 24) + 24) % 24;
  const { elev, az } = sunPosition(tod);
  const sunDir = dirFromAzEl(az, elev);
  const day = smoothstep(-6, 9, elev);                         // 18:45'te ~0.8, 19:50'de ~0
  const golden = Math.exp(-(((elev - 2.5) / 5.5) ** 2));         // tepe ≈ 19:05, 16:30'da ~0
  const night = smoothstep(-2, -15, elev);                      // mavi saat ~0.3, 21:30'da 1
  const lightsOn = smoothstep(2, -8, elev);                      // §5: +2° → −8°
  return { tod, t, sunDir, sunElev: elev, sunAzimuth: az, day, golden, night, lightsOn };
}

/** "19:20" biçimi. */
export function formatTod(tod) {
  tod = ((tod % 24) + 24) % 24;
  let h = Math.floor(tod), m = Math.round((tod - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Arayüz etiketi. */
export function phaseLabel(s) {
  if (s.sunElev > 12) return s.tod < 11 ? 'Sabah' : (s.tod < 15 ? 'Öğle' : 'İkindi');
  if (s.sunElev > 1) return s.tod < SOLAR_NOON ? 'Gün doğumu' : 'Altın saat';
  if (s.sunElev > -4) return s.tod < SOLAR_NOON ? 'Şafak' : 'Gün batımı';
  if (s.sunElev > -10) return 'Mavi saat';
  return 'Gece';
}
