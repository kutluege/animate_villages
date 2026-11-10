// Sıradan binalar: tek birleşik ağ (çekirdek) + tek birleşik ağ (ufka doğru dolgu şehir).
// Cephe tamamen gölgelendiricide: pencere ızgarası, balkon, klima, dükkân katı; gece pencere başına eşik.
import { GeoBuilder, GLSL_NOISE, lin, ringArea, ringCentroid, pointInRing, Grid2, segDist, smoothstep } from './util.js';

const WALL_COLORS = [
  [0xb8b4ac, 5], [0xa9a59c, 5], [0xc9c5bb, 4], [0x9c9890, 3], // beton / gri sıva
  [0xe0dcd0, 5], [0xd6d0c2, 4], [0xcfc8b6, 3], // kirli beyaz
  [0xe0d2ae, 3], [0xe2cc8e, 2], [0xd6a58a, 2], [0xd9b6ab, 2], [0xb7c5a6, 2], [0xabbcc8, 2],
  [0xc6a268, 1.5], [0xb47a62, 1.2], [0xc9b79c, 3], [0xd2bfa0, 2], [0x9fb0a8, 1],
].map(([h, w]) => ({ c: lin(h), w }));
const GLASS_COLORS = [0x5d7f95, 0x4f6f78, 0x6b7f8c, 0x7a6a55, 0x3f5266, 0x88969e, 0x4d6b84].map(lin);
const ROOF_COLORS = [0x8b8780, 0x9a958c, 0x77746f, 0xa39a8b, 0x6b6965, 0xb3aba0, 0x7f5f52, 0x5f6a70, 0x8a8478].map(lin);
const TILE_COLORS = [0x8f5a47, 0x9a6650, 0x7f5445, 0x94705c, 0x7a5a4c, 0x86604e].map(lin);
const C_CONC = lin(0x8f8b84);
const C_WHITE = lin(0xdcdcd8);
const C_PANEL = lin(0x1c2a44);
const C_UNIT = lin(0xb9bbbb);
const C_STONE = lin(0xcfc6b2);
const C_LEAD = lin(0x7d868c);

function pickWeighted(list, r) {
  let tot = 0;
  for (const e of list) tot += e.w;
  let x = r * tot;
  for (const e of list) {
    x -= e.w;
    if (x <= 0) return e.c;
  }
  return list[0].c;
}

export function buildBuildings(ctx, ground, net, group, verdict, roadTest) {
  const { THREE, data, heightAt } = ctx;
  const rng = ctx.rng('city/buildings');
  const list = [];
  for (const b of Array.isArray(data.buildings) ? data.buildings : []) {
    if (b.landmark || !b.ring || b.ring.length < 3) continue;
    const v = verdict && verdict.get(b);
    if (v && v.action === 'remove') continue;
    // tabliyeyi delen yapı: veri değişmez, kopyası alçaltılır (camsız, düz hacim)
    list.push(v && v.action === 'clamp' ? { ...b, height: v.height, minHeight: 0, kind: 'service' } : b);
  }

  const gb = new GeoBuilder();
  const index = new Grid2(40); // ağaç/lamba yerleşimi için bina sorgusu
  const inBuilding = (x, z, skip) => {
    for (const b of index.at(x, z)) if (b !== skip && pointInRing(x, z, b.ring)) return true;
    return false;
  };
  for (const b of list) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of b.ring) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1];
      if (p[1] > z1) z1 = p[1];
    }
    index.addBox(x0, z0, x1, z1, b);
  }
  for (const b of list) addBuilding(THREE, gb, b, rng, ground.gY, inBuilding);
  const mat = facadeMaterial(THREE, ctx.uniforms);
  const mesh = new THREE.Mesh(gb.build(THREE), mat);
  mesh.name = 'city-buildings';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // ---- dolgu şehir: veri sınırının ötesi (İstanbul her yöne sürer) ----------------------
  const fb = new GeoBuilder();
  const fill0 = makeFillers(ctx, net, rng.fork('filler'));
  const fill = roadTest ? fill0.filter((b) => !roadTest.onRoad(b)) : fill0;
  for (const b of fill) addBuilding(THREE, fb, b, rng, heightAt, null);
  const fmesh = new THREE.Mesh(fb.build(THREE), mat);
  fmesh.name = 'city-filler';
  fmesh.castShadow = false;
  fmesh.receiveShadow = false;
  group.add(fmesh);

  return { mesh, fmesh, inBuilding, count: list.length, fillerCount: fill.length, fillerDropped: fill0.length - fill.length };
}

function styleOf(b, h, r) {
  const k = b.kind || '';
  if (k === 'roof' || k === 'shelter') return 'canopy';
  if (k === 'mosque') return 'mosque';
  if (k === 'construction' || k === 'garage' || k === 'parking' || k === 'toilets' || k === 'service') return 'plain';
  if (h > 45) return 'glass';
  if ((k === 'office' || k === 'commercial' || k === 'hotel' || k === 'retail') && h > 20 && r < 0.75) return 'glass';
  if (h > 27 && r < 0.14) return 'glass';
  return 'apt';
}

