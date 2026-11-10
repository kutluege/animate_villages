// ATMO B — post zinciri (tek kare, zamansal birikim YOK → deterministik).
//   sahne (HDR, MSAA, derinlik) → yükseklik sisi + pozlama → bloom → anamorfik şerit
//   → ton eşleme + teal/amber renk kararı + vinyet + gren → ekran (sRGB)
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SKY_GLSL } from './sky.js';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FOG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uProjInv, uCamWorld;
uniform vec3 uCamPos, uFogTint;
uniform float uFogK, uFogR, uFogLow, uFogY0, uFogH, uExposure;
${SKY_GLSL}
void main(){
  vec3 col = texture2D(tColor, vUv).rgb;
  float z = texture2D(tDepth, vUv).x;
  bool isSky = z >= 0.99999;
  vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, (isSky ? 0.5 : z) * 2.0 - 1.0, 1.0);
  v /= v.w;
  vec3 ray = (uCamWorld * v).xyz - uCamPos;
  float dist = length(ray);
  vec3 rd = ray / max(dist, 1e-4);
  vec3 fd = normalize(vec3(rd.x, max(rd.y, 0.0) * 0.35, rd.z));
  float fb;
  vec3 fogCol = skyGrad(fd, fb) * uFogTint;
  float T;
  if (isSky){
    // gök: yalnız ufuk çizgisinde ince pus bandı (uzak zeminle dikişsiz birleşsin; MSAA kenar
    // piksellerinde sisi alınmamış koyu zemin sızmasın)
    T = smoothstep(0.0, 0.012, rd.y);
  } else {
    // genel pus: yakında berrak, uzakta hızla kapanan (dünyanın kenarını gizler)
    float q = dist / uFogR;
    float od = uFogK * dist + q * q * q;
    // alçak sis katmanı: yoğunluk ~ exp(-(y-y0)/H), ışın boyunca analitik integral
    float x = clamp(ray.y / uFogH, -30.0, 30.0);
    float f = abs(x) < 1e-3 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
    od += uFogLow * exp(-clamp((uCamPos.y - uFogY0) / uFogH, -30.0, 30.0)) * f * dist;
    T = exp(-od);
  }
  col = col * T + fogCol * (1.0 - T);
  col = max(col, vec3(0.0)) * uExposure;
  // HDR tepe sıkıştırma (renk tonu korunur): cam üstündeki güneş parlaması bloom'u patlatmasın
  float m = max(col.r, max(col.g, col.b));
  const float KNEE = 1.6, PEAK = 3.8;
  if (m > KNEE) col *= (KNEE + (PEAK - KNEE) * (1.0 - exp(-(m - KNEE) / (PEAK - KNEE)))) / m;
  gl_FragColor = vec4(col, 1.0);
}
`;

// Anamorfik şerit: parlak-geçiren (çeyrek çözünürlük) + art arda genişleyen yatay bulanıklık.
const STREAK_PRE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uThreshold;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  c = min(c, vec3(24.0));
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}
`;
const STREAK_BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uStep;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 0.1964;
  c += (texture2D(tColor, vUv + uStep * 1.4118).rgb + texture2D(tColor, vUv - uStep * 1.4118).rgb) * 0.2969;
  c += (texture2D(tColor, vUv + uStep * 3.2941).rgb + texture2D(tColor, vUv - uStep * 3.2941).rgb) * 0.0945;
  c += (texture2D(tColor, vUv + uStep * 5.1765).rgb + texture2D(tColor, vUv - uStep * 5.1765).rgb) * 0.0104;
  gl_FragColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tStreak;
uniform sampler2D tStreakWide;
uniform vec2 uRes;
uniform float uStreak, uSplit, uSat, uCon, uVig, uGrain, uSeed, uCA, uNightK;
uniform vec3 uStreakTint;

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 tonemap(vec3 x){
  // ACES (Narkowicz) eğrisi; kanal başına sürüm parlaklarda rengi beyaza yıkar (amber pencere →
  // krem). Ton-korumalı sürümle (en parlak kanala göre ölçek) karıştır: parlak renk doygun kalır.
  x *= 0.72;
  vec3 pc = aces(x);
  float m = max(x.r, max(x.g, x.b));
  vec3 hp = x * (aces(vec3(m)).r / max(m, 1e-5));
  return mix(pc, hp, 0.6);
}
float h31(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }

void main(){
  vec2 c = vUv - 0.5;
  // oval mercek uzayı: köşeler ve üst/alt kenar kararır, yanlar daha az
  vec2 lens = c * vec2(1.0, 1.12);
  float r2 = dot(lens, lens) * 2.0;

  vec2 off = c * uCA * r2;
  vec3 col;
  col.r = texture2D(tColor, vUv + off).r;
  col.g = texture2D(tColor, vUv).g;
  col.b = texture2D(tColor, vUv - off).b;

  col += (texture2D(tStreak, vUv).rgb * 0.5 + texture2D(tStreakWide, vUv).rgb) * uStreakTint * uStreak;

  col = tonemap(col);

  // renk kararı: gölgeler teal, parlaklar amber
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float sh = 1.0 - smoothstep(0.0, 0.42, l);
  float hi = smoothstep(0.35, 0.95, l);
  vec3 shTint = mix(vec3(0.9, 1.0, 1.12), vec3(0.62, 1.04, 1.16), uNightK);
  vec3 hiTint = mix(vec3(1.05, 1.0, 0.93), vec3(1.1, 0.98, 0.84), uNightK);
  col *= mix(vec3(1.0), shTint, sh * uSplit);
  col *= mix(vec3(1.0), hiTint, hi * uSplit);
  // gölge kaldırma: tam siyaha çökmesin, taban teal
  vec3 lift = mix(vec3(0.004, 0.006, 0.009), vec3(0.003, 0.011, 0.016), uNightK);
  col = col * (1.0 - 0.02) + lift;

  l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSat), 0.0);
  col = pow(col / 0.18, vec3(uCon)) * 0.18;

  // vinyet
  float v = smoothstep(0.18, 1.25, r2);
  col *= 1.0 - uVig * v;

  // sRGB
  col = clamp(col, 0.0, 1.0);
  col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));

  // gren + titreme (kare indeksinden tohumlu; bantlanmayı da kırar)
  vec2 px = floor(vUv * uRes);
  float g = h31(vec3(px, uSeed)) + h31(vec3(px + 17.0, uSeed + 3.7)) - 1.0;
  col += g * (uGrain * (0.35 + 0.65 * (1.0 - l)) + 1.0 / 255.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createPost(renderer, skyUniforms) {
  const size = new THREE.Vector2(2, 2);
  const gl = renderer.getContext();
  const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);

  const hdr = (w, h, opts = {}) =>
    new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      ...opts,
    });

  const depthTex = new THREE.DepthTexture(2, 2);
  depthTex.type = THREE.UnsignedIntType;
  depthTex.minFilter = THREE.NearestFilter;
  depthTex.magFilter = THREE.NearestFilter;
  const rtScene = hdr(2, 2, { depthBuffer: true, depthTexture: depthTex, samples });
  const rtA = hdr(2, 2);
  const rtS1 = hdr(2, 2);
  const rtS2 = hdr(2, 2);
  const rtS3 = hdr(2, 2);

  const mk = (frag, uniforms) =>
    new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.NoBlending,
    });

  const fogU = {
    ...skyUniforms,
    tColor: { value: rtScene.texture },
    tDepth: { value: depthTex },
    uProjInv: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uFogTint: { value: new THREE.Vector3(1, 1, 1) },
    uFogK: { value: 0 },
    uFogR: { value: 2500 },
    uFogLow: { value: 0 },
    uFogY0: { value: 0 },
    uFogH: { value: 30 },
    uExposure: { value: 1 },
  };
  const preU = { tColor: { value: rtA.texture }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.6 } };
  const blurU = { tColor: { value: null }, uStep: { value: new THREE.Vector2() } };
  const finalU = {
    tColor: { value: rtA.texture },
    tStreak: { value: rtS1.texture },
    tStreakWide: { value: rtS3.texture },
    uRes: { value: new THREE.Vector2(2, 2) },
    uStreak: { value: 0 },
    uStreakTint: { value: new THREE.Vector3(0.45, 0.75, 1.0) },
    uSplit: { value: 0.4 },
    uSat: { value: 1.1 },
    uCon: { value: 1.1 },
    uVig: { value: 0.3 },
    uGrain: { value: 0.018 },
    uSeed: { value: 0 },
    uCA: { value: 0.0022 },
    uNightK: { value: 0 },
  };

  const fogMat = mk(FOG_FRAG, fogU);
  const preMat = mk(STREAK_PRE_FRAG, preU);
  const blurMat = mk(STREAK_BLUR_FRAG, blurU);
  const finalMat = mk(FINAL_FRAG, finalU);
  const quad = new FullScreenQuad(fogMat);

  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.3, 0.6, 1.0);
  // yumuşak eşik: yüzeyler eşiği geçerken bloom aniden "yanmasın"
  bloom.highPassUniforms.smoothWidth.value = 1.0;

  function setSize(w, h) {
    w = Math.max(2, Math.floor(w));
    h = Math.max(2, Math.floor(h));
    if (size.x === w && size.y === h) return;
    size.set(w, h);
    rtScene.setSize(w, h);
    rtA.setSize(w, h);
    const qw = Math.max(2, Math.round(w / 4));
    const qh = Math.max(2, Math.round(h / 4));
    rtS1.setSize(qw, qh);
    rtS2.setSize(qw, qh);
    rtS3.setSize(qw, qh);
    bloom.setSize(w, h);
    finalU.uRes.value.set(w, h);
    preU.uTexel.value.set(1 / w, 1 / h);
  }

  function pass(mat, target) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  }

  function render(scene, camera) {
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;

    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);

    fogU.uProjInv.value.copy(camera.projectionMatrixInverse);
    fogU.uCamWorld.value.copy(camera.matrixWorld);
    fogU.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    pass(fogMat, rtA);

    // şerit kaynağı bloom'dan ÖNCE alınır (bloom ile çifte sayım olmasın)
    const sw = rtS1.width;
    if (finalU.uStreak.value > 1e-4) {
      pass(preMat, rtS1);
      // genişlik çözünürlükten bağımsız: adımlar çerçeve genişliğinin oranı
      const base = 1 / 270; // 1080 px'te çeyrek çözünürlük teksel
      // dar çekirdek (S1) + uzun kuyruk (S3): ince, uzun anamorfik çizgi
      const chain = [
        [rtS1, rtS2, 1],
        [rtS2, rtS1, 2.6],
        [rtS1, rtS2, 7],
        [rtS2, rtS3, 18],
      ];
      for (const [src, dst, s] of chain) {
        blurU.tColor.value = src.texture;
        blurU.uStep.value.set(Math.max(base * s, 1 / sw), 0);
        pass(blurMat, dst);
      }
    }

    bloom.render(renderer, null, rtA, 0, false);

    renderer.autoClear = prevAuto;
    pass(finalMat, null);
  }

  return { setSize, render, fogU, finalU, preU, bloom, samples };
}
