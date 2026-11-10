// Atmosfer — B yorumu: "berrak, grafik, elektrik".
// Yağmur sonrası yıkanmış hava: keskin güneş, doygun gök, ince hava perspektifi; altın saatte pus yerine
// renk (turuncu yüzey / mor gölge), batışta turuncu → macenta → elektrik mavisi, gecede temiz lacivert gök,
// ay dolgu ışığı ve dar/yoğun bloom (teal–turuncu).
//
// CONTRACT §4b: tone mapping, exposure, bloom, scene.environment (gökten PMREM), tek yönlü güneş gölgesi bizde.
// §7: her şey (tod, kamera)'nın saf fonksiyonu. Tek önbellek: ortam haritası yalnızca tod *aynen* aynıysa
// yeniden üretilmez (sonuç aynı olduğundan determinizmi bozmaz).
//
// Bileşenler
//  - Gök kubbesi (ShaderMaterial): dikey gradyan + güneş tarafı ufuk ışıması + karşı taraf (Venüs kuşağı)
//    + Mie halesi + güneş diski + ay diski + seyrek yıldızlar.
//  - Yön bağımlı sis: three'nin fog chunk'ları yamalanır; sis rengi bakış yönündeki gök rengidir →
//    uzak zemin ufuk gradyanına dikişsiz karışır (batı turuncu, doğu mor/mavi).
//  - Ortam: aynı gök (yıldızsız, güneş diski yok) → CubeCamera → PMREM (sigma 0, keskin cam yansıması).
//  - Işıklar: tek DirectionalLight (gündüz güneş, gece ay; geçiş yoğunluk 0'dayken), HemisphereLight dolgu.
//  - Gölge: kamera frustum'u ∩ sahne kutusu ışık uzayında; boyut 16 m'ye nicelenir, merkez texel'e kenetlenir.
//  - Post: MSAA HDR → UnrealBloom (dar çekirdek) → derecelendirme (exposure, split-tone, doygunluk,
//    ACES, vinyet, sRGB, sabit desenli dither).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const D2R = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => { const u = clamp01((x - e0) / (e1 - e0)); return u * u * (3 - 2 * u); };