// GLSL cH11 ile aynı karma (kat yüksekliği gölgelendiriciyle hizalı olsun)
function glH11(p) {
  p = (p * 0.1031) % 1;
  p *= p + 33.33;
  p *= p + p;
  return p % 1;
}

function addBuilding(THREE, gb, b, rng, gY, inBuilding) {
  const detail = !!inBuilding;
  let ring = b.ring;
  const area0 = ringArea(ring);
  if (Math.abs(area0) < 4) return;
  if (area0 < 0) ring = ring.slice().reverse(); // dış normal = (dz, −dx)
  const area = Math.abs(area0);
  const n = ring.length;

  const seed = rng();
  const r2 = rng();
  const r3 = rng();
  const r4 = rng();
  const base = b.baseY ?? gY(ring[0][0], ring[0][1]);
  const top = (b.groundY ?? base) + b.height;
  const minH = b.minHeight || 0;
  const hBody = b.height - minH;
  const style = styleOf(b, hBody, r2);

  let gMin = base;
  const gAt = new Array(n);
  for (let i = 0; i < n; i++) {
    gAt[i] = gY(ring[i][0], ring[i][1]);
    if (gAt[i] < gMin) gMin = gAt[i];
  }
  let bottom = minH > 0 ? base + minH : gMin - 1.2;
  if (style === 'canopy') bottom = top - 0.5;
  if (top - bottom < 0.4) return;

  let wallCol;
  let kind;
  if (style === 'glass') {
    wallCol = GLASS_COLORS[Math.floor(r3 * GLASS_COLORS.length)];
    kind = 1;
  } else if (style === 'mosque') {
    wallCol = C_STONE;
    kind = 2;
  } else if (style === 'plain' || style === 'canopy') {
    wallCol = C_CONC;
    kind = 2;
  } else {
    wallCol = pickWeighted(WALL_COLORS, r3);
    kind = hBody < 5 ? 2 : 0;
  }
  const tone = 0.74 + 0.2 * r4;
  wallCol = [wallCol[0] * tone, wallCol[1] * tone, wallCol[2] * tone];

  // ---- duvarlar --------------------------------------------------------------------------
  const walls = (rg, flip) => {
    const m = rg.length;
    for (let i = 0; i < m; i++) {
      const a = rg[i];
      const c = rg[(i + 1) % m];
      const dx = c[0] - a[0];
      const dz = c[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.25) continue;
      let nx = dz / len;
      let nz = -dx / len;
      if (flip) {
        nx = -nx;
        nz = -nz;
      }
      const gMid = minH > 0 ? bottom : gY((a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
      const hw = top - bottom;
      const hg = Math.max(0.5, top - gMid); // çatıdan zemine
      const ws = ((i * 0.6180339 + seed * 7.13) % 1 + 1) % 1;
      const v0 = gb.vert(a[0], bottom, a[1], nx, 0, nz, wallCol, 0, hw, len, hg, seed, kind, ws, 0);
      const v1 = gb.vert(c[0], bottom, c[1], nx, 0, nz, wallCol, len, hw, len, hg, seed, kind, ws, 0);
      const v2 = gb.vert(c[0], top, c[1], nx, 0, nz, wallCol, len, 0, len, hg, seed, kind, ws, 0);
      const v3 = gb.vert(a[0], top, a[1], nx, 0, nz, wallCol, 0, 0, len, hg, seed, kind, ws, 0);
      if (flip) gb.idx.push(v0, v1, v2, v0, v2, v3);
      else gb.idx.push(v0, v2, v1, v0, v3, v2);
    }
  };
  walls(ring, false);

  // ---- gerçek kabartma: şerit balkonlar (sert ışıkta gölge versin) ------------------------
  if (detail && kind === 0 && hBody > 8.5 && rng() < 0.62) {
    const fH = 2.85 + 0.45 * glH11(seed * 7.31);
    const order = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % n];
      order.push([Math.hypot(c[0] - a[0], c[1] - a[1]), i]);
    }
    order.sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    const maxWalls = rng() < 0.45 ? 2 : 1;
    const bc = rng() < 0.5 ? [wallCol[0] * 0.8, wallCol[1] * 0.8, wallCol[2] * 0.8] : [0.62 * tone, 0.61 * tone, 0.58 * tone];
    const frac = 0.4 + 0.55 * rng();
    const shift = (rng() - 0.5) * (1 - frac);
    let done = 0;
    for (const [len, i] of order) {
      if (done >= maxWalls || len < 6.5) break;
      const a = ring[i];
      const c = ring[(i + 1) % n];
      const dx = (c[0] - a[0]) / len;
      const dz = (c[1] - a[1]) / len;
      const nx = dz;
      const nz = -dx;
      const mx = (a[0] + c[0]) / 2;
      const mz = (a[1] + c[1]) / 2;
      if (inBuilding(mx + nx * 1.6, mz + nz * 1.6, b) || inBuilding(mx + nx * 3.2, mz + nz * 3.2, b)) continue;
      const hg = Math.max(0.5, top - gY(mx, mz));
      const nF = Math.floor((hg - 0.75) / fH);
      const cx = mx + dx * shift * len + nx * 0.5;
      const cz = mz + dz * shift * len + nz * 0.5;
      const ang = Math.atan2(dz, dx);
      for (let k = 0; k < nF - 1; k++) {
        const yb = top - (0.75 + (k + 1) * fH);
        gb.box(cx, yb - 0.12, cz, (len * frac) / 2, 1.05, 0.55, ang, bc, [seed, 5, 0, 0], true, true);
      }
      done++;
    }
  }
  const holes = b.holes || [];
  for (const h of holes) walls(ringArea(h) < 0 ? h.slice().reverse() : h, true);

  // ---- çatı ------------------------------------------------------------------------------
  const cen = ringCentroid(ring);
  let star = holes.length === 0;
  if (star) {
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % n];
      // merkez her kenarın iç tarafında mı?
      if ((c[1] - a[1]) * (cen[0] - a[0]) - (c[0] - a[0]) * (cen[1] - a[1]) > -0.4) {
        star = false;
        break;
      }
    }
  }
  const hip = style === 'apt' && kind === 0 && star && area < 480 && hBody < 30 && rng() < 0.3;
  const domeR = style === 'mosque' && star ? Math.min(0.4 * Math.sqrt(area), 10) : 0;

  if (hip) {
    const tc0 = TILE_COLORS[Math.floor(rng() * TILE_COLORS.length)];
    const grey = rng() < 0.25;
    const tk = 0.62 + 0.3 * rng();
    const tc = grey ? [0.32 * tk, 0.31 * tk, 0.3 * tk] : [tc0[0] * tk, tc0[1] * tk, tc0[2] * tk];
    const rise = Math.min(3.2, 0.9 + 0.11 * Math.sqrt(area));
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const c = ring[(i + 1) % n];
      const dx = c[0] - a[0];
      const dz = c[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 0.25) continue;
      const ox = dz / len;
      const oz = -dx / len;
      const run = Math.abs((cen[0] - a[0]) * ox + (cen[1] - a[1]) * oz);
      const sl = Math.hypot(run, rise);
      const nx = (ox * rise) / sl;
      const ny = run / sl;
      const nz = (oz * rise) / sl;
      const ua = ((cen[0] - a[0]) * dx + (cen[1] - a[1]) * dz) / len;
      const v0 = gb.vert(a[0], top, a[1], nx, ny, nz, tc, 0, 0, 0, 0, seed, 4, 0, 0);
      const v1 = gb.vert(c[0], top, c[1], nx, ny, nz, tc, len, 0, 0, 0, seed, 4, 0, 0);
      const v2 = gb.vert(cen[0], top + rise, cen[1], nx, ny, nz, tc, ua, sl, 0, 0, seed, 4, 0, 0);
      gb.idx.push(v0, v2, v1);
    }
  } else {
    const drop = style === 'canopy' || hBody < 5 ? 0 : style === 'glass' ? 1.1 : 0.55;
    const ry = top - drop;
    const rc0 = style === 'mosque' ? C_LEAD : ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
    const rk = 0.75 + 0.3 * rng();
    const rc = [rc0[0] * rk, rc0[1] * rk, rc0[2] * rk];
    const contour = ring.map((p) => new THREE.Vector2(p[0], p[1]));
    const hv = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    const tris = THREE.ShapeUtils.triangulateShape(contour, hv);
    const all = ring.concat(...holes);
    const vi = all.map((p) => gb.vert(p[0], ry, p[1], 0, 1, 0, rc, p[0], p[1], 0, 0, seed, 3, 0, 0));
    for (const t of tris) {
      const a = all[t[0]];
      const c = all[t[1]];
      const d = all[t[2]];
      const cr = (c[1] - a[1]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[1] - a[1]);
      if (cr >= 0) gb.idx.push(vi[t[0]], vi[t[1]], vi[t[2]]);
      else gb.idx.push(vi[t[0]], vi[t[2]], vi[t[1]]);
    }

    // ---- çatı karmaşası --------------------------------------------------------------------
    if (detail && style !== 'canopy' && hBody >= 5 && area > 45) {
      // baskın kenar açısı
      let bl = 0;
      let ang = 0;
      for (let i = 0; i < n; i++) {
        const a = ring[i];
        const c = ring[(i + 1) % n];
        const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (l > bl) {
          bl = l;
          ang = Math.atan2(c[1] - a[1], c[0] - a[0]);
        }
      }
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of ring) {
        if (p[0] < x0) x0 = p[0];
        if (p[0] > x1) x1 = p[0];
        if (p[1] < z0) z0 = p[1];
        if (p[1] > z1) z1 = p[1];
      }
      const spot = (margin) => {
        for (let k = 0; k < 6; k++) {
          let x = x0 + rng() * (x1 - x0);
          let z = z0 + rng() * (z1 - z0);
          x = cen[0] + (x - cen[0]) * margin;
          z = cen[1] + (z - cen[1]) * margin;
          if (!pointInRing(x, z, ring)) continue;
          let ok = true;
          for (const h of holes) if (pointInRing(x, z, h)) ok = false;
          if (ok) return [x, z];
        }
        return null;
      };
      if (domeR > 0) {
        addDome(gb, cen[0], ry, cen[1], domeR, seed);
        const mp = ring[0];
        addMinaret(gb, mp[0] + (cen[0] - mp[0]) * 0.08, bottom, mp[1] + (cen[1] - mp[1]) * 0.08, top - bottom + Math.max(14, hBody * 1.1), seed);
      } else if (style === 'glass') {
        const p = spot(0.45);
        if (p) gb.box(p[0], ry, p[1], Math.min(5, Math.sqrt(area) * 0.16), 2.2 + rng() * 1.6, Math.min(4, Math.sqrt(area) * 0.13), ang, [0.2, 0.21, 0.22], [seed, 5, 0, 0]);
        const m = Math.min(16, Math.floor(area / 70));
        for (let k = 0; k < m; k++) {
          const q = spot(0.7);
          if (q) gb.box(q[0], ry, q[1], 0.9 + rng(), 0.9 + rng() * 0.8, 0.8 + rng(), ang, C_UNIT, [seed, 5, 0, 0]);
        }
      } else {
        // merdiven kulesi
        const p = spot(0.5);
        if (p && area > 70) gb.box(p[0], ry, p[1], 1.3 + rng() * 0.9, 2.1 + rng() * 0.6, 1.2 + rng() * 0.7, ang, [wallCol[0] * 0.9, wallCol[1] * 0.9, wallCol[2] * 0.9], [seed, 5, 0, 0]);
        // güneş enerjili su ısıtıcıları: koyu panel + beyaz tank
        const m = Math.min(16, Math.floor(area / 50 + rng() * 1.5));
        // geniş çatılar boş levha kalmasın: ikinci merdiven kulesi, su depoları
        for (let k = 0; k < Math.min(5, Math.floor(area / 240)); k++) {
          const q = spot(0.8);
          if (!q) continue;
          if (rng() < 0.4) gb.box(q[0], ry, q[1], 1.3 + rng(), 2.0 + rng() * 0.8, 1.2 + rng() * 0.8, ang, [wallCol[0] * 0.85, wallCol[1] * 0.85, wallCol[2] * 0.85], [seed, 5, 0, 0]);
          else gb.box(q[0], ry + 0.4, q[1], 0.8, 1.3, 0.8, ang + 0.78, C_WHITE, [seed, 5, 0, 0], true, true);
        }
        for (let k = 0; k < m; k++) {
          const q = spot(0.72);
          if (!q) continue;
          const a2 = ang + (rng() < 0.5 ? 0 : Math.PI / 2);
          if (rng() < 0.7) {
            gb.box(q[0], ry + 0.25, q[1], 1.0, 0.5, 0.55, a2, C_PANEL, [seed, 5, 0, 1]);
            gb.box(q[0] + Math.sin(a2) * -0.75, ry + 0.55, q[1] + Math.cos(a2) * 0.75, 0.75, 0.45, 0.24, a2, C_WHITE, [seed, 5, 0, 0]);
          } else {
            gb.box(q[0], ry, q[1], 0.5, 0.75, 0.38, a2, C_UNIT, [seed, 5, 0, 0]);
          }
        }
      }
    }
  }
}

