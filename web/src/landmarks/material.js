// Cephe malzemesi: MeshStandardMaterial + onBeforeCompile. Desen (kat/panel derzleri,
// spandrel bantları, panel düzensizliği), tek tek yanan pencereler (CONTRACT §5 eşik θ, uLit)
// ve alçak güneşin camdaki parıltısı parça gölgelendiricide üretilir.
// Gök yansıması atmosferin scene.environment'ından gelir; yoksa analitik gök yedeği devreye girer.
//
// Köşe verisi (geometry.js):
//   color  : taban rengi (doğrusal)
//   aFac   : (u = duvar boyunca m, v = cephe tabanından m, topD = üst kenara m, tohum)
//   aTan   : duvarın yatay teğeti (dünya)
//   aSty   : (tip, katYüksekliği, panelGenişliği, yananOran)   tip: 0 mat · 1 ofis camı ·
//            2 konut camı · 3 AVM cephesi · 4 cam çatı · 5 ışıklı katı (aSty.y = θ, aSty.w = şiddet)
//   aSty2  : (spandrelOranı, dikmeGücü, taçYüksekliği, derzKatAralığı)
//   aSty3  : (spandrelAçıklığı, ışıkSıcaklığı 0 soğuk…1 sıcak, taçIşıkŞiddeti, taçSıcaklığı)

const VERT_PARS = /* glsl */ `
attribute vec4 aFac;
attribute vec3 aTan;
attribute vec4 aSty;
attribute vec4 aSty2;
attribute vec4 aSty3;
varying vec4 vFac;
varying vec3 vTanV;
varying vec4 vSty;
varying vec4 vSty2;
varying vec4 vSty3;
varying vec3 vLmW;
`;

const VERT_MAIN = /* glsl */ `
vFac = aFac; vSty = aSty; vSty2 = aSty2; vSty3 = aSty3;
vTanV = normalize(mat3(viewMatrix) * mat3(modelMatrix) * aTan);
vLmW = (modelMatrix * vec4(position, 1.0)).xyz;
`;

const FRAG_PARS = /* glsl */ `
varying vec4 vFac;
varying vec3 vTanV;
varying vec4 vSty;
varying vec4 vSty2;
varying vec4 vSty3;
varying vec3 vLmW;
uniform float uLit;
uniform float uNight;
uniform vec3 uLmSun;
uniform vec3 uLmGlow;
uniform float uLmCore;
uniform vec3 uLmZen;
uniform vec3 uLmHor;
uniform float uLmEnvFallback;
float lmHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float lmLine(float d, float w, float fw) {
  // d: çizgi merkezine uzaklık, w: yarı genişlik; piksel altına inince kapsama oranına söner
  return (1.0 - smoothstep(w - fw, w + fw, d)) * clamp(2.5 * w / max(fw, 1e-5), 0.0, 1.0);
}
float lmOn(float th) { return smoothstep(th, th + 0.035, uLit); }
`;

