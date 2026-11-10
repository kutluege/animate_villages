// Binalar: tek birleşik ağ; pencere/kat çizgisi/dükkân/tabela şaderde (MeshStandardMaterial + onBeforeCompile).
// Gece pencereler seed'li eşikle (k) tek tek yanar: lightsOn > k.
import * as THREE from 'three';
import { Builder, GLSL_HASH, cleanRing, lin, pip, signedArea } from './util.js';

// İstanbul cephe paleti (sRGB): bej, krem, kum, soluk gri, kiremit-somon, toz pembe, eskimiş açık mavi-yeşil
const FACADE = ['e4d9c6', 'dccdb1', 'd3c4a6', 'cdc8be', 'bbb2a4', 'ebe5d9', 'd9c293', 'd8ae98', 'c79279', 'dcc0b2', 'aeb6b6', 'bcc1b0',
  '9d9385', 'e3d4bc', 'cbbb9f', 'efe5d0', 'd6cdbf', 'c2b49c', 'e0cdb0', 'b7aa97'];
const FACADE_W = [5, 5, 4, 4, 3, 4, 2, 2, 1.2, 1.5, 0.8, 0.8, 1, 4, 3, 3, 3, 2, 3, 2];
const ROOF_FLAT = ['8f8b84', '74716c', 'a39f97', '5a5653', '9a9488', '82786c'];
const ROOF_TILE = ['9c4e36', 'a85b3d', '8a4632', '96553f', 'ad6748', '7f4a3a'];
const PLAIN = ['ddd6c8', 'c9c2b4', 'b2aa9c'];

function pick(r, arr, w) {
  if (!w) return arr[Math.floor(r() * arr.length) % arr.length];
  let t = 0; for (const x of w) t += x;
  let v = r() * t;
  for (let i = 0; i < arr.length; i++) { v -= w[i]; if (v <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz);
    if (l < 0.5) continue;
    const ux = dx / l, uz = dz / l;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const s of pts) {
      const a = s[0] * ux + s[1] * uz, b = -s[0] * uz + s[1] * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, ux, uz, a0, a1, b0, b1 };
  }
  if (!best) return null;
  const { ux, uz, a0, a1, b0, b1 } = best;
  const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
  return { area: best.area, cx: ca * ux - cb * uz, cz: ca * uz + cb * ux, ux, uz, ha: (a1 - a0) / 2, hb: (b1 - b0) / 2 };
}

