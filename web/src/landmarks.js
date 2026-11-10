// Simge yapılar — Mecidiyeköy'ün tanınırlığı.
// Trump Towers (iki kule + AVM podyumu), Torun Center (ofis + konut kulesi), Quasar İstanbul (Fairmont + rezidans),
// Şişli Plaza (krem kule, taç halkası), Cevahir AVM (yeşil cam kütle + cam çatı), likör fabrikası ve alçak bloklar,
// metrobüs peronu + üst geçit, İETT peron sundurmaları, metro girişleri, Mecidiyeköy Meydanı.
// Ölçü/kaynak notları: data/landmarks-notes.md. Viyadük tabliyesi city.js'in; burada çizilmez.
//
// CONTRACT: §4b cam = düşük pürüzlü/yüksek metalik Standard (scene.environment'ı yansıtır, kendi envMap'i yok);
// yayıcılar gündüz 0, pencere 1.5–4, tabela 3–6, ikaz lambası ≈ 8. §7: her şey (tod,t)'nin saf fonksiyonu,
// rastgelelik yalnızca ctx.rng ve shader içi sabit hash.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facadeMaterial, lin } from './landmarks/facade.js';
import { buildStation } from './landmarks/station.js';
import { obb, frame, prism, sectionLoft, loft, boxAlong, strip3, interpRect, slabAlong, treeGeos, personGeo, signTexture, wallPlane, arcPts, cleanPoly, centroid, signedArea, pointIn } from './landmarks/geom.js';

