// Araç geometrileri (düşük poligon ama yakın planda araba gibi okunan) + ortak malzeme.
// Köşe özniteliği aPaint: 1 = kaporta (örnek rengiyle çarpılır), 0 = sabit renk (cam, lastik),
// 2 = far, 3 = stop (gece emisif).

class VB {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.paint = [];
    this.idx = [];
    this.n = 0;
  }

  v(x, y, z, nx, ny, nz, c, p) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.col.push(c[0], c[1], c[2]);
    this.paint.push(p);
    return this.n++;
  }

  /** a,b,c,d saat yönünün tersine (normalden bakınca). */
  quad(a, b, c, d, n, col, p) {
    const i0 = this.v(a[0], a[1], a[2], n[0], n[1], n[2], col, p);
    const i1 = this.v(b[0], b[1], b[2], n[0], n[1], n[2], col, p);
    const i2 = this.v(c[0], c[1], c[2], n[0], n[1], n[2], col, p);
    const i3 = this.v(d[0], d[1], d[2], n[0], n[1], n[2], col, p);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }

  box(x0, y0, z0, x1, y1, z1, col, p, skipBottom = true) {
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], col, p);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], col, p);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, p);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, p);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], col, p);
    if (!skipBottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, p);
  }

  /** z ekseni boyunca sekizgen prizma (teker). rx, ry: elips yarıçapları. */
  wheel(cx, cy, rx, ry, z0, z1, col) {
    const N = 8;
    const ring = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / 8;
      ring.push([Math.cos(a), Math.sin(a)]);
    }
    for (let i = 0; i < N; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % N];
      const nx = (a[0] + b[0]) / 2;
      const ny = (a[1] + b[1]) / 2;
      const l = Math.hypot(nx, ny);
      this.quad(
        [cx + a[0] * rx, cy + a[1] * ry, z1], [cx + a[0] * rx, cy + a[1] * ry, z0],
        [cx + b[0] * rx, cy + b[1] * ry, z0], [cx + b[0] * rx, cy + b[1] * ry, z1],
        [nx / l, ny / l, 0], col, 0,
      );
    }
    for (const [z, s] of [[z1, 1], [z0, -1]]) {
      const c = this.v(cx, cy, z, 0, 0, s, [col[0] * 3 + 0.12, col[1] * 3 + 0.12, col[2] * 3 + 0.12], 0);
      const vs = ring.map((p) => this.v(cx + p[0] * rx, cy + p[1] * ry, z, 0, 0, s, col, 0));
      for (let i = 0; i < N; i++) {
        if (s > 0) this.idx.push(c, vs[i], vs[(i + 1) % N]);
        else this.idx.push(c, vs[(i + 1) % N], vs[i]);
      }
    }
  }

  build(THREE) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aPaint', new THREE.Float32BufferAttribute(this.paint, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const GLASS = [0.045, 0.055, 0.07];
const TIRE = [0.02, 0.02, 0.022];
const HEAD = [0.9, 0.9, 0.85];
const TAIL = [0.45, 0.03, 0.02];
const TRIM = [0.06, 0.06, 0.065];
const WHITE = [1, 1, 1];

/** Yan profilden (x ileri, y yukarı; saat yönünün tersine) genişlik boyunca çekilmiş gövde. */
function extrude(THREE, vb, prof, hw, glassEdges, sideWin) {
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const a = prof[i];
    const b = prof[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = dy / l;
    const ny = -dx / l;
    const glass = glassEdges.includes(i);
    const ins = glass ? 0.1 : 0;
    if (glass) {
      // cam şeridi kenarlardan içeride; kalan direkler kaporta
      vb.quad([a[0], a[1], hw], [a[0], a[1], hw - ins], [b[0], b[1], hw - ins], [b[0], b[1], hw], [nx, ny, 0], WHITE, 1);
      vb.quad([a[0], a[1], -hw + ins], [a[0], a[1], -hw], [b[0], b[1], -hw], [b[0], b[1], -hw + ins], [nx, ny, 0], WHITE, 1);
    }
    vb.quad([a[0], a[1], hw - ins], [a[0], a[1], -hw + ins], [b[0], b[1], -hw + ins], [b[0], b[1], hw - ins], [nx, ny, 0], glass ? GLASS : WHITE, glass ? 0 : 1);
  }
  const tris = THREE.ShapeUtils.triangulateShape(prof.map((p) => new THREE.Vector2(p[0], p[1])), []);
  for (const s of [1, -1]) {
    const vs = prof.map((p) => vb.v(p[0], p[1], s * hw, 0, 0, s, WHITE, 1));
    for (const t of tris) {
      const a = prof[t[0]];
      const b = prof[t[1]];
      const c = prof[t[2]];
      const ccw = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
      if (ccw === s > 0) vb.idx.push(vs[t[0]], vs[t[1]], vs[t[2]]);
      else vb.idx.push(vs[t[0]], vs[t[2]], vs[t[1]]);
    }
    // yan camlar (dörtgenler, gövdeden 1 cm dışarıda)
    for (const q of sideWin) {
      const z = s * (hw + 0.012);
      const p = q.map((k) => [k[0], k[1], z]);
      if (s > 0) vb.quad(p[0], p[1], p[2], p[3], [0, 0, 1], GLASS, 0);
      else vb.quad(p[3], p[2], p[1], p[0], [0, 0, -1], GLASS, 0);
    }
  }
}

