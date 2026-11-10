// Arazi: terrain.json → heightAt(x,z) (bilineer, kenarda kenetli) + zemin ağı.
// Şema (CONTRACT §4): { nx, nz, x0, z0, dx, dz, heights: [row-major, z sonra x] } → h[iz*nx + ix]
// Veri yoksa/bozuksa düz zemin (heightAt ≡ 0).
import * as THREE from 'three';

export function validTerrain(T) {
  return !!(T && T.nx >= 2 && T.nz >= 2 && Array.isArray(T.heights) && T.heights.length >= T.nx * T.nz
    && Number.isFinite(T.x0) && Number.isFinite(T.z0) && T.dx > 0 && T.dz > 0);
}

/** heightAt(x,z) üretir. y=0 orijin kotu olacak şekilde gerekirse kaydırır (CONTRACT §2). */
export function makeHeightAt(T) {
  if (!validTerrain(T)) {
    if (T) console.warn('[terrain] terrain.json şemaya uymuyor — düz zemin kullanılıyor');
    const flat = () => 0;
    flat.flat = true;
    return flat;
  }
  const { nx, nz, x0, z0, dx, dz } = T;
  const h = Float64Array.from(T.heights, (v) => (Number.isFinite(v) ? v : 0));
  const raw = (x, z) => {
    let fx = (x - x0) / dx, fz = (z - z0) / dz;
    fx = fx < 0 ? 0 : fx > nx - 1 ? nx - 1 : fx;
    fz = fz < 0 ? 0 : fz > nz - 1 ? nz - 1 : fz;
    const ix = Math.min(Math.floor(fx), nx - 2), iz = Math.min(Math.floor(fz), nz - 2);
    const u = fx - ix, v = fz - iz, i = iz * nx + ix;
    return (h[i] * (1 - u) + h[i + 1] * u) * (1 - v) + (h[i + nx] * (1 - u) + h[i + nx + 1] * u) * v;
  };
  const off = raw(0, 0);
  if (Math.abs(off) > 0.5) console.warn(`[terrain] orijin kotu ${off.toFixed(2)} m, 0 olacak şekilde kaydırıldı`);
  const heightAt = (x, z) => raw(x, z) - off;
  heightAt.flat = false;
  return heightAt;
}

// Ağ ekseni: çekirdekte sık (step), dışarıda giderek seyrek, ufka kadar.
function axis(coreHalf, step, outer) {
  const a = [];
  for (let v = -coreHalf; v <= coreHalf + 1e-6; v += step) a.push(v);
  let s = step, v = coreHalf;
  while (v < outer) { s *= 1.35; v = Math.min(outer, v + s); a.push(v); a.unshift(-v); }
  return a;
}

/** Sahne modülü arayüzünde zemin. ctx.heightAt main tarafından kurulmuş olmalı. */
export async function create(ctx) {
  const { scene, heightAt, quality } = ctx;
  const step = quality === 'draft' ? 16 : 8;
  const xs = axis(900, step, 9000), zs = axis(900, step, 9000);
  const nX = xs.length, nZ = zs.length;
  const pos = new Float32Array(nX * nZ * 3);
  for (let j = 0; j < nZ; j++) for (let i = 0; i < nX; i++) {
    const k = (j * nX + i) * 3;
    pos[k] = xs[i]; pos[k + 1] = heightAt(xs[i], zs[j]) - 0.05; pos[k + 2] = zs[j];
  }
  const idx = [];
  for (let j = 0; j < nZ - 1; j++) for (let i = 0; i < nX - 1; i++) {
    const a = j * nX + i, b = a + 1, c = a + nX, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  scene.add(mesh);
  return {
    object3D: mesh,
    update() {},
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
