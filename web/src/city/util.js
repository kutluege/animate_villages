// Şehir dokusu — ortak yardımcılar (saf, deterministik).

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** Tamsayı karması → [0,1). Sıra bağımsız. */
export function h1(i, j = 0, k = 0) {
  let h = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(k | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** sRGB hex → doğrusal [r,g,b]. */
export function lin(hex) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [f((hex >> 16) & 255), f((hex >> 8) & 255), f(hex & 255)];
}

/** Yay uzunluğuyla örneklenen 3B çoklu çizgi. */
export class Path {
  constructor(pts) {
    const n = pts.length;
    this.n = n;
    this.p = new Float32Array(n * 3);
    this.cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.p[i * 3] = pts[i][0];
      this.p[i * 3 + 1] = pts[i][1];
      this.p[i * 3 + 2] = pts[i][2];
      if (i > 0) {
        const dx = pts[i][0] - pts[i - 1][0];
        const dy = pts[i][1] - pts[i - 1][1];
        const dz = pts[i][2] - pts[i - 1][2];
        this.cum[i] = this.cum[i - 1] + Math.hypot(dx, dy, dz);
      }
    }
    this.length = this.cum[n - 1];
  }

  /** out[0..2] konum, out[3..5] birim teğet. */
  at(s, out) {
    const { p, cum, n } = this;
    if (s <= 0) s = 0;
    else if (s >= this.length) s = this.length;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const f = (s - cum[lo]) / seg;
    const a = lo * 3;
    const b = hi * 3;
    const dx = p[b] - p[a];
    const dy = p[b + 1] - p[a + 1];
    const dz = p[b + 2] - p[a + 2];
    out[0] = p[a] + dx * f;
    out[1] = p[a + 1] + dy * f;
    out[2] = p[a + 2] + dz * f;
    out[3] = dx / seg;
    out[4] = dy / seg;
    out[5] = dz / seg;
    return out;
  }
}

/** Her noktada xz düzleminde sağ normal (+x doğu giderken sağ = +z güney). Gönye sınırlı. */
export function rightNormals(pts) {
  const n = pts.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0];
    let dz = b[2] - a[2];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // gönye düzeltmesi: komşu parça yönüne göre genişlik korunsun
    let m = 1;
    if (i > 0 && i < n - 1) {
      const p = pts[i];
      let ex = p[0] - a[0];
      let ez = p[2] - a[2];
      const el = Math.hypot(ex, ez) || 1;
      ex /= el;
      ez /= el;
      const c = ex * dx + ez * dz;
      m = 1 / Math.max(0.5, c);
    }
    out[i] = [-dz * m, dx * m];
  }
  return out;
}

/** Çoklu çizgiyi sağa `off` metre kaydır (negatif = sol). */
export function offsetLine(pts, off) {
  const rn = rightNormals(pts);
  return pts.map((p, i) => [p[0] + rn[i][0] * off, p[1], p[2] + rn[i][1] * off]);
}

/** ≤ step aralıkla sıklaştır (doğrusal). */
export function densify(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const k = Math.max(1, Math.ceil(d / step));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
    }
  }
  return out;
}

export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const zi = ring[i][1];
    const xj = ring[j][0];
    const zj = ring[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

export function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cz += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(a) < 1e-6) return [ring[0][0], ring[0][1]];
  return [cx / (3 * a), cz / (3 * a)];
}

/** Nokta → parça uzaklığı (xz); t parametresi de döner. */
export function segDist(px, pz, ax, az, bx, bz, out) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px;
  const qz = az + dz * t - pz;
  if (out) out.t = t;
  return Math.sqrt(qx * qx + qz * qz);
}

/** Uzamsal ızgara: kutu ekle, nokta sorgula. */
export class Grid2 {
  constructor(cell = 40) {
    this.cell = cell;
    this.map = new Map();
  }

  key(ix, iz) {
    return ix * 73856093 + iz * 19349663;
  }

  addBox(x0, z0, x1, z1, item) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++) {
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const k = this.key(ix, iz);
        let a = this.map.get(k);
        if (!a) this.map.set(k, (a = []));
        a.push(item);
      }
    }
  }

  at(x, z) {
    return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) || EMPTY;
  }
}
const EMPTY = [];

/** Birleştirilmiş geometri biriktirici: konum, normal, renk, uvw(vec4), info(vec4). */
export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.uvw = [];
    this.info = [];
    this.idx = [];
    this.count = 0;
  }

  vert(x, y, z, nx, ny, nz, c, u0 = 0, u1 = 0, u2 = 0, u3 = 0, i0 = 0, i1 = 0, i2 = 0, i3 = 0) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.col.push(c[0], c[1], c[2]);
    this.uvw.push(u0, u1, u2, u3);
    this.info.push(i0, i1, i2, i3);
    return this.count++;
  }

  tri(a, b, c) {
    this.idx.push(a, b, c);
  }

  quadIdx(a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  }

  /** Eksenlere hizalı olmayan kutu: merkez taban (cx,y0,cz), yarı boyutlar hx,hz, yükseklik h, dönüş açısı. */
  box(cx, y0, cz, hx, h, hz, ang, c, info = [0, 0, 0, 0], top = true, bottom = false) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const P = (lx, lz) => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca];
    const cs = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
    const y1 = y0 + h;
    for (let i = 0; i < 4; i++) {
      const a = cs[i];
      const b = cs[(i + 1) % 4];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1;
      const nx = dz / l;
      const nz = -dx / l;
      const v0 = this.vert(a[0], y0, a[1], nx, 0, nz, c, 0, h, l, h, ...info);
      const v1 = this.vert(b[0], y0, b[1], nx, 0, nz, c, l, h, l, h, ...info);
      const v2 = this.vert(b[0], y1, b[1], nx, 0, nz, c, l, 0, l, h, ...info);
      const v3 = this.vert(a[0], y1, a[1], nx, 0, nz, c, 0, 0, l, h, ...info);
      this.idx.push(v0, v2, v1, v0, v3, v2);
    }
    if (top) {
      const v = cs.map((p) => this.vert(p[0], y1, p[1], 0, 1, 0, c, p[0], p[1], 0, 0, ...info));
      this.idx.push(v[0], v[2], v[1], v[0], v[3], v[2]);
    }
    if (bottom) {
      const v = cs.map((p) => this.vert(p[0], y0, p[1], 0, -1, 0, c, p[0], p[1], 0, 0, ...info));
      this.idx.push(v[0], v[1], v[2], v[0], v[2], v[3]);
    }
  }

  build(THREE, { uvw = true, info = true, color = true } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (uvw) g.setAttribute('aUvw', new THREE.Float32BufferAttribute(this.uvw, 4));
    if (info) g.setAttribute('aInfo', new THREE.Float32BufferAttribute(this.info, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** GLSL: ortak karma / gürültü. */
export const GLSL_NOISE = /* glsl */ `
float cH11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float cH21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 cH23(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
float cNoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cH21(i), cH21(i + vec2(1.0, 0.0)), f.x), mix(cH21(i + vec2(0.0, 1.0)), cH21(i + vec2(1.0, 1.0)), f.x), f.y); }
float cFbm(vec2 p){ return 0.5 * cNoise(p) + 0.3 * cNoise(p * 2.13 + 7.1) + 0.2 * cNoise(p * 4.37 + 3.7); }
float cBox(vec2 f, vec2 a, vec2 b, vec2 w){ vec2 s = smoothstep(a - w, a + w, f) * (1.0 - smoothstep(b - w, b + w, f)); return s.x * s.y; }
`;
