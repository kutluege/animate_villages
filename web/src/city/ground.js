// Zemin: 4 m'lik ince ızgara (yollar için düzleştirilmiş/dolgulu) + ufka uzanan kaba örtü + boyalı doku.
import { smoothstep, lerp, segDist, GLSL_NOISE } from './util.js';

const FX0 = -960, FX1 = 1000, FZ0 = -900, FZ1 = 1100, STEP = 4;
const TEX = 4096;

export function buildGround(ctx, net, group) {
  const { THREE, heightAt, data, renderer } = ctx;
  const nx = Math.round((FX1 - FX0) / STEP) + 1;
  const nz = Math.round((FZ1 - FZ0) / STEP) + 1;
  const H = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) H[iz * nx + ix] = heightAt(FX0 + ix * STEP, FZ0 + iz * STEP);

  // ---- yollar zemini biçimlendirir: en yakın yol kazanır (dolgu, yarma, teras) ----------
  const bestD = new Float32Array(nx * nz).fill(1e9);
  const bestY = new Float32Array(nx * nz);
  const o = { t: 0 };
  for (const r of net.roads) {
    if (r.bridge || r.ext) continue;
    if (!r.veh && r.cls !== 'pedestrian') continue;
    const hw = r.width / 2;
    const R = hw + 12;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const ix0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R - FX0) / STEP));
      const ix1 = Math.min(nx - 1, Math.ceil((Math.max(a[0], b[0]) + R - FX0) / STEP));
      const iz0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - R - FZ0) / STEP));
      const iz1 = Math.min(nz - 1, Math.ceil((Math.max(a[2], b[2]) + R - FZ0) / STEP));
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const d = segDist(FX0 + ix * STEP, FZ0 + iz * STEP, a[0], a[2], b[0], b[2], o) - hw;
          const k = iz * nx + ix;
          if (d < bestD[k]) {
            bestD[k] = d;
            bestY[k] = lerp(a[1], b[1], o.t) - 0.1;
          }
        }
      }
    }
  }
  for (let k = 0; k < H.length; k++) {
    if (bestD[k] < 11.7) H[k] = lerp(H[k], bestY[k], 1 - smoothstep(5.8, 11.7, bestD[k]));
  }

  const gY = (x, z) => {
    if (x <= FX0 || x >= FX1 || z <= FZ0 || z >= FZ1) return heightAt(x, z);
    const fx = (x - FX0) / STEP;
    const fz = (z - FZ0) / STEP;
    const ix = Math.min(nx - 2, Math.floor(fx));
    const iz = Math.min(nz - 2, Math.floor(fz));
    const u = fx - ix;
    const v = fz - iz;
    const i = iz * nx + ix;
    const a = H[i] + (H[i + 1] - H[i]) * u;
    const b = H[i + nx] + (H[i + nx + 1] - H[i + nx]) * u;
    return a + (b - a) * v;
  };

  // ---- doku ------------------------------------------------------------------------------
  const tex = paintTexture(ctx, net);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ---- ince ızgara ağı -------------------------------------------------------------------
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const k = iz * nx + ix;
      pos[k * 3] = FX0 + ix * STEP;
      pos[k * 3 + 1] = H[k];
      pos[k * 3 + 2] = FZ0 + iz * STEP;
      uv[k * 2] = ix / (nx - 1);
      uv[k * 2 + 1] = iz / (nz - 1);
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      idx[q++] = a; idx[q++] = a + nx; idx[q++] = a + 1;
      idx[q++] = a + 1; idx[q++] = a + nx; idx[q++] = a + nx + 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const mat = groundMaterial(THREE, tex, true);
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'city-ground';
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);

  // ---- kaba dış örtü (arazi ızgarası + ufka doğru büyük dörtgenler) ---------------------
  const t = data.terrain;
  const xs = [];
  const zs = [];
  const far = [1700, 2200, 3000, 4200, 6000, 9000, 14000];
  if (t && t.nx > 1) {
    for (const f of far.slice().reverse()) xs.push(t.x0 - f);
    for (let i = 0; i < t.nx; i++) xs.push(t.x0 + i * t.dx);
    for (const f of far) xs.push(t.x0 + (t.nx - 1) * t.dx + f);
    for (const f of far.slice().reverse()) zs.push(t.z0 - f);
    for (let i = 0; i < t.nz; i++) zs.push(t.z0 + i * t.dz);
    for (const f of far) zs.push(t.z0 + (t.nz - 1) * t.dz + f);
  } else {
    for (let v = -14000; v <= 14000; v += 500) {
      xs.push(v);
      zs.push(v);
    }
  }
  const cx = xs.length;
  const cz = zs.length;
  const cp = new Float32Array(cx * cz * 3);
  for (let iz = 0; iz < cz; iz++) {
    for (let ix = 0; ix < cx; ix++) {
      const x = xs[ix];
      const z = zs[iz];
      const k = (iz * cx + ix) * 3;
      const inner = Math.min(x - FX0, FX1 - x, z - FZ0, FZ1 - z);
      cp[k] = x;
      cp[k + 1] = heightAt(x, z) - (inner > 30 ? 8 : inner > -1 ? 0.6 : 0);
      cp[k + 2] = z;
    }
  }
  const ci = new Uint32Array((cx - 1) * (cz - 1) * 6);
  q = 0;
  for (let iz = 0; iz < cz - 1; iz++) {
    for (let ix = 0; ix < cx - 1; ix++) {
      const a = iz * cx + ix;
      ci[q++] = a; ci[q++] = a + cx; ci[q++] = a + 1;
      ci[q++] = a + 1; ci[q++] = a + cx; ci[q++] = a + cx + 1;
    }
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3));
  cg.setIndex(new THREE.BufferAttribute(ci, 1));
  cg.computeVertexNormals();
  const outer = new THREE.Mesh(cg, groundMaterial(THREE, null, false, ctx.uniforms));
  outer.name = 'city-ground-outer';
  outer.receiveShadow = true;
  group.add(outer);

  /** Zemin normali (havuz çıkartmaları için). */
  const gN = (x, z, out) => {
    const e = 3;
    const dx = gY(x + e, z) - gY(x - e, z);
    const dz = gY(x, z + e) - gY(x, z - e);
    const l = Math.hypot(dx, 2 * e, dz);
    out[0] = -dx / l;
    out[1] = (2 * e) / l;
    out[2] = -dz / l;
    return out;
  };

  return { gY, gN, bounds: { x0: FX0, x1: FX1, z0: FZ0, z1: FZ1 } };
}

