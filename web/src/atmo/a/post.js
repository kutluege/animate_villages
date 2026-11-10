// ATMO A — post zinciri: sahne (HDR, MSAA, derinlik) → hava perspektifi + pozlama → bloom →
// film eğrisi + renk + vinyet + gren → sRGB. Zamansal birikim yok; her kare bağımsız.
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { SKY_GLSL } from './sky.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FOG_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform mat4 uProjInv, uCamWorld;
uniform vec3 uCamPos;
uniform float uFogD, uFogH, uFogY0, uExposure;
${SKY_GLSL}
void main() {
  vec3 col = texture2D(tColor, vUv).rgb;
  float z = texture2D(tDepth, vUv).x;
  if (z < 0.9999995) {
    vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0);
    v /= v.w;
    vec3 ray = (uCamWorld * v).xyz - uCamPos;
    float dist = length(ray);
    vec3 rd = ray / max(dist, 1e-4);
    // Yükseklikle üstel azalan pus, ışın boyunca analitik integral.
    float k = ray.y / uFogH;
    float f = abs(k) > 1e-3 ? (1.0 - exp(-k)) / k : 1.0 - 0.5 * k;
    float od = uFogD * exp(-(uCamPos.y - uFogY0) / uFogH) * f * dist;
    float T = exp(-od);
    vec3 fc = skyBase(vec3(rd.x, 0.0, rd.z), 1.0);
    col = col * T + fc * (1.0 - T);
  }
  col = max(col, 0.0) * uExposure;
  // Ateşböceği kıstırma: alt-piksel aynasal parlamalar (alçak güneş) bloom'da tek karelik patlama yapmasın.
  float mx = max(col.r, max(col.g, col.b));
  if (!(mx < 1e6)) { col = vec3(0.0); mx = 0.0; } // NaN/Inf
  col *= min(1.0, 12.0 / max(mx, 1e-4));
  gl_FragColor = vec4(col, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uSeed, uGrain, uVignette, uSat, uWarm, uContrast;

vec3 hable(vec3 x) {
  const float A = 0.15, B = 0.50, C = 0.10, D = 0.20, E = 0.02, F = 0.30;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}
float gHash(vec2 p, float s) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973) + s * 0.0137);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = max(texture2D(tDiffuse, vUv).rgb, 0.0);

  // Film eğrisi: yumuşak omuz, hafif ayak. Kanal başına + parlaklık temelli karışım →
  // gün batımı turuncusu sarıya/beyaza kaçmadan doyar.
  const float BIAS = 3.0;
  vec3 wInv = 1.0 / hable(vec3(11.2));
  vec3 a = hable(c * BIAS) * wInv;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float lt = hable(vec3(l * BIAS)).x * wInv.x;
  vec3 b = c * (lt / max(l, 1e-5));
  b = mix(b, vec3(lt), smoothstep(0.75, 1.6, max(b.r, max(b.g, b.b)))); // taşan rengi beyaza yatır
  c = clamp(mix(a, b, 0.42), 0.0, 1.0);

  // Doygunluk + çok hafif ayrık ton (gölge serin, tepe sıcak).
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast); // hafif S eğrisi
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(y), c, uSat);
  c *= mix(vec3(0.985, 1.0, 1.03), vec3(1.03, 1.0, 0.965), smoothstep(0.05, 0.8, y) * uWarm + (1.0 - uWarm) * 0.5);

  // Vinyet
  vec2 q = (vUv - 0.5) * vec2(min(1.0, uRes.x / uRes.y), min(1.0, uRes.y / uRes.x)) * 2.0;
  c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));

  // sRGB
  c = clamp(c, 0.0, 1.0);
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));

  // Gren: kare indeksinden tohumlu, üçgen dağılım; koyu-orta tonlarda biraz daha belirgin.
  // 1080p'ye göre ölçekli hücre → taslak ve nihai çözünürlükte benzer görünüm.
  vec2 gp = floor(gl_FragCoord.xy * (1080.0 / min(uRes.x, uRes.y)) / 1.0);
  float g = gHash(gp, uSeed) + gHash(gp + 17.0, uSeed + 5.0) - 1.0;
  float yy = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += g * uGrain * (1.0 - 0.6 * yy);

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const BLOOM_BASE_H = 1080; // bloom iç çözünürlüğü sabit → 540p taslak ile 1080p nihai aynı görünür

