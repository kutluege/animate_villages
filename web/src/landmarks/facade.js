// Prosedürel cephe malzemesi (MeshStandardMaterial + onBeforeCompile).
// Kat çizgileri, doğramalar, panel başına hafif normal sapması (yansımayı kırar), panel tonu oynaması,
// gece "tek tek yanan" pencereler (lightsOn > k), karanlık katlar, ofis şeritleri, LED kat çizgileri, lobi parıltısı.
// Hepsi dünya konumunun ve uniform'ların saf fonksiyonu → deterministik (CONTRACT §7).
// Uzakta (hücre < ~1 px) desen ortalamaya erir: moiré ve titreme olmaz.
//
// Geometri dünya koordinatında (mesh matrisleri birim) varsayılmaz: dünya konumu/normali vertex'te hesaplanır.

const VERT_DECL = /* glsl */`
varying vec3 vLmPos;
varying vec3 vLmNrm;
`;
const VERT_BODY = /* glsl */`
vLmPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vLmNrm = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_DECL = /* glsl */`
varying vec3 vLmPos;
varying vec3 vLmNrm;
uniform float uMode, uFull, uSparse, uTrans, uT;
uniform float uLightsOn, uLed, uBaseY, uFloorH, uColW, uSeed, uOcc, uDarkFrac, uZone, uTilt, uLedEvery, uLobbyH, uTint;
uniform vec4 uWin;           // pencere dikdörtgeni hücre içinde: x0,x1,y0,y1 (0..1)
uniform vec3 uLitA, uLitB, uGlass, uWall, uRoof, uLedColor, uLobbyC;
uniform vec2 uLitI, uGlassRM, uWallRM;
// kutu süzgeçli periyodik darbe: hücre içinde [a,b] aralığı 1, piksel ayak izi w boyunca ortalanır (moiré yok)
float lmPulseI(float t, float a, float b) { return floor(t) * (b - a) + clamp(fract(t), a, b) - a; }
float lmPulse(float x, float a, float b, float w) { w = max(w, 1e-4); return (lmPulseI(x + 0.5 * w, a, b) - lmPulseI(x - 0.5 * w, a, b)) / w; }
float lmHash(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
`;

// diffuseColor ayarlandıktan sonra: sınıflandırma ve renk
const FRAG_CLASSIFY = /* glsl */`
vec3 lmN = normalize(vLmNrm);
float lmRoof = step(0.6, abs(lmN.y));
vec2 lmHn = length(lmN.xz) > 1e-4 ? normalize(lmN.xz) : vec2(1.0, 0.0);
vec2 lmT = vec2(-lmHn.y, lmHn.x);
float lmFace = floor(atan(lmHn.y, lmHn.x) * 1.27324 + 0.5) + uSeed;     // 8 yön
float lmU = dot(vLmPos.xz, lmT) / uColW;
float lmV = (vLmPos.y - uBaseY) / uFloorH;
float lmFl = floor(lmV), lmCl = floor(lmU);
float lmFx = lmU - lmCl, lmFy = lmV - lmFl;
float lmNearX = 1.0 - smoothstep(0.3, 0.85, fwidth(lmU));
float lmNearY = 1.0 - smoothstep(0.3, 0.85, fwidth(lmV));
// pencere maskesi (uzakta ortalama)
float lmG = lmPulse(lmU, uWin.x, uWin.y, fwidth(lmU)) * lmPulse(lmV, uWin.z, uWin.w, fwidth(lmV));
lmG *= (1.0 - lmRoof);
float lmPan = lmHash(vec3(lmFl, lmCl, lmFace));
float lmNearXY = lmNearX * lmNearY;
vec3 lmGlassC = uGlass * mix(1.0, 0.8 + 0.4 * lmPan, uTint * lmNearXY);
vec3 lmCol = mix(uWall, lmGlassC, lmG);
lmCol = mix(lmCol, uRoof, lmRoof);
diffuseColor.rgb = lmCol;
float lmRough = mix(mix(uWallRM.x, uGlassRM.x, lmG), 0.85, lmRoof);
float lmMetal = mix(mix(uWallRM.y, uGlassRM.y, lmG), 0.0, lmRoof);

// gece: pencere ışıkları — iki kişilik:
//  ofis (uMode=1): katlar bant halinde — tam aydınlık kat (kat bütünüyle yanar), seyrek kat (tek tük oda), karanlık kat;
//  konut (uMode=0): seyrek, sıcak amber, perde arkası loş, arada TV mavisi (t ile hafif titrer).
// Her pencere/oda/kat sabit bir k eşiği taşır: lightsOn > k → yanar (§5 "tek tek").
float lmZoneId = uZone > 0.5 ? floor(lmCl / uZone) : lmCl;
float lmK = lmHash(vec3(lmFl * 1.37 + 0.11, lmZoneId + 0.5, lmFace + 3.0));
float lmOccH = lmHash(vec3(lmFl + 0.3, lmZoneId * 0.71, lmFace + 11.0));
float lmHi = lmHash(vec3(lmFl, lmZoneId, lmFace + 23.0));
float lmLO = clamp(uLightsOn, 0.0, 1.0);
float lmLit, lmInt; vec3 lmLitC;
if (uMode > 0.5) {
  float hf = lmHash(vec3(lmFl * 1.13 + 0.7, uSeed, 5.0));
  float kF = lmHash(vec3(lmFl * 0.71 + 0.2, uSeed, 9.0));
  float full = step(hf, uFull);
  float sparse = step(uFull, hf) * step(hf, uFull + uSparse);
  float dark = 1.0 - full - sparse;
  float fullOn = step(0.15 + 0.8 * kF, uLightsOn);
  float exact = full * fullOn + sparse * step(lmK, uLightsOn) * step(lmOccH, 0.32) + dark * step(lmK, uLightsOn) * step(lmOccH, 0.025);
  float avgX = full * fullOn + sparse * 0.32 * lmLO + dark * 0.025 * lmLO;
  float avgAll = uFull * smoothstep(0.15, 0.95, uLightsOn) + (uSparse * 0.32 + (1.0 - uFull - uSparse) * 0.025) * lmLO;
  lmLit = mix(avgAll, mix(avgX, exact, lmNearX), lmNearY);
  float iFloor = mix(uLitI.x, uLitI.y, kF);
  float iRoom = mix(uLitI.x, uLitI.y, lmHi);
  lmInt = mix(mix(uLitI.x, uLitI.y, 0.45), mix(iRoom, iFloor, full), lmNearY);
  lmLitC = mix(uLitA, uLitB, mix(0.5, mix(lmHash(vec3(lmFl, lmZoneId, lmFace + 31.0)), kF, full), lmNearY));
} else {
  float lmDarkF = step(lmHash(vec3(lmFl * 0.93, uSeed, 7.0)), uDarkFrac);
  float exact = step(lmK, uLightsOn) * step(lmOccH, uOcc) * (1.0 - lmDarkF);
  float avgX = lmLO * uOcc * (1.0 - lmDarkF);
  float avgAll = lmLO * uOcc * (1.0 - uDarkFrac);
  lmLit = mix(avgAll, mix(avgX, exact, lmNearX), lmNearY);
  float tv = step(lmHash(vec3(lmFl, lmZoneId, lmFace + 51.0)), 0.13);
  float cur = 0.4 + 0.6 * lmHash(vec3(lmFl, lmZoneId, lmFace + 57.0));          // perde: loş ↔ açık
  float fl = 0.78 + 0.22 * sin(uT * (2.3 + 4.0 * lmHi) + lmHi * 40.0);
  vec3 amber = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.76, 0.48), lmHash(vec3(lmFl, lmZoneId, lmFace + 31.0)));
  vec3 tvC = vec3(0.42, 0.6, 1.0);
  float nr = lmNearXY;
  lmLitC = mix(mix(uLitA, uLitB, 0.5), mix(amber, tvC, tv), nr);
  lmInt = mix(mix(uLitI.x, uLitI.y, 0.4) * 0.7, mix(uLitI.x, uLitI.y, lmHi) * mix(cur, 0.55 * fl, tv), nr);
}
lmLit *= step(0.0, lmV) * (1.0 - lmRoof);
lmInt *= uTrans * mix(1.0, 0.6 + 0.5 * smoothstep(uWin.z, uWin.w, lmFy), lmNearY);   // koyu cam geçirgenliği, tavan ışığı
vec3 lmEmit = lmG * lmLit * lmInt * lmLitC;
// lobi / alt katlar
lmEmit += lmG * step(lmV * uFloorH, uLobbyH) * step(0.0, lmV) * clamp(uLightsOn * 1.5, 0.0, 1.0) * uLobbyC;
// LED kat çizgileri (her uLedEvery katta bir, döşeme hizasında ince şerit)
if (uLedEvery > 0.5) {
  float lmBand = lmPulse(lmV / uLedEvery, 0.0, 0.11 / uLedEvery, fwidth(lmV) / uLedEvery);
  lmEmit += (1.0 - lmRoof) * uLed * uLedColor * lmBand * step(0.0, lmV);
}
`;

const FRAG_NORMAL = /* glsl */`
{
  float lmDx = (lmHash(vec3(lmFl, lmCl, lmFace + 41.0)) - 0.5) * uTilt;
  float lmDy = (lmHash(vec3(lmFl, lmCl, lmFace + 47.0)) - 0.5) * uTilt * 0.6;
  vec3 lmPert = vec3(lmT.x, 0.0, lmT.y) * lmDx + vec3(0.0, 1.0, 0.0) * lmDy;
  lmPert *= lmNearXY * (1.0 - lmRoof) * (0.35 + 0.65 * lmG);
  normal = normalize(normal + (viewMatrix * vec4(lmPert, 0.0)).xyz);
}
`;

const DEFAULTS = {
  floorH: 3.8, colW: 1.5, seed: 1, occ: 0.85, darkFrac: 0.12, zone: 0, tilt: 0.05,
  ledEvery: 0, lobbyH: 0, tint: 0.5, mode: 0, full: 0.22, sparse: 0.33, trans: 1,
  win: [0.1, 1.0, 0.28, 1.0],
  litA: [1.0, 0.86, 0.66], litB: [1.0, 0.95, 0.86], litI: [1.0, 2.2],
  glass: [0.05, 0.08, 0.11], glassRM: [0.06, 0.92],
  wall: [0.05, 0.06, 0.07], wallRM: [0.45, 0.4],
  roof: [0.085, 0.088, 0.092],
  ledColor: [3.2, 2.2, 1.0], lobbyC: [3.0, 2.3, 1.5],
};

/**
 * @param THREE
 * @param opts DEFAULTS'taki alanlar + baseY. Renkler doğrusal [r,g,b].
 * @returns MeshStandardMaterial; material.userData.u → uniform'lar (uLightsOn, uLed güncellenir)
 */
export function facadeMaterial(THREE, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
  const u = {
    uLightsOn: { value: 0 }, uLed: { value: 0 }, uT: { value: 0 },
    uMode: { value: o.mode }, uFull: { value: o.full }, uSparse: { value: o.sparse }, uTrans: { value: o.trans },
    uBaseY: { value: o.baseY ?? 0 }, uFloorH: { value: o.floorH }, uColW: { value: o.colW }, uSeed: { value: o.seed },
    uOcc: { value: o.occ }, uDarkFrac: { value: o.darkFrac }, uZone: { value: o.zone }, uTilt: { value: o.tilt },
    uLedEvery: { value: o.ledEvery }, uLobbyH: { value: o.lobbyH }, uTint: { value: o.tint },
    uWin: { value: new THREE.Vector4(...o.win) },
    uLitA: { value: v3(o.litA) }, uLitB: { value: v3(o.litB) }, uLitI: { value: new THREE.Vector2(...o.litI) },
    uGlass: { value: v3(o.glass) }, uGlassRM: { value: new THREE.Vector2(...o.glassRM) },
    uWall: { value: v3(o.wall) }, uWallRM: { value: new THREE.Vector2(...o.wallRM) },
    uRoof: { value: v3(o.roof) }, uLedColor: { value: v3(o.ledColor) }, uLobbyC: { value: v3(o.lobbyC) },
  };
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.5, envMapIntensity: o.envMapIntensity ?? 1 });
  m.name = 'lm-facade-' + (o.name || '');
  m.userData.u = u;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_CLASSIFY)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = lmRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = lmMetal;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += lmEmit;');
  };
  m.customProgramCacheKey = () => 'lm-facade-v3';
  return m;
}

/** sRGB hex → doğrusal [r,g,b] */
export function lin(THREE, hex, mul = 1) {
  const c = new THREE.Color(hex);
  return [c.r * mul, c.g * mul, c.b * mul];
}
