// Mecidiyeköy metrobüs durağı (D100 orta refüjü): uzun peron, tonoz sundurma, kenar korkulukları, sarı hissedilebilir
// şeritler, asılı istasyon tabelaları, reklam panoları, turnike sırası, kalabalık; kapalı yaya üst geçidi ve merdivenler;
// orijindeki İETT otobüs peronlarının sundurmaları. Ölçüler TAHMİN (bkz. data/landmarks-notes.md).
// Veri: landmarks.metrobus_station (yeni: gerçek peron w1305577747; eski: İETT alanı) ve landmarks.bus_platforms (yeni);
// eksikse OSM'den bilinen sabit çizgiler kullanılır. Peron ekseni ve genişliği roads.json'daki iki busway şeridinin
// arasından ölçülür → city.js'in çizdiği şeritlerle hizalı.
import { obb, frame, prism, loft, boxAlong, slabAlong, strip3, signTexture, wallPlane, signedArea, personGeo } from './geom.js';

const FALLBACK_PLATFORM = [[-101, -49.5], [-80, -46.5], [33, -37]];
const FALLBACK_BUS = [[[-34, -5], [14, -1]], [[-48, 0], [-17, 8], [2, 10], [26, 10]], [[-44, 10], [-28, 15], [-7, 19], [9, 20], [32, 17]]];
const FALLBACK_BRIDGE = [[-93, -102], [-98, -50], [-100, -24]];

function lineOf(f) {
  const pts = f?.centerline || f?.pts || f?.footprint;
  if (!Array.isArray(pts) || pts.length < 2) return null;
  if (pts.length >= 4 && Math.abs(signedArea(pts)) > 15) {
    const b = obb(pts), fr = frame(b.cx, b.cz, b.angle);
    const a = fr(-b.L / 2, 0), c = fr(b.L / 2, 0);
    return a[0] < c[0] ? [a, c] : [c, a];
  }
  return pts.map((p) => [p[0], p[1]]);
}
function interpZ(line, x) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
  }
  return x < line[0][0] ? line[0][1] : line[line.length - 1][1];
}

