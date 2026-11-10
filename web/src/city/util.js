// city/ ortak yardımcılar: geometri kurucu, çokgen işlemleri, ızgara, GLSL parçaları.
import * as THREE from 'three';

export const key = (x, z) => `${Math.round(x * 10)},${Math.round(z * 10)}`;

export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function pip(x, z, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Kapalı halkanın tekrar eden son noktasını ve ardışık çiftleri temizle. */
export function cleanRing(pts) {
  const out = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 0.05) out.push([p[0], p[1]]);
  }
  if (out.length > 2) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05) out.pop();
  }
  return out;
}

/** Çoklu çizgiyi en fazla `step` m aralıkla yeniden örnekle. */
export function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.01) continue;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

/** Her noktada sağ normal (miter, sınırlı). Sağ = yöne göre +X doğu, +Z güney sisteminde (−dz, dx). */
export function miterNormals(pts) {
  const n = pts.length, out = new Array(n);
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1];
    const l = Math.hypot(dx, dz) || 1;
    segN.push([-dz / l, dx / l]);
  }
  for (let i = 0; i < n; i++) {
    const a = segN[Math.max(0, i - 1)], b = segN[Math.min(n - 2, i)];
    let mx = a[0] + b[0], mz = a[1] + b[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const d = Math.max(0.55, mx * b[0] + mz * b[1]);
    out[i] = [mx / d, mz / d];
  }
  return out;
}

export function cumLength(pts) {
  const s = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

/** Basit uzamsal ızgara (2B). */
export class Grid {
  constructor(cell = 25) { this.cell = cell; this.map = new Map(); }
  _k(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  add(x, z, item) {
    const k = this._k(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(item);
  }
  addBox(x0, z0, x1, z1, item) {
    const c = this.cell;
    for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
      for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
        const k = this._k(ix, iz); let a = this.map.get(k); if (!a) this.map.set(k, (a = [])); a.push(item);
      }
  }
  query(x, z, r, fn) {
    const c = this.cell;
    for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++)
      for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
        const a = this.map.get(this._k(ix, iz)); if (a) for (const it of a) if (fn(it) === false) return;
      }
  }
}

/** İndeksli geometri kurucu: position, normal, color (+ isteğe bağlı ek öznitelikler). */
export class Builder {
  constructor(extra = {}) {
    this.p = []; this.n = []; this.c = []; this.i = [];
    this.extra = extra; this.ex = {};
    for (const k of Object.keys(extra)) this.ex[k] = [];
    this.count = 0;
  }
  v(x, y, z, nx, ny, nz, col, ex) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]);
    if (ex) for (const k in this.extra) { const a = ex[k], s = this.extra[k], d = this.ex[k]; for (let j = 0; j < s; j++) d.push(a ? a[j] : 0); }
    return this.count++;
  }
  /** Üçgen; verilen normale göre sarım yönünü düzeltir. */
  tri(a, b, c, nx, ny, nz) {
    const P = this.p;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * nx + cy * ny + cz * nz >= 0) this.i.push(a, b, c); else this.i.push(a, c, b);
  }
  quad(a, b, c, d, nx, ny, nz) { this.tri(a, b, c, nx, ny, nz); this.tri(a, c, d, nx, ny, nz); }
  /** Dikey dörtgen duvar: (x0,z0)→(x1,z1), yb..yt, normal (nx,nz). */
  wall(x0, z0, x1, z1, yb0, yt0, yb1, yt1, nx, nz, col, exFn) {
    const a = this.v(x0, yb0, z0, nx, 0, nz, col, exFn && exFn(0, yb0));
    const b = this.v(x1, yb1, z1, nx, 0, nz, col, exFn && exFn(1, yb1));
    const c = this.v(x1, yt1, z1, nx, 0, nz, col, exFn && exFn(1, yt1));
    const d = this.v(x0, yt0, z0, nx, 0, nz, col, exFn && exFn(0, yt0));
    this.quad(a, b, c, d, nx, 0, nz);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    for (const k in this.extra) g.setAttribute(k, new THREE.Float32BufferAttribute(this.ex[k], this.extra[k]));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

/** sRGB hex → doğrusal [r,g,b] */
const _c = new THREE.Color();
export function lin(hex, mul = 1) { _c.setHex(typeof hex === 'string' ? parseInt(hex, 16) : hex); return [_c.r * mul, _c.g * mul, _c.b * mul]; }

/** GLSL: tamsayı karma (WebGL2). */
export const GLSL_HASH = /* glsl */`
uint cityHu(uint x){ x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float cityH(float a, float b, float c){
  uint h = cityHu(uint(int(floor(a + 0.5)) + 65536) ^ cityHu(uint(int(floor(b + 0.5)) + 65536) ^ cityHu(uint(int(floor(c + 0.5)) + 65536))));
  return float(h >> 8) / 16777216.0;
}
float cityBox(float x, float lo, float hi, float w){ w = max(w, 1e-4); return clamp((x - lo) / w + 0.5, 0.0, 1.0) * clamp((hi - x) / w + 0.5, 0.0, 1.0); }
float cityNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = cityH(i.x, i.y, 11.0), b = cityH(i.x + 1.0, i.y, 11.0), c = cityH(i.x, i.y + 1.0, 11.0), d = cityH(i.x + 1.0, i.y + 1.0, 11.0);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

/** Radyal yumuşak disk dokusu (ışık havuzları). */
export function radialTexture(size = 64, pow = 1.6) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size * 2 - 1, v = (y + 0.5) / size * 2 - 1;
    const r = Math.min(1, Math.hypot(u, v));
    const a = Math.pow(1 - r, pow) * (1 - r * r);
    const i = (y * size + x) * 4;
    d[i] = d[i + 1] = d[i + 2] = Math.round(255 * a); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

export const smooth = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
