// Arazi kullanımı zemini (data/landuse.json): mezarlık (selvi, mermer mezar taşları, çevre duvarı, toprak yollar),
// park/çim/koru (çim + ağaç), saha, otopark, inşaat, meydan, su. Gece mezarlık karanlık kalır (yayıcı yok).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, GLSL_HASH, Grid, cleanRing, lin, pip, signedArea } from './util.js';

export const LU_CODE = { cemetery: 10, park: 11, grass: 11, forest: 12, pitch: 13, parking: 14, construction: 15, plaza: 16, water: 17 };

/** Alanları hazırla: temiz halkalar, kutu, baskın eksen. */
export function prepareLanduse(data) {
  const out = [];
  for (const a of data?.areas || []) {
    const code = LU_CODE[a?.kind];
    if (!code || !Array.isArray(a.footprint)) continue;
    let outer = cleanRing(a.footprint);
    if (outer.length < 3) continue;
    if (signedArea(outer) < 0) outer = outer.reverse();
    const holes = (a.holes || []).map(cleanRing).filter((h) => h.length >= 3).map((h) => (signedArea(h) > 0 ? h.reverse() : h));
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of outer) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    // baskın kenar açısı (uzunluk ağırlıklı, mod 90°)
    let sx = 0, sy = 0;
    for (let i = 0; i < outer.length; i++) {
      const p = outer[i], q = outer[(i + 1) % outer.length];
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) * 4, l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      sx += Math.cos(ang) * l; sy += Math.sin(ang) * l;
    }
    const rot = Math.atan2(sy, sx) / 4;
    out.push({ id: a.id, kind: a.kind, code, outer, holes, bbox: [x0, z0, x1, z1], rot, area: Math.abs(signedArea(outer)) });
  }
  // küçükler sonra çizilsin (iç içe alanlarda üstte kalsın)
  out.sort((a, b) => b.area - a.area);
  const g = new Grid(40);
  out.forEach((a, i) => { a.order = i; g.addBox(a.bbox[0], a.bbox[1], a.bbox[2], a.bbox[3], a); });
  const inside = (a, x, z) => pip(x, z, a.outer) && !a.holes.some((h) => pip(x, z, h));
  /** (x,z) noktasındaki en küçük (en üstteki) alan */
  const at = (x, z) => {
    let best = null;
    g.query(x, z, 0, (a) => {
      const b = a.bbox;
      if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) return;
      if ((!best || a.order > best.order) && inside(a, x, z)) best = a;
    });
    return best;
  };
  return { areas: out, at, inside };
}

function luMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aLU; varying vec4 vLU; varying vec3 vWp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vLU = aLU; vWp = (modelMatrix * vec4(position, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vLU; varying vec3 vWp;
${GLSL_HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float luRough = 0.95, luMetal = 0.0;
{
  float code = floor(vLU.x + 0.5);
  vec2 p = mat2(vLU.y, -vLU.z, vLU.z, vLU.y) * vWp.xz;
  float n1 = cityNoise(vWp.xz * 0.05), n2 = cityNoise(vWp.xz * 0.6 + 9.0), n3 = cityNoise(vWp.xz * 2.1 + 3.0);
  vec3 grass = mix(vec3(0.05, 0.08, 0.025), vec3(0.09, 0.105, 0.04), n1) * mix(0.82, 1.15, n2);
  vec3 dirt = mix(vec3(0.16, 0.12, 0.08), vec3(0.22, 0.17, 0.11), n2) * mix(0.85, 1.1, n3);
  vec3 c = grass;
  if (code < 10.5) {
    // mezarlık: kuru çim + toprak, mermer levha sıraları (yakında taş, uzakta açık doku)
    c = mix(mix(vec3(0.075, 0.08, 0.04), vec3(0.13, 0.11, 0.07), n1), dirt, smoothstep(0.55, 0.8, n2) * 0.6);
    vec2 g = p / vec2(2.3, 3.4), f = fract(g), w = fwidth(g);
    float slab = cityBox(f.x, 0.14, 0.86, w.x) * cityBox(f.y, 0.12, 0.82, w.y);
    float has = step(0.3, cityH(floor(g.x), floor(g.y), 23.0));
    float far = smoothstep(0.2, 0.6, max(w.x, w.y));
    slab = 0.3 * far * (0.6 + 0.4 * has);
    vec3 marble = mix(vec3(0.36, 0.355, 0.33), vec3(0.5, 0.49, 0.46), cityH(floor(g.x), floor(g.y), 29.0)) * mix(0.85, 1.05, n3);
    c = mix(c, marble, slab);
    luRough = mix(0.95, 0.45, slab);
  } else if (code < 11.5) { c = grass; }
  else if (code < 12.5) { c = grass * 0.7; }
  else if (code < 13.5) {
    c = vec3(0.04, 0.11, 0.035) * mix(0.9, 1.1, step(0.5, fract(p.x / 6.0)));
    vec2 w = fwidth(p);
    float ln = cityBox(fract(p.x / 30.0), 0.0, 0.004, w.x / 30.0) + cityBox(fract(p.y / 20.0), 0.0, 0.006, w.y / 20.0);
    c = mix(c, vec3(0.7), clamp(ln, 0.0, 1.0) * 0.8);
  } else if (code < 14.5) {
    c = vec3(0.11, 0.11, 0.115) * mix(0.85, 1.12, n1);
    vec2 w = fwidth(p);
    float st = cityBox(fract(p.x / 2.6), 0.0, 0.05, w.x / 2.6) * step(0.15, fract(p.y / 12.0)) * step(fract(p.y / 12.0), 0.85);
    c = mix(c, vec3(0.7), st * 0.85);
    luRough = 0.9;
  } else if (code < 15.5) { c = dirt * 1.1; }
  else if (code < 16.5) {
    vec2 tp = vWp.xz / 0.8;
    c = vec3(0.3, 0.285, 0.26) * mix(0.88, 1.08, n1) * mix(0.94, 1.05, cityH(floor(tp.x), floor(tp.y), 7.0));
  } else { c = vec3(0.02, 0.035, 0.04); luRough = 0.08; luMetal = 0.2; }
  diffuseColor.rgb = c;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = luRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = luMetal;`);
  };
  m.customProgramCacheKey = () => 'city-landuse-v1';
  return m;
}

/** Çokgeni üçgenle, uzun kenarları böl (arazi eğimini izlesin). */
function fillPoly(B, outer, holes, heightAt, yOff, ex) {
  const v2 = outer.map((p) => new THREE.Vector2(p[0], p[1]));
  const h2 = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(v2, h2); } catch { return; }
  const all = [outer, ...holes].flat();
  const MAX = 14;
  const emit = (a, b, c, depth) => {
    const la = Math.hypot(b[0] - c[0], b[1] - c[1]), lb = Math.hypot(a[0] - c[0], a[1] - c[1]), lc = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const mx = Math.max(la, lb, lc);
    if (mx > MAX && depth < 10) {
      if (mx === la) { const m = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2]; emit(a, b, m, depth + 1); emit(a, m, c, depth + 1); }
      else if (mx === lb) { const m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]; emit(a, b, m, depth + 1); emit(m, b, c, depth + 1); }
      else { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; emit(a, m, c, depth + 1); emit(m, b, c, depth + 1); }
      return;
    }
    const ids = [a, b, c].map((p) => B.v(p[0], heightAt(p[0], p[1]) + yOff, p[1], 0, 1, 0, [1, 1, 1], ex));
    B.tri(ids[0], ids[1], ids[2], 0, 1, 0);
  };
  for (const t of tris) emit(all[t[0]], all[t[1]], all[t[2]], 0);
}

export function buildLanduse(ctx, LU, roadNet, isInside) {
  const group = new THREE.Group(); group.name = 'city-landuse';
  if (!LU.areas.length) return { group, update() {}, counts: { areas: 0 } };
  const { heightAt } = ctx;
  const B = new Builder({ aLU: 4 });
  LU.areas.forEach((a, i) => {
    const ex = { aLU: [a.code, Math.cos(a.rot), Math.sin(a.rot), i] };
    fillPoly(B, a.outer, a.holes, heightAt, 0.07 + Math.min(0.06, a.order * 0.0005), ex);
  });
  const ground = new THREE.Mesh(B.geometry(), luMaterial());
  ground.name = 'city-landuse-ground'; ground.receiveShadow = true;
  group.add(ground);

  // yol düğümleri ızgarası (mezar taşı/ağaç yol üstüne düşmesin, duvarda kapı açılsın)
  const rg = new Grid(10);
  for (const r of roadNet.roads) for (let i = 0; i < r.pts.length; i++) rg.add(r.pts[i][0], r.pts[i][1], [r.pts[i][0], r.pts[i][1], r.halfW]);
  const nearRoad = (x, z, pad) => { let hit = false; rg.query(x, z, pad + 8, (it) => { if (Math.hypot(it[0] - x, it[1] - z) < it[2] + pad) { hit = true; return false; } }); return hit; };

  const stones = [], cypress = [], trees = [];
  const wall = new Builder();
  const stoneC = lin('cfccc4'), capC = lin('b9b4a8');
  for (const a of LU.areas) {
    const r = ctx.rng('city/lu/' + a.id);
    const [x0, z0, x1, z1] = a.bbox;
    const c = Math.cos(a.rot), s = Math.sin(a.rot);
    if (a.kind === 'cemetery') {
      // mezar taşları: eksene hizalı sıra düzeni (gölgeli kesimlerde boşluklar)
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.hypot(x1 - x0, z1 - z0) / 2;
      for (let u = -R; u < R; u += 2.3) for (let v = -R; v < R; v += 3.4) {
        const jx = (r() - 0.5) * 0.25, jz = (r() - 0.5) * 0.25;
        const x = cx + c * (u + jx) - s * (v + jz), z = cz + s * (u + jx) + c * (v + jz);
        const keep = r();
        if (keep < 0.3) continue;
        if (!LU.inside(a, x, z) || LU.at(x, z) !== a || nearRoad(x, z, 1.6) || isInside(x, z, 0.5)) continue;
        stones.push({ x, z, y: heightAt(x, z), rot: a.rot + (r() - 0.5) * 0.08, h: 0.6 + r() * 0.7, kind: r(), tone: 0.75 + r() * 0.3 });
      }
      // selviler: kümeler + yol kenarları
      const nC = Math.round(a.area / 70);
      for (let k = 0, got = 0; k < nC * 3 && got < nC && cypress.length < 6000; k++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        const cl = 0.5 + 0.5 * Math.sin(x * 0.045 + 1.3) * Math.sin(z * 0.05 + 0.4);
        if (r() > 0.25 + 0.6 * cl) continue;
        if (!LU.inside(a, x, z) || nearRoad(x, z, 0.8) || isInside(x, z, 1)) continue;
        cypress.push({ x, z, y: heightAt(x, z), h: 8 + r() * 9, w: 0.9 + r() * 0.6, tone: 0.8 + r() * 0.35 });
        got++;
      }
      // çevre duvarı (yol geçen yerlerde kapı)
      const ring = a.outer;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const n = Math.max(1, Math.ceil(L / 3));
        const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L, nx = uz, nz = -ux; // dışa
        for (let k = 0; k < n; k++) {
          const ax = p[0] + ((q[0] - p[0]) * k) / n, az = p[1] + ((q[1] - p[1]) * k) / n;
          const bx = p[0] + ((q[0] - p[0]) * (k + 1)) / n, bz = p[1] + ((q[1] - p[1]) * (k + 1)) / n;
          const mx = (ax + bx) / 2, mz = (az + bz) / 2;
          if (nearRoad(mx, mz, 0.2) || isInside(mx, mz, 0.2)) continue;
          const ya = heightAt(ax, az) - 0.4, yb = heightAt(bx, bz) - 0.4, H = 2.6, t = 0.22;
          for (const sd of [1, -1]) {
            const ox = nx * t * sd, oz = nz * t * sd;
            wall.wall(ax + ox, az + oz, bx + ox, bz + oz, ya, ya + 0.4 + H, yb, yb + 0.4 + H, nx * sd, nz * sd, stoneC);
          }
          const top = [[ax - nx * 0.3, az - nz * 0.3], [bx - nx * 0.3, bz - nz * 0.3], [bx + nx * 0.3, bz + nz * 0.3], [ax + nx * 0.3, az + nz * 0.3]];
          const yy = [ya, yb, yb, ya].map((y) => y + 0.4 + H + 0.08);
          const ids = top.map((pp, j) => wall.v(pp[0], yy[j], pp[1], 0, 1, 0, capC));
          wall.quad(ids[0], ids[1], ids[2], ids[3], 0, 1, 0);
        }
      }
    } else if (a.kind === 'park' || a.kind === 'forest' || a.kind === 'grass') {
      const dens = a.kind === 'forest' ? 1 / 45 : a.kind === 'park' ? 1 / 160 : 1 / 600;
      const n = Math.min(1500, Math.round(a.area * dens));
      for (let k = 0, got = 0; k < n * 4 && got < n; k++) {
        const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0);
        if (LU.at(x, z) !== a || nearRoad(x, z, 1.2) || isInside(x, z, 1.5)) continue;
        trees.push({ x, z, y: heightAt(x, z), h: 5 + r() * 7, w: 2.4 + r() * 2.6, tone: r() });
        got++;
      }
    }
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const colorize = (g, rgb) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count; g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => rgb[i % 3]), 3)); return g; };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
  // mezar: yatık levha + baş taşı
  if (stones.length) {
    const g = mergeGeometries([
      colorize(new THREE.BoxGeometry(0.85, 0.22, 1.9).translate(0, 0.11, 0), [0.92, 0.92, 0.92]),
      colorize(new THREE.BoxGeometry(0.62, 1, 0.13).translate(0, 0.5, -0.95), [1, 1, 1]),
    ]);
    const im = new THREE.InstancedMesh(g, mat, stones.length);
    im.name = 'city-cemetery-stones'; im.castShadow = true; im.receiveShadow = true;
    stones.forEach((st, i) => {
      q.setFromAxisAngle(Y, -st.rot);
      m4.compose(v.set(st.x, st.y, st.z), q, sc.set(1, st.kind < 0.25 ? 0.35 : st.h, 1));
      im.setMatrixAt(i, m4);
      const grey = st.kind > 0.8 ? 0.22 : 0.44;
      im.setColorAt(i, col.setRGB(grey * st.tone, grey * st.tone, grey * st.tone * 0.97));
    });
    im.computeBoundingSphere(); group.add(im);
  }
  if (cypress.length) {
    const prof = [[0.001, 0], [0.12, 0], [0.12, 0.06], [0.62, 0.1], [0.92, 0.3], [0.85, 0.55], [0.55, 0.8], [0.22, 0.95], [0.001, 1]].map(([x, y]) => new THREE.Vector2(x, y));
    const g = colorize(new THREE.LatheGeometry(prof, 8), [1, 1, 1]);
    g.computeVertexNormals();
    const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const im = new THREE.InstancedMesh(g, cm, cypress.length);
    im.name = 'city-cypress'; im.castShadow = true; im.receiveShadow = true;
    cypress.forEach((t, i) => {
      m4.compose(v.set(t.x, t.y, t.z), q.setFromAxisAngle(Y, t.x * 3.1), sc.set(t.w, t.h, t.w));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.setRGB(0.028 * t.tone, 0.055 * t.tone, 0.03 * t.tone));
    });
    im.computeBoundingSphere(); group.add(im);
  }
  if (trees.length) {
    const g = mergeGeometries([
      colorize(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6).translate(0, 0.25, 0), [0.28, 0.2, 0.14]),
      colorize(new THREE.IcosahedronGeometry(0.5, 1).scale(1, 0.85, 1).translate(0, 0.66, 0), [1, 1, 1]),
    ]);
    const tm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const im = new THREE.InstancedMesh(g, tm, trees.length);
    im.name = 'city-lu-trees'; im.castShadow = true; im.receiveShadow = true;
    const greens = ['3f5a2a', '4a6630', '36512a', '56703a', '425f34'].map((h) => lin(h));
    trees.forEach((t, i) => {
      m4.compose(v.set(t.x, t.y, t.z), q.setFromAxisAngle(Y, t.tone * 6.28), sc.set(t.w * 2, t.h, t.w * 2));
      im.setMatrixAt(i, m4);
      const gc = greens[Math.floor(t.tone * 5) % 5]; im.setColorAt(i, col.setRGB(gc[0], gc[1], gc[2]));
    });
    im.computeBoundingSphere(); group.add(im);
  }
  if (wall.count) {
    const wm = new THREE.Mesh(wall.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    wm.name = 'city-cemetery-wall'; wm.castShadow = true; wm.receiveShadow = true; group.add(wm);
  }
  return { group, update() {}, counts: { areas: LU.areas.length, stones: stones.length, cypress: cypress.length, luTrees: trees.length } };
}
