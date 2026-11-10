// Veri kutusu dışı dolgu: VERİYE DAYANMAYAN, düşük ayrıntılı alçak-orta yoğun doku (CONTRACT §4 Tur 2).
// userData.procedural = true. Simge yapı yok (≤ ~45 m). Gece pencereler uzaklıkla seyrelir; sokak parıltısı noktaları.
import * as THREE from 'three';
import { GLSL_HASH, lin, radialTexture, smooth } from './util.js';

const FACADE = ['e4d9c6', 'dccdb1', 'd3c4a6', 'cdc8be', 'bbb2a4', 'ebe5d9', 'd9c293', 'd8ae98', 'c79279', 'dcc0b2', 'b7aa97', 'e0cdb0'];

export function buildFill(ctx, U, box) {
  const group = new THREE.Group(); group.name = 'city-fill'; group.userData.procedural = true;
  const { heightAt } = ctx;
  const r = ctx.rng('city/fill');
  const inBox = (x, z, m) => x > box[0] - m && x < box[2] + m && z > box[1] - m && z < box[3] + m;
  const blds = [], glows = [];
  const pal = FACADE.map((h) => lin(h));
  for (const [R0, R1, step] of [[0, 2200, 34], [2200, 4800, 50]]) {
    for (let gx = -R1; gx < R1; gx += step) for (let gz = -R1; gz < R1; gz += step) {
      const cx = gx + step / 2, cz = gz + step / 2;
      const d = Math.max(Math.abs(cx), Math.abs(cz));
      if (d < R0 || d >= R1) continue;
      if (inBox(cx, cz, step * 0.2)) continue;
      // caddeler: düzenli aralıkla boş şeritler (hafif açılı ızgara hissi için ofsetli)
      const ax = Math.floor((gx + 7) / (step * 6)), az = Math.floor((gz - 11) / (step * 7));
      const onAvenueX = ((gx + 7) % (step * 6) + step * 6) % (step * 6) < step * 0.6;
      const onAvenueZ = ((gz - 11) % (step * 7) + step * 7) % (step * 7) < step * 0.6;
      void ax; void az;
      if (onAvenueX || onAvenueZ) {
        if (r() < 0.6) glows.push([cx + (r() - 0.5) * step * 0.4, cz + (r() - 0.5) * step * 0.4, 1]);
        continue;
      }
      if (r() < 0.1) continue; // açıklık
      const dist = Math.hypot(cx, cz);
      const nb = step < 40 ? 1 + (r() < 0.45 ? 1 : 0) : 1;
      for (let k = 0; k < nb; k++) {
        const w = step * (nb > 1 ? 0.38 + r() * 0.12 : 0.55 + r() * 0.3), dd = step * (0.55 + r() * 0.3);
        const ox = nb > 1 ? (k ? 1 : -1) * step * 0.22 : (r() - 0.5) * step * 0.12, oz = (r() - 0.5) * step * 0.12;
        const tall = r() < (dist < 2500 ? 0.05 : 0.025);
        const floors = tall ? 10 + Math.floor(r() * 5) : Math.max(2, Math.round(3 + r() * 5 - Math.max(0, (dist - 2500) / 1500)));
        const H = floors * 3.1 + 0.6;
        const x = cx + ox, z = cz + oz;
        if (inBox(x, z, Math.max(w, dd) * 0.6)) continue;
        blds.push({ x, z, y: heightAt(x, z) - 2, w, d: dd, H: H + 2, rot: (r() - 0.5) * 0.12, col: pal[Math.floor(r() * pal.length)], seed: Math.floor(r() * 30000), k: r(), roof: r() });
      }
      if (r() < 0.25) glows.push([gx, gz, 0]);
    }
  }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  geo.deleteAttribute('uv');
  const iData = new Float32Array(blds.length * 4);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLightsOn = U.uLightsOn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 iData; varying vec4 vData; varying vec3 vWp; varying vec3 vWn; varying float vBase;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vData = iData;
vWp = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
vWn = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
vBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uLightsOn; varying vec4 vData; varying vec3 vWp; varying vec3 vWn; varying float vBase;
${GLSL_HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 fEm = vec3(0.0);
{
  float seed = vData.x;
  if (vWn.y > 0.5) {
    diffuseColor.rgb = vData.w > 0.55 ? vec3(0.32, 0.12, 0.07) * mix(0.8, 1.1, vData.w) : vec3(0.25, 0.24, 0.23) * mix(0.8, 1.1, vData.w);
  } else {
    vec2 t = normalize(vec2(-vWn.z, vWn.x));
    float u = dot(vWp.xz, t) / 3.0;
    float h = (vWp.y - vBase - 2.0) / 3.1;
    vec2 g = vec2(u, h), f = fract(g), w = fwidth(g);
    float far = smoothstep(0.2, 0.55, max(w.x, w.y));
    float wm = cityBox(f.x, 0.3, 0.7, w.x) * cityBox(f.y, 0.3, 0.72, w.y) * step(0.0, h) * step(h, vData.y - 0.5);
    wm = mix(wm, 0.16 * step(0.0, h) * step(h, vData.y - 0.5), far);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.045, 0.05), wm);
    float dist = length(vWp.xz);
    float frac = mix(0.42, 0.1, smoothstep(900.0, 4800.0, dist));
    float hw = cityH(seed, floor(u), floor(h));
    float k = vData.z * 0.4 + hw * 0.6 / max(frac, 0.05) * 0.5;
    float on = smoothstep(k, k + 0.02, uLightsOn) * step(hw, frac * 1.6) * step(0.002, uLightsOn);
    float tone = cityH(seed, floor(u) + 7.0, floor(h));
    vec3 lc = tone < 0.65 ? vec3(1.0, 0.6, 0.28) : vec3(0.9, 0.92, 1.0);
    fEm = lc * mix(1.4, 2.4, cityH(seed, floor(u), floor(h) + 50.0)) * on * wm;
  }
}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += fEm;`);
  };
  mat.customProgramCacheKey = () => 'city-fill-v1';
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, blds.length));
  im.count = blds.length; im.name = 'city-fill-blocks'; im.userData.procedural = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  blds.forEach((b, i) => {
    m4.compose(v.set(b.x, b.y, b.z), q.setFromAxisAngle(Y, b.rot), s.set(b.w, b.H, b.d));
    im.setMatrixAt(i, m4);
    const fade = 0.92 + (b.k - 0.5) * 0.1;
    im.setColorAt(i, c.setRGB(b.col[0] * fade, b.col[1] * fade, b.col[2] * fade));
    iData[i * 4] = b.seed; iData[i * 4 + 1] = (b.H - 2.6) / 3.1; iData[i * 4 + 2] = b.k; iData[i * 4 + 3] = b.roof;
  });
  geo.setAttribute('iData', new THREE.InstancedBufferAttribute(iData, 4));
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.computeBoundingSphere();
  group.add(im);

  // sokak parıltısı (gece): yere yatık toplamalı lekeler
  const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const pm = new THREE.MeshBasicMaterial({ map: radialTexture(32, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0x000000 });
  const gm = new THREE.InstancedMesh(pg, pm, Math.max(1, glows.length));
  gm.count = glows.length; gm.name = 'city-fill-glow'; gm.userData.procedural = true; gm.renderOrder = 2;
  glows.forEach((g, i) => {
    const size = g[2] ? 26 : 14;
    m4.compose(v.set(g[0], heightAt(g[0], g[1]) + 0.6, g[1]), q.identity(), s.set(size, 1, size));
    gm.setMatrixAt(i, m4);
    const fd = 1 - 0.65 * smooth(1200, 4800, Math.hypot(g[0], g[1]));
    gm.setColorAt(i, (g[2] ? c.setRGB(1.0, 0.62, 0.3) : c.setRGB(1.0, 0.8, 0.6)).multiplyScalar(fd));
  });
  gm.instanceMatrix.needsUpdate = true; if (gm.instanceColor) gm.instanceColor.needsUpdate = true; gm.computeBoundingSphere();
  group.add(gm);
  const base = new THREE.Color(1, 1, 1);
  return {
    group, counts: { fill: blds.length, fillGlow: glows.length },
    update(state) {
      const on = smooth(0.1, 0.6, state.lightsOn);
      gm.visible = on > 0.002;
      pm.color.copy(base).multiplyScalar(0.55 * on);
    },
  };
}
