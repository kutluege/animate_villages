// Yol ağı hazırlığı: sınıflandırma, ufka doğru D-100 uzantıları, tek yönlü zincirler, şeritler.
import { Path, offsetLine, densify, lerp, smoothstep } from './util.js';

export const VEHICLE = new Set([
  'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link',
  'tertiary', 'tertiary_link', 'residential', 'living_street', 'unclassified', 'service', 'busway',
]);

// tür: 0 otoyol, 1 ana cadde, 2 sokak, 3 metrobüs, 4 yaya kaplaması, 5 bağlantı
const CLS = {
  trunk: { type: 0, yOff: 0.23 },
  trunk_link: { type: 5, yOff: 0.2 },
  primary: { type: 1, yOff: 0.17 },
  primary_link: { type: 5, yOff: 0.19 },
  secondary: { type: 1, yOff: 0.14 },
  secondary_link: { type: 5, yOff: 0.15 },
  tertiary: { type: 1, yOff: 0.11 },
  tertiary_link: { type: 5, yOff: 0.12 },
  residential: { type: 2, yOff: 0.08 },
  living_street: { type: 2, yOff: 0.07 },
  unclassified: { type: 2, yOff: 0.08 },
  service: { type: 2, yOff: 0.05 },
  busway: { type: 3, yOff: 0.27 },
  pedestrian: { type: 4, yOff: 0.04 },
  footway: { type: 4, yOff: 0.05 },
  steps: { type: 4, yOff: 0.05 },
};

export const EXT_LEN = 2300; // D-100 veri sınırından ufka doğru uzatılır