function addDome(gb, cx, y, cz, r, seed) {
  const seg = 14;
  const rings = 5;
  const idx = [];
  for (let j = 0; j <= rings; j++) {
    const ph = (j / rings) * Math.PI * 0.5;
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const nx = Math.cos(ph) * Math.cos(th);
      const ny = Math.sin(ph);
      const nz = Math.cos(ph) * Math.sin(th);
      row.push(gb.vert(cx + nx * r, y + ny * r * 0.85, cz + nz * r, nx, ny, nz, C_LEAD, 0, 0, 0, 0, seed, 6, 0, 0));
    }
    idx.push(row);
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) gb.idx.push(idx[j][i], idx[j + 1][i], idx[j + 1][i + 1], idx[j][i], idx[j + 1][i + 1], idx[j][i + 1]);
  }
}

function addMinaret(gb, cx, y0, cz, h, seed) {
  const seg = 8;
  const r = 0.95;
  const lv = [[y0, r], [y0 + h * 0.72, r], [y0 + h * 0.72, r * 1.5], [y0 + h * 0.76, r * 1.5], [y0 + h * 0.76, r * 0.85], [y0 + h * 0.88, r * 0.85], [y0 + h, 0.02]];
  const rows = lv.map(([y, rr], li) => {
    const row = [];
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const c = li >= 5 ? C_LEAD : C_STONE;
      row.push(gb.vert(cx + Math.cos(th) * rr, y, cz + Math.sin(th) * rr, Math.cos(th), 0.15, Math.sin(th), c, 0, 0, 0, 0, seed, 6, 0, 0));
    }
    return row;
  });
  for (let j = 0; j + 1 < rows.length; j++) {
    for (let i = 0; i < seg; i++) gb.idx.push(rows[j][i], rows[j + 1][i], rows[j + 1][i + 1], rows[j][i], rows[j + 1][i + 1], rows[j][i + 1]);
  }
}

