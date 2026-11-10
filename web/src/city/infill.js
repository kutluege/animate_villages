// Veri kutusu İÇİNDE, landuse=residential olup bina izi haritalanmamış adalar için prosedürel apartman dokusu
// (koordinatör kararı, Tur 3). VERİYE DAYANMAZ: kayıtlar procedural: true; ağ userData.procedural = true.
// Binalar en yakın sokağa hizalı, gerçek bina/yol/arazi alanlarına taşmadan, çevre kat dağılımıyla yerleşir.
import { Grid } from './util.js';

export const INFILL_CENTERS = [[-310, -180], [-590, -246], [-421, -509], [-256, 458], [88, -521]];

export function proceduralInfill(ctx, net, isInside, LU, realBuildings, centers = INFILL_CENTERS) {
  const { heightAt } = ctx;
  const rg = new Grid(12);
  for (const r of net.roads) {
    for (let i = 0; i < r.pts.length; i++) {
      const j = Math.min(i, r.pts.length - 2);
      const dx = r.pts[j + 1][0] - r.pts[j][0], dz = r.pts[j + 1][1] - r.pts[j][1];
      rg.add(r.pts[i][0], r.pts[i][1], { x: r.pts[i][0], z: r.pts[i][1], hw: r.halfW, ang: Math.atan2(dz, dx), cls: r.cls });
    }
  }
  const roadAt = (x, z, pad) => { let hit = false; rg.query(x, z, 12, (n) => { if (Math.hypot(n.x - x, n.z - z) < n.hw + pad) { hit = true; return false; } }); return hit; };
  const nearestRoad = (x, z) => { let best = null, bd = 1e9; rg.query(x, z, 40, (n) => { if (n.cls === 'path') return; const d = Math.hypot(n.x - x, n.z - z) - n.hw; if (d < bd) { bd = d; best = n; } }); return best ? { n: best, d: bd } : null; };
  // çevredeki gerçek binaların kat dağılımı
  const levelsNear = (x, z) => {
    const a = [];
    for (const b of realBuildings) { if (Math.hypot(b.cx - x, b.cz - z) < 260 && b.H < 40 && b.H > 6) a.push(b.H); }
    a.sort((p, q) => p - q);
    return a.length > 8 ? a : [13, 15.9, 16.1, 19.2, 22.3];
  };
  const occ = new Set();
  const cellK = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  const out = [];
  const usedAreas = [];
  centers.forEach(([cx0, cz0], ci) => {
    const r = ctx.rng('city/infill/' + ci);
    const Hs = levelsNear(cx0, cz0);
    const R = 170;
    const cand = [];
    for (let x = cx0 - R; x <= cx0 + R; x += 5) for (let z = cz0 - R; z <= cz0 + R; z += 5) {
      if (Math.hypot(x - cx0, z - cz0) > R) continue;
      const nr = nearestRoad(x, z);
      if (!nr || nr.d > 32) continue;
      cand.push({ x: x + (r() - 0.5) * 2, z: z + (r() - 0.5) * 2, nr });
    }
    cand.sort((a, b) => a.nr.d - b.nr.d || a.x - b.x || a.z - b.z);
    let n = 0;
    for (const c of cand) {
      const ang = c.nr.n.ang;
      const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux;
      const w = 10 + r() * 8, d = 9 + r() * 7;
      const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [c.x + ux * a + vx * b, c.z + uz * a + vz * b]);
      const samples = [...corners, [c.x, c.z], ...corners.map((p, i) => { const q = corners[(i + 1) % 4]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; })];
      let ok = true;
      for (const [x, z] of samples) {
        if (isInside(x, z, 2.5) || roadAt(x, z, 1.8) || (LU && LU.at(x, z))) { ok = false; break; }
      }
      if (!ok) continue;
      // doluluk (2 m ızgara)
      const cells = [];
      for (let a = -w / 2 - 1.5; a <= w / 2 + 1.5; a += 1.5) for (let b = -d / 2 - 1.5; b <= d / 2 + 1.5; b += 1.5) cells.push(cellK(c.x + ux * a + vx * b, c.z + uz * a + vz * b));
      if (cells.some((k) => occ.has(k))) continue;
      cells.forEach((k) => occ.add(k));
      const H = Math.max(6.8, Hs[Math.floor(r() * Hs.length)] + (r() - 0.5) * 3.1);
      const fp = corners.slice();
      // CCW (x,z) olsun
      let area = 0; for (let i = 0; i < 4; i++) { const p = fp[i], q = fp[(i + 1) % 4]; area += p[0] * q[1] - q[0] * p[1]; }
      if (area < 0) fp.reverse();
      out.push({ id: `proc-${ci}-${n++}`, footprint: fp, height: H, heightSource: 'procedural', procedural: true,
        baseY: Math.min(...fp.map((p) => heightAt(p[0], p[1]))), levels: Math.max(2, Math.round((H - 0.6) / 3.1)), kind: 'apartments' });
    }
    usedAreas.push({ center: [cx0, cz0], count: n });
  });
  return { list: out, perArea: usedAreas };
}