export function prepareNetwork(ctx) {
  const { data, heightAt } = ctx;
  const raw = Array.isArray(data.roads) ? data.roads : [];
  const roads = [];
  for (const r of raw) {
    const c = CLS[r.cls];
    if (!c || !r.pts || r.pts.length < 2 || r.tunnel || r.indoor) continue;
    roads.push({
      id: r.id, cls: r.cls, pts: r.pts, width: r.width || 5, lanes: Math.max(1, r.lanes || 1),
      oneway: !!r.oneway, bridge: !!r.bridge, viaduct: !!r.viaduct, name: r.name || '',
      type: c.type, yOff: c.yOff, veh: VEHICLE.has(r.cls), ext: false,
    });
  }

  // ---- D-100 uzantıları: doğu ve batı uçta ortak yönle düz devam ------------------------
  const extLines = []; // [{ax,az,bx,bz}] dolgu şehir bu koridoru boş bırakır
  const dirs = { w: null, e: null };
  for (const r of roads) {
    if (r.cls !== 'trunk') continue;
    const a = r.pts[0];
    const b = r.pts[r.pts.length - 1];
    if (b[0] > 1040 && !dirs.e) {
      const p = r.pts[r.pts.length - 4] || a;
      const l = Math.hypot(b[0] - p[0], b[2] - p[2]);
      dirs.e = [(b[0] - p[0]) / l, (b[2] - p[2]) / l];
    }
    if (a[0] < -1040 && !dirs.w) {
      const p = r.pts[3] || b;
      const l = Math.hypot(a[0] - p[0], a[2] - p[2]);
      dirs.w = [(a[0] - p[0]) / l, (a[2] - p[2]) / l];
    }
  }
  const makeExt = (p0, dir, width) => {
    const out = [];
    const rx = -dir[1];
    const rz = dir[0];
    for (let d = 0; d <= EXT_LEN; d += 20) {
      // düz cetvel çizgisi olmasın: uzantı yumuşak bir kavisle ufka döner
      const off = ((dir[0] > 0 ? 1 : -1) * d * d) / 15000;
      const x = p0[0] + dir[0] * d + rx * off;
      const z = p0[2] + dir[1] * d + rz * off;
      let g = -1e9;
      for (let k = -1; k <= 1; k++) g = Math.max(g, heightAt(x + rx * k * width * 0.6, z + rz * k * width * 0.6));
      out.push([x, lerp(p0[1], g + 0.5, smoothstep(0, 260, d)), z]);
    }
    return out;
  };
  const extRoads = [];
  for (const r of roads) {
    if (r.cls !== 'trunk' && r.cls !== 'busway') continue;
    const n = r.pts.length;
    for (const end of [0, n - 1]) {
      const p = r.pts[end];
      const side = p[0] > 1040 ? 'e' : p[0] < -1040 ? 'w' : null;
      if (!side || !dirs[side]) continue;
      let pts = makeExt(p, dirs[side], r.width);
      if (end === 0) pts = pts.reverse(); // yol buradan başlıyor → uzantı içeri doğru akar
      extRoads.push({ ...r, id: `${r.id}_ext${end}`, pts, bridge: false, viaduct: false, ext: true });
      for (let i = 0; i + 1 < pts.length; i += 4) {
        const q0 = pts[i];
        const q1 = pts[Math.min(pts.length - 1, i + 4)];
        extLines.push({ ax: q0[0], az: q0[2], bx: q1[0], bz: q1[2] });
      }
    }
  }
  roads.push(...extRoads);

  // ---- tek yönlü zincirler ---------------------------------------------------------------
  const key = (p) => `${Math.round(p[0] * 2)}|${Math.round(p[2] * 2)}`;
  const group = (r) => (r.cls === 'trunk' ? 'trunk' : r.cls === 'busway' ? 'busway' : `${r.cls}:${r.name}`);
  const starts = new Map();
  const endsAt = new Map();
  const veh = roads.filter((r) => r.veh);
  for (const r of veh) {
    if (!r.oneway) continue;
    const ks = `${group(r)}#${key(r.pts[0])}`;
    if (!starts.has(ks)) starts.set(ks, []);
    starts.get(ks).push(r);
    const ke = `${group(r)}#${key(r.pts[r.pts.length - 1])}`;
    endsAt.set(ke, (endsAt.get(ke) || 0) + 1);
  }
  const used = new Set();
  const chains = [];
  const follow = (r0) => {
    const parts = [r0];
    used.add(r0);
    let cur = r0;
    for (;;) {
      const e = cur.pts[cur.pts.length - 1];
      const p = cur.pts[cur.pts.length - 2];
      const cands = (starts.get(`${group(cur)}#${key(e)}`) || []).filter((c) => !used.has(c));
      if (!cands.length) break;
      let best = null;
      let bestDot = -2;
      for (const c of cands) {
        const q = c.pts[1];
        const d1 = Math.hypot(e[0] - p[0], e[2] - p[2]) || 1;
        const d2 = Math.hypot(q[0] - e[0], q[2] - e[2]) || 1;
        const dot = ((e[0] - p[0]) * (q[0] - e[0]) + (e[2] - p[2]) * (q[2] - e[2])) / (d1 * d2);
        if (dot > bestDot) {
          bestDot = dot;
          best = c;
        }
      }
      if (!best || bestDot < 0.2) break;
      parts.push(best);
      used.add(best);
      cur = best;
    }
    return parts;
  };
  const onewayRoads = veh.filter((r) => r.oneway);
  // önce öncülü olmayanlar (zincir başı), sonra kalanlar (halkalar)
  for (const pass of [0, 1]) {
    for (const r of onewayRoads) {
      if (used.has(r)) continue;
      if (pass === 0 && endsAt.get(`${group(r)}#${key(r.pts[0])}`)) continue;
      chains.push(follow(r));
    }
  }
  for (const r of veh) if (!r.oneway) chains.push([r]);

  // ---- şeritler ---------------------------------------------------------------------------
  // lane: { path, cls, type, lw, loop, speedK, parts }
  const lanes = [];
  for (const parts of chains) {
    const r0 = parts[0];
    if (r0.cls === 'busway') continue; // metrobüs araçları pois.metrobusLines üzerinden
    const laneCount = Math.min(...parts.map((p) => p.lanes));
    // zincir boyunca nokta dizisi (parça ekleri tekrar etmesin)
    const pts = [];
    for (const p of parts) for (let i = pts.length ? 1 : 0; i < p.pts.length; i++) pts.push([p.pts[i][0], p.pts[i][1] + p.yOff, p.pts[i][2]]);
    const w = Math.min(...parts.map((p) => p.width));
    const bridge = parts.some((p) => p.bridge);
    if (r0.oneway) {
      const lw = Math.min(3.5, (w - 0.8) / laneCount);
      for (let k = 0; k < laneCount; k++) {
        const off = (k - (laneCount - 1) / 2) * lw;
        lanes.push({ path: new Path(offsetLine(pts, off)), cls: r0.cls, type: r0.type, k, n: laneCount, bridge });
      }
    } else {
      const nf = Math.max(1, Math.floor(laneCount / 2));
      const lw = Math.min(3.4, (w - 0.6) / (nf * 2));
      for (let k = 0; k < nf; k++) {
        const off = (k + 0.5) * lw;
        lanes.push({ path: new Path(offsetLine(pts, off)), cls: r0.cls, type: r0.type, k, n: nf, bridge });
        const rev = pts.slice().reverse();
        lanes.push({ path: new Path(offsetLine(rev, off)), cls: r0.cls, type: r0.type, k, n: nf, bridge });
      }
    }
  }

  // ---- metrobüs hatları (yön başına tek sürekli çizgi + uzantı) -------------------------
  const busLines = [];
  const ml = (data.pois && data.pois.metrobusLines) || [];
  for (const l of ml) {
    if (!l.pts || l.pts.length < 2) continue;
    let pts = l.pts.map((p) => [p[0], p[1] + 0.3, p[2]]);
    const a = pts[0];
    const b = pts[pts.length - 1];
    const sideA = a[0] > 1040 ? 'e' : a[0] < -1040 ? 'w' : null;
    const sideB = b[0] > 1040 ? 'e' : b[0] < -1040 ? 'w' : null;
    if (sideA && dirs[sideA]) pts = makeExt(a, dirs[sideA], 4).reverse().slice(0, -1).concat(pts);
    if (sideB && dirs[sideB]) pts = pts.concat(makeExt(b, dirs[sideB], 4).slice(1));
    busLines.push(new Path(densify(pts, 12)));
  }

  return { roads, chains, lanes, busLines, extLines, dirs };
}