export function carGeometry(THREE) {
  const vb = new VB();
  const hw = 0.89;
  const prof = [
    [-2.15, 0.3], [2.15, 0.3], [2.15, 0.66], [2.02, 0.8], [0.95, 0.93], [0.28, 1.41], [-1.1, 1.41], [-1.8, 0.99], [-2.15, 0.9],
  ];
  extrude(THREE, vb, prof, hw, [4, 6], [
    [[-0.38, 0.97], [0.82, 0.97], [0.3, 1.35], [-0.38, 1.35]],
    [[-1.62, 1.01], [-0.5, 0.97], [-0.5, 1.35], [-1.08, 1.35]],
  ]);
  for (const x of [1.32, -1.3]) vb.wheel(x, 0.33, 0.33, 0.33, -hw - 0.02, hw + 0.02, TIRE);
  for (const z of [0.56, -0.56]) {
    vb.quad([2.16, 0.6, z + 0.24], [2.16, 0.6, z - 0.24], [2.1, 0.75, z - 0.24], [2.1, 0.75, z + 0.24], [1, 0.3, 0], HEAD, 2);
    vb.quad([-2.16, 0.68, z - 0.26], [-2.16, 0.68, z + 0.26], [-2.16, 0.86, z + 0.26], [-2.16, 0.86, z - 0.26], [-1, 0, 0], TAIL, 3);
  }
  vb.quad([2.16, 0.36, 0.7], [2.16, 0.36, -0.7], [2.16, 0.52, -0.7], [2.16, 0.52, 0.7], [1, 0, 0], TRIM, 0);
  // plakalar, marşpiyel bandı, tampon
  vb.quad([2.165, 0.4, 0.26], [2.165, 0.4, -0.26], [2.165, 0.5, -0.26], [2.165, 0.5, 0.26], [1, 0, 0], [0.85, 0.85, 0.82], 0);
  vb.quad([-2.165, 0.5, -0.26], [-2.165, 0.5, 0.26], [-2.165, 0.6, 0.26], [-2.165, 0.6, -0.26], [-1, 0, 0], [0.85, 0.85, 0.82], 0);
  vb.quad([-2.162, 0.3, -0.89], [-2.162, 0.3, 0.89], [-2.162, 0.46, 0.89], [-2.162, 0.46, -0.89], [-1, 0, 0], TRIM, 0);
  for (const s of [1, -1]) {
    const z = s * (hw + 0.014);
    const q = [[-2.1, 0.3, z], [2.1, 0.3, z], [2.1, 0.43, z], [-2.1, 0.43, z]];
    if (s > 0) vb.quad(q[0], q[1], q[2], q[3], [0, 0, 1], TRIM, 0);
    else vb.quad(q[3], q[2], q[1], q[0], [0, 0, -1], TRIM, 0);
  }
  // taksi tepe lambası: yalnız taksi sarısı örneklerde görünür (aPaint = 4)
  vb.box(-0.3, 1.41, -0.26, -0.05, 1.54, 0.26, [1.0, 0.85, 0.25], 4);
  return vb.build(THREE);
}