export function buildStation(api) {
  const { THREE, ctx, heightAt, add, std, glow, signMat, root, byKey, steel, darkSteel, concrete, railGlass, people } = api;
  const rng = ctx.rng('landmarks/station');
  const gy = (x, z) => heightAt(x, z);

  // ── peron referans çizgisi ──
  const ms = byKey('metrobus_station');
  const pfs = (ms?.footprints || []).filter((f) => ['way/1305577747', 'way/1412628025'].includes(f.osmId) || /platform/i.test(f.role || '') && !/957443/.test(f.osmId || ''));
  let ref = FALLBACK_PLATFORM;
  const isNew = pfs.some((f) => f.osmId === 'way/1305577747');
  if (isNew) {
    const pts = pfs.map(lineOf).filter(Boolean).flat().sort((a, b) => a[0] - b[0]);
    if (pts.length >= 2) ref = pts;
  }
  const xMin = ref[0][0], xMax = ref[ref.length - 1][0];

  // ── busway şeritleri: peronun iki yanı ──
  const bus = (ctx.data.roads?.roads || []).filter((r) => r.kind === 'busway' && !r.bridge && Array.isArray(r.pts)
    && r.pts.some((p) => p[0] > xMin - 30 && p[0] < xMax + 30 && p[1] > -90 && p[1] < 10));
  const centers = [];
  for (let x = xMin; x <= xMax + 0.01; x += 3) {
    const rz = interpZ(ref, x);
    const zs = [];
    for (const r of bus) for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      if ((x - a[0]) * (x - b[0]) <= 0 && a[0] !== b[0]) zs.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
    }
    zs.sort((a, b) => a - b);
    let best = null;
    for (let i = 0; i < zs.length - 1; i++) {
      const gap = zs[i + 1] - zs[i];
      if (gap < 6 || gap > 17) continue;
      const d = Math.abs((zs[i] + zs[i + 1]) / 2 - rz);
      if (!best || d < best.d) best = { d, c: (zs[i] + zs[i + 1]) / 2, w: gap - 3.3 - 0.5 };
    }
    centers.push(best && best.d < 9 ? [x, best.c, Math.min(10, Math.max(4, best.w))] : [x, rz, 5.5]);
  }
  // yumuşat
  const C = centers.map((c, i) => {
    const a = centers[Math.max(0, i - 1)], b = centers[Math.min(centers.length - 1, i + 1)];
    return [c[0], (a[1] + 2 * c[1] + b[1]) / 4, (a[2] + 2 * c[2] + b[2]) / 4];
  });
  const PH = 0.35;                                    // peron kotu (TAHMİN)
  const top = (c) => gy(c[0], c[1]) + PH;

  const platMat = std(0xb9b4aa, 0.85, 0);
  const yellow = std(0xd9b21c, 0.6, 0);
  const canopy = std(0xc9d0d4, 0.25, 0.5, { side: THREE.DoubleSide });
  const led = glow(0xe6eeff, 3.4, 0.04, 0x707478);
  const amber = glow(0xffa21a, 3.5, 0.03, 0x1a1408);
  const gateGreen = glow(0x2cff6a, 3.2, 0.03, 0x0a1a0e);
  const adMats = [glow(0xfff0dc, 3.0, 0.05, 0xd8d0c0), glow(0x8fe0ff, 3.0, 0.07, 0x9cc8d8), glow(0xffb070, 3.0, 0.06, 0xd8a070)];
  const nameTex = signTexture('MECİDİYEKÖY', { color: '#ffffff', bg: '#173f86', size: 0.5, letter: 0.06 });
  const nameMat = signMat(nameTex, 3.2, 0.04, { transparent: false, alphaTest: 0, side: THREE.FrontSide });
  const nameMat2 = signMat(signTexture('METROBÜS  ·  MECİDİYEKÖY', { color: '#ffffff', bg: '#173f86', size: 0.42, letter: 0.04 }), 3.2, 0.04, { transparent: false, alphaTest: 0, side: THREE.FrontSide });

  const seg = [];
  for (let i = 0; i < C.length - 1; i++) {
    const a = C[i], b = C[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    seg.push({ a, b, L, nx, nz, tx: dx / L, tz: dz / L });
    // peron plağı
    add(platMat, slabAlong([a[0], a[1]], [b[0], b[1]], a[2], top(a), top(b), PH + 1.2, b[2]));
    // sarı hissedilebilir kenar şeritleri
    for (const sg of [-1, 1]) {
      const oa = sg * (a[2] / 2 - 0.45), ob = sg * (b[2] / 2 - 0.45);
      add(yellow, slabAlong([a[0] + nx * oa, a[1] + nz * oa], [b[0] + nx * ob, b[1] + nz * ob], 0.45, top(a) + 0.02, top(b) + 0.02, 0.05));
    }
  }
  // ── tonoz sundurma, kolonlar, LED ──
  const vault = (p, q, wp, wq, yp, yq, rise) => {
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    const N = 10, pos = [];
    const pt = (e, k) => { const a = Math.PI * (k / N), w = e ? wq : wp; const off = -Math.cos(a) * w / 2; const y = (e ? yq : yp) + Math.sin(a) * rise; const b = e ? q : p; return [b[0] + nx * off, y, b[1] + nz * off]; };
    for (let k = 0; k < N; k++) { const a0 = pt(0, k), a1 = pt(0, k + 1), b0 = pt(1, k), b1 = pt(1, k + 1); pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  };
  const EAVE = 4.0, RISE = 1.6;
  let sAcc = 0;
  for (const s of seg) {
    const { a, b, nx, nz, L } = s;
    add(canopy, vault([a[0], a[1]], [b[0], b[1]], a[2] + 1.6, b[2] + 1.6, top(a) + EAVE, top(b) + EAVE, RISE));
    // enine çelik kaburgalar (her ~3 m): tonoz kesitini izleyen ince şeritler
    for (let t = 0; t < L; t += 3) {
      const S = sAcc + t;
      if (Math.round(S) % 3 !== 0) continue;
      const x = a[0] + s.tx * t, z = a[1] + s.tz * t, w = a[2] + (b[2] - a[2]) * (t / L) + 1.6, y0 = gy(x, z) + PH + EAVE;
      const N = 8; let prev = null;
      for (let k = 0; k <= N; k++) {
        const an = Math.PI * k / N, off = -Math.cos(an) * w / 2, yy = y0 + Math.sin(an) * RISE + 0.04;
        const cur = [x + nx * off, yy, z + nz * off];
        if (prev) add(darkSteel, strip3(prev, cur, 0.16, 0.12));
        prev = cur;
      }
    }
    // sundurma kenar oluğu (koyu) ve iki sıra LED
    for (const sg of [-1, 1]) {
      const oa = sg * (a[2] / 2 + 0.8), ob = sg * (b[2] / 2 + 0.8);
      add(darkSteel, strip3([a[0] + nx * oa, top(a) + EAVE - 0.25, a[1] + nz * oa], [b[0] + nx * ob, top(b) + EAVE - 0.25, b[1] + nz * ob], 0.3, 0.3));
      const la = sg * 1.6;
      add(led, strip3([a[0] + nx * la, top(a) + EAVE + 0.9, a[1] + nz * la], [b[0] + nx * la, top(b) + EAVE + 0.9, b[1] + nz * la], 0.25, 0.08));
    }
    // kolonlar (her ~9 m) + kenar korkulukları (kapı açıklıklarıyla)
    for (let t = 0; t < L; t += 1) {
      const S = sAcc + t;
      const x = a[0] + s.tx * t, z = a[1] + s.tz * t, w = a[2] + (b[2] - a[2]) * (t / L), y = gy(x, z) + PH;
      if (S % 9 < 1) for (const sg of [-1, 1]) {
        const cx = x + nx * sg * (w / 2 - 0.25), cz = z + nz * sg * (w / 2 - 0.25);
        add(steel, prism(frame(cx, cz, 0).rect(-0.14, 0.14, -0.14, 0.14), y - 0.1, y + EAVE + 0.4 * RISE));
      }
      const door = (S % 18) > 11.5 && (S % 18) < 16.5;
      if (!door) for (const sg of [-1, 1]) {
        const cx = x + nx * sg * (w / 2 - 0.12), cz = z + nz * sg * (w / 2 - 0.12);
        if (Math.round(S) % 2 === 0) add(darkSteel, boxAlong([cx - 0.04, cz], [cx + 0.04, cz], 0.08, y, y + 1.1));
        const x2 = x + s.tx, z2 = z + s.tz;
        add(steel, boxAlong([cx, cz], [x2 + nx * sg * (w / 2 - 0.12), z2 + nz * sg * (w / 2 - 0.12)], 0.06, y + 1.02, y + 1.1));
      }
    }
    sAcc += L;
  }
  // ── asılı istasyon tabelaları, LED bilgi panoları, reklam panoları, banklar ──
  const total = sAcc;
  const at = (S) => {
    let acc = 0;
    for (const s of seg) { if (S <= acc + s.L) { const t = S - acc; return { x: s.a[0] + s.tx * t, z: s.a[1] + s.tz * t, s, w: s.a[2] + (s.b[2] - s.a[2]) * (t / s.L) }; } acc += s.L; }
    const s = seg[seg.length - 1]; return { x: s.b[0], z: s.b[1], s, w: s.b[2] };
  };
  for (let S = 28; S < total - 6; S += 26) {
    const p = at(S), y = gy(p.x, p.z) + PH + EAVE - 0.9;
    for (const sg of [-1, 1]) {
      const g = wallPlane(p.x + p.s.nx * sg * 0.04, p.z + p.s.nz * sg * 0.04, p.s.nx * sg, p.s.nz * sg, y, 3.6, 0.62, 0);
      root.add(new THREE.Mesh(g, nameMat));
    }
    add(darkSteel, boxAlong([p.x - p.s.tx * 1.8, p.z - p.s.tz * 1.8], [p.x + p.s.tx * 1.8, p.z + p.s.tz * 1.8], 0.06, y + 0.3, y + 0.36));
    const q = at(S + 4), yq = gy(q.x, q.z) + PH + EAVE - 0.8;
    add(amber, boxAlong([q.x - q.s.tx * 0.9, q.z - q.s.tz * 0.9], [q.x + q.s.tx * 0.9, q.z + q.s.tz * 0.9], 0.18, yq - 0.25, yq + 0.25));
  }
  let ai = 0;
  for (let S = 34; S < total - 8; S += 19) {
    const p = at(S), y = gy(p.x, p.z) + PH;
    add(adMats[ai++ % adMats.length], boxAlong([p.x - p.s.tx * 0.7, p.z - p.s.tz * 0.7], [p.x + p.s.tx * 0.7, p.z + p.s.tz * 0.7], 0.22, y + 0.15, y + 2.05));
    add(darkSteel, boxAlong([p.x - p.s.tx * 0.78, p.z - p.s.tz * 0.78], [p.x + p.s.tx * 0.78, p.z + p.s.tz * 0.78], 0.3, y, y + 0.15));
    const bq = at(S + 8), yb = gy(bq.x, bq.z) + PH;
    add(concrete, boxAlong([bq.x - bq.s.tx * 1.1, bq.z - bq.s.tz * 1.1], [bq.x + bq.s.tx * 1.1, bq.z + bq.s.tz * 1.1], 0.5, yb, yb + 0.45));
  }
  // ── turnike sırası + İstanbulkart gişesi (merdiven dibinde, batı başı) ──
  const TS = Math.min(24, total * 0.2);
  {
    const p = at(TS), y = gy(p.x, p.z) + PH;
    const n = Math.max(4, Math.floor((p.w - 1.2) / 0.95));
    for (let i = 0; i < n; i++) {
      const off = -((n - 1) / 2) * 0.95 + i * 0.95;
      const cx = p.x + p.s.nx * off, cz = p.z + p.s.nz * off;
      add(steel, boxAlong([cx - p.s.tx * 0.6, cz - p.s.tz * 0.6], [cx + p.s.tx * 0.6, cz + p.s.tz * 0.6], 0.22, y, y + 1.0));
      add(gateGreen, boxAlong([cx - p.s.tx * 0.12, cz - p.s.tz * 0.12], [cx + p.s.tx * 0.12, cz + p.s.tz * 0.12], 0.16, y + 1.0, y + 1.06));
    }
    const kq = at(TS + 5), ky = gy(kq.x, kq.z) + PH, ko = kq.w / 2 - 1.3;
    const kx = kq.x + kq.s.nx * ko, kz = kq.z + kq.s.nz * ko;
    add(railGlass, boxAlong([kx - kq.s.tx * 1.2, kz - kq.s.tz * 1.2], [kx + kq.s.tx * 1.2, kz + kq.s.tz * 1.2], 1.8, ky, ky + 2.4));
    add(darkSteel, boxAlong([kx - kq.s.tx * 1.4, kz - kq.s.tz * 1.4], [kx + kq.s.tx * 1.4, kz + kq.s.tz * 1.4], 2.1, ky + 2.4, ky + 2.6));
    add(adMats[0], boxAlong([kx - kq.s.tx * 0.4 - kq.s.nx * 1.0, kz - kq.s.tz * 0.4 - kq.s.nz * 1.0], [kx + kq.s.tx * 0.4 - kq.s.nx * 1.0, kz + kq.s.tz * 0.4 - kq.s.nz * 1.0], 0.15, ky + 0.8, ky + 1.7));
  }

  // ── kalabalık ──
  const PAL = [[0.06, 0.06, 0.07], [0.12, 0.13, 0.16], [0.2, 0.17, 0.14], [0.32, 0.08, 0.07], [0.5, 0.48, 0.44], [0.08, 0.14, 0.26], [0.38, 0.3, 0.2], [0.7, 0.68, 0.62], [0.16, 0.24, 0.16]];
  const LEGS = [[0.05, 0.05, 0.06], [0.1, 0.12, 0.2], [0.18, 0.16, 0.15], [0.3, 0.3, 0.32]];
  const person = (x, z, y, rot) => {
    const h = 1.58 + rng() * 0.3;
    people.push(...personGeo(x, y, z, h, rot, PAL[Math.floor(rng() * PAL.length)], LEGS[Math.floor(rng() * LEGS.length)]));
  };
  for (let i = 0; i < 170; i++) {
    // kapı önlerinde ve turnike sonrası kümelenme
    let S = TS + 3 + rng() * (total - TS - 6);
    if (rng() < 0.45) S = Math.floor(S / 18) * 18 + 12 + rng() * 5;
    if (S > total - 2) S = total - 2 - rng() * 10;
    const p = at(S), off = (rng() - 0.5) * (p.w - 1.6);
    const x = p.x + p.s.nx * off, z = p.z + p.s.nz * off;
    person(x, z, gy(x, z) + PH, rng() * Math.PI * 2);
  }
  for (let i = 0; i < 16; i++) { const p = at(TS + 1 + rng() * 4), off = (rng() - 0.5) * (p.w - 2); person(p.x + p.s.nx * off, p.z + p.s.nz * off, gy(p.x, p.z) + PH, Math.atan2(p.s.tx, p.s.tz) + (rng() - 0.5)); }

  // ── kapalı üst geçit ──
  let bridge = FALLBACK_BRIDGE;
  const fb = (ctx.data.roads?.roads || []).find((r) => r.kind === 'footway' && r.bridge && r.pts?.some((p) => Math.hypot(p[0] + 98, p[1] + 50) < 4));
  if (fb && fb.pts.length >= 2) { bridge = fb.pts.map((p) => [p[0], p[1]]); if (bridge[0][1] > bridge[bridge.length - 1][1]) bridge.reverse(); bridge[0] = [bridge[0][0], Math.min(bridge[0][1], -102)]; }
  const DECK = 5.95;                                   // city.js yaya köprüsü kotu (5.6 + yol ofseti) ile aynı yüzey
  const dy = (p) => gy(p[0], p[1]) + DECK;
  const roofM = std(0xc9ced1, 0.4, 0.3, { side: THREE.DoubleSide });
  const fascia = std(0x1b3f84, 0.5, 0.1);
  for (let i = 0; i < bridge.length - 1; i++) {
    const p = bridge[i], q = bridge[i + 1], yp = dy(p), yq = dy(q);
    add(concrete, slabAlong(p, q, 4.0, yp, yq, 0.75));
    const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    for (const sg of [-1, 1]) {
      const a = [p[0] + nx * sg * 1.85, p[1] + nz * sg * 1.85], b = [q[0] + nx * sg * 1.85, q[1] + nz * sg * 1.85];
      add(railGlass, loft([[[a[0], yp, a[1]], [b[0], yq, b[1]], [b[0] + nx * sg * 0.05, yq, b[1] + nz * sg * 0.05], [a[0] + nx * sg * 0.05, yp, a[1] + nz * sg * 0.05]],
        [[a[0], yp + 1.25, a[1]], [b[0], yq + 1.25, b[1]], [b[0] + nx * sg * 0.05, yq + 1.25, b[1] + nz * sg * 0.05], [a[0] + nx * sg * 0.05, yp + 1.25, a[1] + nz * sg * 0.05]]], { top: true }));
      // mavi alın bandı (yol tarafı)
      const fa = [p[0] + nx * sg * 2.05, p[1] + nz * sg * 2.05], fbb = [q[0] + nx * sg * 2.05, q[1] + nz * sg * 2.05];
      add(fascia, loft([[[fa[0], yp - 0.85, fa[1]], [fbb[0], yq - 0.85, fbb[1]], [fbb[0] - nx * sg * 0.12, yq - 0.85, fbb[1] - nz * sg * 0.12], [fa[0] - nx * sg * 0.12, yp - 0.85, fa[1] - nz * sg * 0.12]],
        [[fa[0], yp + 0.15, fa[1]], [fbb[0], yq + 0.15, fbb[1]], [fbb[0] - nx * sg * 0.12, yq + 0.15, fbb[1] - nz * sg * 0.12], [fa[0] - nx * sg * 0.12, yp + 0.15, fa[1] - nz * sg * 0.12]]], { top: true, bottom: true }));
      for (let t = 0; t <= L; t += 5) {
        const c = [a[0] + dx * t / L, a[1] + dz * t / L], yc = yp + (yq - yp) * t / L;
        add(steel, boxAlong([c[0] - 0.09, c[1]], [c[0] + 0.09, c[1]], 0.18, yc, yc + 3.1));
      }
    }
    add(roofM, vault(p, q, 4.6, 4.6, yp + 3.1, yq + 3.1, 0.7));
    add(led, strip3([p[0], yp + 3.0, p[1]], [q[0], yq + 3.0, q[1]], 0.25, 0.08));
    for (let t = 0; t <= L; t += 16) {
      const c = [p[0] + dx * t / L, p[1] + dz * t / L], yc = yp + (yq - yp) * t / L;
      if (Math.abs(c[1] + 44) < 6) continue;        // perona/şeride ayak basma
      add(concrete, boxAlong([c[0] - 0.45, c[1]], [c[0] + 0.45, c[1]], 0.9, gy(c[0], c[1]) - 1, yc - 0.75));
    }
    // en uzun parçanın ortasında, trafiğe bakan iki yüzde istasyon adı
    if (L > 30) {
      const mid = [p[0] + dx * 0.5, p[1] + dz * 0.5], ym = (yp + yq) / 2;
      const ss = mid;
      for (const sg of [-1, 1]) {
        root.add(new THREE.Mesh(wallPlane(ss[0] + nx * sg * 2.2, ss[1] + nz * sg * 2.2, nx * sg, nz * sg, ym - 0.35, 9, 0.9, 0), nameMat2));
      }
    }
    for (let k = 0; k < Math.floor(L / 7); k++) {
      const t = rng() * L, off = (rng() - 0.5) * 2.4;
      const x = p[0] + dx * t / L + nx * off, z = p[1] + dz * t / L + nz * off;
      person(x, z, yp + (yq - yp) * t / L, Math.atan2(dx, dz) + (rng() < 0.5 ? 0 : Math.PI));
    }
  }
  // merdivenler: perona iki kol (merdiven + yürüyen merdiven), kuzey ve güney uca
  const stair = (topP, botP, w, people0 = 0) => {
    const yt = dy(topP), yb = gy(botP[0], botP[1]) + (botP[2] ?? 0.3);
    add(concrete, slabAlong(topP, botP, w, yt, yb, 0.6));
    // basamak çizgileri
    const dx = botP[0] - topP[0], dz = botP[1] - topP[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
    const n = Math.floor((yt - yb) / 0.17);
    for (let i = 1; i < n; i += 2) { const f = i / n, x = topP[0] + dx * f, z = topP[1] + dz * f, y = yt + (yb - yt) * f;
      add(darkSteel, strip3([x + nx * w / 2, y, z + nz * w / 2], [x - nx * w / 2, y, z - nz * w / 2], 0.08, 0.03)); }
    for (const sg of [-1, 1]) {
      const a = [topP[0] + nx * sg * w / 2, topP[1] + nz * sg * w / 2], b = [botP[0] + nx * sg * w / 2, botP[1] + nz * sg * w / 2];
      add(railGlass, loft([[[a[0], yt, a[1]], [b[0], yb, b[1]], [b[0] + nx * sg * 0.05, yb, b[1] + nz * sg * 0.05], [a[0] + nx * sg * 0.05, yt, a[1] + nz * sg * 0.05]],
        [[a[0], yt + 1.1, a[1]], [b[0], yb + 1.1, b[1]], [b[0] + nx * sg * 0.05, yb + 1.1, b[1] + nz * sg * 0.05], [a[0] + nx * sg * 0.05, yt + 1.1, a[1] + nz * sg * 0.05]]], { top: true }));
    }
    for (let k = 0; k < people0; k++) { const f = rng(), off = (rng() - 0.5) * (w - 0.6); person(topP[0] + dx * f + nx * off, topP[1] + dz * f + nz * off, yt + (yb - yt) * f, Math.atan2(dx, dz)); }
  };
  // peron batı başına inen kollar: köprüden peron eksenine
  {
    const bx = interpZ(bridge.map((p) => [p[1], p[0]]), interpZ(C.map((c) => [c[0], c[1]]), C[0][0])); // köprünün peron hizasındaki x'i
    const c0 = at(2), c1 = at(TS - 3);
    const top0 = [Number.isFinite(bx) ? bx : c0.x, c0.z];
    for (const sg of [-1, 1]) {
      const o = sg * Math.min(1.2, c1.w / 4);
      stair([top0[0] + c0.s.nx * o, top0[1] + c0.s.nz * o], [c1.x + c1.s.nx * o, c1.z + c1.s.nz * o, PH], Math.min(2.2, c1.w / 2 - 0.3), 5);
    }
  }
  const b0 = bridge[0], b1 = bridge[bridge.length - 1];
  stair(b0, [b0[0] + 1.5, b0[1] - 20], 2.6, 3);
  stair(b1, [b1[0] + 17, b1[1] + 2], 2.6, 3);

  // ── İETT otobüs peronları (orijin) ──
  const bp = byKey('bus_platforms');
  let busLines = (bp?.footprints || []).map(lineOf).filter(Boolean);
  if (!busLines.length) {
    const old = (ms?.footprints || []).filter((f) => /957443/.test(f.osmId || ''));
    busLines = FALLBACK_BUS;
    void old;
  }
  const busRoof = std(0xcfd4d6, 0.45, 0.3, { side: THREE.DoubleSide });
  const lamp = glow(0xffe2b8, 3.0, 0.08, 0x666666);
  for (const ln of busLines) {
    for (let i = 0; i < ln.length - 1; i++) {
      const p = ln[i], q = ln[i + 1], g = Math.max(gy(...p), gy(...q));
      add(concrete, boxAlong(p, q, 3.2, g - 1, g + 0.2));
      add(busRoof, boxAlong(p, q, 4.2, g + 3.6, g + 3.85));
      add(lamp, boxAlong(p, q, 0.3, g + 3.5, g + 3.6));
      const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
      for (let s = 0; s <= L; s += 8) { const c = [p[0] + dx * s / L, p[1] + dz * s / L]; add(steel, boxAlong([c[0] - 0.12, c[1]], [c[0] + 0.12, c[1]], 0.24, g, g + 3.6)); }
      for (let k = 0; k < Math.floor(L / 4); k++) {
        const t = rng() * L, off = (rng() - 0.5) * 2.4, nx = -dz / L, nz = dx / L;
        person(p[0] + dx * t / L + nx * off, p[1] + dz * t / L + nz * off, g + 0.2, rng() * 6.28);
      }
    }
  }
}