// ---- dolgu şehir ---------------------------------------------------------------------------
function makeFillers(ctx, net, rng) {
  const { data, heightAt } = ctx;
  const bb = (data.meta && data.meta.bbox) || { xmin: -900, xmax: 946, zmin: -842, zmax: 1038 };
  const R = 2900;
  const out = [];
  // veri sınırı dışına taşan gerçek yollar: yakınına bina koyma
  const rg = new Grid2(60);
  for (const r of net.roads) {
    if (!r.veh || r.ext) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      if (a[0] > bb.xmin && a[0] < bb.xmax && a[2] > bb.zmin && a[2] < bb.zmax) continue;
      const m = r.width / 2 + 8;
      rg.addBox(Math.min(a[0], b[0]) - m, Math.min(a[2], b[2]) - m, Math.max(a[0], b[0]) + m, Math.max(a[2], b[2]) + m, { a, b, m });
    }
  }
  const ca = Math.cos(0.14);
  const sa = Math.sin(0.14);
  const TILE = 300;
  const nT = Math.ceil(R / TILE) + 1;
  for (let tz = -nT; tz <= nT; tz++) {
    for (let tx = -nT; tx <= nT; tx++) {
      const tr = rng.fork(`${tx},${tz}`);
      const bw = 52 + tr() * 30; // blok boyu (u)
      const bd = 36 + tr() * 16; // blok derinliği (v)
      const meanH = 11 + 13 * tr() * tr() + (tr() < 0.12 ? 10 : 0);
      const sw = 7 + tr() * 4;
      const tcx = tx * TILE;
      const tcz = tz * TILE;
      if (Math.hypot(tcx, tcz) > R + TILE) continue;
      for (let bu = -TILE / 2; bu + bw * 0.6 < TILE / 2; bu += bw) {
        for (let bv = -TILE / 2; bv + bd * 0.6 < TILE / 2; bv += bd) {
          const rowD = (Math.min(bd, TILE / 2 - bv) - sw) / 2;
          const uEnd = Math.min(bu + bw, TILE / 2) - sw;
          if (rowD < 7) continue;
          for (let row = 0; row < 2; row++) {
            let u = bu;
            while (u < uEnd - 8) {
              const lw = Math.min(uEnd - u, 13 + tr() * 13);
              const skip = tr() < 0.1;
              const hh = meanH * (0.65 + 0.7 * tr());
              const tower = tr() < 0.0035;
              const jx = tr();
              const jz = tr();
              const u0 = u;
              u += lw;
              if (skip || lw < 8) continue;
              const lu = u0 + lw / 2;
              const lv = bv + row * rowD + rowD / 2;
              const wx = tcx + lu * ca - lv * sa;
              const wz = tcz + lu * sa + lv * ca;
              if (wx > bb.xmin - 6 && wx < bb.xmax + 6 && wz > bb.zmin - 6 && wz < bb.zmax + 6) continue;
              const dist = Math.hypot(wx, wz);
              if (dist > R || jx < smoothstep(1700, R, dist) * 0.85) continue;
              // koridorlar
              let blocked = false;
              for (const l of net.extLines) {
                if (segDist(wx, wz, l.ax, l.az, l.bx, l.bz) < 34 + lw * 0.5) {
                  blocked = true;
                  break;
                }
              }
              if (blocked) continue;
              for (const s of rg.at(wx, wz)) {
                if (segDist(wx, wz, s.a[0], s.a[2], s.b[0], s.b[2]) < s.m + lw * 0.5) {
                  blocked = true;
                  break;
                }
              }
              if (blocked) continue;
              const hx = lw / 2 - 0.6 - jz * 1.2;
              const hz = rowD / 2 - 0.4 - jx * 1.5;
              const rot = 0.14 + (jz - 0.5) * 0.12;
              const c2 = Math.cos(rot);
              const s2 = Math.sin(rot);
              const ring = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([a, b]) => [wx + a * c2 - b * s2, wz + a * s2 + b * c2]);
              let base = 1e9;
              for (const p of ring) base = Math.min(base, heightAt(p[0], p[1]));
              out.push({ ring, height: tower ? 38 + jx * 50 : Math.max(6, hh), minHeight: 0, baseY: base - 0.5, kind: tower ? 'office' : '' });
            }
          }
        }
      }
    }
  }
  return out;
}

