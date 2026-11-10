// İstanbul Cevahir AVM (Büyükdere Cd. 22). Doğrulanan: 6 perakende katı, 2.500 m² cam çatı ve üzerinde dev saat
// (Wikipedia "Istanbul Cevahir"), yeşil cam cephe ve beyaz köşe giriş kulesi + "İSTANBUL CEVAHİR" yazısı (Commons fotoğrafı).
// TAHMİN: cam çatının yeri/oranı, atrium derinliği, galeri sayısı, reklam ekranları, saçak, çatı tesisatı, saatin yönü.
// Mavi saatteki ana imge: karanlık kütlenin ortasında parlayan cam çatı; altında kat galerilerinin ışık halkaları.
import { obb, frame, prism, loft, sectionLoft, boxAlong, strip3, signTexture, wallPlane, signedArea, pointIn, cleanPoly, personGeo } from './geom.js';

function flipGeo(g) {
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const a = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = a; }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export function buildCevahir(api, cvFp) {
  const { THREE, ctx, heightAt, add, std, glow, signMat, root, facade, L3, steel, darkSteel, concrete, people, updaters } = api;
  const rng = ctx.rng('landmarks/cevahir');
  let poly = cleanPoly(cvFp.footprint);
  if (signedArea(poly) < 0) poly = poly.slice().reverse();
  const top = Math.max(cvFp.baseY + 34, Math.max(...poly.map(([x, z]) => heightAt(x, z))) + 22);
  const ob = obb(poly), fr = frame(ob.cx, ob.cz, ob.angle);
  // ışık sızması: çatı yüzeyine düşen sıcak hâle (radyal doku, eklemeli); gece okunurluğu için
  const spillTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    gr.addColorStop(0, 'rgb(255,196,140)'); gr.addColorStop(0.35, 'rgb(110,80,55)'); gr.addColorStop(0.7, 'rgb(28,20,14)'); gr.addColorStop(1, 'rgb(0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.NoColorSpace; return t;
  })();
  const spillMats = new Map();
  const spill = (cx, cz, y, w, d, ang, I) => {
    if (!spillMats.has(I)) {
      const sm = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: spillTex, emissiveIntensity: 0,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      api.glows.push({ m: sm, k: 0.03, I }); spillMats.set(I, sm);
    }
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.rotateY(-ang); g.translate(cx, y, cz);
    const mesh = new THREE.Mesh(g, spillMats.get(I)); mesh.renderOrder = 2; root.add(mesh);
  };

  // ── atrium deliği (cam çatının altı) — çokgenin içinde kalana dek küçült ──
  let hu = 34, hv = 18;
  for (let i = 0; i < 20 && !fr.rect(-hu - 3, hu + 3, -hv - 3, hv + 3).every(([x, z]) => pointIn(poly, x, z)); i++) { hu *= 0.92; hv *= 0.92; }
  const holeR = [-hu, hu, -hv, hv];
  let hole = fr.rect(...holeR);
  if (signedArea(hole) > 0) hole = hole.slice().reverse();         // delik ters yönde

  // ── dış kütle: yeşil cam cephe; zemin katı mağazaları erken ve sıcak yanar ──
  const m = facade({ name: 'cevahir', baseY: cvFp.baseY, seed: 101, floorH: 5.6, colW: 3.0, win: [0.05, 1, 0.1, 1],
    glass: L3(0x6fa89a), glassRM: [0.08, 0.75], wall: L3(0x2b4a45), wallRM: [0.4, 0.4], tilt: 0.04, tint: 0.6, roof: L3(0x5d6062),
    lobbyH: 7.5, lobbyC: [1.6, 1.05, 0.55], occ: 0.16, darkFrac: 0.4, zone: 4, mode: 1, full: 0.12, sparse: 0.25, trans: 0.55,
    litI: [1.0, 1.7], litA: [1, 0.85, 0.65], litB: [1, 0.95, 0.85] });
  m.userData.boost = 2.2;                                            // AVM erken yanar
  const ring0 = poly.map(([x, z]) => [x, heightAt(x, z) - 3, z]), ring1 = poly.map(([x, z]) => [x, top, z]);
  add(m, loft([ring0, ring1], { top: false }));
  // çatı: delikli kapak
  {
    const tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), [hole.map((p) => new THREE.Vector2(p[0], p[1]))]);
    const all = [...poly, ...hole], pos = [];
    for (const t of tris) {
      const v = t.map((i) => all[i]);
      const cr = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
      const o = cr > 0 ? [v[0], v[2], v[1]] : v;                    // +y'ye baksın
      for (const q of o) pos.push(q[0], top, q[1]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    add(m, g);
  }

  // ── atrium: içe bakan mağaza cepheleri (3 galeri katı), galeri döşemeleri ve ışıklı korkuluk halkaları ──
  const FH = 5.6, NF = 3, floorY = top - NF * FH;
  const atr = facade({ name: 'cevahir-atrium', baseY: floorY, seed: 107, floorH: FH, colW: 4.2, win: [0.08, 0.92, 0.12, 0.78],
    glass: L3(0x8a9aa0), glassRM: [0.12, 0.5], wall: L3(0xe9e2d4), wallRM: [0.6, 0.0], tilt: 0, roof: L3(0xd8cfbf),
    lobbyH: NF * FH, lobbyC: [2.8, 2.0, 1.25], occ: 0, darkFrac: 0 });
  atr.userData.boost = 2.5;
  add(atr, flipGeo(loft([fr.rect(...holeR).map(([x, z]) => [x, floorY, z]), fr.rect(...holeR).map(([x, z]) => [x, top, z])], { top: false })));
  const marble = std(0xd9d1c3, 0.35, 0.05, { emissive: 0xffd8a8, emissiveIntensity: 0 });
  api.glows.push({ m: marble, k: 0.02, I: 0.35 });
  add(marble, prism(fr.rect(...holeR), floorY - 0.4, floorY));
  const rail = glow(0xffe6c2, 3.0, 0.02, 0xb8b4ac);
  const D = 3.2;
  for (let k = 1; k < NF; k++) {
    const y = floorY + k * FH;
    const [u0, u1, v0, v1] = holeR;
    for (const r of [[u0, u1, v0, v0 + D], [u0, u1, v1 - D, v1], [u0, u0 + D, v0 + D, v1 - D], [u1 - D, u1, v0 + D, v1 - D]]) add(atr, prism(fr.rect(...r), y - 0.45, y));
    const inner = fr.rect(u0 + D, u1 - D, v0 + D, v1 - D).map(([x, z]) => [x, y + 0.9, z]);
    for (let i = 0; i < 4; i++) add(rail, strip3(inner[i], inner[(i + 1) % 4], 0.12, 0.12));
    const lip = fr.rect(u0 + D, u1 - D, v0 + D, v1 - D).map(([x, z]) => [x, y - 0.5, z]);
    for (let i = 0; i < 4; i++) add(rail, strip3(lip[i], lip[(i + 1) % 4], 0.2, 0.08));
  }
  // atrium zemininde kalabalık ve birkaç büfe
  const PAL = [[0.08, 0.08, 0.1], [0.3, 0.1, 0.08], [0.55, 0.5, 0.45], [0.12, 0.18, 0.32], [0.4, 0.32, 0.22], [0.75, 0.72, 0.66]];
  for (let i = 0; i < 46; i++) {
    const u = (rng() - 0.5) * (2 * hu - 4), v = (rng() - 0.5) * (2 * hv - 4), [x, z] = fr(u, v);
    people.push(...personGeo(x, floorY, z, 1.6 + rng() * 0.25, rng() * 6.28, PAL[Math.floor(rng() * PAL.length)], [0.1, 0.1, 0.12]));
  }
  const kiosk = glow(0xffd9a6, 2.2, 0.02, 0x8a7a66);
  for (let i = 0; i < 4; i++) { const [x, z] = fr((i - 1.5) * hu * 0.45, (i % 2 ? 1 : -1) * hv * 0.25); add(kiosk, prism(frame(x, z, fr.angle).rect(-2, 2, -1.2, 1.2), floorY, floorY + 2.4)); }

  // ── cam çatı: kırma, yarı saydam; kaburgalar; çerçeve; içten sıcak hâle ──
  const roofGlass = std(0xd2e2e6, 0.06, 0.35, { transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, emissive: 0xffc890, emissiveIntensity: 0 });
  api.glows.push({ m: roofGlass, k: 0.02, I: 0.4 });
  const [u0, u1, v0, v1] = holeR;
  add(roofGlass, sectionLoft(fr, [
    { y: top, rect: [u0, u1, v0, v1] },
    { y: top + 3.5, rect: [u0 + 4, u1 - 4, v0 + 4, v1 - 4] },
    { y: top + 9, rect: [u0 + 12, u1 - 12, -3, 3] },
  ]));
  { const rr = fr.rect(...holeR).map(([x, z]) => [x, top, z]); for (let i = 0; i < 4; i++) add(steel, strip3(rr[i], rr[(i + 1) % 4], 1.0, 0.6)); }
  for (let u = u0 + 2; u <= u1 - 2; u += 4) {
    const inner = Math.abs(u) <= u1 - 12;
    for (const sg of [-1, 1]) {
      const pA = fr(u, sg * (hv - 0.2)), pB = fr(inner ? u : Math.sign(u) * (u1 - 4), sg * (inner ? 3.2 : hv - 4));
      const yA = top + 0.1, yB = inner ? top + 9.15 : top + 3.6;
      add(darkSteel, strip3([pA[0], yA, pA[1]], [pB[0], yB, pB[1]], 0.3, 0.3));
    }
  }
  { const [cx, cz] = fr(0, 0); spill(cx, cz, top + 0.06, 2 * hu + 46, 2 * hv + 40, fr.angle, 0.35); }
  // dev saat: cam çatıya asılı, kadranı aşağı (atriuma) bakar; akrep/yelkovan tod'un saf fonksiyonu
  {
    const [cx, cz] = fr(0, 0), cy = top + 1.2, R = 6.5;
    const dialMat = glow(0xfff4e0, 2.4, 0.02, 0xf2eee6, { side: THREE.DoubleSide });
    const dial = new THREE.Mesh(new THREE.CircleGeometry(R, 48), dialMat);
    dial.rotation.x = Math.PI / 2; dial.position.set(cx, cy, cz); root.add(dial);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 8, 48), darkSteel);
    rim.rotation.x = Math.PI / 2; rim.position.set(cx, cy, cz); root.add(rim);
    const handMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 });
    const mk = (len, w) => { const g = new THREE.BoxGeometry(w, 0.12, len); g.translate(0, 0, len / 2); const h = new THREE.Mesh(g, handMat); h.position.set(cx, cy - 0.15, cz); root.add(h); return h; };
    const hh = mk(R * 0.55, 0.5), mh = mk(R * 0.85, 0.3);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 1.2), handMat); t.position.set(cx + Math.sin(a) * (R - 1), cy - 0.08, cz + Math.cos(a) * (R - 1)); t.rotation.y = a; root.add(t); }
    updaters.push((s) => { const h = ((s.tod % 12) + 12) % 12; hh.rotation.y = -h / 12 * Math.PI * 2; mh.rotation.y = -(h % 1) * Math.PI * 2; });
  }

  // ── Büyükdere'ye bakan ana cephe: giriş kulesi, saçak, tabelalar, reklam ekranları, korniş ışığı ──
  const toRoad = [-0.62, -0.78];
  const ranked = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    const nx = dz / len, nz = -dx / len;                              // CCW → dış normal
    const score = len * Math.max(0, nx * toRoad[0] + nz * toRoad[1]);
    if (len > 12 && score > 0) ranked.push({ p, q, nx, nz, len, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const onEdge = (e, f) => [e.p[0] + (e.q[0] - e.p[0]) * f, e.p[1] + (e.q[1] - e.p[1]) * f];
  // korniş ışığı: yola bakan tüm kenarlar boyunca (TAHMİN)
  const cornice = glow(0xfff0d8, 3.0, 0.03, 0x9a9a96);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
    const nx = dz / len, nz = -dx / len;
    if (len > 6 && nx * toRoad[0] + nz * toRoad[1] > 0.3) add(cornice, strip3([p[0] + nx * 0.3, top - 0.6, p[1] + nz * 0.3], [q[0] + nx * 0.3, top - 0.6, q[1] + nz * 0.3], 0.4, 0.3));
  }
  if (best) {
    const { p, q, nx, nz, len } = best, tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
    const at = (f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    const [mx, mz] = at(0.5), g = heightAt(mx, mz);
    const ent = facade({ name: 'cevahir-ent', baseY: cvFp.baseY, seed: 103, floorH: 5.6, colW: 2.0, win: [0.1, 0.9, 0.1, 0.95],
      glass: L3(0x93b0ba), glassRM: [0.05, 0.9], wall: L3(0xe6e8e8), wallRM: [0.5, 0.05], tilt: 0.03, lobbyH: 60, lobbyC: [0.8, 0.6, 0.4], occ: 0, zone: 2 });
    ent.userData.boost = 2.5;
    const c0 = [mx + nx * 2 - tx * 9, mz + nz * 2 - tz * 9], c1 = [mx + nx * 2 + tx * 9, mz + nz * 2 + tz * 9];
    add(ent, boxAlong(c0, c1, 8, g - 3, top + 6));
    root.add(new THREE.Mesh(wallPlane(mx + nx * 6.1, mz + nz * 6.1, nx, nz, top + 1.5, 16, 3.2, 0.2),
      signMat(signTexture('İSTANBUL CEVAHİR', { color: '#ffffff', bg: '#1d2a2c', size: 0.5, letter: 0.06 }), 4.0, 0.03, { transparent: false, alphaTest: 0 })));
    // saçak + altında sıcak gömme ışık
    const canopy = std(0xe4e6e6, 0.4, 0.3);
    const down = glow(0xffdcaa, 3.0, 0.03, 0xdedad2);
    const s0 = [mx + nx * 6 - tx * 12, mz + nz * 6 - tz * 12], s1 = [mx + nx * 6 + tx * 12, mz + nz * 6 + tz * 12];
    add(canopy, boxAlong(s0, s1, 9, g + 6.2, g + 6.8));
    add(down, boxAlong(s0, s1, 7.5, g + 6.1, g + 6.22));
    for (const f of [-11, 11]) { const c = [mx + nx * 10 + tx * f, mz + nz * 10 + tz * f]; add(steel, boxAlong([c[0] - 0.2, c[1]], [c[0] + 0.2, c[1]], 0.4, g, g + 6.2)); }
    // büyük CEVAHİR harfleri (cephenin üst bandı) ve iki reklam ekranı (TAHMİN)
    const others = ranked.slice(1).filter((e) => e.len > 18);
    if (others[0]) {
      const e = others[0], [x, z] = onEdge(e, 0.5), w = Math.min(28, e.len - 6);
      root.add(new THREE.Mesh(wallPlane(x, z, e.nx, e.nz, top - 6, w, w * 0.2, 0.35), signMat(signTexture('CEVAHİR', { color: '#ffd38a', size: 0.72, letter: 0.1 }), 5, 0.03)));
    }
    const adTex = (c1s, c2s, label) => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320; const g2 = cv.getContext('2d');
      const gr = g2.createLinearGradient(0, 0, 512, 320); gr.addColorStop(0, c1s); gr.addColorStop(1, c2s); g2.fillStyle = gr; g2.fillRect(0, 0, 512, 320);
      g2.fillStyle = 'rgba(255,255,255,0.9)'; g2.font = 'bold 64px Arial, sans-serif'; g2.textAlign = 'center'; g2.fillText(label, 256, 190);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    [[others[1], '#d23a6a', '#f2a03a', 'YENİ SEZON'], [others[2], '#2a6fd6', '#38d0c8', '%50']].forEach(([e, a, b2, label]) => {
      if (!e) return;
      const [x, z] = onEdge(e, 0.5), tx2 = (e.q[0] - e.p[0]) / e.len, tz2 = (e.q[1] - e.p[1]) / e.len;
      const mat = signMat(adTex(a, b2, label), 3.6, 0.02, { transparent: false, alphaTest: 0 });
      root.add(new THREE.Mesh(wallPlane(x, z, e.nx, e.nz, top - 12, 12, 7.5, 0.4), mat));
      add(darkSteel, boxAlong([x - tx2 * 6.3 + e.nx * 0.2, z - tz2 * 6.3 + e.nz * 0.2], [x + tx2 * 6.3 + e.nx * 0.2, z + tz2 * 6.3 + e.nz * 0.2], 0.3, top - 16, top - 8));
    });
    // giriş önü: kalabalık + yer ışıkları
    const bol = glow(0xffd29a, 3.2, 0.03, 0x555048);
    for (let i = 0; i < 48; i++) {
      const f = 0.5 + (rng() - 0.5) * 0.7, d = 4 + rng() * 12, [ex, ez] = at(f), x = ex + nx * d, z = ez + nz * d;
      people.push(...personGeo(x, heightAt(x, z) + 0.05, z, 1.6 + rng() * 0.25, rng() * 6.28, PAL[Math.floor(rng() * PAL.length)], [0.1, 0.1, 0.12]));
    }
    for (let f = 0.1; f < 0.95; f += 0.08) { const [ex, ez] = at(f), x = ex + nx * 16, z = ez + nz * 16, y = heightAt(x, z); add(bol, boxAlong([x - 0.15, z], [x + 0.15, z], 0.3, y, y + 0.9)); }
  }

  // ── koridor ışıklıkları: atriumdan uzun/kısa eksen boyunca dar cam şeritler, gece içeriden sıcak (TAHMİN) ──
  const skyMat = glow(0xffcf98, 1.7, 0.02, 0xa9b9bd, { metalness: 0.6, roughness: 0.12 });
  const strips = [];
  for (const sg of [-1, 1]) {
    strips.push([[sg * (hu + 3), 0], [sg * ob.L * 0.43, 0], 4.5]);
    strips.push([[0, sg * (hv + 3)], [0, sg * ob.W * 0.4], 4]);
  }
  for (const [[ua, va], [ub, vb], w] of strips) {
    // içerde kalan en uzun parça
    let end = 1;
    for (; end > 0.2; end -= 0.05) { const [x, z] = fr(ua + (ub - ua) * end, va + (vb - va) * end); if (pointIn(poly, x, z) && pointIn(poly, ...fr(ua + (ub - ua) * end + (va === vb ? 0 : w), va + (vb - va) * end + (va === vb ? w : 0)))) break; }
    const ue = ua + (ub - ua) * (end - 0.03), ve = va + (vb - va) * (end - 0.03);
    const r = va === vb ? [Math.min(ua, ue), Math.max(ua, ue), -w / 2, w / 2] : [-w / 2, w / 2, Math.min(va, ve), Math.max(va, ve)];
    if ((r[1] - r[0]) * (r[3] - r[2]) < 40) continue;
    const ridge = va === vb ? [r[0], r[1], -0.3, 0.3] : [-0.3, 0.3, r[2], r[3]];
    add(skyMat, sectionLoft(fr, [{ y: top - 0.1, rect: r }, { y: top + 0.8, rect: r }, { y: top + 2.2, rect: ridge }]));
    { const [cx, cz] = fr((r[0] + r[1]) / 2, (r[2] + r[3]) / 2); spill(cx, cz, top + 0.05, (r[1] - r[0]) + 16, (r[3] - r[2]) + 18, fr.angle, 0.3); }
    const rr = fr.rect(...r).map(([x, z]) => [x, top + 0.82, z]);
    for (let i = 0; i < 4; i++) add(darkSteel, strip3(rr[i], rr[(i + 1) % 4], 0.3, 0.2));
  }

  // ── çatı dokusu: tesisat odaları (jaluzili), klima sıraları, bakım yolları (TAHMİN) ──
  const free = (x, z, u, v, m2) => pointIn(poly, x, z) && !(Math.abs(u) < hu + m2 && Math.abs(v) < hv + m2);
  const louvre = std(0x6c7074, 0.55, 0.4), hvac = std(0x9a9ea0, 0.6, 0.3);
  const svcLamp = glow(0xffe2b0, 6, 0.03, 0x666055);
  // çatı yüzeyi: iki tonlu membran bölmeleri + açık renkli bakım yolu ızgarası (yüzey tonunda bölmeler; TAHMİN)
  const memA = std(0x55585b, 0.9, 0), memB = std(0x6a6d70, 0.88, 0), path = std(0x8c8a84, 0.85, 0);
  const BAY = 22;
  for (let u = -ob.L / 2 + BAY / 2; u < ob.L / 2; u += BAY) for (let v = -ob.W / 2 + BAY / 2; v < ob.W / 2; v += BAY) {
    const c = fr.rect(u - BAY / 2 + 1, u + BAY / 2 - 1, v - BAY / 2 + 1, v + BAY / 2 - 1);
    if (!c.every(([x, z]) => pointIn(poly, x, z)) || (Math.abs(u) < hu + BAY / 2 + 1 && Math.abs(v) < hv + BAY / 2 + 1)) continue;
    const ui = Math.round((u + ob.L) / BAY), vi = Math.round((v + ob.W) / BAY);
    add((ui + vi) % 2 ? memA : memB, prism(c, top - 0.1, top + 0.04));
  }
  for (let u = -ob.L / 2 + BAY; u < ob.L / 2; u += BAY) {
    for (let v = -ob.W / 2; v < ob.W / 2; v += 4) {
      const a = fr(u, v), b = fr(u, v + 4);
      if (pointIn(poly, ...a) && pointIn(poly, ...b) && !(Math.abs(u) < hu + 1 && Math.abs(v + 2) < hv + 1)) add(path, boxAlong(a, b, 1.0, top - 0.1, top + 0.08));
    }
  }
  // parapet boyunca hafif aydınlatma (tüm kenarlar, iç yüz; TAHMİN)
  const parapet = glow(0xffe6c4, 1.2, 0.03, 0x77736c);
  {
    const cx = ob.cx, cz = ob.cz;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const pi = [p[0] + (cx - p[0]) * 0.006, p[1] + (cz - p[1]) * 0.006], qi = [q[0] + (cx - q[0]) * 0.006, q[1] + (cz - q[1]) * 0.006];
      add(concrete, boxAlong(p, q, 0.5, top - 0.1, top + 1.0));
      add(parapet, strip3([pi[0], top + 0.9, pi[1]], [qi[0], top + 0.9, qi[1]], 0.18, 0.08));
    }
  }
  for (let i = 0; i < 9; i++) {
    const u = (rng() - 0.5) * ob.L * 0.75, v = (rng() - 0.5) * ob.W * 0.7, [x, z] = fr(u, v);
    const w = 12 + rng() * 10, d = 7 + rng() * 5;
    if (!free(x, z, u, v, Math.max(w, d) / 2 + 3) || !fr.rect(u - w / 2, u + w / 2, v - d / 2, v + d / 2).every(([a, b]) => pointIn(poly, a, b))) continue;
    const f2 = frame(x, z, fr.angle), h = 3.5 + rng() * 2;
    add(louvre, prism(f2.rect(-w / 2, w / 2, -d / 2, d / 2), top - 0.2, top + h));
    // servis kapısı lambası + altında hâle
    { const lp = f2(w / 2 - 2, -d / 2 - 0.25); add(svcLamp, boxAlong([lp[0] - 0.3, lp[1]], [lp[0] + 0.3, lp[1]], 0.25, top + 2.4, top + 2.7));
      const sp = f2(w / 2 - 2, -d / 2 - 3); spill(sp[0], sp[1], top + 0.05, 10, 8, fr.angle, 0.4); }
    for (let k = 0.6; k < h - 0.3; k += 0.45) { const a = f2(-w / 2 - 0.05, -d / 2 - 0.05), b = f2(w / 2 + 0.05, -d / 2 - 0.05); add(darkSteel, strip3([a[0], top + k, a[1]], [b[0], top + k, b[1]], 0.1, 0.06)); }
  }
  for (let i = 0; i < 90; i++) {
    const u = (rng() - 0.5) * ob.L * 0.9, v = (rng() - 0.5) * ob.W * 0.85, [x, z] = fr(u, v);
    if (!free(x, z, u, v, 4)) continue;
    const f2 = frame(x, z, fr.angle), w = 2 + rng() * 3, d = 1.4 + rng() * 1.6;
    add(rng() < 0.6 ? hvac : concrete, prism(f2.rect(-w / 2, w / 2, -d / 2, d / 2), top - 0.2, top + 1.0 + rng() * 1.4));
    if (rng() < 0.4) { const fan = f2(0, 0); add(darkSteel, prism(frame(fan[0], fan[1], fr.angle).rect(-0.6, 0.6, -0.6, 0.6), top + 2.2, top + 2.5)); }
  }
}