// ───────────────────────────── palet: sunElev'e göre anahtarlar ─────────────────────────────
// Renkler sRGB hex (göz için), doğrusala çevrilip yoğunlukla çarpılır. Anahtarlar arası doğrusal (elev'de).
const KEYS = [
  { e: 60, zen: ['#4a86d8', 0.95], hor: ['#bcd4ee', 1.0], glow: ['#fff0d8', 0.12], glowW: 3, anti: ['#000000', 0], mie: ['#fff2dc', 0.22],
    ground: ['#6a6762', 1.0], sun: '#fff0dc', sunI: 4.0, hemiS: '#d4d8e0', hemiG: '#a89884', hemiI: 0.75, envI: 1.15,
    exp: 0.88, fog: 0.00014, bloom: 0.10, bthr: 2.2, sat: 1.04, shT: '#ffffff', hiT: '#fff6ea', con: 1.0, envSat: 0.5, fogSat: 0.95, city: 0 },
  { e: 30, zen: ['#4a86d8', 0.95], hor: ['#bcd4ee', 1.0], glow: ['#fff0d8', 0.14], glowW: 3, anti: ['#000000', 0], mie: ['#fff2dc', 0.25],
    ground: ['#6a6762', 1.0], sun: '#fff0dc', sunI: 4.0, hemiS: '#d4d8e0', hemiG: '#a89884', hemiI: 0.75, envI: 1.15,
    exp: 0.88, fog: 0.00014, bloom: 0.10, bthr: 2.2, sat: 1.04, shT: '#ffffff', hiT: '#fff6ea', con: 1.0, envSat: 0.5, fogSat: 0.95, city: 0 },
  { e: 14, zen: ['#4a7ccc', 0.9], hor: ['#dcd8d4', 1.0], glow: ['#ffd9a8', 0.35], glowW: 4, anti: ['#c0b4d8', 0.08], mie: ['#ffe0b0', 0.4],
    ground: ['#6a6460', 0.95], sun: '#ffe4bc', sunI: 4.2, hemiS: '#c8ccdc', hemiG: '#a08870', hemiI: 0.7, envI: 1.05,
    exp: 0.9, fog: 0.00015, bloom: 0.12, bthr: 2.0, sat: 1.05, shT: '#fafaff', hiT: '#fff2e0', con: 1.02, envSat: 0.5, fogSat: 0.85, city: 0 },
  { e: 5, zen: ['#2f4cb0', 0.8], hor: ['#f4b07a', 1.05], glow: ['#ff9a3a', 1.25], glowW: 3, anti: ['#b48cd0', 0.25], mie: ['#ffaa58', 0.8],
    ground: ['#5a4c4c', 0.9], sun: '#ff9c44', sunI: 3.9, hemiS: '#a8a4d0', hemiG: '#6a4636', hemiI: 0.5, envI: 0.85,
    exp: 0.98, fog: 0.00014, bloom: 0.18, bthr: 1.8, sat: 1.1, shT: '#f4f0ff', hiT: '#fff0da', con: 1.08, envSat: 0.6, fogSat: 0.55, city: 0 },
  { e: 1.5, zen: ['#30449a', 0.62], hor: ['#e0a088', 0.8], glow: ['#ff6420', 1.9], glowW: 2.6, anti: ['#a874c0', 0.34], mie: ['#ff7428', 1.0],
    ground: ['#4a3c44', 0.8], sun: '#ff7430', sunI: 3.0, hemiS: '#9a94d0', hemiG: '#5a3a36', hemiI: 0.55, envI: 0.75,
    exp: 1.08, fog: 0.00014, bloom: 0.30, bthr: 1.5, sat: 1.1, shT: '#f2eeff', hiT: '#ffe8d4', con: 1.08, envSat: 0.6, fogSat: 0.5, city: 0 },
  { e: -0.6, zen: ['#2a3c9c', 0.5], hor: ['#9a7aa8', 0.55], glow: ['#ff6a20', 2.0], glowW: 2.6, anti: ['#8c5cb0', 0.22], mie: ['#ff5a20', 0.45],
    ground: ['#3a3040', 0.7], sun: '#ff5a26', sunI: 2.0, hemiS: '#8a88c8', hemiG: '#4a3c40', hemiI: 0.6, envI: 0.7,
    exp: 1.22, fog: 0.00015, bloom: 0.45, bthr: 1.3, sat: 1.1, shT: '#eeeaff', hiT: '#ffe4d8', con: 1.08, envSat: 0.6, fogSat: 0.5, city: 0 },
  { e: -3, zen: ['#2036a0', 0.36], hor: ['#8a5a9a', 0.38], glow: ['#e8406a', 0.75], glowW: 2.0, anti: ['#4c4ca8', 0.22], mie: ['#000000', 0],
    ground: ['#2c2a44', 0.6], sun: '#ff4a30', sunI: 0, hemiS: '#6a78d0', hemiG: '#3c3050', hemiI: 0.7, envI: 0.75,
    exp: 1.35, fog: 0.00017, bloom: 0.62, bthr: 1.2, sat: 1.08, shT: '#e6ecff', hiT: '#ffe2d8', con: 1.08, envSat: 0.65, fogSat: 0.55, city: 0.02 },
  { e: -6, zen: ['#2450c0', 0.22], hor: ['#4a68d0', 0.24], glow: ['#9c3aa8', 0.26], glowW: 2.0, anti: ['#000000', 0], mie: ['#000000', 0],
    ground: ['#1e2440', 0.55], sun: '#ff4a30', sunI: 0, hemiS: '#6a84d8', hemiG: '#4a3a40', hemiI: 0.9, envI: 0.85,
    exp: 1.4, fog: 0.0002, bloom: 0.6, bthr: 1.3, sat: 1.06, shT: '#cce4ff', hiT: '#ffe4d0', con: 1.08, envSat: 0.7, fogSat: 0.6, city: 0.05 },
  { e: -10, zen: ['#12309a', 0.45], hor: ['#2e3c86', 0.3], glow: ['#4a2c80', 0.08], glowW: 2.0, anti: ['#000000', 0], mie: ['#000000', 0],
    ground: ['#20203a', 0.5], sun: '#ff4a30', sunI: 0, hemiS: '#2c5ed0', hemiG: '#4a3828', hemiI: 1.35, envI: 1.05,
    exp: 1.45, fog: 0.00022, bloom: 0.68, bthr: 1.5, sat: 1.20, shT: '#c8eaff', hiT: '#ffe2c8', con: 1.08, envSat: 0.75, fogSat: 0.85, city: 0.06 },
  { e: -15, zen: ['#0c2466', 0.75], hor: ['#2a3a64', 0.5], glow: ['#000000', 0], glowW: 2.0, anti: ['#000000', 0], mie: ['#000000', 0],
    ground: ['#2a2228', 0.5], sun: '#ff4a30', sunI: 0, hemiS: '#26648c', hemiG: '#4a3420', hemiI: 1.5, envI: 1.0,
    exp: 1.5, fog: 0.00024, bloom: 0.72, bthr: 1.6, sat: 1.18, shT: '#c4ecff', hiT: '#ffe0c0', con: 1.08, envSat: 0.8, fogSat: 0.9, city: 0.08 },
  { e: -22, zen: ['#0a1e56', 0.95], hor: ['#1e3a5a', 0.6], glow: ['#000000', 0], glowW: 2.0, anti: ['#000000', 0], mie: ['#000000', 0],
    ground: ['#30241c', 0.5], sun: '#ff4a30', sunI: 0, hemiS: '#1f6a88', hemiG: '#4a3420', hemiI: 1.5, envI: 1.0,
    exp: 1.5, fog: 0.00025, bloom: 0.72, bthr: 1.6, sat: 1.18, shT: '#c0ecff', hiT: '#ffdcb8', con: 1.08, envSat: 0.8, fogSat: 0.9, city: 0.08 },
  { e: -90, zen: ['#0a1e56', 0.95], hor: ['#1e3a5a', 0.6], glow: ['#000000', 0], glowW: 2.0, anti: ['#000000', 0], mie: ['#000000', 0],
    ground: ['#30241c', 0.5], sun: '#ff4a30', sunI: 0, hemiS: '#1f6a88', hemiG: '#4a3420', hemiI: 1.5, envI: 1.0,
    exp: 1.5, fog: 0.00025, bloom: 0.72, bthr: 1.6, sat: 1.18, shT: '#c0ecff', hiT: '#ffdcb8', con: 1.08, envSat: 0.8, fogSat: 0.9, city: 0.08 },
];
const COLOR_FIELDS = ['zen', 'hor', 'glow', 'anti', 'mie', 'ground'];      // [hex, yoğunluk]
const TINT_FIELDS = ['sun', 'hemiS', 'hemiG', 'shT', 'hiT'];              // hex (doğrusal)
const NUM_FIELDS = ['envSat', 'fogSat', 'city', 'glowW', 'sunI', 'hemiI', 'envI', 'exp', 'fog', 'bloom', 'bthr', 'sat', 'con'];
// Önceden doğrusala çevir
const PKEYS = KEYS.map((k) => {
  const o = { e: k.e };
  for (const f of COLOR_FIELDS) o[f] = new THREE.Color(k[f][0]).multiplyScalar(k[f][1]); // Color(hex) → doğrusal (ColorManagement)
  for (const f of TINT_FIELDS) o[f] = new THREE.Color(k[f]);
  for (const f of NUM_FIELDS) o[f] = k[f];
  return o;
});

