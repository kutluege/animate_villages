// Yol üstüne taşan bina süzgeci (saf; tarayıcıda ve node'da aynı sonuç).
// Ayak izi 1,5 m ızgarayla örneklenir; taşıt yolu şeridine (eksen ± genişlik/2) düşen alan ölçülür.
// Köprü/viyadük altında kalan (çatısı tabliyenin altında) ya da yolun üstünden yeterince yüksekte
// geçen hacimler (minHeight) meşrudur ve sayılmaz.
import { Grid2, pointInRing, segDist } from './util.js';

const MAJOR = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'busway']);
const MINOR = new Set(['residential', 'living_street', 'unclassified']);
const HIGHWAY = new Set(['trunk', 'trunk_link', 'busway']); // D-100 sistemi: en sıkı ölçüt

export function makeRoadTester(net) {
  const grid = new Grid2(50);
  for (const r of net.roads) {
    if (!r.veh) continue;
    const major = MAJOR.has(r.cls);
    if (!major && !MINOR.has(r.cls)) continue; // servis yolları avlu/pasaj içinden geçebilir
    const hw = r.width / 2;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      grid.addBox(Math.min(a[0], b[0]) - hw, Math.min(a[2], b[2]) - hw, Math.max(a[0], b[0]) + hw, Math.max(a[2], b[2]) + hw, { a, b, hw, r, major });
    }
  }
  const o = { t: 0 };
  // otoyol sistemi parçaları (ada sınaması için)
  const hwSegs = new Grid2(120);
  for (const r of net.roads) {
    if (!r.veh || !(HIGHWAY.has(r.cls) || r.cls === 'primary_link')) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const m = 45 + r.width / 2;
      hwSegs.addBox(Math.min(a[0], b[0]) - m, Math.min(a[2], b[2]) - m, Math.max(a[0], b[0]) + m, Math.max(a[2], b[2]) + m, { a, b, m });
    }
  }
  /** Ayak izi merkezi, 45 m içinde otoyol/rampa şeritleriyle çevrili mi (refüj / kavşak adası)? En büyük açıklık < 150°. */
  function island(b) {
    let cx = 0;
    let cz = 0;
    for (const p of b.ring) {
      cx += p[0] / b.ring.length;
      cz += p[1] / b.ring.length;
    }
    const dirs = [];
    for (const s of hwSegs.at(cx, cz)) {
      if (segDist(cx, cz, s.a[0], s.a[2], s.b[0], s.b[2], o) > s.m) continue;
      dirs.push(Math.atan2(s.a[2] + (s.b[2] - s.a[2]) * o.t - cz, s.a[0] + (s.b[0] - s.a[0]) * o.t - cx));
    }
    if (dirs.length < 2) return false;
    dirs.sort((x, y) => x - y);
    let gap = 0;
    for (let i = 0; i < dirs.length; i++) gap = Math.max(gap, (i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + Math.PI * 2) - dirs[i]);
    return gap < (150 * Math.PI) / 180;
  }

  /**
   * → { area, onMajor, onMinor (m²), frac, hit:{id,cls,name} | null }
   * b: { ring, baseY?, groundY?, height, minHeight? }
   */
  function measure(b) {
    const ring = b.ring;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of ring) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1];
      if (p[1] > z1) z1 = p[1];
    }
    const base = b.baseY ?? 0;
    const top = (b.groundY ?? base) + b.height;
    const bottom = base + (b.minHeight || 0);
    const S = 1.5;
    let n = 0;
    let nMaj = 0;
    let nMin = 0;
    let nHwy = 0;
    let deckY = 1e9; // ayak izinin altında kaldığı en alçak tabliye (köprü yolu)
    const hits = new Map();
    for (let x = x0 + S / 2; x < x1; x += S) {
      for (let z = z0 + S / 2; z < z1; z += S) {
        if (!pointInRing(x, z, ring)) continue;
        let hole = false;
        for (const h of b.holes || []) if (pointInRing(x, z, h)) hole = true;
        if (hole) continue;
        n++;
        let maj = null;
        let min = null;
        for (const s of grid.at(x, z)) {
          if (segDist(x, z, s.a[0], s.a[2], s.b[0], s.b[2], o) >= s.hw) continue;
          const ry = s.a[1] + (s.b[1] - s.a[1]) * o.t;
          if (s.r.bridge) deckY = Math.min(deckY, ry);
          if (s.r.bridge && top < ry - 1.0) continue; // tabliyenin altında
          if ((b.minHeight || 0) > 0 && bottom > ry + 4.5) continue; // yolun üstünden geçen hacim
          if (s.major) maj = s.r;
          else min = s.r;
        }
        if (maj) {
          nMaj++;
          if (HIGHWAY.has(maj.cls)) nHwy++;
          hits.set(maj, (hits.get(maj) || 0) + 1);
        } else if (min) {
          nMin++;
          hits.set(min, (hits.get(min) || 0) + 1);
        }
      }
    }
    let hit = null;
    let best = 0;
    for (const [r, c] of hits) {
      if (c > best) {
        best = c;
        hit = { id: r.id, cls: r.cls, name: r.name || '', ext: !!r.ext, bridge: !!r.bridge };
      }
    }
    const cell = S * S;
    return { area: n * cell, onMajor: nMaj * cell, onHighway: nHwy * cell, onMinor: nMin * cell, frac: n ? (nMaj + nMin) / n : 0, hit, deckY };
  }

  /**
   * Çizilmesin mi? D-100 sistemi (trunk, bağlantı, metrobüs, uzantı): ≥ 6 m². Öteki ana yollar: ≥ 40 m² ya da
   * (≥ 12 m² ve ≥ %6). Sokak: ≥ %35 ya da (≥ 40 m² ve ≥ %20).
   */
  function onRoad(b) {
    const m = measure(b);
    if (!m.area) return null;
    const majF = m.onMajor / m.area;
    const minF = m.onMinor / m.area;
    if (m.onHighway >= 6 || m.onMajor >= 40 || (m.onMajor >= 12 && majF >= 0.06) || minF >= 0.35 || (m.onMinor >= 40 && minF >= 0.2)) return m;
    return null;
  }

  /**
   * Karar: null (çiz) | { action:'remove', m } | { action:'clamp', m, height }.
   * Yalnız köprü tabliyesini delen yapı (ör. viyadük altındaki istasyon binaları, yüksekliği tahmin) silinmez;
   * tabliyenin altına alçaltılır — "alt şehir" yapısı olarak kalır.
   */
  function decide(b) {
    const m = onRoad(b);
    if (!m) {
      // yol şeridine değmiyor ama otoyol adasının ortasında ve yüksekliği tahmin: apartman olamaz → büfe/istasyon yapısı boyu
      if (b.estimated && b.height > 5 && island(b)) return { action: 'clamp', m: measure(b), height: 3.6, why: 'ada' };
      return null;
    }
    if (m.deckY < 1e8) {
      const base = b.groundY ?? b.baseY ?? 0;
      const h = m.deckY - 2.4 - base;
      if (h >= 2.6 && !onRoad({ ...b, height: h })) return { action: 'clamp', m, height: Math.round(h * 10) / 10, why: 'tabliye' };
    }
    return { action: 'remove', m, why: 'yol' };
  }

  return { measure, onRoad, decide, island };
}
