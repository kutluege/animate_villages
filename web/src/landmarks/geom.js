// Geometri yardımcıları: poligon, OBB çerçevesi, loft (halkalar arası yan yüzler + kapaklar), tabela dokusu.
import * as THREE from 'three';

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
export function pointIn(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}
/** Kapalı halkanın son noktası ilkini tekrar ediyorsa at; çok yakın ardışık noktaları birleştir. */
export function cleanPoly(poly, eps = 0.05) {
  const out = [];
  for (const p of poly) { const l = out[out.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > eps) out.push([p[0], p[1]]); }
  if (out.length > 2) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps) out.pop(); }
  return out;
}

/** En küçük alanlı yönlü sınır kutusu (kenar yönleri denenir). angle: uzun eksenin x'ten (x,z) düzleminde açısı. */
export function obb(poly) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const c = Math.cos(a), s = Math.sin(a);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const r of poly) { const u = r[0] * c + r[1] * s, v = -r[0] * s + r[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area - 1e-6) best = { area, a, u0, u1, v0, v1 };
  }
  let { a, u0, u1, v0, v1 } = best;
  let L = u1 - u0, W = v1 - v0;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const c = Math.cos(a), s = Math.sin(a);
  const cx = cu * c - cv * s, cz = cu * s + cv * c;
  if (W > L) { a += Math.PI / 2; [L, W] = [W, L]; }
  return { cx, cz, angle: a, L, W };
}

/** Yerel çerçeve: (u,v) → dünya (x,z). u uzun eksen boyunca. */
export function frame(cx, cz, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const f = (u, v) => [cx + u * c - v * s, cz + u * s + v * c];
  f.cx = cx; f.cz = cz; f.angle = angle;
  f.rect = (u0, u1, v0, v1) => [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)];
  f.poly = (pts) => pts.map(([u, v]) => f(u, v));
  /** dünya → yerel */
  f.inv = (x, z) => { const dx = x - cx, dz = z - cz; return [dx * c + dz * s, -dx * s + dz * c]; };
  return f;
}

/** Yuvarlatılmış uçlu dikdörtgen / yay noktaları (yerel uv). */
export function arcPts(cu, cv, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]); }
  return out;
}

/**
 * Loft: halkalar (her biri [[x,y,z],…], aynı nokta sayısı) arasında yan yüzler + üst/alt kapak.
 * Normaller düz (non-indexed); yan yüzler poligon yönünden bağımsız olarak dışa bakar.
 */
export function loft(rings, { top = true, bottom = false } = {}) {
  const pos = [];
  const n = rings[0].length;
  const base2d = rings[0].map((p) => [p[0], p[2]]);
  const A = signedArea(base2d);
  const tri = (a, b, c, wantOut) => {
    // wantOut: [x,y,z] istenen yön
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * wantOut[0] + ny * wantOut[1] + nz * wantOut[2] < 0) pos.push(...a, ...c, ...b);
    else pos.push(...a, ...b, ...c);
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const lo = rings[r], hi = rings[r + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = lo[j][0] - lo[i][0], dz = lo[j][2] - lo[i][2];
      const out = A > 0 ? [dz, 0, -dx] : [-dz, 0, dx];
      // dejenere (sıfır uzunluklu) kenarları atla
      if (Math.hypot(dx, dz) < 1e-4 && Math.hypot(hi[j][0] - hi[i][0], hi[j][2] - hi[i][2]) < 1e-4) continue;
      tri(lo[i], lo[j], hi[j], out);
      tri(lo[i], hi[j], hi[i], out);
    }
  }
  const cap = (ring, up) => {
    const contour = ring.map((p) => new THREE.Vector2(p[0], p[2]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const t of tris) tri(ring[t[0]], ring[t[1]], ring[t[2]], [0, up ? 1 : -1, 0]);
  };
  if (top) cap(rings[rings.length - 1], true);
  if (bottom) cap(rings[0], false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Düz prizma: poligon (x,z) y0→y1. y1 fonksiyon olabilir (x,z)→y (eğik çatı). */
export function prism(poly, y0, y1, opts) {
  const f0 = typeof y0 === 'function' ? y0 : () => y0;
  const f1 = typeof y1 === 'function' ? y1 : () => y1;
  return loft([poly.map(([x, z]) => [x, f0(x, z), z]), poly.map(([x, z]) => [x, f1(x, z), z])], opts);
}

/** Yerel çerçevede kat kat değişen kesitli kütle: sections = [{y, rect:[u0,u1,v0,v1]} …] (ya da pts). */
export function sectionLoft(fr, sections, opts) {
  const rings = sections.map((s) => {
    const pts = s.pts || [[s.rect[0], s.rect[2]], [s.rect[1], s.rect[2]], [s.rect[1], s.rect[3]], [s.rect[0], s.rect[3]]];
    return pts.map(([u, v], i) => { const [x, z] = fr(u, v); const y = typeof s.y === 'function' ? s.y(u, v, i) : s.y; return [x, y, z]; });
  });
  return loft(rings, opts);
}

/** Bir çizgi boyunca kutu (uzunluk ekseni p→q). */
export function boxAlong(p, q, w, y0, y1) {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1;
  const nx = -dz / L * w / 2, nz = dx / L * w / 2;
  return prism([[p[0] + nx, p[1] + nz], [q[0] + nx, q[1] + nz], [q[0] - nx, q[1] - nz], [p[0] - nx, p[1] - nz]], y0, y1, { top: true, bottom: true });
}

/** İki 3B nokta arasında ince şerit (eğik kenarlar için). */
export function strip3(a, b, w = 0.4, h = 0.4) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2;
  const lo = [[a[0] - nx, a[1], a[2] - nz], [b[0] - nx, b[1], b[2] - nz], [b[0] + nx, b[1], b[2] + nz], [a[0] + nx, a[1], a[2] + nz]];
  return loft([lo, lo.map((p) => [p[0], p[1] + h, p[2]])], { top: true });
}

/** Sayısal y'li kesit listesinde (artan y) y yüksekliğindeki dikdörtgeni doğrusal ara değerle bul. */
export function interpRect(S, y) {
  if (y <= S[0].y) return S[0].rect.slice();
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1];
    if (y <= b.y) { const f = (y - a.y) / (b.y - a.y || 1); return a.rect.map((v, k) => v + (b.rect[k] - v) * f); }
  }
  return S[S.length - 1].rect.slice();
}