export async function create(ctx) {
  const { THREE, heightAt } = ctx;
  const rng = ctx.rng('landmarks');
  const root = new THREE.Group();
  root.name = 'landmarks';
  const LM = ctx.data?.landmarks?.landmarks || [];
  const byKey = (k) => LM.find((l) => l.key === k);
  const fpOf = (k, osm) => byKey(k)?.footprints?.find((f) => f.osmId === osm);

  // ───────── malzeme ve parça kayıtları ─────────
  const facades = [];                 // { m, ledK }
  const glows = [];                   // { m, k, I }  → emissiveIntensity = lightsOn > k ? I : 0
  const blinkers = [];                // { m, period, phase, duty, I }
  const parts = new Map();            // material → [geometry]
  const add = (mat, geo) => { if (!geo) return; if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo); };
  const L3 = (hex, mul) => lin(THREE, hex, mul);

  function facade(opts, ledK = null) {
    const m = facadeMaterial(THREE, opts);
    facades.push({ m, ledK: ledK ?? rng() * 0.5 + 0.2 });
    return m;
  }
  function std(hex, rough, metal, extra = {}) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, ...extra });
  }
  function glow(color, I, k, base = 0x111111, extra = {}) {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.6, metalness: 0, emissive: color, emissiveIntensity: 0, ...extra });
    glows.push({ m, k, I });
    return m;
  }
  function signMat(tex, I, k, extra = {}) {
    const m = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, transparent: true, alphaTest: 0.05,
      roughness: 0.5, metalness: 0, side: THREE.DoubleSide, depthWrite: true, ...extra,
    });
    glows.push({ m, k, I });
    return m;
  }
  const steel = std(0x8b9298, 0.38, 0.85);
  const darkSteel = std(0x2a2e33, 0.45, 0.7);
  const concrete = std(0x9c978e, 0.85, 0);
  const railGlass = std(0x9fb5bf, 0.05, 0.6, { transparent: true, opacity: 0.35, depthWrite: false });
  const paving = std(0xb3aa9c, 0.82, 0);
  const pavingDark = std(0x6f6a64, 0.85, 0);

  // aviation (havacılık ikaz) — kırmızı, t'nin saf fonksiyonu olarak yanıp söner
  const avGeo = new THREE.SphereGeometry(0.5, 10, 8);
  function aviation(points, phase) {
    const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a10, emissiveIntensity: 0, roughness: 0.5 });
    blinkers.push({ m, period: 1.5, phase, duty: 0.42, I: 9 });
    for (const [x, y, z] of points) { const s = new THREE.Mesh(avGeo, m); s.position.set(x, y + 0.5, z); root.add(s); }
  }
  const rectCorners = (fr, r, y, inset = 0.6) => fr.rect(r[0] + inset, r[1] - inset, r[2] + inset, r[3] - inset).map(([x, z]) => [x, y, z]);

  const minGround = (poly) => Math.min(...poly.map(([x, z]) => heightAt(x, z)));
  const maxGround = (poly) => Math.max(...poly.map(([x, z]) => heightAt(x, z)));

  // ───────── Trump Towers ─────────
  const tt = byKey('trump_towers');
  if (tt) {
    const res = fpOf('trump_towers', 'way/1222286465');
    const off = fpOf('trump_towers', 'way/1455454989');
    const pod = fpOf('trump_towers', 'way/163629174');
    const tcfg = (seed, base, residential) => ({
      dark: facade({
        name: 'trump-dark', baseY: base, seed, floorH: 3.75, colW: 1.55, win: [0.07, 1, 0.3, 1],
        glass: L3(0x6d8398), glassRM: [0.035, 0.92], wall: L3(0x2b2e33), wallRM: [0.35, 0.55], tilt: 0.07,
        occ: 0.2, darkFrac: residential ? 0.1 : 0.18, zone: residential ? 0 : 5, mode: residential ? 0 : 1, full: 0.24, sparse: 0.3, trans: 0.85, litI: residential ? [0.9, 2.0] : [1.2, 1.9],
        litA: residential ? [1.0, 0.7, 0.4] : [0.85, 0.92, 1.0], litB: residential ? [1.0, 0.85, 0.62] : [1.0, 0.94, 0.82],
      }),
      white: facade({
        name: 'trump-white', baseY: base, seed: seed + 5, floorH: 3.75, colW: 1.9, win: [0.06, 1, 0.3, 1],
        glass: L3(0x9cb6c2), glassRM: [0.04, 0.88], wall: L3(0xe4e7e8), wallRM: [0.45, 0.05], tilt: 0.05,
        occ: 0.2, darkFrac: residential ? 0.1 : 0.2, zone: residential ? 0 : 4, mode: residential ? 0 : 1, full: 0.24, sparse: 0.3, trans: 0.9, litI: residential ? [0.9, 2.0] : [1.2, 1.9],
        litA: residential ? [1.0, 0.72, 0.44] : [0.88, 0.94, 1.0], litB: [1.0, 0.9, 0.72],
      }),
      core: facade({
        name: 'trump-core', baseY: base, seed: seed + 9, floorH: 3.75, colW: 1.2, win: [0.03, 1, 0.08, 1],
        glass: L3(0xa9c2cc), glassRM: [0.03, 0.95], wall: L3(0x9aa7ad), wallRM: [0.2, 0.7], tilt: 0.02,
        occ: 0.2, darkFrac: 0.15, zone: 3, mode: residential ? 0 : 1, full: 0.24, sparse: 0.3, litA: [0.9, 0.95, 1.0], litB: [1.0, 1.0, 0.95], litI: [1.0, 1.7],
      }),
    });
    const crownMat = facade({ name: 'trump-crown', baseY: 0, seed: 77, floorH: 4, colW: 2, win: [0, 0, 0, 0],
      glass: L3(0x111418), wall: L3(0x2a2e33), wallRM: [0.22, 0.7], tilt: 0, occ: 0 });

    const trumpLed = glow(0xfff1dc, 3.5, 0.2, 0x8a8a8a);
    const podLeaf = std(0x3e5a30, 0.92, 0), podBark = std(0x4b3c2f, 0.9, 0);
    const trumpWhiteBand = std(0xe8ebec, 0.5, 0.05);
    const trumpBronze = std(0x4a4038, 0.32, 0.75);
    const trumpParapet = std(0x8fa3ad, 0.04, 0.9, { side: THREE.DoubleSide });
    function trumpTower(fp, H, residential, seed) {
      const b = obb(fp.footprint);
      const fr = frame(b.cx, b.cz, b.angle);
      const L = b.L, W = b.W, base = fp.baseY, y0 = base - 3, roof = base + H, s = 1.4;
      const M = tcfg(seed, base, residential);
      // koyu yarı: prizmatik yüzler — ortada dışa kırılır, üstte içe çekilir
      const darkTop = residential
        ? (u) => roof - 3 * Math.min(1, Math.max(0, (-s - u) / (L / 2 - s)))   // hafif eğik çatı
        : () => roof - 15;
      const dS = [
        { y: y0, rect: [-L / 2, -s, -W / 2, W / 2] },
        { y: base + 0.44 * H, rect: [-L / 2 - 1.2, -s, -W / 2 - 3.0, W / 2 + 1.2] },
        { y: (u) => darkTop(u), rect: [-L / 2 + 1.8, -s, -W / 2 + 1.0, W / 2 - 2.0] },
      ];
      add(M.dark, sectionLoft(fr, dS));
      // beyaz yarı: dış ucu yukarı doğru içe kaçar (incelen siluet)
      const whiteTop = residential ? roof - 3 : roof - 14;
      const wS = [
        { y: y0, rect: [s, L / 2, -W / 2 + 0.4, W / 2 - 0.4] },
        { y: base + 0.6 * H, rect: [s, L / 2 - 1.2, -W / 2 + 0.2, W / 2 + 0.9] },
        { y: whiteTop, rect: [s, L / 2 - 5.5, -W / 2 + 1.2, W / 2 - 0.2] },
      ];
      add(M.white, sectionLoft(fr, wS));
      // ── cephe kabartması (yakın planda düz ızgara kalmasın) ──
      const numS = (S, top) => S.map((q) => ({ y: typeof q.y === 'function' ? top : q.y, rect: q.rect }));
      const dN = numS(dS, residential ? roof - 3 : roof - 15), wN = numS(wS, whiteTop);
      const r3 = ctx.rng('landmarks/trump-relief-' + seed);
      const FH = 3.75;
      // beyaz yarı: her katta beyaz döşeme bandı (0.35 m taşar) + ritmik parapet/balkon panelleri (e-architect)
      for (let y = base + 2 * FH; y < whiteTop - 1.5; y += FH) {
        const r = interpRect(wN, y);
        add(trumpWhiteBand, prism(fr.rect(r[0] + 0.05, r[1] + 0.35, r[2] - 0.35, r[3] + 0.35), y - 0.22, y + 0.22, { top: true, bottom: true }));
      }
      for (let fl = 2, y = base + 2 * FH; y < whiteTop - FH; fl++, y += FH) {
        const r = interpRect(wN, y + 0.6);
        const bayW = 2.9, nB = Math.floor((r[1] - r[0] - 0.6) / bayW);
        for (const side of [-1, 1]) for (let b2 = 0; b2 < nB; b2++) {
          const ph = (fl * 2 + b2 * 3 + (side > 0 ? 1 : 0)) % 7;
          if (!(ph < 2 || (ph === 4 && r3() < 0.5))) continue;
          const u0 = r[0] + 0.4 + b2 * bayW, v = side > 0 ? r[3] : r[2];
          add(trumpWhiteBand, prism(fr.rect(u0 + 0.15, u0 + bayW - 0.15, side > 0 ? v - 0.1 : v - 0.55, side > 0 ? v + 0.55 : v + 0.1), y + 0.22, y + 1.25, { top: true, bottom: true }));
        }
      }
      // koyu yarı: her katta bronz yatay kanat (kırık yüzleri izler), iki katta bir daha derin
      for (let fl = 2, y = base + 2 * FH; y < (residential ? roof - 4 : roof - 16); fl++, y += FH) {
        const r = interpRect(dN, y), e = fl % 2 ? 0.22 : 0.5;
        add(trumpBronze, prism(fr.rect(r[0] - e, r[1] - 0.05, r[2] - e, r[3] + e), y - 0.18, y + 0.18, { top: true, bottom: true }));
      }
      // koyu yarının iki uzun yüzünde derin dikey kanat (prizmatik kırığı vurgular)
      for (const side of [-1, 1]) {
        const pts = dN.map((q) => { const r = q.rect; return [r[0] + (r[1] - r[0]) * 0.42, side > 0 ? r[3] : r[2], q.y]; });
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b2 = pts[i + 1];
          const ring = (p) => [fr(p[0] - 0.35, p[1]), fr(p[0] + 0.35, p[1]), fr(p[0] + 0.35, p[1] + side * 0.7), fr(p[0] - 0.35, p[1] + side * 0.7)].map(([x, z]) => [x, p[2], z]);
          add(darkSteel, loft([ring(a), ring(b2)], { top: true }));
        }
      }
      // şeffaf orta kütle (çekirdeğin iki yanı ayrı birim — e-architect); rezidansta çatıdan cam bıçak gibi taşar
      const coreTop = residential ? roof - 3 : roof - 14;
      add(M.core, prism(fr.rect(-s - 1.2, s + 1.2, -W / 2 + 2.6, W / 2 - 2.6), y0, coreTop));
      const av = [];
      // cephe temizleme vinci (BMU) — iki kulenin tepesinde de fotoğrafta görülen yatay kol (Commons "Sunset over Mecidiyeköy", 2020)
      const bmu = (u, v, y, len, ang) => {
        const [x, z] = fr(u, v);
        add(darkSteel, boxAlong([x - 0.5, z], [x + 0.5, z], 1.0, y, y + 2.2));
        const a = fr.angle + ang, ex = x + Math.cos(a) * len, ez = z + Math.sin(a) * len;
        add(darkSteel, boxAlong([x - Math.cos(a) * len * 0.35, z - Math.sin(a) * len * 0.35], [ex, ez], 0.5, y + 2.2, y + 2.8));
        add(darkSteel, boxAlong([ex, ez], [ex + Math.cos(a) * 0.4, ez + Math.sin(a) * 0.4], 0.4, y + 1.2, y + 2.8));
      };
      if (!residential) {
        // Ofis kulesinin koyu taç kutusu, ön yüzlerde "TRUMP / TOWERS" beyaz serif yazı (fotoğrafla doğrulandı:
        // Commons "Sunset over Mecidiyeköy.jpg"); kutu kuleden dar, ~14 m. Jaluzi/LED çerçeve yok (doğrulanamadı).
        const cr = [-9, 7, -W / 2 + 2.2, W / 2 - 2.2];
        add(crownMat, prism(fr.rect(...cr), roof - 15, roof));
        const tex = signTexture('TRUMP', { color: '#f4f1ea', size: 0.74, letter: 0.08, font: 'normal', w: 1024, h: 256, family: 'serif' });
        const tex2 = signTexture('TOWERS', { color: '#f4f1ea', size: 0.7, letter: 0.3, font: 'normal', w: 1024, h: 256, family: 'serif' });
        const sm = signMat(tex, 3.2, 0.15), sm2 = signMat(tex2, 3.2, 0.15);
        for (const sgn of [-1, 1]) {
          const [cx, cz] = fr((cr[0] + cr[1]) / 2, sgn > 0 ? cr[3] : cr[2]);
          const nx = -Math.sin(fr.angle) * sgn, nz = Math.cos(fr.angle) * sgn;
          root.add(new THREE.Mesh(wallPlane(cx, cz, nx, nz, roof - 4.6, 11, 2.75, 0.06), sm));
          root.add(new THREE.Mesh(wallPlane(cx, cz, nx, nz, roof - 7.2, 6.5, 1.6, 0.06), sm2));
        }
        bmu((cr[0] + cr[1]) / 2, 0, roof, 9, Math.PI / 2 * 0.15);
        av.push(...rectCorners(fr, cr, roof));
      } else {
        // Rezidans: düz çatı, kuleden dar koyu teknik kutu + BMU (fotoğraf); eğim yalnız hafif (prizmatik yüzlerin perspektifi)
        const cb = [-L / 2 + 6, s + 1.2, -W / 2 + 3, W / 2 - 3.5];
        add(crownMat, prism(fr.rect(...cb), roof - 4, roof + 1.5));
        bmu((cb[0] + cb[1]) / 2, 0, roof + 1.5, 8, -Math.PI / 2 * 0.1);
        av.push(...rectCorners(fr, cb, roof + 1.5, 0.3));
      }
      aviation(av, seed * 0.137);
      return { fr, L, W, roof };
    }
    if (res) trumpTower(res, 155, true, 11);
    if (off) trumpTower(off, 145, false, 23);

    // AVM podyumu — eğimli arazide ~3 kat; üst yüzey araziyi izler (tahmin)
    if (pod) {
      const poly = cleanPoly(pod.footprint);
      const podMat = facade({
        name: 'trump-podium', baseY: pod.baseY, seed: 31, roof: L3(0x7a756d), floorH: 4.6, colW: 2.4, win: [0.05, 1, 0.22, 0.95],
        glass: L3(0x55636e), glassRM: [0.06, 0.88], wall: L3(0x1b1d20), wallRM: [0.4, 0.5], tilt: 0.03,
        lobbyH: 9.5, lobbyC: [1.8, 1.25, 0.75], occ: 0.60, darkFrac: 0.2, zone: 3, litA: [1, 0.8, 0.55], litB: [1, 0.9, 0.75],
      });
      const top = (x, z) => heightAt(x, z) + 14;
      add(podMat, prism(poly, (x, z) => heightAt(x, z) - 3, top));
      // çatı: kuzey-güney ışıklıkları, tesisat kutuları, kule diplerinde saksı ağaçlar (TAHMİN)
      {
        const ob = obb(poly), fp2 = frame(ob.cx, ob.cz, ob.angle), r4 = ctx.rng('landmarks/trump-roof');
        const towers = [res, off].filter(Boolean).map((f) => obb(f.footprint));
        const nearT = (x, z, m) => towers.some((o) => { const c = Math.cos(o.angle), sn = Math.sin(o.angle), dx = x - o.cx, dz = z - o.cz;
          return Math.abs(dx * c + dz * sn) < o.L / 2 + m && Math.abs(-dx * sn + dz * c) < o.W / 2 + m; });
        const sky = std(0x8ea4b0, 0.06, 0.85), sky2 = glow(0xffd7a0, 1.2, 0.1, 0x8ea4b0);
        for (let u = -ob.L / 2 + 14; u < ob.L / 2 - 14; u += 26) {
          for (const v of [-ob.W * 0.18, ob.W * 0.18]) {
            const c = fp2(u, v);
            if (!pointIn(poly, c[0], c[1]) || nearT(c[0], c[1], 6)) continue;
            const rr = frame(c[0], c[1], ob.angle), y = top(c[0], c[1]);
            add(sky, sectionLoft(rr, [{ y: y - 0.2, rect: [-9, 9, -3, 3] }, { y: y + 1.2, rect: [-9, 9, -3, 3] }, { y: y + 2.4, rect: [-9, 9, -0.4, 0.4] }]));
            add(sky2, prism(rr.rect(-8.6, 8.6, -2.6, 2.6), y - 0.25, y + 0.05));
            for (let k = -9; k <= 9; k += 3) { const a1 = rr(k, -3.05), a2 = rr(k, 0); add(darkSteel, strip3([a1[0], y + 1.2, a1[1]], [a2[0], y + 2.45, a2[1]], 0.12, 0.1)); const b1 = rr(k, 3.05); add(darkSteel, strip3([b1[0], y + 1.2, b1[1]], [a2[0], y + 2.45, a2[1]], 0.12, 0.1)); }
          }
        }
        for (let i = 0; i < 60; i++) {
          const u = (r4() - 0.5) * ob.L * 0.9, v = (r4() - 0.5) * ob.W * 0.8, c = fp2(u, v);
          if (!pointIn(poly, c[0], c[1]) || nearT(c[0], c[1], 3)) continue;
          const y = top(c[0], c[1]), rr = frame(c[0], c[1], ob.angle);
          if (r4() < 0.6) { const w = 2 + r4() * 5, d = 1.5 + r4() * 3; add(r4() < 0.5 ? concrete : steel, prism(rr.rect(-w / 2, w / 2, -d / 2, d / 2), y - 0.2, y + 1 + r4() * 1.8)); }
          else if (nearT(c[0], c[1], 22)) {
            add(concrete, prism(rr.rect(-1.6, 1.6, -1.6, 1.6), y - 0.2, y + 0.9));
            const [tr, cw] = treeGeos(c[0], y + 0.9, c[1], 4.5 + r4() * 2, 1.6 + r4(), 'round', r4() * 6);
            add(podBark, tr); add(podLeaf, cw);
          }
        }
      }
      // güney cephesi (D100'e bakan) tabelalar
      const a = [-8.7, -107.9], bpt = [52.3, -104.8];
      const dx = bpt[0] - a[0], dz = bpt[1] - a[1], len = Math.hypot(dx, dz);
      const nx = -dz / len, nz = dx / len; // dışa (güney, +z)
      const onx = nz > 0 ? nx : -nx, onz = nz > 0 ? nz : -nz;
      const at = (f) => [a[0] + dx * f, a[1] + dz * f];
      const gy = (p) => heightAt(p[0], p[1]);
      const p1 = at(0.3);
      root.add(new THREE.Mesh(wallPlane(p1[0], p1[1], onx, onz, gy(p1) + 11.2, 22, 3.6, 0.4),
        signMat(signTexture('TRUMP TOWERS', { color: '#f0dfb4', size: 0.6, letter: 0.1 }), 3.2, 0.22)));
      const p2 = at(0.78);
      const mmTex = signTexture('MediaMarkt', { color: '#ffffff', bg: '#d4111a', size: 0.58, letter: 0 });
      root.add(new THREE.Mesh(wallPlane(p2[0], p2[1], onx, onz, gy(p2) + 10.5, 13, 3.2, 0.4), signMat(mmTex, 4.5, 0.1)));
    }
  }

  // ───────── Torun Center + Quasar İstanbul ─────────
  const tcFps = [...(byKey('torun_center')?.footprints || []), ...(byKey('quasar')?.footprints || [])];
  if (tcFps.length) {
    const fps = Object.fromEntries(tcFps.map((f) => [f.osmId, f]));
    const torunCrownGlow = glow(0xffb85a, 4.5, 0.1, 0x6a5a40);
    // Torun ofis kulesi (w801, tahmin: 36 kat ≈ 150 m) — kaydırılmış istif bloklar, koyu mavi cam, altın LED kat çizgileri, kırmızı T logosu
    const tOff = fps['way/728793801'];
    if (tOff) {
      const b = obb(tOff.footprint), fr = frame(b.cx, b.cz, b.angle), L = b.L, W = b.W;
      const base = tOff.baseY, y0 = base - 3, H = 150, roof = base + H;
      const m = facade({
        name: 'torun-office', baseY: base, seed: 41, floorH: 4.1, colW: 1.5, win: [0.06, 1, 0.24, 1],
        glass: L3(0x5c7090), glassRM: [0.04, 0.92], wall: L3(0x151b24), wallRM: [0.35, 0.6], tilt: 0.06,
        ledEvery: 3, ledColor: [3.4, 2.1, 0.9], zone: 6, occ: 0.41, darkFrac: 0.28, mode: 1, full: 0.2, sparse: 0.3, trans: 0.6, litI: [1.2, 2.0], litA: [0.86, 0.93, 1.0], litB: [1, 0.95, 0.85],
      }, 0.12);
      const stone = facade({ name: 'torun-crown', baseY: base, seed: 43, floorH: 4.1, colW: 3, win: [0.4, 0.6, 0.4, 0.6],
        glass: L3(0x2a2f36), wall: L3(0x5d5d5c), wallRM: [0.7, 0.05], tilt: 0, occ: 0 });
      const A = [-L / 2, -L / 2 + 19, -W / 2 + 2, W / 2 - 1];
      const B = [-L / 2 + 16, L / 2 - 15, -W / 2, W / 2];
      const C = [L / 2 - 18, L / 2, -W / 2 + 1, W / 2 - 3];
      add(m, prism(fr.rect(...A), y0, base + 0.6 * H));
      add(m, prism(fr.rect(...B), y0, roof - 9));
      add(m, prism(fr.rect(...C), y0, base + 0.79 * H));
      const crown = [B[0] + 4, B[1] - 6, -W / 2 + 3, W / 2 - 4];
      add(stone, prism(fr.rect(...crown), roof - 10, roof));
      // taç: dikey köşe ışıkları + üst kenar altın çerçeve
      for (const [cx, cz] of fr.rect(crown[0] - 0.3, crown[1] + 0.3, crown[2] - 0.3, crown[3] + 0.3)) add(torunCrownGlow, boxAlong([cx - 0.25, cz], [cx + 0.25, cz], 0.5, roof - 10, roof + 0.3));
      { const rr = fr.rect(crown[0], crown[1], crown[2], crown[3]).map(([x, z]) => [x, roof + 0.02, z]); for (let i = 0; i < 4; i++) add(torunCrownGlow, strip3(rr[i], rr[(i + 1) % 4], 0.5, 0.4)); }
      // dikey koyu kanat (cephedeki derin çizgi)
      const [fx, fz] = fr((B[0] + B[1]) / 2, W / 2 + 0.6);
      const [gx, gz] = fr((B[0] + B[1]) / 2, W / 2 - 0.2);
      add(darkSteel, boxAlong([fx, fz], [gx, gz], 1.3, base + 0.18 * H, base + 0.93 * H));
      // kırmızı T logosu ve TORUN CENTER yazısı
      const tTex = signTexture('T', { color: '#ff2a1c', size: 0.95, w: 256, h: 256 });
      for (const sgn of [-1, 1]) {
        const [cx, cz] = fr((crown[0] + crown[1]) / 2, sgn > 0 ? crown[3] : crown[2]);
        const nx = -Math.sin(fr.angle) * sgn, nz = Math.cos(fr.angle) * sgn;
        root.add(new THREE.Mesh(wallPlane(cx, cz, nx, nz, roof - 5, 9, 9, 0.3), signMat(tTex, 5.5, 0.08)));
        const [ax, az] = fr((A[0] + A[1]) / 2, sgn > 0 ? A[3] : A[2]);
        root.add(new THREE.Mesh(wallPlane(ax, az, nx, nz, base + 0.6 * H - 2.2, 17, 2.4, 0.3),
          signMat(signTexture('TORUN CENTER', { color: '#ffffff', size: 0.6, letter: 0.08 }), 3.2, 0.15)));
      }
      aviation(rectCorners(fr, crown, roof), 0.31);
    }
    // Torun konut kuleleri — gri taş kaplı balkon şeritli dilim + cam bloklar (altın LED kat çizgileri)
    function torunRes(fr, L, W, base, H, seed, flip) {
      const y0 = base - 3, roof = base + H, f = flip ? -1 : 1;
      const stoneM = facade({
        name: 'torun-stone', baseY: base, seed, floorH: 3.6, colW: 3.2, win: [0.04, 0.96, 0.62, 0.9],
        glass: L3(0x4f5a66), glassRM: [0.06, 0.85], wall: L3(0x6e6c69), wallRM: [0.75, 0.02], tilt: 0.02,
        occ: 0.2, darkFrac: 0.1, zone: 0, trans: 0.9, litI: [0.9, 1.9], litA: [1, 0.68, 0.38], litB: [1, 0.84, 0.6],
      });
      const glassM = facade({
        name: 'torun-resglass', baseY: base, seed: seed + 2, floorH: 3.6, colW: 1.5, win: [0.06, 1, 0.26, 1],
        glass: L3(0x5e7392), glassRM: [0.04, 0.92], wall: L3(0x161c25), wallRM: [0.35, 0.6], tilt: 0.06,
        ledEvery: 3, ledColor: [3.4, 2.1, 0.9], occ: 0.18, darkFrac: 0.12, trans: 0.65, litI: [0.9, 1.9], litA: [1, 0.7, 0.42], litB: [1, 0.88, 0.66],
      }, 0.14);
      const R = (u0, u1, v0, v1) => (f > 0 ? [u0, u1, v0, v1] : [-u1, -u0, v0, v1]);
      const S = R(-L / 2, -L / 2 + 0.45 * L, -W / 2, W / 2 - 0.3 * W);
      const G1 = R(-L / 2 + 0.38 * L, L / 2, -W / 2 + 2, W / 2);
      const G2 = R(-L / 2 + 2, -L / 2 + 0.42 * L, W / 2 - 0.34 * W, W / 2);
      add(stoneM, prism(fr.rect(...S), y0, roof));
      add(glassM, prism(fr.rect(...G1), y0, roof - 7));
      add(glassM, prism(fr.rect(...G2), y0, base + 0.68 * H));
      // taş dilimin balkon yarıkları: her katta ince koyu kanat (yakın planda gölge ritmi)
      for (let y = base + 10; y < roof - 2; y += 3.6) {
        const v = S[2];
        add(darkSteel, prism(fr.rect(S[0] + 1.2, S[1] - 1.2, v - 0.6, v + 0.2), y - 0.12, y + 0.12, { top: true, bottom: true }));
      }
      add(darkSteel, prism(fr.rect(S[0] + 3, S[1] - 3, S[2] + 3, S[3] - 3), roof, roof + 2.5));
      // taç: altın LED çerçeve
      const cr = fr.rect(S[0], S[1], S[2], S[3]).map(([x, z]) => [x, roof + 0.02, z]);
      for (let i = 0; i < 4; i++) add(torunGold, strip3(cr[i], cr[(i + 1) % 4], 0.45, 0.4));
      aviation(rectCorners(fr, S, roof + 2.5, 3), 0.77 + seed * 0.01);
    }
    const torunGold = glow(0xffb85a, 4, 0.12, 0x6a5a40);
    const tRes = fps['way/728793798'];
    let resAngle = 0;
    if (tRes) {
      const b = obb(tRes.footprint), fr = frame(b.cx, b.cz, b.angle);
      resAngle = b.angle;
      torunRes(fr, b.L, b.W, tRes.baseY, 160, 51, false);
    }
    // Eksik üçüncü Torun kulesi (OSM'de yok) — ScraperBase "South Tower" konumundan (East'e göre kaydırma
    // düzeltilerek) ≈ (550, 192); 160 m / 43 kat [SB]; iz 34×26 m TAHMİN.
    const third = byKey('torun_center')?.footprints?.find((f) => f.role === 'tower_estimate' || f.osmId === 'estimate/torun_south');
    {
      const cx = third ? obb(third.footprint).cx : 550, cz = third ? obb(third.footprint).cz : 192;
      const fr = frame(cx, cz, resAngle);
      const base = Math.min(...fr.rect(-17, 17, -13, 13).map(([x, z]) => heightAt(x, z)));
      torunRes(fr, 34, 26, base, 160, 57, true);
    }

    // ── Torun arsası: D100'e bakan AVM/podyum + çatısında bahçe-meydan (podyum ve peyzaj TAHMİN) ──
    const avoid = [];
    for (const id of ['way/728793801', 'way/728793798']) if (fps[id]) avoid.push(obb(fps[id].footprint));
    avoid.push({ cx: third ? obb(third.footprint).cx : 550, cz: third ? obb(third.footprint).cz : 192, angle: resAngle, L: 34, W: 26 });
    const nearTower = (x, z, m) => avoid.some((o) => { const c = Math.cos(o.angle), sn = Math.sin(o.angle), dx = x - o.cx, dz = z - o.cz;
      return Math.abs(dx * c + dz * sn) < o.L / 2 + m && Math.abs(-dx * sn + dz * c) < o.W / 2 + m; });
    const foliage = std(0x3e5a30, 0.92, 0), bark = std(0x4b3c2f, 0.9, 0), lawn = std(0x56763c, 0.95, 0);
    const water = std(0x1d2a33, 0.03, 0.6);
    const bollard = glow(0xffd29a, 3.2, 0.06, 0x555048);
    function garden(poly, yTop, seedStr, density = 0.5, kind = 'roof') {
      const r = ctx.rng('landmarks/garden-' + seedStr);
      const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
      for (let x = Math.min(...xs) + 7; x < Math.max(...xs) - 5; x += 13) {
        for (let z = Math.min(...zs) + 7; z < Math.max(...zs) - 5; z += 13) {
          const jx = x + (r() - 0.5) * 4, jz = z + (r() - 0.5) * 4;
          if (!pointIn(poly, jx, jz) || nearTower(jx, jz, 5)) continue;
          const y = typeof yTop === 'function' ? yTop(jx, jz) : yTop;
          const q = r();
          if (q < density) {
            const w = 5 + r() * 9, d = 4 + r() * 6, fg = frame(jx, jz, resAngle + (r() < 0.3 ? Math.PI / 4 : 0));
            const lp = r() < 0.35 ? arcPts(jx, jz, Math.min(w, d) / 1.6, 0, Math.PI * 2, 14).slice(0, 14) : fg.rect(-w / 2, w / 2, -d / 2, d / 2);
            add(lawn, prism(lp, y - 0.2, y + (kind === 'roof' ? 0.55 : 0.12)));
            if (kind === 'roof') add(concrete, prism(lp.map(([px, pz]) => [jx + (px - jx) * 1.06, jz + (pz - jz) * 1.06]), y - 0.2, y + 0.45));
            const nT = 1 + Math.floor(r() * 2.5);
            for (let i = 0; i < nT; i++) {
              const [tr, cw] = treeGeos(jx + (r() - 0.5) * w * 0.6, y + 0.5, jz + (r() - 0.5) * d * 0.6, 5 + r() * 4, 1.8 + r() * 1.4, 'round', r() * 6);
              add(bark, tr); add(foliage, cw);
            }
          } else if (q < density + 0.18) {
            add(darkSteel, boxAlong([jx - 0.08, jz], [jx + 0.08, jz], 0.16, y, y + 4.2));
            add(bollard, boxAlong([jx - 0.3, jz], [jx + 0.3, jz], 0.6, y + 4.1, y + 4.4));
          }
        }
      }
    }
    const site = [[468, 16], [636, 12], [640, 128], [620, 184], [566, 210], [506, 210], [490, 94], [464, 92]];
    const pTop = maxGround(site) + 9;
    const podM = facade({ name: 'torun-podium', baseY: minGround(site), seed: 45, floorH: 4.6, colW: 3.0, win: [0.04, 1, 0.12, 0.96],
      glass: L3(0x56677a), glassRM: [0.05, 0.9], wall: L3(0x1e2329), wallRM: [0.4, 0.5], tilt: 0.03, roof: L3(0x8c857a),
      lobbyH: 30, lobbyC: [2.0, 1.45, 0.85], occ: 0.0, darkFrac: 0 });
    add(podM, prism(site, (x, z) => heightAt(x, z) - 3, pTop));
    garden(site, pTop, 'torun', 0.42, 'roof');
    // kuleler arası uzun yansıtma havuzu + çatı yürüyüş aksı
    add(concrete, prism(frame(552, 72, resAngle).rect(-42, 42, -5.5, 5.5), pTop - 0.2, pTop + 0.5));
    add(water, prism(frame(552, 72, resAngle).rect(-41, 41, -4.5, 4.5), pTop - 0.2, pTop + 0.42));
    // D100 cephesi: TORUN CENTER tabelası + üst kenarda sıcak LED medya bandı
    {
      const a = site[0], b2 = site[1], mx = (a[0] + b2[0]) / 2, mz = (a[1] + b2[1]) / 2;
      const dx = b2[0] - a[0], dz = b2[1] - a[1], len = Math.hypot(dx, dz);
      let nx = dz / len, nz = -dx / len; if (nz > 0) { nx = -nx; nz = -nz; }
      root.add(new THREE.Mesh(wallPlane(mx, mz, nx, nz, pTop - 3.2, 34, 4.4, 0.35),
        signMat(signTexture('TORUN CENTER', { color: '#ffffff', size: 0.62, letter: 0.12 }), 4.5, 0.08)));
      const tTex = signTexture('T', { color: '#ff2a1c', size: 0.95, w: 256, h: 256 });
      root.add(new THREE.Mesh(wallPlane(mx - dx / len * 22, mz - dz / len * 22, nx, nz, pTop - 3.2, 4.6, 4.6, 0.35), signMat(tTex, 5, 0.08)));
      add(torunGold, strip3([a[0] + nx * 0.3, pTop - 0.6, a[1] + nz * 0.3], [b2[0] + nx * 0.3, pTop - 0.6, b2[1] + nz * 0.3], 0.5, 0.35));
      add(torunGold, strip3([a[0] + nx * 0.3, pTop - 9.3 + (maxGround(site) - heightAt(mx, mz)), a[1] + nz * 0.3], [b2[0] + nx * 0.3, pTop - 9.3 + (maxGround(site) - heightAt(mx, mz)), b2[1] + nz * 0.3], 0.4, 0.3));
    }
    // Quasar — Fairmont (w799, heliport): koyu mavi cam, beyaz kat çizgileri, kırmızı dikey LED, gökbahçe boşluğu
    const qF = fps['way/728793799'];
    if (qF) {
      const b = obb(qF.footprint), fr = frame(b.cx, b.cz, b.angle), L = b.L, W = b.W;
      const base = qF.baseY, y0 = base - 3, H = 156, roof = base + H;
      const m = facade({
        name: 'quasar-fairmont', baseY: base, seed: 61, floorH: 3.9, colW: 1.6, win: [0.05, 1, 0.1, 1],
        glass: L3(0x5873a0), glassRM: [0.04, 0.92], wall: L3(0xaeb6bd), wallRM: [0.4, 0.3], tilt: 0.06,
        occ: 0.3, darkFrac: 0.12, zone: 0, trans: 0.65, litI: [0.9, 1.9], litA: [1, 0.74, 0.46], litB: [1, 0.88, 0.7],
      });
      const main = [-L / 2, L / 2 - 0.36 * L, -W / 2 + 0.12 * W, W / 2 - 0.08 * W];
      const sec = [L / 2 - 0.42 * L, L / 2, -W / 2, W / 2 - 0.3 * W];
      const gap0 = base + 0.56 * H, gap1 = gap0 + 7.8;
      add(m, prism(fr.rect(...main), y0, gap0));
      add(m, prism(fr.rect(main[0] + 6, main[0] + 14, main[2] + 3, main[3] - 3), gap0, gap1));  // gökbahçe çekirdeği
      add(m, prism(fr.rect(...main), gap1, roof));
      add(m, prism(fr.rect(...sec), y0, base + 0.64 * H));
      add(glow(0xff6a2a, 2.2, 0.2, 0x3a2418), prism(fr.rect(main[0] + 0.5, main[1] - 0.5, main[2] + 0.5, main[3] - 0.5), gap0 - 0.05, gap0 + 0.2));
      // kırmızı dikey LED şeritler
      const red = glow(0xff1a12, 4.5, 0.1, 0x200404);
      for (const [u, y1, y2] of [[main[0] + 0.62 * (main[1] - main[0]), base + 0.68 * H, roof - 8], [main[0] + 0.62 * (main[1] - main[0]), base + 0.22 * H, base + 0.48 * H]]) {
        const p = fr(u, main[2] - 0.35), q = fr(u + 0.6, main[2] - 0.35);
        add(red, boxAlong(p, q, 0.5, y1, y2));
      }
      // heliport
      add(darkSteel, prism(fr.rect(main[0] + 4, main[1] - 4, main[2] + 3, main[3] - 3), roof, roof + 1.2));
      aviation(rectCorners(fr, main, roof + 1.2, 2), 0.53);
    }
    // Quasar Residences (w800) — açık ızgara, iki gökbahçe boşluğu
    const qR = fps['way/728793800'];
    if (qR) {
      const b = obb(qR.footprint), fr = frame(b.cx, b.cz, b.angle), L = b.L, W = b.W;
      const base = qR.baseY, y0 = base - 3, H = 156, roof = base + H;
      const m = facade({
        name: 'quasar-res', baseY: base, seed: 71, floorH: 3.7, colW: 1.7, win: [0.16, 1, 0.24, 1],
        glass: L3(0x7790ab), glassRM: [0.04, 0.9], wall: L3(0xc9ced2), wallRM: [0.45, 0.1], tilt: 0.05,
        occ: 0.2, darkFrac: 0.1, trans: 0.8, litI: [0.9, 1.9], litA: [1, 0.72, 0.45], litB: [1, 0.9, 0.72],
      });
      const r = [-L / 2 + 2, L / 2 - 2, -W / 2 + 0.25 * W, W / 2 - 0.2 * W];
      const g1 = base + 0.36 * H, g2 = base + 0.7 * H, gh = 7.4;
      add(m, prism(fr.rect(...r), y0, g1));
      add(m, prism(fr.rect(r[0] + 0.3 * (r[1] - r[0]), r[0] + 0.55 * (r[1] - r[0]), r[2] + 2, r[3] - 2), g1, g2 + gh));
      add(m, prism(fr.rect(...r), g1 + gh, g2));
      add(m, prism(fr.rect(...r), g2 + gh, roof));
      const warm = glow(0xffa055, 1.8, 0.25, 0x30261e);
      for (const g of [g1, g2]) add(warm, prism(fr.rect(r[0] + 0.5, r[1] - 0.5, r[2] + 0.5, r[3] - 0.5), g - 0.05, g + 0.2));
      // alçak ofis/podyum kanadı (U izinin kolları)
      add(m, prism(fr.rect(-L / 2, L / 2, W / 2 - 0.2 * W, W / 2), y0, base + 24));
      add(darkSteel, prism(fr.rect(r[0] + 4, r[1] - 4, r[2] + 2, r[3] - 2), roof, roof + 3));
      aviation(rectCorners(fr, r, roof, 1), 0.11);
    }
    // alçak bloklar: likör fabrikası (Mallet-Stevens, 1930'lar — beyaz) ve 40 m bloklar
    const fab = fps['way/728793802'];
    if (fab) {
      const m = facade({ name: 'factory', baseY: fab.baseY, seed: 81, floorH: 5, colW: 3.2, win: [0.25, 0.75, 0.3, 0.85],
        glass: L3(0x26313a), glassRM: [0.12, 0.7], wall: L3(0xe8e4da), wallRM: [0.8, 0], tilt: 0, occ: 0.68, darkFrac: 0, zone: 4,
        lobbyH: 5, lobbyC: [1.5, 1.15, 0.75], litA: [1, 0.85, 0.6], litB: [1, 0.9, 0.7] });
      add(m, prism(cleanPoly(fab.footprint), fab.baseY - 2, fab.baseY + 7.5));
    }
    const lowM = facade({ name: 'torun-low', baseY: -12, seed: 85, floorH: 4, colW: 1.6, win: [0.08, 1, 0.3, 1],
      glass: L3(0x5a6b80), glassRM: [0.05, 0.9], wall: L3(0x3a3f45), wallRM: [0.4, 0.4], tilt: 0.04,
      zone: 4, occ: 0.38, darkFrac: 0.3, mode: 1, full: 0.25, sparse: 0.3, trans: 0.75, litI: [1.1, 1.8], litA: [0.86, 0.93, 1.0], litB: [1, 0.95, 0.85] });
    for (const id of ['way/728793803', 'way/728793805']) {
      const f = fps[id];
      if (f) add(lowM, prism(cleanPoly(f.footprint), f.baseY - 2, f.baseY + (f.height || 40)));
    }
    // ── Quasar: fabrikanın önünde Büyükdere'ye uzanan kent parkı (Emre Arolat "nefes alanı") + kulelerin altında podyum (TAHMİN) ──
    {
      for (const id of ['way/728793799', 'way/728793800']) if (fps[id]) avoid.push(obb(fps[id].footprint));
      const park = [[652, 16], [784, 12], [784, 78], [652, 80]];
      const gy = (x, z) => heightAt(x, z) + 0.15;
      add(paving, prism(park, (x, z) => heightAt(x, z) - 1, gy));
      garden(park, gy, 'quasar-park', 0.62, 'park');
      const qpod = [[640, 127], [787, 123], [784, 181], [643, 179]];
      const qTop = maxGround(qpod) + 7;
      const qm = facade({ name: 'quasar-podium', baseY: minGround(qpod), seed: 65, floorH: 4.4, colW: 2.6, win: [0.05, 1, 0.14, 0.96],
        glass: L3(0x5d6d80), glassRM: [0.05, 0.9], wall: L3(0x2a2f36), wallRM: [0.4, 0.4], tilt: 0.03, roof: L3(0x85807a),
        lobbyH: 30, lobbyC: [1.9, 1.35, 0.8], occ: 0, darkFrac: 0 });
      add(qm, prism(qpod, (x, z) => heightAt(x, z) - 3, qTop));
      garden(qpod, qTop, 'quasar-roof', 0.35, 'roof');
    }
  }

  // ───────── Şişli Plaza (kule konumu tahmin; bkz. notlar) ─────────
  const sp = byKey('sisli_plaza');
  if (sp) {
    const outline = sp.footprints?.[0];
    const fr = frame(-42, 669, Math.PI / 2);   // u → güney (+z), v → batı (−x)
    const base = Math.min(heightAt(-42, 669), outline?.baseY ?? 0) - 0.5;
    const H = 170.1, roof = base + H;
    const cream = facade({ name: 'sisli-cream', baseY: base, seed: 91, floorH: 3.25, colW: 3.1, win: [0.22, 0.78, 0.3, 0.86],
      glass: L3(0x2a3642), glassRM: [0.1, 0.8], wall: L3(0xe6dcc6), wallRM: [0.72, 0], tilt: 0.02,
      occ: 0.22, darkFrac: 0.08, litI: [0.9, 1.9], litA: [1, 0.7, 0.42], litB: [1, 0.86, 0.62] });
    const mauve = facade({ name: 'sisli-mauve', baseY: base, seed: 93, floorH: 3.25, colW: 3.1, win: [0.25, 0.75, 0.3, 0.86],
      glass: L3(0x2a3642), glassRM: [0.1, 0.8], wall: L3(0x8d6f7d), wallRM: [0.7, 0], tilt: 0.02, occ: 0.2, litI: [0.9, 1.9], litA: [1, 0.7, 0.42], litB: [1, 0.86, 0.62] });
    const pink = facade({ name: 'sisli-pink', baseY: base, seed: 95, floorH: 3.25, colW: 3.1, win: [0.25, 0.75, 0.3, 0.86],
      glass: L3(0x2a3642), glassRM: [0.1, 0.8], wall: L3(0xc58b7c), wallRM: [0.7, 0], tilt: 0.02, occ: 0.2, litI: [0.9, 1.9], litA: [1, 0.7, 0.42], litB: [1, 0.86, 0.62] });
    // ana gövde: dikdörtgen + kuzey ucunda yarım silindir (fotoğraftaki kavisli yan)
    const mainPts = [[16, -11], [16, 11], ...arcPts(-8, 0, 11, Math.PI / 2, Math.PI * 1.5, 12)];
    add(cream, sectionLoft(fr, [{ y: base - 3, pts: mainPts }, { y: roof - 6, pts: mainPts }]));
    const topPts = [[13, -9.5], [13, 9.5], ...arcPts(-8, 0, 9.5, Math.PI / 2, Math.PI * 1.5, 12)];
    add(cream, sectionLoft(fr, [{ y: roof - 6, pts: topPts }, { y: roof, pts: topPts }]));
    // doğuya (Büyükdere / Cevahir tarafı) bakan basamaklı renkli bloklar
    add(mauve, prism(fr.rect(-4, 18, -14, -3), base - 3, base + 0.42 * H));
    add(pink, prism(fr.rect(2, 15, -13, -5), base + 0.42 * H, base + 0.66 * H));
    add(cream, prism(fr.rect(-14, 2, 9, 13.5), base - 3, base + 0.78 * H));
    // taç: radyo istasyonu halkası (direkler + kafa) ve orta direk
    const ringC = fr(1, 0), ringR = 10.5;
    const crownGlow = glow(0xffe7c0, 3.0, 0.3, 0x777064);
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * 0.15 + (i / 13) * Math.PI * 1.3 + fr.angle;
      const x = ringC[0] + Math.cos(a) * ringR, z = ringC[1] + Math.sin(a) * ringR;
      const p = [x, z], q = [x + Math.cos(a) * 0.4, z + Math.sin(a) * 0.4];
      add(steel, boxAlong(p, q, 0.5, roof, roof + 7));
      add(crownGlow, boxAlong([x - Math.sin(a) * 0.9, z + Math.cos(a) * 0.9], [x + Math.sin(a) * 0.9, z - Math.cos(a) * 0.9], 1.0, roof + 6.4, roof + 8.4));
    }
    add(steel, boxAlong(fr(-3, 0), fr(-2.2, 0), 0.8, roof, roof + 16));
    { const [ax, az] = fr(-2.6, 0); aviation([[ax, roof + 16, az]], 0.66); }
    // podyum + A/C blokları (9 kat) — OSM'deki kompleks dış hattı
    if (outline) {
      const poly = cleanPoly(outline.footprint);
      const podM = facade({ name: 'sisli-podium', baseY: outline.baseY, seed: 97, floorH: 4.2, colW: 2.6, win: [0.08, 0.92, 0.25, 0.9],
        glass: L3(0x26313a), glassRM: [0.08, 0.85], wall: L3(0xd8cfbf), wallRM: [0.7, 0], tilt: 0.02,
        lobbyH: 8.5, lobbyC: [1.6, 1.15, 0.7], occ: 0.60, zone: 3, litA: [1, 0.85, 0.6], litB: [1, 0.92, 0.75] });
      add(podM, prism(poly, (x, z) => heightAt(x, z) - 3, (x, z) => Math.max(heightAt(x, z) + 6, outline.baseY + 17)));
      const north = poly.filter(([, z]) => z < 625), south = poly.filter(([, z]) => z > 688);
      for (const part of [north, south]) {
        if (part.length < 3) continue;
        const ob = obb(part), f2 = frame(ob.cx, ob.cz, ob.angle);
        const r = [-ob.L / 2 + 2, ob.L / 2 - 2, -Math.min(ob.W, 18) / 2 + 1, Math.min(ob.W, 18) / 2 - 1];
        const g = minGround(f2.rect(...r));
        add(cream, prism(f2.rect(...r), g - 3, outline.baseY + 31));
      }
    }
  }

  // ───────── Cevahir AVM ─────────
  const cv = byKey('cevahir');
  const cvFp = cv?.footprints?.[0];
  if (cvFp) {
    const poly = cleanPoly(cvFp.footprint);
    const top = Math.max(cvFp.baseY + 34, maxGround(poly) + 22);
    const m = facade({ name: 'cevahir', baseY: cvFp.baseY, seed: 101, floorH: 5.6, colW: 3.0, win: [0.05, 1, 0.1, 1],
      glass: L3(0x6fa89a), glassRM: [0.08, 0.75], wall: L3(0x2b4a45), wallRM: [0.4, 0.4], tilt: 0.04, tint: 0.6,
      lobbyH: 7, lobbyC: [1.5, 1.1, 0.7], occ: 0.26, darkFrac: 0.4, zone: 4, litA: [1, 0.85, 0.65], litB: [1, 0.95, 0.85] });
    add(m, prism(poly, (x, z) => heightAt(x, z) - 3, top));
    // cam çatı (~2500 m²): kütlenin ortasında kırma çatı + gece içeriden sıcak parıltı
    const ob = obb(poly), fr = frame(ob.cx, ob.cz, ob.angle);
    const roofGlass = std(0xa7babd, 0.1, 0.75, { emissive: 0xffc890, emissiveIntensity: 0 });
    glows.push({ m: roofGlass, k: 0.15, I: 0.3 });
    add(roofGlass, sectionLoft(fr, [
      { y: top - 0.2, rect: [-34, 34, -18, 18] },
      { y: top + 3.5, rect: [-30, 30, -14, 14] },
      { y: top + 9, rect: [-22, 22, -3, 3] },
    ]));
    add(steel, sectionLoft(fr, [{ y: top - 0.5, rect: [-35, 35, -19, 19] }, { y: top + 0.3, rect: [-35, 35, -19, 19] }]));
    // çatı kirişleri (kırma çatı boyunca)
    for (let u = -30; u <= 30; u += 4) {
      const k = Math.abs(u) <= 22 ? 1 : 0;
      for (const sg of [-1, 1]) {
        const v0 = sg * 18.2, v1 = sg * (k ? 3.2 : 14 - (Math.abs(u) - 22) * 0);
        const yA = top + 0.1, yB = k ? top + 9.15 : top + 3.6;
        const pA = fr(u, v0), pB = fr(u, v1);
        add(darkSteel, loft([[[pA[0] - 0.15, yA, pA[1]], [pA[0] + 0.15, yA, pA[1]], [pB[0] + 0.15, yB, pB[1]], [pB[0] - 0.15, yB, pB[1]]],
          [[pA[0] - 0.15, yA + 0.35, pA[1]], [pA[0] + 0.15, yA + 0.35, pA[1]], [pB[0] + 0.15, yB + 0.35, pB[1]], [pB[0] - 0.15, yB + 0.35, pB[1]]]], { top: true }));
      }
    }
    // çatı tesisat kutuları (seed'li)
    const r2 = ctx.rng('landmarks/cevahir-roof');
    for (let i = 0; i < 26; i++) {
      const u = (r2() - 0.5) * ob.L * 0.8, v = (r2() - 0.5) * ob.W * 0.8;
      if (Math.abs(u) < 38 && Math.abs(v) < 22) continue;
      const [x, z] = fr(u, v);
      if (!pointIn(poly, x, z)) continue;
      const w = 3 + r2() * 7, d = 2 + r2() * 5, hh = 1.5 + r2() * 2.5;
      const f2 = frame(x, z, fr.angle);
      add(i % 3 ? concrete : steel, prism(f2.rect(-w / 2, w / 2, -d / 2, d / 2), top - 0.2, top + hh));
    }
    // kuzey (metrobüs/D100 tarafı) beyaz giriş kulesi + İSTANBUL CEVAHİR tabelası
    let best = null;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      const A = signedArea(poly);
      const nx = (A > 0 ? dz : -dz) / len, nz = (A > 0 ? -dx : dx) / len;
      const score = len * Math.max(0, -nz) * (1 + Math.max(0, -nx));
      if (len > 12 && (!best || score > best.score)) best = { p, q, nx, nz, len, score };
    }
    if (best) {
      const mx = (best.p[0] + best.q[0]) / 2, mz = (best.p[1] + best.q[1]) / 2;
      const ent = facade({ name: 'cevahir-ent', baseY: cvFp.baseY, seed: 103, floorH: 5.6, colW: 2.0, win: [0.1, 0.9, 0.1, 0.95],
        glass: L3(0x93b0ba), glassRM: [0.05, 0.9], wall: L3(0xe6e8e8), wallRM: [0.5, 0.05], tilt: 0.03, lobbyH: 14, lobbyC: [2.0, 1.5, 1.0], occ: 0.68, zone: 2 });
      const tx = -best.nz, tz = best.nx;
      const c0 = [mx + best.nx * 2 - tx * 9, mz + best.nz * 2 - tz * 9], c1 = [mx + best.nx * 2 + tx * 9, mz + best.nz * 2 + tz * 9];
      const g = heightAt(mx, mz);
      add(ent, boxAlong(c0, c1, 8, g - 3, top + 6));
      const st = signTexture('İSTANBUL CEVAHİR', { color: '#ffffff', size: 0.5, letter: 0.06 });
      root.add(new THREE.Mesh(wallPlane(mx + best.nx * 6.1, mz + best.nz * 6.1, best.nx, best.nz, top + 1.5, 16, 3.2, 0.2), signMat(st, 4, 0.12)));
      const st2 = signTexture('CEVAHİR', { color: '#ffd38a', size: 0.7, letter: 0.1 });
      const p3 = [best.p[0] + (best.q[0] - best.p[0]) * 0.18, best.p[1] + (best.q[1] - best.p[1]) * 0.18];
      root.add(new THREE.Mesh(wallPlane(p3[0], p3[1], best.nx, best.nz, top - 5, 20, 4.4, 0.35), signMat(st2, 4.5, 0.2)));
    }
  }

  // ───────── Metrobüs durağı + üst geçit + İETT peronları (landmarks/station.js) ─────────
  const peopleGeos = [];
  buildStation({ THREE, ctx, heightAt, add, std, glow, signMat, root, byKey, steel, darkSteel, concrete, railGlass, people: peopleGeos });

  // ───────── Metro girişleri — cam köşk + kırmızı M ─────────
  {
    const ms = byKey('metro_station');
    const ents = (ms?.entrances || []).filter(([x, z]) => Math.abs(x) < 700 && z > -640 && z < 760);
    const stations = (ms?.stations || []).filter((s) => Math.abs(s.x) < 700 && Math.abs(s.z) < 700);
    const mTex = signTexture('M', { color: '#ffffff', bg: '#d0101b', size: 0.8, w: 256, h: 256 });
    const mMat = signMat(mTex, 4, 0.06, { transparent: false, alphaTest: 0 });
    const kioskGlass = std(0x7d969f, 0.05, 0.85, { emissive: 0xfff0d8, emissiveIntensity: 0 });
    glows.push({ m: kioskGlass, k: 0.12, I: 1.6 });
    for (const [x, z] of ents) {
      let st = stations[0] || { x: 64, z: 84 }, bd = Infinity;
      for (const s of stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; st = s; } }
      const ang = Math.atan2(st.z - z, st.x - x) + (rng() - 0.5) * 0.3;
      const fr = frame(x, z, ang);
      const g = heightAt(x, z);
      add(kioskGlass, prism(fr.rect(-2.6, 2.6, -1.6, 1.6), g - 0.5, g + 2.7));
      add(darkSteel, prism(fr.rect(-3.0, 3.0, -2.0, 2.0), g + 2.7, g + 3.05));
      const [px, pz] = fr(-3.4, 1.8);
      add(darkSteel, boxAlong([px - 0.08, pz], [px + 0.08, pz], 0.16, g, g + 3.8));
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.15), mMat);
      s.position.set(px, g + 4.3, pz); s.rotation.y = -ang + Math.PI / 2;
      root.add(s);
    }
  }

  // ───────── Mecidiyeköy Meydanı — taş döşeme, aydınlatma noktaları ─────────
  {
    const sq = byKey('square')?.footprints?.[0];
    if (sq) {
      const poly = cleanPoly(sq.footprint);
      add(paving, prism(poly, (x, z) => heightAt(x, z) - 1.5, (x, z) => heightAt(x, z) + 0.3));
      const c = centroid(poly);
      // ortada daire biçimli koyu taş + yer ışıkları halkası
      const ring = arcPts(c[0], c[1], 13, 0, Math.PI * 2, 32).slice(0, 32);
      add(pavingDark, prism(ring, (x, z) => heightAt(x, z) - 1, (x, z) => heightAt(x, z) + 0.36));
      const up = glow(0xffd9a0, 5, 0.1, 0x333333);
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2, x = c[0] + Math.cos(a) * 14, z = c[1] + Math.sin(a) * 14;
        add(up, boxAlong([x - 0.3, z], [x + 0.3, z], 0.6, heightAt(x, z) + 0.3, heightAt(x, z) + 0.42));
      }
      // kenar bankları + aydınlatma direkleri (kenar boyunca)
      const lampHead = glow(0xffe0b0, 7, 0.05, 0x444444);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
        if (L < 15) continue;
        for (let s = 6; s < L - 4; s += 18) {
          const x = p[0] + dx * s / L - dz / L * 3, z = p[1] + dz * s / L + dx / L * 3;
          const A = signedArea(poly) > 0 ? 1 : -1;
          const xi = p[0] + dx * s / L + (A > 0 ? -dz : dz) / L * -3, zi = p[1] + dz * s / L + (A > 0 ? dx : -dx) / L * -3;
          const gx = heightAt(xi, zi);
          add(darkSteel, boxAlong([xi - 0.1, zi], [xi + 0.1, zi], 0.2, gx, gx + 6));
          add(lampHead, boxAlong([xi - 0.35, zi], [xi + 0.35, zi], 0.7, gx + 5.8, gx + 6.1));
          void x; void z;
        }
      }
    }
  }

  // ───────── birleştir ─────────
  for (const [mat, geos] of parts) {
    const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!g) { console.warn('[landmarks] birleştirme başarısız', mat.name); continue; }
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'lm:' + (mat.name || 'part');
    const transparent = mat.transparent;
    mesh.castShadow = !transparent;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  if (peopleGeos.length) {
    const g = mergeGeometries(peopleGeos, false);
    if (g) {
      const crowd = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }));
      crowd.name = 'lm:crowd'; crowd.castShadow = true; crowd.receiveShadow = true;
      root.add(crowd);
    }
  }
  ctx.scene.add(root);

  return {
    object3D: root,
    update(state) {
      const L = state.lightsOn;
      for (const { m, ledK } of facades) {
        m.userData.u.uLightsOn.value = L;
        m.userData.u.uT.value = state.t;
        m.userData.u.uLed.value = L > ledK ? 1 : 0;
      }
      for (const g of glows) g.m.emissiveIntensity = L > g.k ? g.I : 0;
      for (const b of blinkers) {
        const ph = (((state.t / b.period) + b.phase) % 1 + 1) % 1;
        const on = ph < b.duty ? 1 : 0.04;
        b.m.emissiveIntensity = b.I * on * (0.12 + 0.88 * L);
      }
    },
    dispose() {
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      for (const m of new Set([...parts.keys(), ...glows.map((g) => g.m), ...blinkers.map((b) => b.m)])) { m.map?.dispose(); m.dispose(); }
    },
  };
}