// Dolgu binaların bittiği yerden ufka: şehir dokusu izlenimi (çatı mozaiği) + gece seyrek ışık kırıntısı.
const OUTER_GLSL = /* glsl */ `
  {
    vec2 p = vCityPos.xz;
    float ro = length(p);
    float k = smoothstep(1900.0, 3000.0, ro);
    vec2 g = p / 19.0;
    float fwc = max(fwidth(g.x), fwidth(g.y));
    float det = 1.0 - smoothstep(0.35, 1.0, fwc);
    vec2 id = floor(g); vec2 f = fract(g);
    float h = cH21(id);
    float roofT = step(0.72, h);
    vec3 roof = mix(vec3(0.42, 0.41, 0.39) * (0.7 + 0.6 * cH21(id + 3.1)), vec3(0.42, 0.22, 0.16), roofT * 0.8);
    float street = step(f.x, 0.16) + step(f.y, 0.12) * step(0.5, cH21(vec2(id.y, 7.0)));
    vec3 city = mix(roof, vec3(0.12, 0.12, 0.13), clamp(street, 0.0, 1.0));
    vec3 avg = vec3(0.33, 0.31, 0.29);
    diffuseColor.rgb = mix(diffuseColor.rgb * mix(vec3(1.0), vec3(0.92, 0.95, 0.9), cNoise(p * 0.004)), mix(avg, city, det), k);
    float litP = clamp((uLit - 0.04) / 0.92, 0.0, 1.0);
    float sp = mix(0.07, step(0.93, cH21(id + 1.7)) * (1.0 - clamp(street, 0.0, 1.0)), det);
    cEmis = mix(vec3(1.0, 0.66, 0.34), vec3(1.0, 0.86, 0.66), cH21(id + 9.7) * det) * 0.6 * sp * litP * k * (0.55 + 0.9 * cNoise(p * 0.0025));
  }
`;