/** p→q boyunca, uçlarda farklı üst kotlu (yp, yq) eğimli plak; kalınlık t, genişlik w (uçlarda wq ayrı olabilir). */
export function slabAlong(p, q, w, yp, yq, t, wq = w) {
  const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
  const top = [[p[0] + nx * w / 2, yp, p[1] + nz * w / 2], [q[0] + nx * wq / 2, yq, q[1] + nz * wq / 2],
    [q[0] - nx * wq / 2, yq, q[1] - nz * wq / 2], [p[0] - nx * w / 2, yp, p[1] - nz * w / 2]];
  return loft([top.map((v) => [v[0], v[1] - t, v[2]]), top], { top: true, bottom: true });
}

function stripGeo(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}

/** Basit ağaç: [gövde, taç] geometrileri (yalnız position+normal; birleştirilebilir). kind 'round' | 'cypress' */
export function treeGeos(x, y, z, h, r, kind = 'round', rot = 0) {
  const trunkH = kind === 'cypress' ? h * 0.15 : h * 0.4;
  const trunk = stripGeo(new THREE.CylinderGeometry(0.12 * r, 0.18 * r, trunkH, 5));
  trunk.translate(x, y + trunkH / 2, z);
  let crown;
  if (kind === 'cypress') { crown = stripGeo(new THREE.ConeGeometry(r * 0.55, h - trunkH * 0.6, 7)); crown.translate(x, y + trunkH * 0.4 + (h - trunkH * 0.6) / 2, z); }
  else { crown = stripGeo(new THREE.IcosahedronGeometry(r, 0)); crown.scale(1, 0.85, 1); crown.rotateY(rot); crown.translate(x, y + trunkH + r * 0.7, z); }
  crown.computeVertexNormals();
  return [trunk, crown];
}

/** Düşük çokgenli insan figürü (gövde + baş), renk vertex color olarak. */
export function personGeo(x, y, z, h, rot, rgbBody, rgbLegs, rgbHead = [0.55, 0.4, 0.32]) {
  const parts = [];
  const box = (w, hh, d, cy, rgb) => {
    const g = stripGeo(new THREE.BoxGeometry(w, hh, d));
    g.translate(0, cy, 0);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) { c[i] = rgb[0]; c[i + 1] = rgb[1]; c[i + 2] = rgb[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(g);
  };
  const s = h / 1.75;
  box(0.34 * s, 0.82 * s, 0.22 * s, 0.41 * s, rgbLegs);
  box(0.46 * s, 0.62 * s, 0.26 * s, 1.13 * s, rgbBody);
  box(0.2 * s, 0.24 * s, 0.22 * s, 1.58 * s, rgbHead);
  const m = new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
  for (const g of parts) g.applyMatrix4(m);
  return parts;
}

/** Tabela dokusu (CanvasTexture). Yazı tipi: sistem sans-serif; aynı makinede kare kare aynı. */
export function signTexture(text, { w = 1024, h = 256, color = '#ffffff', bg = null, font = 'bold', size = 0.62, letter = 0.06, stroke = null, family = '"Helvetica Neue", Arial, sans-serif' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
  g.fillStyle = color;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = Math.floor(h * size);
  g.font = `${font} ${px}px ${family}`;
  if ('letterSpacing' in g) g.letterSpacing = `${Math.round(px * letter)}px`;
  while (g.measureText(text).width > w * 0.92 && px > 8) { px -= 2; g.font = `${font} ${px}px ${family}`; }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = px * 0.06; g.strokeText(text, w / 2, h / 2 + px * 0.04); }
  g.fillText(text, w / 2, h / 2 + px * 0.04);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Dünya (x,z) noktasında, normal yönü (nx,nz) dışa bakan düz dikey plan. */
export function wallPlane(cx, cz, nx, nz, y, w, h, off = 0.25) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Matrix4();
  const ang = Math.atan2(nx, nz);
  m.makeRotationY(ang);
  m.setPosition(cx + nx * off, y, cz + nz * off);
  g.applyMatrix4(m);
  return g;
}