const FRAG_COLOR = /* glsl */ `
float lmType = vSty.x;
float lmSeed = vFac.w;
float lmRough = 0.85;
float lmMetal = 0.0;
float lmGlass = 0.0;
vec3 lmTint = vec3(0.5);
vec2 lmJit = vec2(0.0);
vec3 lmEmis = vec3(0.0);
float lmNightAmp = mix(0.55, 1.0, uNight);
if (lmType < 0.5) {
  // mat katı: çatı, beton, metal
  float g = lmHash(vec3(floor(vLmW.x * 0.35), floor(vLmW.z * 0.35), 3.0));
  diffuseColor.rgb *= 0.92 + 0.16 * g;
} else if (lmType < 2.5) {
  // ---- cam giydirme cephe (1 ofis, 2 konut) ----
  float floorH = vSty.y, panelW = vSty.z, litFrac = vSty.w;
  float fl = vFac.y / floorH; float fi = floor(fl); float ff = fl - fi;
  float pu = vFac.x / panelW; float pi = floor(pu); float pf = pu - pi;
  float fwV = fwidth(fl), fwU = fwidth(pu);
  float h1 = lmHash(vec3(pi, fi, lmSeed));
  float h2 = lmHash(vec3(pi + 17.0, fi + 3.0, lmSeed + 1.7));
  float hf = lmHash(vec3(fi, 5.0, lmSeed + 9.1));
  float detail = clamp(1.6 - 1.2 * max(fwU, fwV), 0.0, 1.0);
  float spF = vSty2.x;
  float sp = (1.0 - smoothstep(spF - fwV, spF + fwV, ff)) * step(0.001, spF);
  float mw = 0.04 * vSty2.y / panelW;
  float mul = lmLine(min(pf, 1.0 - pf), mw, fwU);
  float jointN = vSty2.w;
  float joint = (jointN > 0.5 && mod(fi + 1.5, jointN) < 1.0) ? 1.0 : 0.0;
  float crownH = vSty2.z;
  float crown = crownH > 0.0 ? 1.0 - smoothstep(crownH - 0.25, crownH + 0.25, vFac.z) : 0.0;
  float base = 1.0 - smoothstep(0.0, 0.4, vFac.y); // (taban hattı)

  vec3 glassCol = diffuseColor.rgb * (0.86 + 0.28 * h1 * detail) * (0.94 + 0.12 * hf);
  vec3 spCol = mix(diffuseColor.rgb * 0.45, vec3(0.62, 0.65, 0.68), vSty3.x);
  vec3 col = mix(glassCol, spCol, sp);
  col = mix(col, vec3(0.30, 0.31, 0.33), mul * 0.85);
  col = mix(col, vec3(0.035, 0.04, 0.045), joint);
  float louver = 0.5 + 0.5 * sin(vFac.y * 9.0);
  col = mix(col, mix(vec3(0.42, 0.44, 0.47), vec3(0.58, 0.6, 0.63), louver), crown);
  diffuseColor.rgb = col;
  lmTint = glassCol;

  float glassAmt = (1.0 - sp) * (1.0 - mul) * (1.0 - joint) * (1.0 - crown);
  lmRough = mix(0.42, 0.045 + 0.09 * h2, glassAmt);
  lmRough = mix(lmRough, 0.55, max(joint, crown));
  lmMetal = mix(0.35, 0.9, glassAmt);
  lmGlass = glassAmt * 0.9 + sp * 0.12;
  // panel düzensizliği: her cam hafifçe farklı yöne bakar + geniş dalga ("oil-canning")
  lmJit = (vec2(h1, h2) - 0.5) * 0.045 * detail * glassAmt
        + vec2(sin(vFac.x * 0.21 + fi * 1.3 + lmSeed), sin(vFac.y * 0.17 + pi * 0.7)) * 0.008;

  // ---- pencereler: θ eşiğiyle tek tek ----
  float on; float th; vec3 lc; float inten;
  float warm = vSty3.y;
  if (lmType < 1.5) {
    // ofis: kat kat, kat içinde bölge bölge
    float zw = 4.0 + floor(8.0 * lmHash(vec3(fi, 7.0, lmSeed)));
    float hfc = lmHash(vec3(fi, 13.0, lmSeed));
    float colm = mod(pi + 0.5, 6.0) < 1.0 ? 0.12 : 1.0; // taşıyıcı kolon aksı
    float zone = floor((pu + 40.0 * hf) / zw);
    float hz = lmHash(vec3(zone, fi, lmSeed + 5.3));
    float hz2 = lmHash(vec3(zone, fi, lmSeed + 6.9));
    float floorOn = step(hf, litFrac + 0.12);
    on = floorOn * step(hz, 0.82) + (1.0 - floorOn) * step(hz, 0.10);
    th = 0.05 + 0.9 * fract(0.62 * lmHash(vec3(fi, 11.0, lmSeed)) + 0.38 * hz2);
    lc = mix(vec3(0.84, 0.92, 1.0), vec3(1.0, 0.82, 0.56), clamp(warm + (hfc - 0.5) * 0.9 + (hz2 - 0.5) * 0.3, 0.0, 1.0));
    // tavan armatür şeritleri: üstte parlak, altta mobilya karanlığı
    inten = (0.42 + 0.4 * hz) * mix(0.3, 1.0, smoothstep(0.3, 0.95, ff)) * (0.5 + 0.65 * h1) * colm;
  } else {
    // konut: iki panellik pencere grupları, sıcak; bir kısmı perdeli/loş
    float cell = floor(pu * 0.5);
    float hc = lmHash(vec3(cell, fi, lmSeed + 5.3));
    float hc2 = lmHash(vec3(cell, fi, lmSeed + 8.1));
    on = step(hc, litFrac);
    th = 0.04 + 0.92 * hc2;
    float tv = step(0.93, hc2 + hc * 0.1);
    lc = mix(mix(vec3(1.0, 0.9, 0.74), vec3(1.0, 0.66, 0.34), clamp(warm * (0.55 + 0.9 * hc2), 0.0, 1.0)), vec3(0.55, 0.7, 1.0), tv);
    inten = (0.35 + 0.95 * fract(hc * 7.31)) * mix(0.6, 1.0, ff) * (0.85 + 0.3 * h1);
  }
  float a = on * lmOn(th) * glassAmt;
  lmEmis += lc * inten * a * 1.05 * lmNightAmp;
  lmGlass *= 1.0 - 0.6 * a;
  // taç: mekanik kat / tepe LED hattı
  float cw = vSty3.w;
  vec3 cc = mix(vec3(0.75, 0.88, 1.0), vec3(1.0, 0.82, 0.58), cw);
  lmEmis += cc * crown * vSty3.z * lmOn(0.34) * (0.55 + 0.45 * louver) * lmNightAmp;
  // taban hattı çok hafif koyulaşır
  diffuseColor.rgb *= 1.0 - 0.3 * base;
} else if (lmType < 3.5) {
  // ---- AVM / podyum cephesi ----
  float floorH = vSty.y, bayW = vSty.z, litFrac = vSty.w;
  float v = vFac.y;
  float bay = vFac.x / bayW; float bi = floor(bay); float bf = bay - bi;
  float fwB = fwidth(bay), fwV = fwidth(v);
  float hb = lmHash(vec3(bi, 1.0, lmSeed));
  float hb2 = lmHash(vec3(bi, 2.0, lmSeed));
  float pier = lmLine(min(bf, 1.0 - bf), 0.07, fwB);
  vec3 clad = diffuseColor.rgb;
  float glassK = vSty2.x; // üst katlardaki cam oranı (0 taş, 1 cam ağırlıklı)
  if (v < 4.5) {
    // vitrin: gündüz koyu cam, gece sıcak zemin kat
    float g = smoothstep(0.3, 0.5, v) * (1.0 - smoothstep(4.2, 4.5, v)) * (1.0 - pier);
    float sub = lmLine(abs(fract(bay * 3.0) - 0.5), 0.02, fwB * 3.0);
    g *= 1.0 - 0.6 * sub;
    diffuseColor.rgb = mix(clad * 0.7, vec3(0.045, 0.05, 0.058), g);
    lmRough = mix(0.8, 0.09, g); lmMetal = mix(0.0, 0.8, g); lmGlass = g * 0.55;
    float on = step(hb, 0.9) * lmOn(0.02 + 0.28 * hb2);
    vec3 lc = mix(vec3(1.0, 0.70, 0.38), vec3(1.0, 0.9, 0.74), hb);
    lmEmis += g * on * lc * (0.9 + 1.1 * hb2) * mix(1.0, 0.55, smoothstep(0.5, 4.2, v)) * 1.5 * lmNightAmp;
    lmGlass *= 1.0 - 0.7 * on;
  } else if (v < 6.4) {
    // alın bandı: mağaza tabelaları
    float sgn = step(hb2, 0.55) * step(0.1, bf) * step(bf, 0.9) * smoothstep(4.75, 4.85, v) * (1.0 - smoothstep(6.0, 6.1, v));
    vec3 sc = hb < 0.25 ? vec3(1.0, 0.13, 0.08) : hb < 0.5 ? vec3(1.0, 0.94, 0.82) : hb < 0.75 ? vec3(0.16, 0.45, 1.0) : vec3(1.0, 0.7, 0.1);
    diffuseColor.rgb = mix(clad * 0.62, sc * 0.55, sgn);
    lmRough = 0.6;
    lmEmis += sgn * sc * 1.9 * lmOn(0.03 + 0.4 * hb) * lmNightAmp;
  } else {
    float fl = (v - 6.4) / floorH; float fi = floor(fl); float ff = fl - fi;
    float fwF = fwidth(fl);
    float hfl = lmHash(vec3(fi, 3.0, lmSeed));
    float jh = lmLine(min(ff, 1.0 - ff), 0.012, fwF);
    float jv = lmLine(abs(fract(bay * 2.0) - 0.5), 0.012, fwB * 2.0);
    float hp = lmHash(vec3(floor(bay * 2.0), fi, lmSeed + 2.0));
    vec3 c = clad * (0.9 + 0.2 * hp);
    c *= 1.0 - 0.45 * max(jh, jv);
    // şerit pencere / cam bant
    float band = smoothstep(0.26, 0.3, ff) * (1.0 - smoothstep(0.74, 0.78, ff)) * step(hfl, 0.35 + 0.65 * glassK) * (1.0 - pier * 0.8);
    float seg = step(lmHash(vec3(floor(bay * 0.5), fi, lmSeed + 4.0)), 0.55 + 0.45 * glassK);
    band *= seg;
    diffuseColor.rgb = mix(c, vec3(0.06, 0.075, 0.09), band);
    lmRough = mix(0.72, 0.08, band); lmMetal = mix(0.05, 0.85, band); lmGlass = band * 0.8;
    lmJit = (vec2(hp, hfl) - 0.5) * 0.03 * band;
    float hw = lmHash(vec3(bi, fi, lmSeed + 6.0));
    float on = step(hw, litFrac) * lmOn(0.05 + 0.85 * lmHash(vec3(bi, fi, lmSeed + 7.0)));
    lmEmis += band * on * mix(vec3(1.0, 0.74, 0.44), vec3(1.0, 0.92, 0.8), hw / max(litFrac, 0.01)) * (0.5 + 0.7 * hp) * lmNightAmp;
    lmGlass *= 1.0 - 0.6 * on * band;
    // parapet altı ışık çizgisi (sıcak cephe yıkaması)
    float wash = smoothstep(2.6, 0.0, vFac.z) * step(0.0, vFac.z);
    lmEmis += vec3(1.0, 0.72, 0.42) * wash * vSty2.z * lmOn(0.18) * (1.0 - band) * lmNightAmp;
  }
} else if (lmType < 4.5) {
  // ---- cam çatı / tonoz ----
  float pw = vSty.z;
  vec2 gq = vFac.xy / pw; vec2 gi = floor(gq); vec2 gf = gq - gi;
  vec2 fwG = fwidth(gq);
  float ln = max(lmLine(min(gf.x, 1.0 - gf.x), 0.05, fwG.x), lmLine(min(gf.y, 1.0 - gf.y), 0.05, fwG.y));
  float hg = lmHash(vec3(gi, lmSeed));
  diffuseColor.rgb = mix(diffuseColor.rgb * (0.85 + 0.3 * hg), vec3(0.5, 0.52, 0.55), ln);
  lmRough = mix(0.16 + 0.1 * hg, 0.5, ln); lmMetal = mix(0.88, 0.4, ln);
  lmGlass = (1.0 - ln);
  lmTint = diffuseColor.rgb;
  lmJit = (vec2(hg, fract(hg * 13.7)) - 0.5) * 0.05 * (1.0 - ln);
  float on = lmOn(0.12 + 0.2 * hg);
  lmEmis += vec3(1.0, 0.74, 0.44) * (1.0 - ln) * on * vSty.w * (0.5 + 0.6 * hg) * lmNightAmp;
  lmGlass *= 1.0 - 0.5 * on;
} else {
  // ---- ışıklı katı (totem, şerit) ----
  lmEmis += diffuseColor.rgb * vSty.w * lmOn(vSty.y) * lmNightAmp;
  diffuseColor.rgb *= 0.45;
  lmRough = 0.5;
}
`;