function groundMaterial(THREE, map, fine, uniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : 0x6f6b64,
    map,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.4,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = uniforms ? uniforms.uLit : { value: 0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCityPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCityPos;\nuniform float uLit;\nvec3 cEmis;\n${GLSL_NOISE}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cEmis;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float n1 = cFbm(vCityPos.xz * 0.045);
          float n2 = cNoise(vCityPos.xz * 0.9);
          float dist = length(vCityPos.xz - cameraPosition.xz);
          float fineK = 1.0 - smoothstep(150.0, 600.0, dist);
          diffuseColor.rgb *= 0.82 + 0.3 * n1 + (n2 - 0.5) * 0.16 * fineK;
          cEmis = vec3(0.0);
          ${fine ? '' : OUTER_GLSL}
        }`,
      );
  };
  mat.customProgramCacheKey = () => `city-ground-${fine ? 1 : 0}`;
  return mat;
}

function paintTexture(ctx, net) {
  const { THREE, data } = ctx;
  const cv = document.createElement('canvas');
  cv.width = TEX;
  cv.height = TEX;
  const c = cv.getContext('2d');
  const sx = TEX / (FX1 - FX0);
  const sz = TEX / (FZ1 - FZ0);
  const X = (x) => (x - FX0) * sx;
  const Z = (z) => (z - FZ0) * sz;
  const poly = (ring) => {
    c.beginPath();
    ring.forEach((p, i) => (i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))));
    c.closePath();
  };
  const line = (pts) => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Z(p[2])) : c.moveTo(X(p[0]), Z(p[2]))));
  };

  c.fillStyle = '#7b766d';
  c.fillRect(0, 0, TEX, TEX);
  c.lineJoin = 'round';
  c.lineCap = 'round';

  const pois = data.pois || {};
  // Orijinin GB'sındaki boşluk: veri notlarına göre büyük olasılıkla mezarlık → koyu yeşil zemin
  c.fillStyle = '#4c5444';
  c.fillRect(X(-345), Z(70), (345 + 140) * sx, (395 - 70) * sz);

  const GREEN = { park: '#59684a', wood: '#46553a', grass: '#66704f', garden: '#5c6a4b', pitch: '#55774e', playground: '#a08a69', dog_park: '#77755a' };
  for (const gp of pois.greens || []) {
    if (!gp.ring || gp.ring.length < 3) continue;
    c.fillStyle = GREEN[gp.kind] || '#5e6a4c';
    poly(gp.ring);
    c.fill();
  }
  for (const s of pois.squares || []) {
    if (!s.ring) continue;
    c.fillStyle = '#a39d92';
    poly(s.ring);
    c.fill();
  }
  for (const p of pois.platforms || []) {
    if (!p.pts || !p.closed) continue;
    c.fillStyle = '#8f8a81';
    poly(p.pts);
    c.fill();
  }

  const surf = net.roads.filter((r) => !r.bridge && !r.ext);
  // kaldırım kasası
  c.strokeStyle = '#9d988f';
  for (const r of surf) {
    if (!r.veh) continue;
    c.lineWidth = (r.width + (r.type === 0 || r.type === 3 || r.type === 5 ? 1.6 : 4.2)) * sx;
    line(r.pts);
    c.stroke();
  }
  // yaya yolları
  for (const r of surf) {
    if (r.veh) continue;
    c.strokeStyle = r.cls === 'steps' ? '#8d887f' : '#a8a398';
    c.lineWidth = r.width * sx;
    line(r.pts);
    c.stroke();
  }
  // asfalt
  for (const r of surf) {
    if (!r.veh) continue;
    c.strokeStyle = r.type === 2 ? '#4a4a4c' : '#3a3b3e';
    c.lineWidth = r.width * sx;
    line(r.pts);
    c.stroke();
  }

  // temas gölgeleri: bina izleri + köprü altları, bulanık koyulaştırma
  const S2 = 2048;
  const cv2 = document.createElement('canvas');
  cv2.width = S2;
  cv2.height = S2;
  const d = cv2.getContext('2d');
  const k2 = S2 / TEX;
  d.fillStyle = '#000';
  for (const b of data.buildings || []) {
    if (!b.ring || b.ring.length < 3) continue;
    d.beginPath();
    b.ring.forEach((p, i) => (i ? d.lineTo(X(p[0]) * k2, Z(p[1]) * k2) : d.moveTo(X(p[0]) * k2, Z(p[1]) * k2)));
    d.closePath();
    d.fill();
  }
  c.save();
  c.globalAlpha = 0.5;
  c.filter = 'blur(7px)';
  c.drawImage(cv2, 0, 0, TEX, TEX);
  c.restore();

  d.clearRect(0, 0, S2, S2);
  d.strokeStyle = '#000';
  d.lineCap = 'butt';
  for (const r of net.roads) {
    if (!r.bridge || r.ext) continue;
    d.lineWidth = (r.width + 1) * sx * k2;
    d.beginPath();
    r.pts.forEach((p, i) => (i ? d.lineTo(X(p[0]) * k2, Z(p[2]) * k2) : d.moveTo(X(p[0]) * k2, Z(p[2]) * k2)));
    d.stroke();
  }
  c.save();
  c.globalAlpha = 0.5;
  c.filter = 'blur(9px)';
  c.drawImage(cv2, 0, 0, TEX, TEX);
  c.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
