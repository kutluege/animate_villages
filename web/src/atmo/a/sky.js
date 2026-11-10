// ATMO A — gök: ortak GLSL (gök kubbesi, env kubbesi ve sis geçişi aynı renk işlevini kullanır;
// uzak binalar tam olarak arkalarındaki ufuk rengine erir).

export function makeSkyUniforms(THREE) {
  const c = () => ({ value: new THREE.Color() });
  return {
    uZen: c(), uHor: c(), uHorS: c(), uBand: c(), uBandS: c(), uGlow: c(),
    uCloudLit: c(), uCloudDark: c(), uSunCol: c(), uGnd: c(),
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunAz: { value: new THREE.Vector2(1, 0) },
    uMoonDir: { value: new THREE.Vector3(0.74, 0.46, 0.49).normalize() },
    uAzPow: { value: 1.5 },
    uDisc: { value: 30 },
    uMoon: { value: 0 },
    uStars: { value: 0 },
    uWind: { value: new THREE.Vector2() },
    uCloudAmt: { value: 0.7 },
  };
}

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZen, uHor, uHorS, uBand, uBandS, uGlow, uCloudLit, uCloudDark, uSunCol, uGnd;
uniform vec3 uSunDir, uMoonDir;
uniform vec2 uSunAz, uWind;
uniform float uAzPow, uDisc, uMoon, uStars, uCloudAmt;

float aHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float aNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1, 0)), f.x), mix(aHash(i + vec2(0, 1)), aHash(i + vec2(1, 1)), f.x), f.y);
}
float aFbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * aNoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; }
  return s;
}

// h: ufuk üstü yükseklik (dir.y, >=0), az: güneş azimutuna göre kosinüs (-1..1),
// mu: güneş yönüyle kosinüs (>=0), glowK: parlamanın ölçeği.
vec3 skyCore(float h, float az, float mu, float glowK) {
  float toward = pow(clamp(0.5 + 0.5 * az, 0.0, 1.0), uAzPow);
  vec3 hor = mix(uHor, uHorS, toward);
  vec3 col = mix(uZen, hor, exp(-h * 3.4));
  vec3 band = mix(uBand, uBandS, toward);
  col = mix(col, band, exp(-h * 15.0) * 0.88);
  col += uGlow * glowK * (0.10 * pow(mu, 5.0) + 0.32 * pow(mu, 36.0) + 0.85 * pow(mu, 320.0));
  return col;
}

// Gövdesi olmayan (bulutsuz, disksiz) gök — sis rengi için de bu.
vec3 skyBase(vec3 d, float glowK) {
  float h = max(d.y, 0.0);
  float hl = length(d.xz);
  float az = dot(d.xz, uSunAz) / max(hl, 0.35); // başucu/ayakucu yakınında azimut etkisi söner
  vec3 dd = normalize(vec3(d.x, h, d.z));
  float mu = max(dot(dd, uSunDir), 0.0);
  // Ufka yapışık yoğun pus parlamayı kısar; sis rengi (d.y=0) ile kubbe ufukta birleşir.
  return skyCore(h, az, mu, glowK * mix(0.35, 1.0, smoothstep(0.0, 0.11, d.y)));
}

// Tam gök: bulut, güneş diski, ay, yıldız. envK>0 → çevre haritası çeşidi (yumuşak, iri disk).
vec3 skyFull(vec3 d, float envK) {
  float glowK = 1.0 + 0.7 * envK;
  vec3 base = skyBase(d, glowK);
  vec3 col = base;
  float h = d.y;

  // --- bulut (ince, yüksek, çizgili) ---
  float cd = 0.0, raw = 0.0;
  if (h > 0.0) {
    vec2 p = d.xz / (h + 0.14) * 0.85 + uWind;
    p = vec2(p.x * 0.5 + p.y * 0.22, p.y * 0.95 - p.x * 0.1);
    float w = aFbm(p * 0.55 + 3.1);
    float n = aFbm(p * 1.25 + vec2(w * 1.3, -w * 0.9));
    raw = smoothstep(0.47, 0.86, n);
    cd = raw * smoothstep(0.015, 0.2, h) * uCloudAmt;
    float mu = max(dot(d, uSunDir), 0.0);
    vec3 cc = mix(uCloudLit, uCloudDark, smoothstep(0.15, 0.95, raw));
    cc += uGlow * glowK * (0.22 * pow(mu, 8.0) + 0.5 * pow(mu, 60.0)) * (1.0 - 0.7 * raw);
    cc = mix(cc, base, exp(-h * 7.0) * 0.75); // ufka doğru pusa gömülür
    col = mix(col, cc, cd);
  }

  // --- yıldız (ışık kirliliği: seyrek, soluk, yalnız yukarıda) ---
  if (uStars > 0.001 && h > 0.1) {
    vec2 sp = d.xz / (h + 0.4) * 90.0;
    vec2 ci = floor(sp);
    float r = aHash(ci);
    if (r > 0.965) {
      vec2 o = vec2(aHash(ci + 11.0), aHash(ci + 23.0)) * 0.6 + 0.2;
      float s = smoothstep(0.16, 0.0, length(fract(sp) - o));
      col += vec3(0.75, 0.8, 1.0) * s * (r - 0.965) * 9.0 * uStars * smoothstep(0.1, 0.5, h) * (1.0 - cd);
    }
  }

  // --- güneş diski ---
  float sr = mix(0.0085, 0.05, envK);
  float sd = length(d - uSunDir);
  float disc = 1.0 - smoothstep(sr * mix(0.82, 0.3, envK), sr, sd);
  float horizonCut = smoothstep(-0.006, 0.006, h);
  col += uSunCol * uSunCol * uDisc * mix(1.0, 0.3, envK) * disc * horizonCut * (1.0 - 0.9 * cd);

  // --- ay (şişkin ay, hafif hale) ---
  if (uMoon > 0.001) {
    float md = length(d - uMoonDir);
    float mr = 0.0095;
    float m = 1.0 - smoothstep(mr * 0.86, mr, md);
    vec3 mx = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    float ph = 1.0 - smoothstep(mr * 0.80, mr * 0.98, length(d - uMoonDir - mx * mr * 0.55));
    float tex = 0.82 + 0.18 * aNoise((d.xz - uMoonDir.xz) * 420.0);
    vec3 mc = vec3(1.0, 0.95, 0.84) * (m * mix(0.06, 1.0, ph) * tex * 2.4 + 0.05 * exp(-md * 38.0) + 0.012 * exp(-md * 7.0));
    col += mc * uMoon * (1.0 - 0.8 * cd);
  }
  return col;
}
`;

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
  gl_Position = p.xyww; // uzak düzlem
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vDir);
  #ifdef ENV_VARIANT
    vec3 col = skyFull(d, 1.0);
    // Ufuk altı: şehrin/zeminin ortalama parlaklığı (camdaki alt yansıma, alttan dolgu ışığı).
    float g = smoothstep(0.0, -0.12, d.y);
    col = mix(col, uGnd, g);
  #else
    vec3 col = skyFull(d, 0.0);
  #endif
  gl_FragColor = vec4(col, 1.0);
}
`;

export function makeSkyDome(THREE, uniforms, env) {
  const geo = new THREE.IcosahedronGeometry(env ? 40 : 1, 5);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: env ? { ENV_VARIANT: 1 } : {},
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = env ? 'atmo-a-sky-env' : 'atmo-a-sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1e6;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.noShadow = true;
  return mesh;
}