export function vanGeometry(THREE) {
  const vb = new VB();
  const hw = 0.98;
  const prof = [[-2.7, 0.34], [2.7, 0.34], [2.7, 0.92], [2.42, 1.22], [1.75, 2.12], [1.4, 2.2], [-2.7, 2.2]];
  extrude(THREE, vb, prof, hw, [3], [
    [[0.7, 1.3], [2.0, 1.3], [1.5, 1.98], [0.7, 1.98]],
    [[-2.3, 1.3], [0.45, 1.3], [0.45, 1.98], [-2.3, 1.98]],
  ]);
  for (const x of [1.75, -1.7]) vb.wheel(x, 0.36, 0.36, 0.36, -hw - 0.02, hw + 0.02, TIRE);
  for (const z of [0.66, -0.66]) {
    vb.quad([2.71, 0.72, z + 0.22], [2.71, 0.72, z - 0.22], [2.71, 0.9, z - 0.22], [2.71, 0.9, z + 0.22], [1, 0, 0], HEAD, 2);
    vb.quad([-2.71, 0.8, z - 0.14], [-2.71, 0.8, z + 0.14], [-2.71, 1.5, z + 0.14], [-2.71, 1.5, z - 0.14], [-1, 0, 0], TAIL, 3);
  }
  vb.quad([-2.71, 1.35, -0.5], [-2.71, 1.35, 0.5], [-2.71, 1.95, 0.5], [-2.71, 1.95, -0.5], [-1, 0, 0], GLASS, 0);
  return vb.build(THREE);
}

/** Birim boyutlu uzun araç (otobüs / metrobüs / kamyon): örnek başına (boy, yükseklik, en) ölçeklenir. */
export function longGeometry(THREE) {
  const vb = new VB();
  vb.box(-0.5, 0.1, -0.5, 0.5, 0.46, 0.5, WHITE, 1, false);
  vb.box(-0.492, 0.46, -0.485, 0.492, 0.8, 0.485, GLASS, 0);
  vb.box(-0.5, 0.8, -0.5, 0.5, 1.0, 0.5, [0.92, 0.92, 0.92], 1);
  // cam bandını bölen direkler
  for (let i = -4; i <= 4; i++) {
    const x = i * 0.118;
    vb.box(x - 0.006, 0.46, -0.5, x + 0.006, 0.8, 0.5, WHITE, 1);
  }
  for (const x of [0.3, -0.27]) vb.wheel(x, 0.165, 0.045, 0.165, -0.51, 0.51, TIRE);
  for (const z of [0.33, -0.33]) {
    vb.quad([0.501, 0.2, z + 0.1], [0.501, 0.2, z - 0.1], [0.501, 0.3, z - 0.1], [0.501, 0.3, z + 0.1], [1, 0, 0], HEAD, 2);
    vb.quad([-0.501, 0.2, z - 0.09], [-0.501, 0.2, z + 0.09], [-0.501, 0.34, z + 0.09], [-0.501, 0.34, z - 0.09], [-1, 0, 0], TAIL, 3);
  }
  return vb.build(THREE);
}

/** lamps: true → gece far/stop emisif (hareketli araçlar); false → park etmiş. */
export function vehicleMaterial(THREE, uniforms, lamps) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.12, envMapIntensity: 0.7 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = uniforms.uLit;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPaint; attribute float aAo; varying float vPaint; varying float vAo;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
          if (aPaint > 3.5) transformed *= step(0.6, instanceColor.r) * step(instanceColor.b, 0.05) * step(0.3, instanceColor.g);
        #endif`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        vPaint = aPaint;
        vAo = aAo;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = aPaint > 0.5 && aPaint < 1.5 ? color.rgb * instanceColor.rgb : color.rgb;
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPaint; varying float vAo; uniform float uLit;')
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = vPaint < 0.5 ? 0.25 : roughnessFactor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${lamps ? `{
          float lampOn = smoothstep(0.02, 0.22, uLit);
          // gölgede (tabliye altı) farlar yanık; sıkışık trafikte stoplar gündüz de kızarır
          float headOn = max(lampOn, 0.8 * vAo);
          float tailOn = max(lampOn, 0.3 + 0.65 * vAo);
          if (vPaint > 1.5 && vPaint < 2.5) totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * 5.0 * headOn;
          if (vPaint > 2.5 && vPaint < 3.5) totalEmissiveRadiance += vec3(1.0, 0.05, 0.02) * 3.4 * tailOn;
          if (vPaint > 3.5) totalEmissiveRadiance += vec3(1.0, 0.8, 0.2) * 2.5 * lampOn;
        }` : ''}`,
      );
  };
  {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh) => {
      prev(sh);
      // tabliye altındaki araçlar: ortam ışığı kısılır
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <aomap_fragment>',
        '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.66, vAo); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }',
      );
    };
  }
  mat.customProgramCacheKey = () => `city-vehicle3-${lamps ? 1 : 0}`;
  return mat;
}