/** sunElev → palet (saf). Tek önemli kural: anahtarlar arası doğrusal, elev zamanla yumuşak değişir. */
function palette(elev, out) {
  let i = 0;
  while (i < PKEYS.length - 2 && elev < PKEYS[i + 1].e) i++;
  const a = PKEYS[i], b = PKEYS[i + 1];
  const u = clamp01((a.e - elev) / (a.e - b.e));
  for (const f of COLOR_FIELDS) out[f].copy(a[f]).lerp(b[f], u);
  for (const f of TINT_FIELDS) out[f].copy(a[f]).lerp(b[f], u);
  for (const f of NUM_FIELDS) out[f] = a[f] + (b[f] - a[f]) * u;
  // sis yoğunluğu log-uzayında daha doğal ama farklar küçük; doğrusal yeterli
  return out;
}
const CITY_GLOW = new THREE.Color('#d8905a');
function makePalette() {
  const o = {};
  for (const f of [...COLOR_FIELDS, ...TINT_FIELDS]) o[f] = new THREE.Color();
  return o;
}

// ───────────────────────────── GLSL: ortak gök fonksiyonu ─────────────────────────────
const SKY_GLSL = /* glsl */`
struct AtmoSkyB {
  vec3 sunDir; vec3 moonDir;
  vec3 zenith; vec3 horizon; vec3 glow; vec3 anti; vec3 mie; vec3 ground;
  vec3 city; float glowW; float on; float fogSat;
};
uniform AtmoSkyB atmoSkyB;
vec3 atmoSkyColorB( vec3 dir ) {
  float hp = max( dir.y, 0.0 );
  vec3 sH = vec3( atmoSkyB.sunDir.x, 0.0, atmoSkyB.sunDir.z );
  sH /= max( length( sH ), 1e-4 );
  vec3 dH = vec3( dir.x, 0.0, dir.z );
  dH /= max( length( dH ), 1e-4 );
  float az = clamp( dot( sH, dH ) * 0.5 + 0.5, 0.0, 1.0 );
  float t = 1.0 - exp( - hp * 4.2 );
  vec3 c = mix( atmoSkyB.horizon, atmoSkyB.zenith, t );
  c += atmoSkyB.glow * pow( az, atmoSkyB.glowW ) * exp( - hp * 6.5 );
  c += atmoSkyB.anti * ( 1.0 - az ) * ( 1.0 - az ) * exp( - hp * 4.5 );
  c += atmoSkyB.city * exp( - hp * 16.0 );   // şehir ışığı parıltısı (ufukta dar bant)
  vec3 d0 = normalize( vec3( dir.x, hp, dir.z ) );
  float mu = max( dot( d0, atmoSkyB.sunDir ), 0.0 );
  c += atmoSkyB.mie * ( 0.3 * pow( mu, 16.0 ) + 1.6 * pow( mu, 160.0 ) );
  return c;
}
`;