export function makePost(ctx, skyUniforms) {
  const { THREE, renderer, scene, camera } = ctx;
  const buf = new THREE.Vector2();
  renderer.getDrawingBufferSize(buf);
  let W = Math.max(1, buf.x);
  let H = Math.max(1, buf.y);

  const maxSamples = renderer.capabilities.maxSamples || 4;
  const sceneRT = new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType,
    samples: Math.min(4, maxSamples),
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(W, H),
  });
  sceneRT.texture.name = 'atmoA.scene';
  const hdrRT = new THREE.WebGLRenderTarget(W, H, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });
  hdrRT.texture.name = 'atmoA.hdr';

  const fogMat = new THREE.ShaderMaterial({
    uniforms: {
      ...skyUniforms,
      tColor: { value: sceneRT.texture },
      tDepth: { value: sceneRT.depthTexture },
      uProjInv: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uFogD: { value: 0.0006 },
      uFogH: { value: 150 },
      uFogY0: { value: -30 },
      uExposure: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: FOG_FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: hdrRT.texture },
      uRes: { value: new THREE.Vector2(W, H) },
      uSeed: { value: 0 },
      uGrain: { value: 0.016 },
      uVignette: { value: 0.2 },
      uSat: { value: 1.1 },
      uWarm: { value: 1 },
      uContrast: { value: 0.45 },
    },
    vertexShader: VERT,
    fragmentShader: FINAL_FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const fogQuad = new FullScreenQuad(fogMat);
  const finalQuad = new FullScreenQuad(finalMat);

  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.25, 0.5, 1.5);
  bloom.highPassUniforms.smoothWidth.value = 1.5; // yumuşak diz: eşik çevresinde titreme olmaz
  const sizeBloom = () => {
    const s = BLOOM_BASE_H / Math.max(W, H);
    bloom.setSize(Math.max(2, Math.round(W * s)), Math.max(2, Math.round(H * s)));
  };
  sizeBloom();

  function setSize() {
    renderer.getDrawingBufferSize(buf);
    const w = Math.max(1, buf.x);
    const h = Math.max(1, buf.y);
    if (w === W && h === H) return;
    W = w;
    H = h;
    sceneRT.setSize(W, H);
    hdrRT.setSize(W, H);
    finalMat.uniforms.uRes.value.set(W, H);
    sizeBloom();
  }

  function render(p) {
    setSize();
    const prevRT = renderer.getRenderTarget();
    const prevAuto = renderer.autoClear;

    // 1) sahne → HDR (ton eşlemesi yok; render hedefinde three zaten uygulamaz)
    renderer.autoClear = true;
    renderer.setRenderTarget(sceneRT);
    renderer.render(scene, camera);

    // 2) hava perspektifi + pozlama
    const u = fogMat.uniforms;
    u.uProjInv.value.copy(camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(camera.matrixWorld);
    u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    u.uFogD.value = p.fog;
    u.uExposure.value = p.exp;
    renderer.setRenderTarget(hdrRT);
    fogQuad.render(renderer);

    // 3) bloom (hdrRT üstüne toplamalı)
    bloom.strength = p.bloom;
    bloom.render(renderer, null, hdrRT, 0, false);

    // 4) film eğrisi → ekran
    finalMat.uniforms.uSeed.value = p.seed;
    renderer.setRenderTarget(null);
    finalQuad.render(renderer);

    renderer.setRenderTarget(prevRT);
    renderer.autoClear = prevAuto;
  }

  return { render, setSize, fogMat, finalMat, bloom };
}