const FRAG_NORMAL = /* glsl */ `
{
  vec3 lmUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  normal = normalize(normal + vTanV * lmJit.x + lmUpV * lmJit.y);
}
`;

const FRAG_EMISSIVE = /* glsl */ `
{
  vec3 lmV = normalize(cameraPosition - vLmW);
  vec3 lmN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 lmR = reflect(-lmV, lmN);
  float lmF = pow(1.0 - clamp(dot(lmV, lmN), 0.0, 1.0), 5.0);
  float sd = max(dot(lmR, uLmSun), 0.0);
  // alçak güneş: dar çekirdek + geniş hale → cephe boyunca kayan, panel panel kırılan parıltı
  vec3 glow = uLmGlow * (pow(sd, 140.0) * 2.5 * uLmCore + pow(sd, 18.0) * 0.42 * mix(0.3, 1.0, uLmCore) + pow(sd, 4.0) * 0.10);
  vec3 sky = mix(uLmHor, uLmZen, smoothstep(0.0, 0.55, lmR.y));
  sky = mix(sky, uLmHor * 0.28 + vec3(0.012), smoothstep(0.0, -0.25, lmR.y));
  lmEmis += lmGlass * (glow + sky * uLmEnvFallback * mix(lmTint, vec3(1.0), lmF));
  totalEmissiveRadiance += lmEmis;
}
`;

