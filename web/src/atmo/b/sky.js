// ATMO B — stilize gök. Tek GLSL işlevi hem gök kubbesinde, hem environment yakalamada,
// hem de post-sis renginde kullanılır (uzak siluetler göğün ufuk rengine erir).
import * as THREE from 'three';

export function makeSkyUniforms() {
  const v3 = () => ({ value: new THREE.Vector3() });
  return {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    cZen: v3(), cMid: v3(), cMidSun: v3(), cHor: v3(), cHorSun: v3(),
    cGlow: v3(), cDisc: v3(), cCloudLit: v3(), cCloudDark: v3(),
    uGlowPow: { value: 60 },
    uDiscR: { value: 0.02 },
    uCloudCov: { value: 0.3 },
    uCloudOp: { value: 0.5 },
    uCloudUnder: { value: 0 },
    uStars: { value: 0 },
    uMoonK: { value: 0 },
    uSkyTime: { value: 0 },
  };
}

export const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir, uMoonDir;
uniform vec3 cZen, cMid, cMidSun, cHor, cHorSun, cGlow, cDisc, cCloudLit, cCloudDark;
uniform float uGlowPow, uDiscR, uCloudCov, uCloudOp, uCloudUnder, uStars, uMoonK, uSkyTime;

float skyHash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float skyHash3(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float skyNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(skyHash2(i), skyHash2(i+vec2(1,0)), f.x), mix(skyHash2(i+vec2(0,1)), skyHash2(i+vec2(1,1)), f.x), f.y);
}
float skyFbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++){ s += a * skyNoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; }
  return s;
}

// Yalın gradyan (hâle, disk, bulut, yıldız yok). Sis rengi bunu kullanır.
vec3 skyGrad(vec3 d, out float b){
  float h = max(d.y, 0.0);
  vec2 dh = normalize(d.xz + vec2(1e-5, 0.0));
  vec2 sh = normalize(uSunDir.xz + vec2(1e-5, 0.0));
  float w = clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0);
  w = w * w * (3.0 - 2.0 * w);
  w *= w;
  vec3 hor = mix(cHor, cHorSun, w);
  vec3 mid = mix(cMid, cMidSun, w);
  float a = 1.0 - exp(-h * 7.0);
  b = 1.0 - exp(-h * h * 9.0 - h * 1.2);
  vec3 c = mix(mix(hor, mid, a), cZen, b);
  // ufkun altı: zemin pusu
  c = mix(c, hor * 0.5, smoothstep(-0.1, -0.55, d.y));
  return c;
}
vec3 skyBase(vec3 d){
  float b;
  vec3 c = skyGrad(d, b);
  float g = max(dot(d, uSunDir), 0.0);
  c += cGlow * (pow(g, uGlowPow) + 0.22 * pow(g, uGlowPow * 0.12)) * (1.0 - 0.6 * b) * smoothstep(-0.25, 0.0, d.y);
  return c;
}

vec3 skyFull(vec3 d){
  vec3 c = skyBase(d);
  float up = smoothstep(-0.006, 0.006, d.y);

  // bulut örtüsü (yalnız ufkun üstü) — ince, uzamış şeritler
  float cov = 0.0, n = 0.0;
  if (d.y > 0.0 && uCloudOp > 0.0){
    vec2 p = d.xz / (d.y + 0.22);
    p = mat2(0.906, 0.423, -0.423, 0.906) * p;
    // alan bükme: şeritler düz çizgi değil, taranmış sirrus gibi kıvrılsın
    vec2 wp = vec2(skyFbm(p * 0.8 + 3.0), skyFbm(p * 0.8 + 17.0)) - 0.5;
    p = (p + wp * 0.8) * vec2(1.4, 4.4);
    p.x += uSkyTime * 0.004;
    n = skyFbm(p + 11.0);
    cov = smoothstep(1.0 - uCloudCov - 0.12, 1.0 - uCloudCov + 0.2, n + 0.25);
    cov *= smoothstep(0.015, 0.16, d.y) * uCloudOp;
  }

#ifndef SKY_ENV
  // yıldızlar (deterministik ızgara karması)
  if (uStars > 0.001 && d.y > 0.0){
    vec3 q = d * 210.0; vec3 id = floor(q); vec3 f = fract(q) - 0.5;
    float hsh = skyHash3(id);
    float st = step(0.955, hsh);
    vec3 jit = vec3(skyHash3(id + 3.1), skyHash3(id + 7.7), skyHash3(id + 13.3)) - 0.5;
    float r = length(f - jit * 0.5);
    float mag = pow(skyHash3(id + 21.0), 5.0);
    float star = st * smoothstep(0.2, 0.02, r) * (0.25 + 2.6 * mag);
    c += vec3(0.75, 0.88, 1.0) * star * uStars * smoothstep(0.02, 0.3, d.y) * (1.0 - cov);
  }
#endif

  // ay: net disk + ince hâle
  if (uMoonK > 0.001){
    float lm = length(d - uMoonDir);
    float md = 1.0 - smoothstep(0.0195, 0.0215, lm);
    vec3 moon = vec3(0.86, 0.96, 1.0) * (1.05 * md + 0.03 * exp(-lm * 16.0) + 0.12 * exp(-lm * 90.0));
    c += moon * uMoonK * up * (1.0 - 0.75 * cov);
  }

  // bulut rengi: güneşe bakan taraf alttan yanar
  if (cov > 0.0){
    float g2 = dot(d, uSunDir) * 0.5 + 0.5;
    float lit = smoothstep(0.25, 1.0, g2) * (0.55 + 0.45 * n);
    // alçak güneş: bulut altları her yönde alttan yanar (ince kenarlar daha çok)
    lit = max(lit, uCloudUnder * (1.0 - 0.75 * smoothstep(0.35, 0.95, cov / max(uCloudOp, 1e-3))) * (0.45 + 0.55 * exp(-d.y * 2.2)));
    vec3 cc = mix(cCloudDark, cCloudLit, lit);
    c = mix(c, cc, cov);
  }

  // güneş diski: grafik, net kenarlı
  float ls = length(d - uSunDir);
  float disc = 1.0 - smoothstep(uDiscR * 0.93, uDiscR, ls);
#ifdef SKY_ENV
  // camdaki yansıma: PMREM'de kaybolmasın diye biraz iri, ateşböceği olmasın diye kısık
  disc = 1.0 - smoothstep(uDiscR * 1.2, uDiscR * 1.8, ls);
  c += min(cDisc, vec3(26.0)) * disc * up;
#else
  c += cDisc * disc * up * (1.0 - 0.5 * cov);
#endif
  return c;
}
`;

const VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww;
}
`;

const FRAG = /* glsl */ `
varying vec3 vDir;
${SKY_GLSL}
void main(){
  gl_FragColor = vec4(skyFull(normalize(vDir)), 1.0);
}
`;

/** Gök kubbesi ağı. env=true → environment yakalama türevi (yıldız yok, disk kısık). */
export function makeSkyDome(uniforms, env = false) {
  const mat = new THREE.ShaderMaterial({
    name: env ? 'atmo-b-sky-env' : 'atmo-b-sky',
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: env ? { SKY_ENV: 1 } : {},
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 4), mat);
  mesh.name = env ? 'atmo-b-sky-env' : 'atmo-b-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -10000;
  mesh.matrixAutoUpdate = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