function makeMaterial(U) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLightsOn = U.uLightsOn; sh.uniforms.uT = U.uT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 aWin; attribute vec4 aBld; attribute vec4 aExt;
varying vec4 vWin; varying vec4 vBld; varying vec4 vExt; varying float vNy;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWin = aWin; vBld = aBld; vExt = aExt; vNy = normal.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uLightsOn; uniform float uT;
varying vec4 vWin; varying vec4 vBld; varying vec4 vExt; varying float vNy;
${GLSL_HASH}
vec3 signCol(float h){
  if (h < 0.18) return vec3(0.85, 0.06, 0.05);
  if (h < 0.32) return vec3(0.05, 0.25, 0.85);
  if (h < 0.44) return vec3(0.95, 0.55, 0.05);
  if (h < 0.54) return vec3(0.06, 0.6, 0.2);
  if (h < 0.62) return vec3(0.8, 0.1, 0.5);
  if (h < 0.78) return vec3(0.95, 0.9, 0.8);
  return vec3(0.9, 0.75, 0.1);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float bGlass = 0.0; float bMetal = 0.0; vec3 bEmit = vec3(0.0);
{
  float cat = vBld.x;
  float seed = vWin.w;
  float yRel = vWin.z;
  vec3 fac = diffuseColor.rgb;
  float lightsGate = step(0.002, uLightsOn);
  bool wall = abs(vNy) < 0.5;
  if (wall && cat > 0.5 && cat < 4.5) {
    float L = vWin.y, u = vWin.x, top = vBld.w, fh = vBld.z, kB = vBld.y;
    float shop = vExt.x, gH = vExt.y, seg = vExt.z, lt = vExt.w;
    float r1 = cityH(seed, 1.0, 0.0), r2 = cityH(seed, 2.0, 0.0), r3 = cityH(seed, 3.0, 0.0), r4 = cityH(seed, 4.0, 0.0), r5 = cityH(seed, 5.0, 0.0);
    // kirlenme: zemine yakın koyu, dikey akıntı izleri
    fac *= mix(0.8, 1.0, smoothstep(0.0, 5.0, yRel));
    float streak = cityNoise(vec2(u * 0.9 + seg * 7.0, yRel * 0.04 + seed));
    fac *= mix(0.9, 1.04, streak);
    // sıva yamaları / eski boya lekeleri
    float pl = cityNoise(vec2(u * 0.33 + seed, yRel * 0.33));
    fac *= mix(1.0, mix(0.9, 1.07, cityH(seed, floor(pl * 3.0), 3.0)), smoothstep(0.62, 0.7, pl));
    if (cat > 2.5 && cat < 3.5) {
      // inşaat: açık katlar
      float fy = yRel / fh, fv = fract(fy), dv = fwidth(fy);
      float open = cityBox(fv, 0.14, 0.97, dv) * step(yRel, top - 0.5) * step(0.0, yRel);
      float colm = cityBox(fract(u / 5.0), 0.0, 0.08, fwidth(u / 5.0));
      fac = mix(vec3(0.42, 0.41, 0.39), vec3(0.03), open * (1.0 - colm));
    } else if (cat < 3.5) {
      bool office = cat > 1.5;
      float colW = office ? mix(1.4, 2.0, r1) : mix(2.5, 3.6, r1);
      float ww = office ? mix(0.68, 0.8, r2) : mix(0.36, 0.52, r2);
      float wh = office ? mix(0.5, 0.62, r3) : mix(0.38, 0.47, r3);
      float sill = office ? 0.14 : 0.30;
      float m = 0.55;
      float nCol = floor((L - 2.0 * m) / colW);
      float cellW = (L - 2.0 * m) / max(nCol, 1.0);
      float uc = (u - m) / cellW;
      float col = floor(uc), fu = fract(uc);
      float z0 = shop > 0.5 ? gH : 0.0;
      float upper = top - (office ? 1.2 : 0.8);
      float fy = (yRel - z0) / fh;
      float f = floor(fy), fv = fract(fy);
      float nF = floor((upper - z0) / fh + 0.25);
      vec2 dd = vec2(fwidth(uc), fwidth(fy));
      float far = smoothstep(0.12, 0.35, max(dd.x, dd.y));
      bool rowOK = f >= 0.0 && f < nF && yRel > z0;
      bool colOK = nCol >= 1.0 && col >= 0.0 && col < nCol;
      // kat çizgisi (döşeme alnı)
      if (yRel > z0 - 0.1 && yRel < upper + 0.3) {
        float slab = cityBox(fv, -0.03, office ? 0.10 : 0.06, dd.y) * (1.0 - far * 0.6);
        vec3 slabC = r4 > 0.55 ? fac * 1.12 : fac * 0.8;
        fac = mix(fac, slabC, slab * (office ? 0.9 : 0.75));
      }
      // parapet / saçak bandı
      fac = mix(fac, fac * 0.84, cityBox(yRel, top - 0.7, top - 0.45, fwidth(yRel)));
      // kat bazında boya farkı (sonradan boyanmış katlar)
      if (!office && r4 > 0.45 && yRel > z0) fac *= mix(0.93, 1.06, cityH(seed, f, 13.0));
      // parapet harpuştası (açık renkli üst kenar)
      fac = mix(fac, fac * 1.18 + 0.03, cityBox(yRel, top - 0.16, top + 0.1, fwidth(yRel)) * (1.0 - far));
      if (rowOK && colOK) {
        float hw = cityH(seed * 8.0 + seg, col, f);
        float blank = office ? 0.0 : step(cityH(seed, seg * 41.0 + col, 77.0), 0.10);
        bool balc = !office && cityH(seed, seg * 41.0 + col, 91.0) < r5 * 0.55 && f >= 0.0;
        float wlo = balc ? 0.04 : sill, whi = balc ? 0.80 : sill + wh;
        float wW = balc ? min(0.9, ww + 0.12) : ww;
        float a0 = 0.5 - wW * 0.5, a1 = 0.5 + wW * 0.5;
        float near = (1.0 - far) * (1.0 - blank);
        float wm = cityBox(fu, a0, a1, dd.x) * cityBox(fv, wlo, whi, dd.y);
        // söve (çerçeve taşı)
        float sv = r2 > 0.35 && !office ? 0.03 : 0.0;
        float fr = cityBox(fu, a0 - sv - 0.02, a1 + sv + 0.02, dd.x) * cityBox(fv, wlo - 0.015, whi + sv + 0.02, dd.y);
        fr = max(0.0, fr - wm);
        wm *= 1.0 - blank; fr *= 1.0 - blank;
        float avg = wW * (whi - wlo) * (1.0 - blank);
        wm = mix(wm, avg, far); fr = mix(fr, 0.0, far);
        float curtain = step(0.45, cityH(seed, col + seg * 50.0, f + 300.0));
        float shut = step(0.9, cityH(seed, col + seg * 50.0, f + 333.0));
        float cx = cityH(seed, col + seg * 50.0, f + 345.0); // perde açıklığı
        // pencere içi yerel koordinat
        float lu = clamp((fu - a0) / max(wW, 1e-3), 0.0, 1.0), lv = clamp((fv - wlo) / max(whi - wlo, 1e-3), 0.0, 1.0);
        float curtMask = curtain * (step(lu, 0.22 + cx * 0.3) + step(0.78 - (1.0 - cx) * 0.3, lu)) ;
        curtMask = clamp(curtMask, 0.0, 1.0);
        vec3 glassC = office ? mix(vec3(0.05, 0.07, 0.085), vec3(0.09, 0.11, 0.12), r5) : vec3(0.035, 0.04, 0.045);
        vec3 curtC = mix(vec3(0.62, 0.58, 0.5), vec3(0.75, 0.7, 0.62), cx);
        glassC = mix(glassC, curtC, curtMask * 0.85 * near);
        glassC = mix(glassC, fac * 0.65, shut * (office ? 0.0 : 1.0));
        // girinti gölgesi: üst ve sol yüzlük koyu
        float reveal = (1.0 - step(0.09, 1.0 - lv)) + (1.0 - step(0.06, lu));
        reveal = clamp(reveal, 0.0, 1.0) * near * (office ? 0.3 : 1.0);
        // kayıt (PVC) kasası: orta dikme + vasistas kayıtı
        float mull = (cityBox(lu, 0.49, 0.51, dd.x / max(wW, 1e-3)) + cityBox(lv, 0.69, 0.715, dd.y / max(whi - wlo, 1e-3))) * near * (office ? 0.0 : 1.0) * (balc ? 0.0 : 1.0);
        vec3 frameC = office ? fac * 0.7 : (r2 > 0.35 ? fac * 1.15 + 0.04 : vec3(0.74, 0.74, 0.72));
        fac = mix(fac, frameC, fr * 0.8);
        fac = mix(fac, glassC, wm);
        fac = mix(fac, vec3(0.7, 0.7, 0.68), clamp(mull, 0.0, 1.0) * wm);
        fac = mix(fac, fac * 0.35, reveal * wm);
        bGlass = wm * (1.0 - curtMask * 0.6) * (1.0 - shut) * (1.0 - reveal);
        bMetal = office ? 0.6 : 0.45;
        if (!balc && !office) {
          // denizlik (mermer) + altında gölge ve akıntı izi
          float sl = cityBox(fu, a0 - 0.05, a1 + 0.05, dd.x) * cityBox(fv, wlo - 0.045, wlo - 0.005, dd.y) * near;
          fac = mix(fac, vec3(0.62, 0.61, 0.58), sl);
          float sh = cityBox(fu, a0 - 0.04, a1 + 0.04, dd.x) * cityBox(fv, wlo - 0.08, wlo - 0.045, dd.y) * near;
          fac *= 1.0 - 0.35 * sh;
          float drip = cityBox(fu, a0, a1, dd.x) * smoothstep(wlo - 0.45, wlo - 0.08, fv) * step(fv, wlo - 0.08) * near;
          fac *= 1.0 - 0.1 * drip * cityH(seed, col, f + 400.0);
          // klima dış ünitesi
          if (cityH(seed, col + seg * 50.0, f + 500.0) < 0.2) {
            float ax0 = a1 + 0.06, ax1 = a1 + 0.06 + 0.24;
            float ac = cityBox(fu, ax0, ax1, dd.x) * cityBox(fv, wlo - 0.02, wlo + 0.2, dd.y) * near;
            float gr = cityBox(fract((fu - ax0) / 0.024), 0.0, 0.4, dd.x / 0.024) * cityBox(fu, ax0 + 0.08, ax1 - 0.02, dd.x);
            vec3 acC = mix(vec3(0.62, 0.62, 0.6), vec3(0.2), gr * 0.6);
            fac = mix(fac, acC, ac);
            float acs = cityBox(fu, ax0 + 0.01, ax1 + 0.01, dd.x) * cityBox(fv, wlo - 0.07, wlo - 0.02, dd.y) * near;
            fac *= 1.0 - 0.4 * acs;
          }
        }
        // balkon: çıkma döşeme + altındaki gölge + korkuluk
        if (balc) {
          float slabB = cityBox(fu, 0.02, 0.98, dd.x) * cityBox(fv, -0.01, 0.06, dd.y) * near;
          fac = mix(fac, fac * 1.15 + 0.03, slabB);
          if (f < nF - 1.0) fac *= 1.0 - 0.4 * cityBox(fu, 0.02, 0.98, dd.x) * cityBox(fv, 0.86, 1.0, dd.y) * near;
          float rail = cityBox(fu, 0.03, 0.97, dd.x) * cityBox(fv, 0.06, 0.36, dd.y) * near;
          float bars = r3 > 0.5 ? 1.0 : cityBox(fract(fu * 22.0), 0.0, 0.35, dd.x * 22.0);
          vec3 railC = r3 > 0.5 ? fac * 0.85 + vec3(0.02) : vec3(0.06, 0.06, 0.065);
          fac = mix(fac, railC, rail * mix(0.95, 0.9, bars) * (r3 > 0.5 ? 1.0 : 0.6 + 0.4 * bars));
          bGlass *= 1.0 - rail;
          wm *= 1.0 - rail * 0.75;
        }
        // gece: seyrek, sıcak ağırlıklı, değişken parlaklık
        float dark = step(0.86, kB) * 0.45;
        float k = lt > 0.5 && lt < 1.5
          ? (0.06 + kB * 0.25 + cityH(seed, f, 707.0) * 0.8 + hw * 0.12)
          : (0.16 + kB * 0.55 + hw * 0.78 + dark);
        float on = smoothstep(k, k + 0.012, uLightsOn) * lightsGate;
        float tone = cityH(seed, col + seg * 50.0, f + 600.0);
        vec3 lc;
        float flick = 1.0;
        if (lt > 0.5 && lt < 1.5) lc = mix(vec3(0.8, 0.88, 1.0), vec3(1.0, 0.92, 0.78), cityH(seed, f, 708.0));
        else if (tone < 0.62) lc = mix(vec3(1.0, 0.42, 0.11), vec3(1.0, 0.6, 0.25), tone / 0.62);
        else if (tone < 0.8) lc = vec3(1.0, 0.8, 0.56);
        else if (tone < 0.93) lc = vec3(0.8, 0.88, 1.0);
        else { lc = vec3(0.3, 0.45, 1.0); flick = 0.55 + 0.45 * sin(uT * (5.0 + tone * 9.0) + hw * 40.0) * sin(uT * 2.3 + tone * 17.0); }
        float I = mix(0.8, lt > 0.5 && lt < 1.5 ? 2.0 : 2.6, pow(cityH(seed, col + seg * 50.0, f + 900.0), 1.5)) * (1.0 - shut * 0.9) * flick;
        float curtGlow = mix(1.0, 0.45, curtMask);
        vec3 lcc = mix(lc, lc * vec3(1.0, 0.8, 0.55), curtMask * 0.6);
        float inside = mix(0.7, 1.15, lv) * (1.0 - reveal * 0.6);
        bEmit += lcc * I * curtGlow * on * wm * inside;
      }
      // reklam panosu (yan/kör cephelerde): pencereleri örter, gece aydınlık
      float bbOn = step(cityH(seed, seg, 81.0), 0.08) * step(9.0, L) * step(13.0, top) * (office ? 0.0 : 1.0);
      if (bbOn > 0.5) {
        float bu0 = L * 0.12, bu1 = L * 0.88, by0 = max(z0 + 2.0, top * 0.42), by1 = top - 1.6;
        float bb = cityBox(u, bu0, bu1, fwidth(u)) * cityBox(yRel, by0, by1, fwidth(yRel));
        float fr2 = cityBox(u, bu0 - 0.25, bu1 + 0.25, fwidth(u)) * cityBox(yRel, by0 - 0.25, by1 + 0.25, fwidth(yRel)) - bb;
        float bx = (u - bu0) / max(bu1 - bu0, 1.0), byy = (yRel - by0) / max(by1 - by0, 1.0);
        vec3 adA = signCol(cityH(seed, seg, 82.0)), adB = signCol(cityH(seed, seg, 83.0));
        vec3 ad = mix(adA * 0.7, adB * 0.6 + 0.05, step(0.55, bx + 0.25 * sin(byy * 3.0 + seed)));
        float txt = cityBox(byy, 0.12, 0.3, fwidth(byy)) * step(0.3, cityH(floor(bx * 14.0), seg, 84.0)) * cityBox(bx, 0.06, 0.6, fwidth(bx));
        ad = mix(ad, vec3(0.9), txt);
        fac = mix(fac, vec3(0.12), max(fr2, 0.0));
        fac = mix(fac, ad, bb);
        bGlass *= 1.0 - bb; bEmit *= 1.0 - bb;
        bEmit += ad * 1.6 * bb * smoothstep(0.05, 0.3, uLightsOn);
      }
      // zemin kat dükkânları
      if (shop > 0.5 && yRel < gH && yRel > -0.5 && L > 3.0) {
        float su = u / 5.5, unit = floor(su), sf = fract(su);
        float sdx = fwidth(su), sdy = fwidth(yRel);
        float sfar = smoothstep(0.25, 0.6, sdx);
        float gl = cityBox(sf, 0.06, 0.94, sdx) * cityBox(yRel, 0.2, gH * 0.64, sdy);
        float mull = cityBox(fract(sf * 3.0), 0.0, 0.05, sdx * 3.0) * (1.0 - sfar);
        gl *= 1.0 - mull;
        float hs = cityH(seed, unit, seg + 17.0);
        float sg = cityBox(sf, 0.03, 0.97, sdx) * cityBox(yRel, gH * 0.7, gH * 0.94, sdy) * step(0.2, hs);
        vec3 sc = signCol(cityH(seed, unit, seg + 29.0));
        // tabela yazısı izlenimi (harf blokları) ve tente
        float lx = fract(u / 0.42), lid = floor(u / 0.42);
        float letters = cityBox(lx, 0.12, 0.82, sdx * 5.5 / 0.42) * cityBox(yRel, gH * 0.75, gH * 0.89, sdy)
          * step(0.25, cityH(seed, lid, unit + 61.0)) * cityBox(sf, 0.12, 0.88, sdx) * (1.0 - sfar);
        float hasAw = step(0.45, cityH(seed, unit, seg + 37.0));
        float aw = cityBox(yRel, gH * 0.6, gH * 0.69, sdy) * cityBox(sf, 0.05, 0.95, sdx) * hasAw;
        float stripe = step(0.5, fract(u / 0.55));
        vec3 awC = mix(signCol(cityH(seed, unit, seg + 41.0)) * 0.6 + 0.03, vec3(0.75, 0.73, 0.68), stripe * step(0.4, cityH(seed, unit, seg + 43.0)));
        float awSh = cityBox(yRel, gH * 0.46, gH * 0.6, sdy) * cityBox(sf, 0.05, 0.95, sdx) * hasAw;
        fac = mix(fac, vec3(0.025, 0.028, 0.03), gl);
        fac = mix(fac, sc * 0.55 + 0.05, sg);
        fac = mix(fac, vec3(0.92, 0.9, 0.86) * (sc.r + sc.g + sc.b > 2.2 ? 0.1 : 1.0), letters * sg);
        fac = mix(fac, awC, aw);
        fac *= 1.0 - 0.45 * awSh;
        bGlass = max(bGlass, gl * (1.0 - awSh * 0.5));
        float kS = kB * 0.2 + cityH(seed, unit, seg + 5.0) * 0.25;
        float onS = smoothstep(kS, kS + 0.015, uLightsOn) * lightsGate;
        float kG = kB * 0.2 + cityH(seed, unit, seg + 6.0) * 0.4;
        float onG = smoothstep(kG, kG + 0.015, uLightsOn) * lightsGate * step(0.12, cityH(seed, unit, seg + 8.0));
        bEmit += gl * vec3(1.0, 0.78, 0.5) * 2.2 * onG + sg * (sc * 2.2 + letters * vec3(1.0) * 2.5) * onS + aw * awC * 0.6 * onG;
      }
    }
    if (lt > 1.5) bEmit += fac * 0.55 * smoothstep(0.1, 0.4, uLightsOn) * (1.0 - 0.6 * smoothstep(0.0, top + 2.0, yRel));
  }
  diffuseColor.rgb = fac;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.08, bGlass);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, bMetal, bGlass);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += bEmit;`);
  };
  m.customProgramCacheKey = () => 'city-bld-v3';
  return m;
}

/**
 * @returns {{ mesh, footprints: Array<{pts, top, flat, roofY, seed, cat, area, cx, cz, id, kind}>, dispose }}
 */
export function buildBuildings(ctx, U, nearShopRoad, listOverride, seedBase = 1) {
  const list = listOverride || ctx.data.buildings?.buildings || [];
  const B = new Builder({ aWin: 4, aBld: 4, aExt: 4 });
  const footprints = [];
  let seedN = seedBase;
  for (const b of list) {
    if (!b || b.landmark || !Array.isArray(b.footprint)) continue;
    let outer = cleanRing(b.footprint);
    if (outer.length < 3) continue;
    let area = signedArea(outer);
    if (Math.abs(area) < 4) continue;
    if (area < 0) { outer = outer.reverse(); area = -area; }
    const holes = (b.holes || []).map(cleanRing).filter((h) => h.length >= 3).map((h) => (signedArea(h) > 0 ? h.reverse() : h));
    const r = ctx.rng('city/b/' + b.id);
    const seed = (seedN++ * 37 + Math.floor(r() * 997)) % 30000;
    const baseY = Number.isFinite(b.baseY) ? b.baseY : ctx.heightAt(outer[0][0], outer[0][1]);
    const H = Math.max(2.5, b.height || 10);
    const minH = b.minHeight || 0;
    const kind = String(b.kind || '');
    let cx = 0, cz = 0; for (const p of outer) { cx += p[0]; cz += p[1]; } cx /= outer.length; cz /= outer.length;
    // kategori
    let cat = 1, lt = 0;
    if (/mosque|church|synagogue/.test(kind)) { cat = 4; lt = 2; }
    else if (/garage|roof|parking|shed|kiosk/.test(kind) || H < 3.6 || area < 16) cat = 4;
    else if (kind === 'construction') cat = 3;
    else if ((/office|commercial|hotel|hospital|university|retail/.test(kind) && H >= 24) || H >= 48) { cat = 2; lt = 1; }
    else if (/office|commercial|hotel|hospital|university|school|public|civic|retail/.test(kind)) lt = 1;
    const kB = lt === 1 ? r() * 0.55 : r();
    const levels = b.levels && b.levels > 0 ? b.levels : Math.max(1, Math.round((H - 0.6) / 3.1));
    let fh = cat === 2 ? Math.min(4.2, Math.max(3.3, (H - 1.2) / levels)) : Math.min(4.0, Math.max(2.8, (H - 0.6) / levels));
    let shop = 0, gH = 0;
    if (cat <= 2 && minH < 0.5 && H > 6) {
      const near = nearShopRoad(outer);
      if (near && r() < near) { shop = 1; gH = Math.max(fh, 4.2); }
    }
    // renkler
    let fc;
    if (cat === 4) fc = lin(pick(r, lt === 2 ? ['ece6d8', 'e2dccd'] : PLAIN));
    else if (cat === 2) fc = lin(pick(r, ['8c959b', 'a3a9aa', '7f8a91', 'b8b4aa', '9aa09c']));
    else if (cat === 3) fc = lin('9a9890');
    else fc = lin(pick(r, FACADE, FACADE_W), 0.92 + r() * 0.14);
    if (cat === 1) { const hj = (r() - 0.5) * 0.06; fc = [fc[0] * (1 + hj), fc[1], fc[2] * (1 - hj)]; }
    // çatı tipi
    let hip = null;
    if (cat === 1 && H < 30 && area < 900 && area > 50 && r() < 0.42) {
      const o = obb(outer);
      if (o && area / o.area > 0.8) hip = o;
    }
    const flat = !hip;
    const parapet = flat && H > 6 && cat !== 4 ? 0.8 : 0;
    const top = baseY + H;
    const wallTop = hip ? top - 0.6 : top;
    const roofY = hip ? wallTop : top - parapet;
    const y0 = minH > 0.5 ? baseY + minH : baseY - 2;
    const roofCol = hip ? lin(pick(r, ROOF_TILE), 0.85 + r() * 0.25) : lin(pick(r, ROOF_FLAT), 0.85 + r() * 0.25);
    const bld = [cat, kB, fh, H];
    const ext = (seg) => [shop, gH, seg, lt];
    // duvarlar (dış + delikler)
    let segIdx = 0;
    for (const ring of [outer, ...holes]) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz);
        if (L < 0.05) continue;
        const nx = dz / L, nz = -dx / L;
        const sIdx = segIdx++;
        B.wall(p[0], p[1], q[0], q[1], y0, wallTop, y0, wallTop, nx, nz, fc,
          (t, y) => ({ aWin: [t * L, L, y - baseY, seed], aBld: bld, aExt: ext(sIdx) }));
        if (parapet) {
          B.wall(q[0], q[1], p[0], p[1], roofY, top, roofY, top, -nx, -nz, fc,
            (t, y) => ({ aWin: [0, 0, y - baseY, seed], aBld: [0, kB, fh, H], aExt: [0, 0, 0, 0] }));
        }
      }
    }
    const rex = { aWin: [0, 0, 0, seed], aBld: [5, kB, fh, H], aExt: [0, 0, 0, 0] };
    if (flat) {
      const v2 = outer.map((p) => new THREE.Vector2(p[0], p[1]));
      const h2 = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
      let tris = [];
      try { tris = THREE.ShapeUtils.triangulateShape(v2, h2); } catch { tris = []; }
      const all = [outer, ...holes].flat();
      const ids = all.map((p) => B.v(p[0], roofY, p[1], 0, 1, 0, roofCol, rex));
      for (const t of tris) B.tri(ids[t[0]], ids[t[1]], ids[t[2]], 0, 1, 0);
      if (minH > 0.5) {
        const bids = all.map((p) => B.v(p[0], y0, p[1], 0, -1, 0, fc, rex));
        for (const t of tris) B.tri(bids[t[0]], bids[t[1]], bids[t[2]], 0, -1, 0);
      }
    } else {
      // kırma (hip) kiremit çatı, OBB üzerinde, 0.35 m saçak
      const o = hip;
      let ax = o.ux, az = o.uz, A = o.ha, Bh = o.hb;
      if (Bh > A) { [A, Bh] = [Bh, A]; [ax, az] = [-o.uz, o.ux]; }
      const bx = -az, bz = ax;
      const ea = A + 0.4, eb = Bh + 0.4;
      const pitch = Math.tan((24 + r() * 10) * Math.PI / 180);
      const rh = Bh * pitch;
      const ry = wallTop + rh;
      const C = (u, v) => [o.cx + ax * u + bx * v, o.cz + az * u + bz * v];
      const P1 = C(-ea, -eb), P2 = C(ea, -eb), P3 = C(ea, eb), P4 = C(-ea, eb);
      const R1 = C(-(A - Bh), 0), R2 = C(A - Bh, 0);
      const ey = wallTop - 0.15;
      const face = (pts) => {
        // pts: [[x,y,z],...]
        const [a, b2, c] = pts;
        const ux = b2[0] - a[0], uy = b2[1] - a[1], uz = b2[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const ids = pts.map((p) => B.v(p[0], p[1], p[2], nx, ny, nz, roofCol, rex));
        if (ids.length === 3) B.tri(ids[0], ids[1], ids[2], nx, ny, nz); else B.quad(ids[0], ids[1], ids[2], ids[3], nx, ny, nz);
      };
      face([[P1[0], ey, P1[1]], [P2[0], ey, P2[1]], [R2[0], ry, R2[1]], [R1[0], ry, R1[1]]]);
      face([[P3[0], ey, P3[1]], [P4[0], ey, P4[1]], [R1[0], ry, R1[1]], [R2[0], ry, R2[1]]]);
      face([[P4[0], ey, P4[1]], [P1[0], ey, P1[1]], [R1[0], ry, R1[1]]]);
      face([[P2[0], ey, P2[1]], [P3[0], ey, P3[1]], [R2[0], ry, R2[1]]]);
      // saçak altı (aşağı bakan) — alt kapak
      const s = [P1, P2, P3, P4].map((p) => B.v(p[0], ey, p[1], 0, -1, 0, [roofCol[0] * 0.5, roofCol[1] * 0.5, roofCol[2] * 0.5], rex));
      B.quad(s[0], s[1], s[2], s[3], 0, -1, 0);
    }
    footprints.push({ id: b.id, pts: outer, holes, top, roofY, flat, parapet, seed, cat, lt, area, cx, cz, kind, H, baseY, r, fc, shop });
  }
  const geo = B.geometry();
  const mesh = new THREE.Mesh(geo, makeMaterial(U));
  mesh.name = 'city-buildings'; mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, footprints, dispose() { geo.dispose(); mesh.material.dispose(); } };
}

/** Bina izleri ızgarası: nokta bir binanın içinde mi? */
export function footprintTester(footprints, Grid) {
  const g = new Grid(30);
  for (const f of footprints) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of f.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    f.bbox = [x0, z0, x1, z1];
    g.addBox(x0, z0, x1, z1, f);
  }
  return (x, z, pad = 0) => {
    let hit = null;
    g.query(x, z, pad + 1, (f) => {
      const b = f.bbox;
      if (x < b[0] - pad || x > b[2] + pad || z < b[1] - pad || z > b[3] + pad) return;
      if (pip(x, z, f.pts) || (pad > 0 && (pip(x + pad, z, f.pts) || pip(x - pad, z, f.pts) || pip(x, z + pad, f.pts) || pip(x, z - pad, f.pts)))) { hit = f; return false; }
    });
    return hit;
  };
}