// three fog chunk yamaları: sis rengi = bakış yönündeki gök rengi (atmoSkyB.on = 0 ise klasik fogColor).
const FOG_PARS_VERTEX = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying vec3 vFogDirB;\n#endif';
const FOG_VERTEX = '#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z;\n\tvFogDirB = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;\n#endif';
const FOG_PARS_FRAGMENT = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogDirB;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
${SKY_GLSL}
#endif`;
const FOG_FRAGMENT = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	// uzak zemin (sahne dışı düzlük) ufka dikişsiz karışsın, şehir berrak kalsın
	if ( atmoSkyB.on > 0.5 ) fogFactor = max( fogFactor, smoothstep( 2200.0, 7000.0, vFogDepth ) );
	vec3 fogColB = fogColor;
	if ( atmoSkyB.on > 0.5 ) { fogColB = atmoSkyColorB( normalize( vFogDirB ) ); fogColB = mix( vec3( dot( fogColB, vec3( 0.2126, 0.7152, 0.0722 ) ) ), fogColB, atmoSkyB.fogSat ); }
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColB, fogFactor );
#endif`;

// ───────────────────────────── gök kubbesi malzemesi ─────────────────────────────
function skyMaterial(uniforms, env) {
  return new THREE.ShaderMaterial({
    name: env ? 'atmoB-sky-env' : 'atmoB-sky',
    uniforms,
    defines: env ? { ENV_PASS: 1 } : {},
    side: THREE.BackSide, depthWrite: false, depthTest: !env, fog: false, toneMapped: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position = p.xyww; // uzak düzleme yapıştır
      }`,
    fragmentShader: /* glsl */`
      ${SKY_GLSL}
      uniform vec3 uSunCol; uniform float uSunDisc;
      uniform vec3 uMoonCol; uniform float uMoon; uniform float uStars; uniform float uEnvSat;
      varying vec3 vDir;
      float hash13( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
      void main() {
        vec3 dir = normalize( vDir );
        vec3 c = atmoSkyColorB( dir );
        // ufuk altı: zemin rengi (uzak şehir), keskin ama kenar yumuşatılmış ufuk çizgisi
        #ifdef ENV_PASS
          c = mix( c, atmoSkyB.ground, smoothstep( 0.0, -0.18, dir.y ) );
        #endif
        float above = smoothstep( -0.012, 0.004, dir.y );
        // ay diski (+ hafif doku ve hale)
        float mmu = dot( dir, atmoSkyB.moonDir );
        float md = acos( clamp( mmu, -1.0, 1.0 ) );
        float mr = 0.0145;                                   // ≈0.83° (telefon için büyütülmüş)
        float aa = clamp( fwidth( md ), 1e-4, 0.01 ) * 1.2;
        float disc = 1.0 - smoothstep( mr - aa, mr + aa, md );
        vec3 mt = dir - atmoSkyB.moonDir * mmu;
        float mot = 0.82 + 0.18 * sin( mt.x * 520.0 + 1.3 ) * sin( mt.y * 610.0 - 0.7 ) * sin( mt.z * 470.0 + 2.1 );
        c += uMoon * above * ( uMoonCol * disc * mot * 1.25 + uMoonCol * 0.02 * pow( max( mmu, 0.0 ), 2500.0 ) + uMoonCol * 0.006 * pow( max( mmu, 0.0 ), 120.0 ) );
        #ifndef ENV_PASS
          // güneş diski
          float smu = dot( dir, atmoSkyB.sunDir );
          float sd = acos( clamp( smu, -1.0, 1.0 ) );
          float sr = 0.0105;
          float saa = clamp( fwidth( sd ), 1e-4, 0.01 ) * 1.2;
          c += uSunCol * uSunDisc * ( 1.0 - smoothstep( sr - saa, sr + saa, sd ) ) * above;
          // seyrek yıldızlar (şehir ışık kirliliği: yalnızca parlaklar), yöne bağlı → kamera hareketinde sabit
          if ( uStars > 0.001 && dir.y > 0.05 ) {
            vec3 p = dir * 150.0;
            vec3 cell = floor( p );
            float h = hash13( cell );
            if ( h > 0.972 ) {
              vec3 off = vec3( hash13( cell + 1.7 ), hash13( cell + 3.1 ), hash13( cell + 5.9 ) ) * 0.6 + 0.2;
              float d = length( p - cell - off );
              float w = max( 0.12, length( fwidth( p ) ) * 0.9 );
              float s = 1.0 - smoothstep( 0.0, w, d );
              float mag = pow( hash13( cell + 9.2 ), 3.0 );
              vec3 tint = mix( vec3( 0.75, 0.85, 1.0 ), vec3( 1.0, 0.9, 0.75 ), hash13( cell + 4.4 ) );
              c += tint * s * ( 0.25 + 2.2 * mag ) * uStars * smoothstep( 0.05, 0.25, dir.y ) * ( 0.12 / max( w, 0.12 ) );
            }
          }
        #endif
        #ifdef ENV_PASS
          c = mix( vec3( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ), c, uEnvSat );
        #else
          // ufuk bandı sisle aynı doygunlukta → uzak zeminle dikişsiz
          c = mix( vec3( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ) ), c, mix( atmoSkyB.fogSat, 1.0, smoothstep( 0.0, 0.12, dir.y ) ) );
        #endif
        gl_FragColor = vec4( c, 1.0 );
      }`,
  });
}

// ───────────────────────────── derecelendirme geçişi ─────────────────────────────
const GradeShader = {
  name: 'atmoB-grade',
  uniforms: {
    tDiffuse: { value: null }, uExposure: { value: 1 }, uSat: { value: 1.1 }, uCon: { value: 1.06 },
    uShadowTint: { value: new THREE.Color(1, 1, 1) }, uHighTint: { value: new THREE.Color(1, 1, 1) },
    uVignette: { value: 0.16 }, uAspect: { value: 9 / 16 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uExposure, uSat, uCon, uVignette, uAspect;
    uniform vec3 uShadowTint, uHighTint;
    varying vec2 vUv;
    bool badHDR( vec3 c ) { uvec3 u = floatBitsToUint( c ) & 0x7f800000u; return any( equal( u, uvec3( 0x7f800000u ) ) ); }
    const mat3 ACESIn = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
    const mat3 ACESOut = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
    vec3 RRTODT( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
    vec3 aces( vec3 c ) { c /= 0.6; c = ACESIn * c; c = RRTODT( c ); c = ACESOut * c; return clamp( c, 0.0, 1.0 ); }
    float lin2srgb( float c ) { return c <= 0.0031308 ? c * 12.92 : 1.055 * pow( c, 1.0 / 2.4 ) - 0.055; }
    float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      #ifdef NAN_DEBUG
        if ( badHDR( c ) ) { gl_FragColor = vec4( 1.0, 0.0, 1.0, 1.0 ); return; }
      #endif
      if ( badHDR( c ) ) c = vec3( 0.0 );
      c = max( c, 0.0 ) * uExposure;
      float L = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
      // split-tone: gölgeler/orta tonlar soğuk (veya mor), ışıklar sıcak
      c *= mix( uShadowTint, uHighTint, smoothstep( 0.02, 0.5, L ) );
      L = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
      c = max( mix( vec3( L ), c, uSat ), 0.0 );
      c = aces( c );
      // kontrast: orta gri etrafında hafif S
      c = clamp( ( c - 0.18 ) * uCon + 0.18, 0.0, 1.0 );
      vec2 q = ( vUv - 0.5 ) * vec2( uAspect, 1.0 ) * 1.6;
      c *= 1.0 - uVignette * smoothstep( 0.35, 1.25, dot( q, q ) );
      c = vec3( lin2srgb( c.r ), lin2srgb( c.g ), lin2srgb( c.b ) );
      c += ( ign( gl_FragCoord.xy ) - 0.5 ) / 255.0;   // sabit desen → deterministik, bantlanmasız
      gl_FragColor = vec4( c, 1.0 );
    }`,
};

// ───────────────────────────── modül ─────────────────────────────
export async function create(ctx) {
  const { scene, camera, renderer, quality, data } = ctx;
  const draft = quality === 'draft';
  const DEBUG = ctx.params?.get('atmoDebug') || '';

  // three fog chunk'larını yama (malzemeler henüz derlenmeden). ShaderLib uniform'larına paylaşılan struct ekle:
  // cloneUniforms düz nesneyi referansla kopyalar → tüm yerleşik malzemeler aynı nesneyi okur.
  const chunkBackup = {};
  for (const [k, v] of [['fog_pars_vertex', FOG_PARS_VERTEX], ['fog_vertex', FOG_VERTEX], ['fog_pars_fragment', FOG_PARS_FRAGMENT], ['fog_fragment', FOG_FRAGMENT]]) {
    chunkBackup[k] = THREE.ShaderChunk[k];
    THREE.ShaderChunk[k] = v;
  }
  const sky = {
    sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, 1, 0),
    zenith: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color(), anti: new THREE.Color(),
    mie: new THREE.Color(), ground: new THREE.Color(), city: new THREE.Color(), glowW: 3, on: 1, fogSat: 1,
  };
  const libPatched = [];
  for (const [name, sh] of Object.entries(THREE.ShaderLib)) {
    if (sh.uniforms && sh.uniforms.fogColor && !sh.uniforms.atmoSkyB) { sh.uniforms.atmoSkyB = { value: sky }; libPatched.push(name); }
  }

  const group = new THREE.Group();
  group.name = 'atmosphere.b';

  // Gök kubbesi
  const skyU = {
    atmoSkyB: { value: sky },
    uSunCol: { value: new THREE.Color() }, uSunDisc: { value: 0 },
    uMoonCol: { value: new THREE.Color(0.85, 0.9, 1.0) }, uMoon: { value: 0 }, uStars: { value: 0 }, uEnvSat: { value: 1 },
  };
  const domeGeo = new THREE.SphereGeometry(1, 96, 48);
  const dome = new THREE.Mesh(domeGeo, skyMaterial(skyU, false));
  dome.name = 'atmoB-sky'; dome.frustumCulled = false; dome.renderOrder = -1e6;
  group.add(dome);

  // Ortam: ayrı sahnede aynı gök → CubeCamera → PMREM
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(domeGeo, skyMaterial(skyU, true));
  envDome.scale.setScalar(100); envDome.frustumCulled = false;
  envScene.add(envDome);
  const cubeRT = new THREE.WebGLCubeRenderTarget(draft ? 128 : 256, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(1, 1000, cubeRT);
  envScene.add(cubeCam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, envTod = NaN;

  // Işıklar
  const sun = new THREE.DirectionalLight(0xffffff, 0);
  sun.name = 'atmoB-sun';
  sun.castShadow = true;
  const MAP = draft ? 2048 : 4096;
  sun.shadow.mapSize.set(MAP, MAP);
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.25;
  sun.shadow.radius = 1;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
  hemi.name = 'atmoB-hemi';
  group.add(sun, sun.target, hemi);
  scene.add(group);

  // ?atmoProbe=1 → yansıma sınaması için cam kule + krom küre (yalnızca hata ayıklama)
  if (ctx.params?.get('atmoProbe') === '1') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, metalness: 0.9, roughness: 0.06 });
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(45, 180, 30), glass);
    t1.position.set(-20, ctx.heightAt(-20, -40) + 90, -40); t1.rotation.y = 0.5; t1.castShadow = t1.receiveShadow = true;
    const sp = new THREE.Mesh(new THREE.SphereGeometry(18, 48, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }));
    sp.position.set(60, ctx.heightAt(60, 60) + 18, 60); sp.castShadow = true;
    group.add(t1, sp);
  }

  const prev = { background: scene.background, environment: scene.environment, fog: scene.fog, envI: scene.environmentIntensity };
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x8899aa, 0.0002);
  renderer.setClearColor(0x000000, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // yalnızca render() düşerse yedek; composer kendi ACES'ini uygular

  // Sahne kutusu (gölge sığdırma). Yükseklik veriden; yoksa 330 m.
  let top = 260;
  try {
    for (const b of data?.buildings?.buildings || []) if (b.height + (b.baseY || 0) > top) top = b.height + (b.baseY || 0);
    for (const l of data?.landmarks?.landmarks || []) if (l.height > top) top = l.height;
  } catch {}
  top = Math.min(top + 30, 600);
  const SCENE_BOX = new THREE.Box3(new THREE.Vector3(-720, -40, -660), new THREE.Vector3(720, top, 780));
  const boxCorners = [];
  for (let i = 0; i < 8; i++) boxCorners.push(new THREE.Vector3(i & 1 ? SCENE_BOX.max.x : SCENE_BOX.min.x, i & 2 ? SCENE_BOX.max.y : SCENE_BOX.min.y, i & 4 ? SCENE_BOX.max.z : SCENE_BOX.min.z));

  // Post-process
  const pr = renderer.getPixelRatio();
  const sz = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(sz.x * pr)), Math.max(1, Math.round(sz.y * pr)), { type: THREE.HalfFloatType, samples: draft ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(sz.x, sz.y);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(sz.x * pr, sz.y * pr), 0.5, 0, 1.0);
  bloom.compositeMaterial.uniforms.bloomFactors.value = [1.0, 0.38, 0.14, 0.05, 0.02]; // dar çekirdek
  // Yüksek geçiren filtre: NaN/Inf ve aşırı parlak pikselleri (başka modüllerden gelebilir) bloom'a sokma —
  // aksi halde bulanıklaştırma zinciri tek bir NaN'ı tüm kareye yayar.
  bloom.materialHighPassFilter.fragmentShader = /* glsl */`
    uniform sampler2D tDiffuse; uniform vec3 defaultColor; uniform float defaultOpacity;
    uniform float luminosityThreshold; uniform float smoothWidth;
    varying vec2 vUv;
    bool badHDR( vec3 c ) { uvec3 u = floatBitsToUint( c ) & 0x7f800000u; return any( equal( u, uvec3( 0x7f800000u ) ) ); }
    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );
      vec3 c = texel.rgb;
      if ( badHDR( c ) ) c = vec3( 0.0 );
      c = clamp( c, 0.0, 48.0 );
      float v = luminance( c );
      float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );
      gl_FragColor = mix( vec4( defaultColor, defaultOpacity ), vec4( c, 1.0 ), alpha );
    }`;
  bloom.materialHighPassFilter.needsUpdate = true;
  bloom.highPassUniforms.smoothWidth.value = 0.15;
  const grade = new ShaderPass(GradeShader);
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(grade);
  grade.uniforms.uAspect.value = sz.x / sz.y;
  if (DEBUG === 'nan') { grade.material.defines.NAN_DEBUG = 1; grade.material.needsUpdate = true; }

  const pal = makePalette();
  const moonCol = new THREE.Color('#a8c0ff');
  const tmp = { v: new THREE.Vector3(), w: new THREE.Vector3(), m: new THREE.Matrix4(), mi: new THREE.Matrix4(), fwd: new THREE.Vector3() };
  let cur = null; // son update durumu (render için)

  function moonDirFor(state, out) {
    // Dolunay: güneşin karşısında doğar (batışta doğuda ufukta), saat ilerledikçe yükselir.
    const az = (state.sunAzimuth ?? 270) - 180 - 12;
    const el = -state.sunElev * 1.3 + 2.0;
    const a = az * D2R, e = el * D2R;
    return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
  }

  function update(state) {
    cur = state;
    const elev = state.sunElev;
    palette(elev, pal);
    sky.sunDir.copy(state.sunDir);
    moonDirFor(state, sky.moonDir);
    sky.zenith.copy(pal.zen); sky.horizon.copy(pal.hor); sky.glow.copy(pal.glow); sky.anti.copy(pal.anti);
    sky.mie.copy(pal.mie).multiplyScalar(smooth(-2.5, 1.5, elev));
    sky.ground.copy(pal.ground); sky.glowW = pal.glowW; sky.on = 1; sky.fogSat = pal.fogSat;
    sky.city.copy(CITY_GLOW).multiplyScalar(pal.city);
    skyU.uEnvSat.value = pal.envSat;

    // Güneş / ay (tek ışık; yön değişimi yoğunluk 0'dayken)
    const sunVis = smooth(-1.0, 2.5, elev);
    const moonVis = smooth(-2.0, -9.0, elev);
    if (elev > -1.5) {
      sun.color.copy(pal.sun);
      sun.intensity = pal.sunI * sunVis;
      tmp.v.copy(state.sunDir);
    } else {
      sun.color.copy(moonCol);
      sun.intensity = 0.55 * moonVis * smooth(-3, 6, moonDirFor(state, tmp.w).y * 57.3);
      tmp.v.copy(tmp.w);
    }
    sun.userData.dir = tmp.v.clone();
    // visible hep true: ışık sayısı değişirse tüm malzemeler yeniden derlenir (≈1.5 sn takılma)

    skyU.uSunCol.value.copy(pal.sun);
    skyU.uSunDisc.value = 60 * smooth(-1.2, 0.5, elev);
    skyU.uMoon.value = smooth(-1, -6, elev);
    skyU.uStars.value = smooth(-9, -16, elev);

    hemi.color.copy(pal.hemiS); hemi.groundColor.copy(pal.hemiG); hemi.intensity = pal.hemiI;
    scene.environmentIntensity = pal.envI;
    scene.fog.density = pal.fog;
    scene.fog.color.copy(pal.hor);

    // Post
    grade.uniforms.uExposure.value = pal.exp;
    grade.uniforms.uSat.value = pal.sat;
    grade.uniforms.uCon.value = pal.con;
    grade.uniforms.uShadowTint.value.copy(pal.shT);
    grade.uniforms.uHighTint.value.copy(pal.hiT);
    bloom.strength = DEBUG === 'nobloom' ? 0 : pal.bloom;
    bloom.enabled = DEBUG !== 'nobloom';
    bloom.threshold = pal.bthr / pal.exp; // eşik ≈ ekran-göreli (§4b: yayıcılar ≈1 üstünde)
    renderer.toneMappingExposure = pal.exp;

    // Ortam haritası: tod aynısıysa yeniden üretme
    if (state.tod !== envTod) {
      envTod = state.tod;
      cubeCam.update(renderer, envScene);
      envRT = envRT ? pmrem.fromCubemap(cubeRT.texture, envRT) : pmrem.fromCubemap(cubeRT.texture);
      scene.environment = envRT.texture;
    }
  }

  // Gölge kamerasını kamera frustum'u ∩ sahne kutusuna sığdır (ışık uzayında), texel'e kenetle.
  const ndc = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  function fitShadow() {
    const dir = sun.userData.dir;
    if (!dir) return;
    // Işık uzayı tabanı: three'nin shadow camera lookAt'i ile aynı (up = +Y)
    tmp.m.lookAt(dir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    tmp.mi.copy(tmp.m).transpose(); // dünya → ışık (yalnız dönme)
    const A = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    const B = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const c of boxCorners) {
      tmp.v.copy(c).applyMatrix4(tmp.mi);
      B.x0 = Math.min(B.x0, tmp.v.x); B.x1 = Math.max(B.x1, tmp.v.x);
      B.y0 = Math.min(B.y0, tmp.v.y); B.y1 = Math.max(B.y1, tmp.v.y);
      B.z0 = Math.min(B.z0, tmp.v.z); B.z1 = Math.max(B.z1, tmp.v.z);
    }
    camera.updateMatrixWorld();
    camera.getWorldDirection(tmp.fwd);
    const camPos = camera.position;
    const dFar = 3200;
    for (const [nx, ny] of ndc) {
      tmp.w.set(nx, ny, 0.5).unproject(camera).sub(camPos).normalize();
      const k = dFar / Math.max(0.05, tmp.w.dot(tmp.fwd));
      for (const dist of [camera.near, k]) {
        tmp.v.copy(camPos).addScaledVector(tmp.w, dist).applyMatrix4(tmp.mi);
        A.x0 = Math.min(A.x0, tmp.v.x); A.x1 = Math.max(A.x1, tmp.v.x);
        A.y0 = Math.min(A.y0, tmp.v.y); A.y1 = Math.max(A.y1, tmp.v.y);
      }
    }
    let x0 = Math.max(A.x0, B.x0), x1 = Math.min(A.x1, B.x1), y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1);
    if (!(x1 > x0 && y1 > y0)) { x0 = B.x0; x1 = B.x1; y0 = B.y0; y1 = B.y1; }
    // Kare harita: büyük kenar, 16 m'ye nicelenmiş (boyut sabit kaldıkça kenarlar kıpırdamaz)
    const Q = 16;
    const size = Math.ceil((Math.max(x1 - x0, y1 - y0) + 20) / Q) * Q;
    const texel = size / MAP;
    const cx = Math.round(((x0 + x1) / 2) / texel) * texel;
    const cy = Math.round(((y0 + y1) / 2) / texel) * texel;
    const zTop = B.z1 + 50;
    // ışık uzayı → dünya
    tmp.v.set(cx, cy, zTop).applyMatrix4(tmp.m);
    sun.position.copy(tmp.v);
    tmp.w.set(cx, cy, zTop - 100).applyMatrix4(tmp.m);
    sun.target.position.copy(tmp.w);
    const sc = sun.shadow.camera;
    sc.left = -size / 2; sc.right = size / 2; sc.bottom = -size / 2; sc.top = size / 2;
    sc.near = 1; sc.far = zTop - B.z0 + 20;
    sc.updateProjectionMatrix();
    sun.shadow.normalBias = Math.max(0.12, texel * 0.9);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
  }

  function render(state) {
    if (state !== cur) update(state);
    dome.position.copy(camera.position);
    dome.scale.setScalar(camera.far * 0.9);
    dome.updateMatrixWorld();
    fitShadow();
    composer.render();
  }

  function resize(w, h, dpr) {
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    grade.uniforms.uAspect.value = w / h;
  }

  return {
    object3D: group,
    update,
    render,
    resize,
    dispose() {
      scene.remove(group);
      for (const [k, v] of Object.entries(chunkBackup)) THREE.ShaderChunk[k] = v;
      for (const n of libPatched) delete THREE.ShaderLib[n].uniforms.atmoSkyB;
      scene.background = prev.background; scene.environment = prev.environment; scene.fog = prev.fog; scene.environmentIntensity = prev.envI;
      composer.dispose?.(); rt.dispose(); bloom.dispose(); cubeRT.dispose(); envRT?.dispose(); pmrem.dispose();
      domeGeo.dispose(); dome.material.dispose(); envDome.material.dispose();
    },
  };
}