export function makeFacadeMaterial(ctx) {
  const { THREE, uniforms } = ctx;
  const u = {
    uLit: uniforms.uLit,
    uNight: uniforms.uNight,
    uLmSun: { value: new THREE.Vector3(0, 1, 0) },
    uLmGlow: { value: new THREE.Color(0, 0, 0) },
    uLmCore: { value: 1 },
    uLmZen: { value: new THREE.Color(0, 0, 0) },
    uLmHor: { value: new THREE.Color(0, 0, 0) },
    uLmEnvFallback: { value: 1 },
  };
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.0,
    envMapIntensity: 1.0,
  });
  material.name = 'landmarks-facade';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = lmRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = lmMetal;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_EMISSIVE}`);
  };
  material.customProgramCacheKey = () => 'landmarks-facade-v1';

  const C = (r, g, b) => new THREE.Color(r, g, b);
  const ZD = C(0.2, 0.4, 0.82), HD = C(0.62, 0.76, 0.95);
  const ZS = C(0.16, 0.2, 0.42), HS = C(1.0, 0.5, 0.2);
  const ZN = C(0.006, 0.01, 0.026), HN = C(0.035, 0.032, 0.045);
  const GW = C(1.0, 0.42, 0.12), GH = C(1.0, 0.86, 0.68);
  const sm = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return {
    material,
    update(state, hasEnv) {
      const e = state.sunElev;
      const dusk = Math.exp(-((e / 0.2) ** 2)) * (1 - 0.85 * state.night);
      u.uLmZen.value.copy(ZD).lerp(ZS, dusk).lerp(ZN, state.night);
      u.uLmHor.value.copy(HD).lerp(HS, dusk).lerp(HN, state.night);
      u.uLmEnvFallback.value = hasEnv ? 0 : 0.85;
      u.uLmSun.value.copy(state.sunDir);
      // parıltı: ufka yakınken en güçlü; batıştan sonra alacakaranlıkla söner
      u.uLmCore.value = sm(-0.035, 0.02, e); // güneş diski ufkun altındaysa çekirdek yok, yalnız alacakaranlık halesi
      const amt = sm(-0.14, -0.02, e) * (0.25 + 1.5 * Math.exp(-((e / 0.24) ** 2))) * (hasEnv ? 0.7 : 1.0);
      u.uLmGlow.value.copy(GW).lerp(GH, sm(0.05, 0.6, e)).multiplyScalar(amt);
    },
  };
}

// Uçak ikaz ışıkları: ekran uzayında boyutu alt sınırlı noktalar (uzak silüette de okunur).
export function makeBeaconMaterial(ctx) {
  const { THREE, uniforms } = ctx;
  const u = { uTime: uniforms.uTime, uLit: uniforms.uLit, uPx: { value: 1 } };
  const material = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute vec3 aBlink; // (periyot sn, faz, boyut m)
      uniform float uTime; uniform float uLit; uniform float uPx;
      varying vec3 vCol; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float ph = fract(uTime / aBlink.x + aBlink.y);
        float pulse = aBlink.x > 50.0 ? 1.0 : smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.42, 0.6, ph));
        vA = (0.12 + 0.88 * pulse) * smoothstep(0.12, 0.3, uLit);
        vCol = color;
        float px = aBlink.z * projectionMatrix[1][1] * uPx * 0.5 / max(-mv.z, 1.0);
        gl_PointSize = clamp(px, 2.2 * uPx / 960.0, 26.0 * uPx / 960.0);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float core = smoothstep(0.42, 0.0, r);
        float halo = pow(max(1.0 - r, 0.0), 2.5);
        gl_FragColor = vec4(vCol * (core * 3.0 + halo * 0.9) * vA, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.name = 'landmarks-beacons';
  return {
    material,
    update(state, bufH) {
      u.uPx.value = bufH;
    },
  };
}