// ---- cephe malzemesi -----------------------------------------------------------------------
function facadeMaterial(THREE, uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    envMapIntensity: 1,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = uniforms.uLit;
    sh.uniforms.uNight = uniforms.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aUvw; attribute vec4 aInfo; varying vec2 vUv2; flat varying vec2 vWall; flat varying vec4 vInfo;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUv2 = aUvw.xy; vWall = aUvw.zw; vInfo = aInfo;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vUv2; flat varying vec2 vWall; flat varying vec4 vInfo;
        uniform float uLit; uniform float uNight;
        vec3 cEmis; float cRough; float cMetal; vec3 cNrm;
        ${GLSL_NOISE}
        float cFar(vec2 g, float l, vec2 offs, float p){
          float s = exp2(l);
          float r = cH21(floor(g / s) + offs + l * 7.7);
          return p * clamp(1.0 + (r - 0.5) * 3.4 / sqrt(s), 0.0, 3.0);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FACADE_GLSL}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = cMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(normal + cNrm);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cEmis;');
  };
  mat.customProgramCacheKey = () => 'city-facade-v2';
  return mat;
}

const FACADE_GLSL = /* glsl */ `
cEmis = vec3(0.0); cRough = 0.9; cMetal = 0.0; cNrm = vec3(0.0);
{
  float seed = vInfo.x; float kind = vInfo.y; float wseed = vInfo.z;
  vec3 base = diffuseColor.rgb;
  vec3 col = base;
  float litP = clamp((uLit - 0.04) / 0.92, 0.0, 1.0);
  if (kind < 2.5) {
    float u = vUv2.x; float v = vUv2.y; float wallLen = vWall.x; float hAb = vWall.y - v;
    float gr = cFbm(vec2(u * 0.12 + seed * 91.0, v * 0.05 + wseed * 13.0));
    float streak = cNoise(vec2(u * 1.7 + wseed * 40.0, v * 0.06));
    base *= 0.82 + 0.26 * gr;
    base *= 1.0 - 0.14 * streak * smoothstep(0.0, 5.0, v);
    base *= 1.0 - 0.25 * exp(-max(hAb, 0.0) / 2.5);
    col = base;
    vec3 e = vec3(0.0);
    if (kind < 0.5) {
      // ---- apartman cephesi ----
      float floorH = 2.85 + 0.45 * cH11(seed * 7.31);
      float bayT = 2.6 + 1.5 * cH11(seed * 3.17);
      float nb = max(1.0, floor(wallLen / bayT + 0.5));
      float bw = wallLen / nb;
      vec2 g = vec2(u / bw, (v - 0.75) / floorH);
      vec2 id = floor(g); vec2 f = fract(g);
      vec2 fw = fwidth(g);
      vec2 aa = fw * 0.6;
      float nFloors = floor((vWall.y - 0.75) / floorH);
      float valid = step(0.0, g.y) * step(g.y, nFloors) * step(1.8, wallLen);
      float shop = step(0.45, cH11(seed * 11.3)) * step(nFloors - 1.0, id.y) * step(2.5, nFloors);
      vec2 wid = id + vec2(wseed * 91.0 + 3.0, seed * 57.0);
      float r1 = cH21(wid + 0.5); float r2 = cH21(wid + 17.3); float r3 = cH21(wid + 41.7); float r4 = cH21(wid + 71.1);
      float litFrac = 0.2 + 0.42 * cH11(seed * 5.71);

      float ww = 0.42 + 0.26 * cH11(seed * 5.9);
      float x0 = 0.5 - ww * 0.5; float x1 = 0.5 + ww * 0.5;
      float balc = step(cH21(vec2(id.x + wseed * 37.0, seed * 19.0)), 0.12 + 0.45 * cH11(seed * 2.3));
      float y0 = 0.2; float y1 = mix(0.7, 0.93, balc);
      float win = cBox(f, vec2(x0, y0), vec2(x1, y1), aa);
      float glass = cBox(f, vec2(x0 + 0.035, y0 + 0.04), vec2(x1 - 0.035, y1 - 0.04), aa);
      vec3 frameCol = mix(vec3(0.8), vec3(0.2, 0.15, 0.11), step(0.7, cH11(seed * 13.7)));
      float curtain = step(r4, 0.55) * step(f.x, x0 + (x1 - x0) * (0.35 + 0.65 * r1));
      vec3 inC = mix(vec3(0.3, 0.36, 0.42), vec3(0.62, 0.58, 0.5) * (0.55 + 0.5 * r3), curtain * 0.9);
      float recess = 1.0 - 0.7 * smoothstep(y0 + 0.2, y0 + 0.02, f.y);
      recess *= 1.0 - 0.35 * smoothstep(x0 + 0.1, x0 + 0.03, f.x);
      vec3 dcol = mix(base, frameCol, win);
      dcol = mix(dcol, inC * recess, glass);
      dcol *= 1.0 - 0.14 * (1.0 - smoothstep(0.0, 0.04, f.y));
      float sill = cBox(f, vec2(x0 - 0.04, y1), vec2(x1 + 0.04, y1 + 0.04), aa) * (1.0 - balc);
      dcol = mix(dcol, base * 1.18, sill);
      dcol *= 1.0 - 0.3 * (1.0 - balc) * cBox(f, vec2(x0 - 0.04, y1 + 0.04), vec2(x1 + 0.04, y1 + 0.085), aa);
      float rail = cBox(f, vec2(0.04, 0.66), vec2(0.96, 0.975), aa) * balc;
      vec3 railCol = mix(base * 0.74, vec3(0.15, 0.16, 0.17), step(0.6, cH11(seed * 17.1)));
      dcol = mix(dcol, railCol * (0.85 + 0.3 * smoothstep(0.66, 0.9, f.y)), rail);
      dcol *= 1.0 - 0.4 * balc * (1.0 - rail) * smoothstep(0.1, 0.0, f.y) ;
      float ac = step(r2, 0.2) * (1.0 - balc) * cBox(f, vec2(x1 + 0.03, 0.73), vec2(min(x1 + 0.2, 0.98), 0.9), aa);
      dcol = mix(dcol, vec3(0.78), ac);
      dcol *= 1.0 - 0.3 * step(r2, 0.2) * (1.0 - balc) * cBox(f, vec2(x1 + 0.03, 0.9), vec2(min(x1 + 0.2, 0.98), 0.95), aa);
      float gmask = glass * (1.0 - curtain) * (1.0 - rail);

      float th = 0.04 + 0.92 * r2;
      float on = step(r1, litFrac) * smoothstep(th, th + 0.02, uLit);
      vec3 wc = r3 < 0.55 ? vec3(1.0, 0.64, 0.32) : (r3 < 0.8 ? vec3(1.0, 0.83, 0.58) : (r3 < 0.93 ? vec3(0.78, 0.9, 1.0) : vec3(0.4, 0.55, 1.0)));
      float wi = (0.7 + 1.5 * r4) * 2.3;
      float grad = mix(1.2, 0.55, smoothstep(y0, y1, f.y)) * mix(1.0, 0.8, curtain);
      float mullion = 1.0 - 0.75 * step(0.35, r3) * (1.0 - smoothstep(0.012, 0.012 + aa.x, abs(f.x - 0.5)));
      float furn = mix(1.0, 0.55 + 0.45 * cNoise(vec2(f.x * 5.0 + r1 * 40.0, r2 * 9.0)), smoothstep(mix(y0, y1, 0.55), y1, f.y) * (1.0 - curtain));
      vec3 de = wc * wi * grad * on * glass * (1.0 - 0.8 * rail) * mullion * furn;

      if (shop > 0.5) {
        float sg = cBox(f, vec2(0.06, 0.34), vec2(0.94, 0.98), aa);
        float sign = cBox(f, vec2(0.03, 0.08), vec2(0.97, 0.28), aa);
        vec3 sc = cH23(vec2(id.x + wseed * 51.0, seed * 77.0));
        float sg0 = dot(sc, vec3(0.333));
        sc = clamp(mix(vec3(sg0), sc, 0.9), 0.03, 1.0);
        sc = mix(sc, vec3(0.8, 0.78, 0.72), step(0.55, cH11(id.x * 7.3 + seed * 131.0)));
        dcol = mix(base * 0.9, vec3(0.1, 0.12, 0.13), sg);
        dcol = mix(dcol, sc * 0.5, sign);
        gmask = sg;
        float ts = 0.02 + 0.3 * r2;
        float son = step(r1, 0.82) * smoothstep(ts, ts + 0.03, uLit);
        de = (sg * vec3(1.0, 0.86, 0.62) * (1.0 + r4) * 1.4 + sign * sc * 2.2) * son;
      }

      float m = max(fw.x, fw.y);
      float lod = smoothstep(0.22, 0.65, m);
      float lvl = max(1.0, log2(max(m, 1e-4) * 3.0));
      float l0 = floor(lvl);
      vec2 offs = vec2(wseed * 91.0 + 3.0, seed * 57.0);
      float fa = mix(cFar(g, l0, offs, litFrac * litP), cFar(g, l0 + 1.0, offs, litFrac * litP), lvl - l0);
      vec3 fc = mix(vec3(1.0, 0.68, 0.36), vec3(0.95, 0.88, 0.8), cH21(floor(g / exp2(l0 + 1.0)) + offs));
      vec3 cellE = wc * wi * on * 0.15;
      vec3 farE = mix(cellE, fc * 3.3 * 0.19 * 0.55 * fa, smoothstep(0.45, 1.1, m));
      vec3 farCol = mix(base, vec3(0.22, 0.25, 0.28), 0.2);

      col = mix(base, mix(dcol, farCol, lod), valid);
      e = mix(de, farE, lod) * valid;
      cRough = mix(0.9, mix(mix(0.9, 0.1, gmask), 0.72, lod), valid);
      cMetal = mix(0.0, mix(0.75 * gmask, 0.12, lod), valid);
      cNrm = (cH23(wid) - 0.5) * 0.09 * gmask * (1.0 - lod) * valid;
    } else if (kind < 1.5) {
      // ---- giydirme cam cephe ----
      float floorH = 3.6;
      float pw = 1.5 + 0.9 * cH11(seed * 3.3);
      float nb = max(1.0, floor(wallLen / pw + 0.5));
      float bw = wallLen / nb;
      vec2 g = vec2(u / bw, v / floorH);
      vec2 id = floor(g); vec2 f = fract(g);
      vec2 fw = fwidth(g); vec2 aa = fw * 0.6;
      float pane = cBox(f, vec2(0.035, 0.0), vec2(0.965, 0.74), aa);
      float span = cBox(f, vec2(0.035, 0.77), vec2(0.965, 0.985), aa);
      vec3 tint = diffuseColor.rgb;
      vec2 wid = id + vec2(wseed * 91.0 + 3.0, seed * 57.0);
      float r1 = cH21(wid + 0.5); float r2 = cH21(wid + 17.3); float r4 = cH21(wid + 71.1);
      vec3 dcol = mix(vec3(0.14, 0.15, 0.16), tint * (0.95 + 0.3 * r4), pane);
      dcol = mix(dcol, tint * 0.42, span);
      float fr1 = cH11(id.y * 3.71 + seed * 191.0);
      float floorOn = step(fr1, 0.3 + 0.3 * cH11(seed * 9.1));
      float th = 0.05 + 0.72 * cH11(id.y * 1.37 + seed * 71.0) + 0.12 * r2;
      float on = floorOn * step(r1, 0.86) * smoothstep(th, th + 0.02, uLit);
      vec3 oc = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.6), step(0.62, cH11(seed * 23.0)));
      float blind = mix(1.0, 0.45, step(f.y, 0.74 * cH21(wid + 5.5)) * step(0.5, cH21(wid + 9.1)));
      vec3 de = mix(oc, vec3(1.0, 0.8, 0.55), 0.35 * cH21(wid + 3.3)) * (0.5 + 0.7 * r4) * 1.35 * on * pane * mix(1.15, 0.6, f.y / 0.74) * blind;
      float lod = smoothstep(0.25, 0.7, max(fw.x, fw.y));
      float pfar = (0.3 + 0.3 * cH11(seed * 9.1)) * 0.86 * litP;
      col = mix(dcol, tint * 0.95, lod);
      float mg = max(fw.x, fw.y);
      float lvg = max(1.0, log2(max(mg, 1e-4) * 3.0)); float lg0 = floor(lvg);
      vec2 offg = vec2(wseed * 91.0 + 3.0, seed * 57.0);
      float fg = mix(cFar(g, lg0, offg, pfar), cFar(g, lg0 + 1.0, offg, pfar), lvg - lg0);
      vec3 farG = mix(oc * (0.6 + 0.7 * r4) * 1.5 * on * 0.6, oc * 1.4 * 0.6 * 0.4 * fg, smoothstep(0.45, 1.1, mg)) * 0.75;
      e = mix(de, farG, lod);
      cRough = mix(mix(0.45, 0.07, pane) + 0.2 * span, 0.22, lod);
      cMetal = mix(mix(0.4, 0.72, pane), 0.55, lod);
      cNrm = (cH23(wid) - 0.5) * 0.06 * pane * (1.0 - lod);
    }
    // sokak lambası yıkaması (yere yakın cepheler)
    float wash = smoothstep(0.08, 0.5, uLit) * exp(-max(hAb - 1.0, 0.0) / 4.5) * (0.3 + 0.7 * cNoise(vec2(u * 0.07 + seed * 31.0, wseed * 7.0)));
    e += col * vec3(1.0, 0.6, 0.28) * wash * 0.28;
    cEmis = e;
  } else if (kind < 3.5) {
    vec2 p = vUv2;
    float n = cFbm(p * 0.3 + seed * 40.0);
    col = base * (0.74 + 0.4 * n) * (0.94 + 0.12 * cNoise(p * 2.5));
    // membran derzleri, yamalar, su birikintisi izi
    float ra = seed * 6.283;
    vec2 rp = vec2(cos(ra) * p.x - sin(ra) * p.y, sin(ra) * p.x + cos(ra) * p.y);
    float fwr = max(fwidth(rp.x), fwidth(rp.y));
    float seam = (1.0 - smoothstep(0.0, 0.04, abs(fract(rp.x / 1.3) - 0.5) - 0.46)) * (1.0 - smoothstep(0.15, 0.6, fwr));
    vec2 pid = floor(rp / vec2(5.5, 3.6));
    float pm = step(0.72, cH21(pid + seed * 9.0)) * (1.0 - smoothstep(0.8, 2.5, fwr));
    col *= (1.0 - 0.2 * seam) * mix(1.0, 0.62 + 0.7 * cH21(pid + 3.0), pm);
    col *= 1.0 - 0.28 * smoothstep(0.6, 0.8, cFbm(p * 0.13 + seed * 17.0));
    cRough = 0.93;
  } else if (kind < 4.5) {
    float rw = vUv2.y * 2.6;
    float rows = abs(fract(rw) - 0.5) * 2.0;
    float k = 1.0 - smoothstep(0.3, 0.9, fwidth(rw));
    col = base * mix(1.0, 0.7 + 0.36 * smoothstep(0.0, 0.6, rows), k) * (0.78 + 0.4 * cFbm(vUv2 * 0.5 + seed * 30.0));
    cRough = 0.86;
  } else if (kind < 5.5) {
    cRough = mix(0.7, 0.16, vInfo.w);
    cMetal = mix(0.0, 0.6, vInfo.w);
  } else {
    cRough = 0.5; cMetal = 0.3;
  }
  diffuseColor.rgb = col;
}
`;
