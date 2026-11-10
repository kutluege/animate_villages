// Atmosfer — A yorumu: sıcak, analog, sinematik.
// Gök (analitik kubbe + bulut + güneş/ay), yükseklik sisi (güneş yönünde içe saçılımlı), güneş/ay ışığı +
// kameraya uyarlanan kararlı gölge, gökten PMREM scene.environment, HDR → bloom/halasyon/anamorfik iz →
// ACES → renk derecelendirme → vinyet + deterministik gren. Her şey yalnızca (tod, t) + kamera pozundan.
// CONTRACT §4b, §5, §6, §7.
import * as THREE from 'three';
import { smoothstep, clamp01, dirFromAzEl } from './timeline.js';

const D2R = Math.PI / 180;

// ───────────────────────────── palet (güneş yüksekliğine göre anahtar kareler) ─────────────────────────────
const _c = new THREE.Color();
/** sRGB hex → doğrusal [r,g,b] × k */
const C = (hex, k = 1) => { _c.set(hex); return [_c.r * k, _c.g * k, _c.b * k]; };
const Z = [0, 0, 0];

// e: güneş yüksekliği (°). Referans: 16:30≈32 · 18:45≈5 · 19:20≈−0.6 · 19:50≈−5.6 · 21:30≈−21
const KEYS = [
  { e: 40, zen: C('#3f74bd', 1.0), hor: C('#c4c8c8', 1.0), fog: C('#bfb39c', 0.9), fogSun: C('#ffd8a0', 0.55), glowPow: 7,
    bandLow: Z, bandHigh: Z, belt: Z, ground: C('#857a6a', 0.9),
    cloudLit: C('#fff4e6', 1.5), cloudBase: C('#b4b6bc', 0.85), cloudCov: 0.34,
    sunI: 5.6, diskI: 45, moonI: 0, envI: 1.0, density: 3.9e-4,
    exposure: 0.82, bloom: 0.035, thresh: 2.2, hal: 0.05, streak: 0.0,
    wb: [1.05, 1.0, 0.93], sat: 0.92, contrast: 1.06, lift: [0.016, 0.014, 0.010], vig: 0.22, grain: 0.016 },
  { e: 32, zen: C('#3f74bd', 1.0), hor: C('#c4c8c8', 1.0), fog: C('#bfb39c', 0.9), fogSun: C('#ffd8a0', 0.55), glowPow: 7,
    bandLow: Z, bandHigh: Z, belt: Z, ground: C('#857a6a', 0.9),
    cloudLit: C('#fff4e6', 1.5), cloudBase: C('#b4b6bc', 0.85), cloudCov: 0.34,
    sunI: 5.6, diskI: 45, moonI: 0, envI: 1.0, density: 3.9e-4,
    exposure: 0.82, bloom: 0.035, thresh: 2.2, hal: 0.05, streak: 0.0,
    wb: [1.05, 1.0, 0.93], sat: 0.92, contrast: 1.06, lift: [0.016, 0.014, 0.010], vig: 0.22, grain: 0.016 },
  { e: 15, zen: C('#4475b6', 0.9), hor: C('#cfc6b6', 0.95), fog: C('#cbb593', 0.85), fogSun: C('#ffc684', 0.85), glowPow: 6,
    bandLow: C('#ffc890', 0.05), bandHigh: Z, belt: Z, ground: C('#85735e', 0.8),
    cloudLit: C('#ffe6c4', 1.45), cloudBase: C('#aca4a2', 0.72), cloudCov: 0.35,
    sunI: 5.8, diskI: 45, moonI: 0, envI: 1.0, density: 3.8e-4,
    exposure: 0.86, bloom: 0.045, thresh: 2.0, hal: 0.06, streak: 0.01,
    wb: [1.06, 1.0, 0.91], sat: 0.98, contrast: 1.07, lift: [0.016, 0.013, 0.009], vig: 0.24, grain: 0.016 },
  { e: 5, zen: C('#4a6cab', 0.72), hor: C('#e9bf92', 0.85), fog: C('#d0a074', 0.7), fogSun: C('#ffa04a', 1.5), glowPow: 4.5,
    bandLow: C('#ffa060', 0.28), bandHigh: C('#e08a80', 0.04), belt: Z, ground: C('#7a5a42', 0.55),
    cloudLit: C('#ffae6a', 1.6), cloudBase: C('#94788a', 0.45), cloudCov: 0.38,
    sunI: 7.0, diskI: 50, moonI: 0, envI: 1.0, density: 3.6e-4,
    exposure: 0.95, bloom: 0.07, thresh: 1.6, hal: 0.09, streak: 0.03,
    wb: [1.07, 1.0, 0.88], sat: 1.1, contrast: 1.08, lift: [0.016, 0.011, 0.010], vig: 0.28, grain: 0.018 },
  { e: 1.5, zen: C('#3c5694', 0.5), hor: C('#ea9a6a', 0.6), fog: C('#b47c66', 0.45), fogSun: C('#ff7434', 1.3), glowPow: 4,
    bandLow: C('#ff6c3c', 0.45), bandHigh: C('#d0607a', 0.1), belt: C('#c890a8', 0.03), ground: C('#604048', 0.25),
    cloudLit: C('#ff7c4c', 1.4), cloudBase: C('#74587a', 0.26), cloudCov: 0.4,
    sunI: 7.0, diskI: 55, moonI: 0, envI: 1.05, density: 3.5e-4,
    exposure: 1.0, bloom: 0.08, thresh: 1.4, hal: 0.11, streak: 0.035,
    wb: [1.05, 1.0, 0.92], sat: 1.12, contrast: 1.08, lift: [0.014, 0.010, 0.012], vig: 0.3, grain: 0.019 },
  { e: -0.6, zen: C('#2a3f7e', 0.3), hor: C('#d67a64', 0.4), fog: C('#86687c', 0.3), fogSun: C('#ff5a2c', 0.6), glowPow: 5,
    bandLow: C('#ff4a2a', 0.6), bandHigh: C('#a04a96', 0.2), belt: C('#d088a4', 0.07), ground: C('#4c3646', 0.12),
    cloudLit: C('#ff6448', 1.05), cloudBase: C('#58446a', 0.14), cloudCov: 0.4,
    sunI: 0, diskI: 55, moonI: 0, envI: 1.1, density: 3.4e-4,
    exposure: 1.14, bloom: 0.09, thresh: 1.25, hal: 0.12, streak: 0.035,
    wb: [1.03, 1.0, 0.96], sat: 1.12, contrast: 1.08, lift: [0.012, 0.008, 0.014], vig: 0.32, grain: 0.02 },
  { e: -3, zen: C('#24407c', 0.26), hor: C('#8a5a80', 0.22), fog: C('#6a4e6c', 0.2), fogSun: C('#d65a40', 0.4), glowPow: 3.4,
    bandLow: C('#e04a30', 0.32), bandHigh: C('#86468e', 0.12), belt: C('#a07098', 0.04), ground: C('#3c3044', 0.07),
    cloudLit: C('#dc5a64', 0.42), cloudBase: C('#3a3458', 0.08), cloudCov: 0.4,
    sunI: 0, diskI: 0, moonI: 0.03, envI: 1.25, density: 3.4e-4,
    exposure: 1.12, bloom: 0.1, thresh: 1.2, hal: 0.12, streak: 0.035,
    wb: [0.99, 1.0, 1.02], sat: 1.08, contrast: 1.08, lift: [0.010, 0.008, 0.016], vig: 0.34, grain: 0.022 },
  { e: -5.6, zen: C('#1a347e', 0.2), hor: C('#4a5c9c', 0.15), fog: C('#4a5280', 0.13), fogSun: C('#d0603a', 0.2), glowPow: 5,
    bandLow: C('#e06038', 0.2), bandHigh: C('#3a3c86', 0.03), belt: Z, ground: C('#3a3040', 0.06),
    cloudLit: C('#8a5274', 0.12), cloudBase: C('#262a4c', 0.06), cloudCov: 0.4,
    sunI: 0, diskI: 0, moonI: 0.08, envI: 1.5, density: 3.2e-4,
    exposure: 1.15, bloom: 0.11, thresh: 1.2, hal: 0.12, streak: 0.04,
    wb: [0.95, 1.0, 1.07], sat: 1.1, contrast: 1.08, lift: [0.008, 0.009, 0.022], vig: 0.36, grain: 0.024 },
  { e: -10, zen: C('#18204e', 0.24), hor: C('#4a3a5c', 0.3), fog: C('#56404e', 0.3), fogSun: C('#7a3a34', 0.06), glowPow: 3,
    bandLow: C('#803830', 0.04), bandHigh: Z, belt: Z, ground: C('#4a3428', 0.1),
    cloudLit: C('#80503c', 0.22), cloudBase: C('#1e1c32', 0.08), cloudCov: 0.4,
    sunI: 0, diskI: 0, moonI: 0.28, envI: 1.8, density: 3.2e-4,
    exposure: 1.12, bloom: 0.12, thresh: 1.2, hal: 0.12, streak: 0.04,
    wb: [0.97, 1.0, 1.04], sat: 1.06, contrast: 1.08, lift: [0.011, 0.008, 0.020], vig: 0.38, grain: 0.026 },
  { e: -21, zen: C('#1c1838', 0.45), hor: C('#56383c', 0.45), fog: C('#5a3c38', 0.4), fogSun: Z, glowPow: 3,
    bandLow: Z, bandHigh: Z, belt: Z, ground: C('#5a3a26', 0.13),
    cloudLit: C('#8a5638', 0.3), cloudBase: C('#2a1e2c', 0.1), cloudCov: 0.4,
    sunI: 0, diskI: 0, moonI: 0.35, envI: 2.0, density: 3.2e-4,
    exposure: 1.12, bloom: 0.12, thresh: 1.2, hal: 0.12, streak: 0.04,
    wb: [1.0, 1.0, 1.02], sat: 1.04, contrast: 1.08, lift: [0.013, 0.008, 0.017], vig: 0.4, grain: 0.028 },
  { e: -90, zen: C('#1c1838', 0.45), hor: C('#56383c', 0.45), fog: C('#5a3c38', 0.4), fogSun: Z, glowPow: 3,
    bandLow: Z, bandHigh: Z, belt: Z, ground: C('#5a3a26', 0.13),
    cloudLit: C('#8a5638', 0.3), cloudBase: C('#2a1e2c', 0.1), cloudCov: 0.4,
    sunI: 0, diskI: 0, moonI: 0.35, envI: 2.0, density: 3.2e-4,
    exposure: 1.12, bloom: 0.12, thresh: 1.2, hal: 0.12, streak: 0.04,
    wb: [1.0, 1.0, 1.02], sat: 1.04, contrast: 1.08, lift: [0.013, 0.008, 0.017], vig: 0.4, grain: 0.028 },
];

function lerpVal(a, b, u) {
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * u);
  return a + (b - a) * u;
}
/** Saf: güneş yüksekliği → palet (anahtarlar arası doğrusal). */
export function palette(elev) {
  let i = 0;
  while (i < KEYS.length - 2 && elev < KEYS[i + 1].e) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const u = clamp01((A.e - elev) / (A.e - B.e));
  const out = {};
  for (const k of Object.keys(A)) out[k] = lerpVal(A[k], B[k], u);
  return out;
}

/** Hava kütlesi sönümüyle güneş rengi (doğrusal). Yükseklik düştükçe sarı → turuncu → kızıl. */
function sunColor(elev, out) {
  const e = Math.max(elev, -1);
  const m = 1 / (Math.sin(Math.max(e, 0) * D2R + 0.0001) + 0.15 * Math.pow(e + 3.885, -1.253));
  const k = Math.min(m, 40);
  return out.set(Math.exp(-0.042 * k), Math.exp(-0.098 * k), Math.exp(-0.215 * k));
}

/** Ay yönü: doğu-güneydoğudan yükselen ay (tod'un saf fonksiyonu). */
function moonDir(tod, out) {
  const az = 100 + (tod - 18) * 11;
  const el = -6 + (tod - 18) * 11.5;
  return dirFromAzEl(az, el, out);
}

// ───────────────────────────── küresel sis bölütü (ShaderChunk yaması) ─────────────────────────────
// Yükseklik sisi + güneş yönünde içe saçılım. Uniform'lar Float32Array: cloneUniforms bunları referansla
// paylaştırır, böylece tüm yerleşik malzemeler aynı değerleri görür. Uniform'u olmayan özel ShaderMaterial'lar
// (atmoFogA.w = 0) standart scene.fog davranışına düşer.
const FOG_U = {
  atmoFogA: { value: new Float32Array(4) }, // xyz güneş yönü, w etkin
  atmoFogB: { value: new Float32Array(4) }, // rgb güneş yönü rengi, w üs
  atmoFogC: { value: new Float32Array(4) }, // x düşüş (1/m), y yer yoğunluğu, z zemin kotu, w uzak tam sis mesafesi
};
const FOG_LIBS = ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'points', 'dashed', 'sprite'];
let _origChunks = null;

function installFog() {
  const SC = THREE.ShaderChunk;
  if (!_origChunks) _origChunks = {
    fog_pars_vertex: SC.fog_pars_vertex, fog_vertex: SC.fog_vertex,
    fog_pars_fragment: SC.fog_pars_fragment, fog_fragment: SC.fog_fragment,
  };
  SC.fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorld;
#endif`;
  SC.fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWorld = cameraPosition + ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif`;
  SC.fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorld;
	uniform vec4 atmoFogA;
	uniform vec4 atmoFogB;
	uniform vec4 atmoFogC;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
  SC.fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	vec3 fogCol = fogColor;
	if ( atmoFogA.w > 0.5 ) {
		vec3 fd = vFogWorld - cameraPosition;
		float fl = length( fd );
		vec3 fv = fd / max( fl, 1e-3 );
		float fb = atmoFogC.x;
		float fdy = fd.y * fb;
		float fh = abs( fdy ) > 1e-3 ? ( 1.0 - exp( - fdy ) ) / fdy : 1.0 - 0.5 * fdy;
		float od = atmoFogC.y * exp( - fb * ( cameraPosition.y - atmoFogC.z ) ) * fl * fh;
		fogFactor = max( 1.0 - exp( - od ), smoothstep( atmoFogC.w * 0.45, atmoFogC.w, fl ) );
		float fmu = max( dot( fv, atmoFogA.xyz ), 0.0 );
		fogCol = fogColor + atmoFogB.rgb * pow( fmu, atmoFogB.w );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif`;
  for (const k of FOG_LIBS) {
    const L = THREE.ShaderLib[k];
    if (L) Object.assign(L.uniforms, FOG_U);
  }
}
function uninstallFog() {
  if (_origChunks) Object.assign(THREE.ShaderChunk, _origChunks);
  for (const k of FOG_LIBS) {
    const L = THREE.ShaderLib[k];
    if (L) for (const u of Object.keys(FOG_U)) delete L.uniforms[u];
  }
  FOG_U.atmoFogA.value[3] = 0;
}

// ───────────────────────────── gök kubbesi ─────────────────────────────
const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
	vDir = position;
	vec4 p = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	gl_Position = p;
}`;

const SKY_FRAG = /* glsl */`
uniform vec3 uSunDir, uMoonDir;
uniform vec3 uZen, uHor, uFog, uFogSun;
uniform float uGlowPow;
uniform vec3 uBandLow, uBandHigh, uBelt, uGround;
uniform vec3 uSunCol;
uniform float uDisk, uDiskR;
uniform vec3 uCloudLit, uCloudBase;
uniform float uCloudCov;
uniform vec3 uMoonCol;
uniform float uMoon;
uniform vec4 uHaze;   // x düşüş, y yer yoğunluğu, z kamera yüksekliği − zemin
uniform float uEnv;
varying vec3 vDir;

float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
float vnoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	vec2 u = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
	float a = 0.5, s = 0.0;
	for ( int i = 0; i < 5; i ++ ) { s += a * vnoise( p ); p = mat2( 1.6, 1.2, - 1.2, 1.6 ) * p + 11.7; a *= 0.5; }
	return s;
}

void main() {
	vec3 d = normalize( vDir );
	float y = d.y;
	float mu = dot( d, uSunDir );
	float mup = max( mu, 0.0 );
	float glow = pow( mup, uGlowPow );
	vec3 fogDir = uFog + uFogSun * glow;
	float yy = max( y, 0.0 );

	// gök gradyanı
	vec3 sky = mix( uHor, uZen, pow( yy, 0.55 ) );
	sky += uFogSun * glow * 0.6 * exp( - yy / 0.22 );
	vec2 h2 = normalize( d.xz + vec2( 1e-5 ) ), s2 = normalize( uSunDir.xz + vec2( 1e-5 ) );
	float az = dot( h2, s2 ) * 0.5 + 0.5;
	float sunSide = az * az;
	sky += uBandLow * exp( - yy / 0.05 ) * ( 0.2 + 0.8 * sunSide );
	float bh = ( yy - 0.14 ) / 0.1, bv = ( yy - 0.07 ) / 0.05, ia = 1.0 - az;
	sky += uBandHigh * exp( - bh * bh ) * ( 0.35 + 0.65 * sunSide );
	sky += uBelt * exp( - bv * bv ) * ia * ia;

	// pus: sonsuza giden ışının yükseklik sisi optik derinliği
	float od = uHaze.y * exp( - uHaze.x * uHaze.z ) / ( uHaze.x * max( yy, 0.003 ) );
	float haze = 1.0 - exp( - od );

	// bulutlar (ince, uzanmış; ufukta solar)
	if ( y > 0.0 ) {
		vec2 p = d.xz / ( y + 0.08 );
		p = mat2( 0.83, 0.55, - 0.55, 0.83 ) * p;
		p *= vec2( 0.55, 1.9 );
		float n = fbm( p * 1.15 + vec2( 4.3, 1.7 ) );
		float n2 = fbm( p * 3.1 + vec2( 9.1, 3.3 ) );
		float cov = smoothstep( 1.0 - uCloudCov, 1.0 - uCloudCov + 0.22, n * 0.8 + n2 * 0.28 );
		cov *= smoothstep( 0.015, 0.11, y );
		float thick = clamp( ( n - ( 1.0 - uCloudCov ) ) * 3.0, 0.0, 1.0 );
		vec3 cc = mix( uCloudLit * ( 0.55 + 1.6 * pow( mup, 3.0 ) ), uCloudBase, thick * 0.7 );
		sky = mix( sky, cc, cov * 0.62 );
	}
	sky = mix( sky, fogDir, haze );

	// güneş diski + hale
	float ang = acos( clamp( mu, - 1.0, 1.0 ) );
	float disk = 1.0 - smoothstep( uDiskR * 0.8, uDiskR, ang );
	float above = smoothstep( - 0.004, 0.006, y );
	sky += uSunCol * ( uDisk * disk + uDisk * 0.012 * exp( - ang / ( uDiskR * 3.0 ) ) ) * above;

	// ay
	float mang = acos( clamp( dot( d, uMoonDir ), - 1.0, 1.0 ) );
	float mdisk = 1.0 - smoothstep( 0.0085, 0.0105, mang );
	float mtex = 0.82 + 0.18 * vnoise( ( d.xz - uMoonDir.xz ) * 900.0 );
	sky += uMoonCol * uMoon * ( mdisk * mtex + 0.02 * exp( - mang / 0.05 ) ) * smoothstep( 0.0, 0.03, y );

	// ufkun altı
	if ( uEnv > 0.5 ) {
		vec3 g = mix( fogDir, uGround, smoothstep( 0.0, - 0.12, y ) );
		sky = mix( sky, g, smoothstep( 0.0, - 0.02, y ) );
	} else {
		sky = mix( sky, fogDir, smoothstep( 0.0, - 0.02, y ) );
	}
	gl_FragColor = vec4( max( sky, vec3( 0.0 ) ), 1.0 );
}`;

// ───────────────────────────── post-process gölgelendiricileri ─────────────────────────────
const FS_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

// 13 dokunuşlu aşağı örnekleme (+ ilk kademede yumuşak eşik ve Karis ağırlığı → kıvılcım yok)
const DOWN_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPrefilter, uThresh, uKnee;
varying vec2 vUv;
vec3 S( vec2 o ) { return texture2D( tSrc, vUv + o * uTexel ).rgb; }
float lum( vec3 c ) { return dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); }
vec3 pf( vec3 c ) {
	c = min( c, vec3( 200.0 ) );
	float br = max( c.r, max( c.g, c.b ) );
	float rq = clamp( br - uThresh + uKnee, 0.0, 2.0 * uKnee );
	rq = rq * rq / ( 4.0 * uKnee + 1e-4 );
	return c * max( rq, br - uThresh ) / max( br, 1e-4 );
}
void main() {
	vec3 a = S( vec2( - 2, - 2 ) ), b = S( vec2( 0, - 2 ) ), c = S( vec2( 2, - 2 ) );
	vec3 d = S( vec2( - 1, - 1 ) ), e = S( vec2( 1, - 1 ) );
	vec3 f = S( vec2( - 2, 0 ) ), g = S( vec2( 0, 0 ) ), h = S( vec2( 2, 0 ) );
	vec3 i = S( vec2( - 1, 1 ) ), j = S( vec2( 1, 1 ) );
	vec3 k = S( vec2( - 2, 2 ) ), l = S( vec2( 0, 2 ) ), m = S( vec2( 2, 2 ) );
	vec3 o;
	if ( uPrefilter > 0.5 ) {
		a = pf( a ); b = pf( b ); c = pf( c ); d = pf( d ); e = pf( e ); f = pf( f ); g = pf( g );
		h = pf( h ); i = pf( i ); j = pf( j ); k = pf( k ); l = pf( l ); m = pf( m );
		vec3 g0 = ( d + e + i + j ) * 0.25, g1 = ( a + b + f + g ) * 0.25, g2 = ( b + c + g + h ) * 0.25;
		vec3 g3 = ( f + g + k + l ) * 0.25, g4 = ( g + h + l + m ) * 0.25;
		float w0 = 1.0 / ( 1.0 + lum( g0 ) ), w1 = 1.0 / ( 1.0 + lum( g1 ) ), w2 = 1.0 / ( 1.0 + lum( g2 ) );
		float w3 = 1.0 / ( 1.0 + lum( g3 ) ), w4 = 1.0 / ( 1.0 + lum( g4 ) );
		o = ( g0 * w0 * 0.5 + ( g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4 ) * 0.125 ) / ( w0 * 0.5 + ( w1 + w2 + w3 + w4 ) * 0.125 );
	} else {
		o = ( d + e + i + j ) * 0.125 + ( a + c + k + m ) * 0.03125 + ( b + f + h + l ) * 0.0625 + g * 0.125;
	}
	gl_FragColor = vec4( o, 1.0 );
}`;

// 9 dokunuşlu çadır yukarı örnekleme, ince seviye ile karıştır (saçılma)
const UP_FRAG = /* glsl */`
uniform sampler2D tLow, tHigh;
uniform vec2 uTexel;
uniform float uScatter;
varying vec2 vUv;
void main() {
	vec2 t = uTexel;
	vec3 s = texture2D( tLow, vUv + vec2( - t.x, - t.y ) ).rgb + texture2D( tLow, vUv + vec2( t.x, - t.y ) ).rgb
		+ texture2D( tLow, vUv + vec2( - t.x, t.y ) ).rgb + texture2D( tLow, vUv + vec2( t.x, t.y ) ).rgb
		+ 2.0 * ( texture2D( tLow, vUv + vec2( 0.0, - t.y ) ).rgb + texture2D( tLow, vUv + vec2( 0.0, t.y ) ).rgb
		+ texture2D( tLow, vUv + vec2( - t.x, 0.0 ) ).rgb + texture2D( tLow, vUv + vec2( t.x, 0.0 ) ).rgb )
		+ 4.0 * texture2D( tLow, vUv ).rgb;
	s /= 16.0;
	vec3 h = texture2D( tHigh, vUv ).rgb;
	gl_FragColor = vec4( mix( h, s, uScatter ), 1.0 );
}`;

// Yatay anamorfik iz (tek boyutlu, seyreltilmiş adımlarla genişleyen)
const STREAK_FRAG = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uStep;
varying vec2 vUv;
void main() {
	vec3 s = vec3( 0.0 ); float wsum = 0.0;
	for ( int i = - 7; i <= 7; i ++ ) {
		float x = float( i );
		float w = exp( - abs( x ) * 0.32 );
		s += texture2D( tSrc, vUv + vec2( x * uStep * uTexel.x, 0.0 ) ).rgb * w;
		wsum += w;
	}
	gl_FragColor = vec4( s / wsum, 1.0 );
}`;

const FINAL_FRAG = /* glsl */`
uniform sampler2D tHDR, tBloom, tHal, tStreak;
uniform vec2 uRes;
uniform float uExposure, uBloom, uHal, uStreak;
uniform vec3 uHalTint, uStreakTint, uWB, uLift, uShadowTint;
uniform float uSat, uContrast, uVig, uGrain, uFrame, uCA;
varying vec2 vUv;

vec3 RRTAndODTFit( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
vec3 aces( vec3 color ) {
	const mat3 IM = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
	const mat3 OM = mat3( vec3( 1.60475, - 0.10208, - 0.00327 ), vec3( - 0.53108, 1.10813, - 0.07276 ), vec3( - 0.07367, - 0.00605, 1.07602 ) );
	color = IM * color; color = RRTAndODTFit( color ); color = OM * color;
	return clamp( color, 0.0, 1.0 );
}
vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( vec3( 0.0031308 ), c ) ); }
float hash13( vec3 p3 ) { p3 = fract( p3 * 0.1031 ); p3 += dot( p3, p3.zyx + 31.32 ); return fract( ( p3.x + p3.y ) * p3.z ); }

void main() {
	vec2 uv = vUv;
	vec2 cc = uv - 0.5;
	// hafif lateral renk sapması (köşelerde ~uCA piksel)
	vec2 caOff = cc * dot( cc, cc ) * 4.0 * uCA / uRes;
	vec3 hdr;
	hdr.r = texture2D( tHDR, uv - caOff ).r;
	hdr.g = texture2D( tHDR, uv ).g;
	hdr.b = texture2D( tHDR, uv + caOff ).b;
	vec3 bloom = texture2D( tBloom, uv ).rgb;
	vec3 hal = texture2D( tHal, uv ).rgb;
	vec3 streak = texture2D( tStreak, uv ).rgb;
	vec3 c = hdr + bloom * uBloom + hal * uHalTint * uHal + streak * uStreakTint * uStreak;
	c *= uWB * ( uExposure / 0.6 );
	c = aces( c );
	c = toSRGB( c );
	// derecelendirme (görüntü uzayında)
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c = mix( vec3( l ), c, uSat );
	c = clamp( ( c - 0.5 ) * uContrast + 0.5, 0.0, 1.0 );
	float l2 = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	c *= mix( vec3( 1.0 ), uShadowTint, ( 1.0 - l2 ) * ( 1.0 - l2 ) );
	c = c + uLift * ( 1.0 - c );
	// vinyet (dikey kadraja göre eliptik)
	vec2 vc = cc * vec2( 1.0, 0.82 );
	float r2 = dot( vc, vc ) * 2.6;
	c *= mix( 1.0, max( 0.0, 1.0 - r2 * r2 * 0.55 - r2 * 0.25 ), uVig );
	// gren: piksel + kare indeksi → deterministik; orta tonlarda en belirgin
	vec2 gp = floor( gl_FragCoord.xy );
	float n = hash13( vec3( gp, uFrame ) ) + hash13( vec3( gp + 71.3, uFrame + 17.0 ) ) - 1.0;
	float lw = 4.0 * l * ( 1.0 - l ) * 0.75 + 0.25;
	c += n * uGrain * lw;
	gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`;

// ───────────────────────────── modül ─────────────────────────────
export async function create(ctx) {
  const { scene, camera, renderer, quality, heightAt } = ctx;
  const FINAL = quality !== 'draft';

  installFog();

  const group = new THREE.Group();
  group.name = 'atmosphere-a';

  // ── ışıklar: tek yönlü ışık (gündüz güneş, gece ay — geçişte yoğunluk 0 iken yön değişir) ──
  const light = new THREE.DirectionalLight(0xffffff, 0);
  light.name = 'sun-moon';
  light.castShadow = true;
  const SM = FINAL ? 4096 : 2048;
  light.shadow.mapSize.set(SM, SM);
  light.shadow.camera.near = 0.5;
  light.shadow.bias = -0.00002;
  light.shadow.radius = 1;
  group.add(light, light.target);
  // gece dolgusu: sokak lambalarının zemine/cephelere sodyum sıçraması + şehir parıltısı (gölgesiz)
  const fill = new THREE.HemisphereLight(0xffb27a, 0x3a2a20, 0);
  fill.name = 'city-fill';
  group.add(fill);

  // ── gök kubbesi ──
  const skyU = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uZen: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() },
    uFog: { value: new THREE.Vector3() }, uFogSun: { value: new THREE.Vector3() }, uGlowPow: { value: 4 },
    uBandLow: { value: new THREE.Vector3() }, uBandHigh: { value: new THREE.Vector3() }, uBelt: { value: new THREE.Vector3() },
    uGround: { value: new THREE.Vector3() },
    uSunCol: { value: new THREE.Vector3() }, uDisk: { value: 0 }, uDiskR: { value: 0.0095 },
    uCloudLit: { value: new THREE.Vector3() }, uCloudBase: { value: new THREE.Vector3() }, uCloudCov: { value: 0.35 },
    uMoonCol: { value: new THREE.Vector3(0.85, 0.9, 1.0) }, uMoon: { value: 0 },
    uHaze: { value: new THREE.Vector4(1 / 220, 5e-4, 30, 0) },
  };
  const makeSkyMat = (env) => new THREE.ShaderMaterial({
    name: env ? 'atmo-a-sky-env' : 'atmo-a-sky',
    uniforms: env
      ? { ...skyU, uEnv: { value: 1 }, uHaze: { value: new THREE.Vector4(1 / 220, 5e-4, 30, 0) }, uDisk: { value: 0 }, uDiskR: { value: 0.03 } }
      : { ...skyU, uEnv: { value: 0 } },
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false, toneMapped: false,
  });
  const skyGeo = new THREE.SphereGeometry(1, 96, 48);
  const skyMat = makeSkyMat(false);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = 'sky'; sky.scale.setScalar(20000); sky.frustumCulled = false; sky.renderOrder = -1000;
  sky.castShadow = false; sky.receiveShadow = false;
  group.add(sky);

  // ── ortam: gök → küp → PMREM (yeniden kullanılan hedefler) ──
  const envScene = new THREE.Scene();
  const envMat = makeSkyMat(true);
  const envSky = new THREE.Mesh(skyGeo, envMat);
  envSky.scale.setScalar(50); envSky.frustumCulled = false;
  envScene.add(envSky);
  const cubeRT = new THREE.WebGLCubeRenderTarget(FINAL ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.5, 200, cubeRT);
  envScene.add(cubeCam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  let envKey = null;

  // ── sis ──
  scene.fog = new THREE.FogExp2(0x9a9080, 4e-4);
  scene.background = null;
  FOG_U.atmoFogA.value[3] = 1;

  // ── post-process hedefleri ──
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
  const LEVELS = 6;
  let W = 1, H = 1;
  let hdrRT = null, down = [], up = [], streakA = null, streakB = null;
  function allocTargets(w, h) {
    W = Math.max(1, w); H = Math.max(1, h);
    for (const t of [hdrRT, streakA, streakB, ...down, ...up]) t?.dispose();
    hdrRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: true, samples: 4 });
    down = []; up = [];
    let w2 = W, h2 = H;
    for (let i = 0; i < LEVELS; i++) {
      w2 = Math.max(1, Math.round(w2 / 2)); h2 = Math.max(1, Math.round(h2 / 2));
      down.push(new THREE.WebGLRenderTarget(w2, h2, rtOpts));
      if (i < LEVELS - 1) up.push(new THREE.WebGLRenderTarget(w2, h2, rtOpts));
    }
    const sw = Math.max(1, Math.round(W / 4)), sh = Math.max(1, Math.round(H / 8));
    streakA = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
    streakB = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
  }
  const dbs = renderer.getDrawingBufferSize(new THREE.Vector2());
  allocTargets(dbs.x, dbs.y);

  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsGeo = new THREE.PlaneGeometry(2, 2);
  const fsMesh = new THREE.Mesh(fsGeo);
  fsMesh.frustumCulled = false;
  const fsScene = new THREE.Scene();
  fsScene.add(fsMesh);
  const passMat = (frag, uniforms) => new THREE.ShaderMaterial({
    uniforms, vertexShader: FS_VERT, fragmentShader: frag, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const downMat = passMat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
    uPrefilter: { value: 0 }, uThresh: { value: 1 }, uKnee: { value: 0.5 } });
  const upMat = passMat(UP_FRAG, { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uScatter: { value: 0.72 } });
  const streakMat = passMat(STREAK_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uStep: { value: 1 } });
  const finalMat = passMat(FINAL_FRAG, {
    tHDR: { value: null }, tBloom: { value: null }, tHal: { value: null }, tStreak: { value: null },
    uRes: { value: new THREE.Vector2() }, uExposure: { value: 1 }, uBloom: { value: 0.05 }, uHal: { value: 0.1 }, uStreak: { value: 0 },
    uHalTint: { value: new THREE.Vector3(1.0, 0.32, 0.12) }, uStreakTint: { value: new THREE.Vector3(0.55, 0.72, 1.0) },
    uWB: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() }, uShadowTint: { value: new THREE.Vector3(0.9, 1.0, 1.1) },
    uSat: { value: 1 }, uContrast: { value: 1 }, uVig: { value: 0.3 }, uGrain: { value: 0.02 }, uFrame: { value: 0 }, uCA: { value: 1.2 },
  });
  function blit(mat, target) {
    fsMesh.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(fsScene, fsCam);
  }

  // ── durum (her karede saf olarak yeniden hesaplanır) ──
  const sunCol = new THREE.Color();
  const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), mDir = new THREE.Vector3(), center = new THREE.Vector3();
  const lx = new THREE.Vector3(), ly = new THREE.Vector3();
  let P = palette(30);
  let frameNo = 0;

  function setV(u, arr) { u.value.set(arr[0], arr[1], arr[2]); }

  function updateShadowFrustum(lightDir) {
    // Kameranın görüş kesitini (yakın..f) saran küre → dönmeden bağımsız boyut; merkez ışık uzayında
    // gölge texel'ine kenetlenir, yarıçap 1/6 oktav adımlarla nicelenir → kareler arası kayma/titreme yok.
    camera.getWorldDirection(fwd);
    const cp = camera.position;
    const g = heightAt ? heightAt(cp.x, cp.z) : 0;
    const camH = Math.max(8, cp.y - g);
    const f = Math.min(1800, Math.max(320, 1.8 * camH / Math.max(-fwd.y, 0.08)));
    const n = 1;
    const ty = Math.tan(camera.fov * 0.5 * D2R);
    const k2 = ty * ty * (1 + camera.aspect * camera.aspect);
    let cd, r;
    if (k2 >= (f - n) / (f + n)) { cd = f; r = f * Math.sqrt(k2); }
    else { cd = 0.5 * (f + n) * (1 + k2); r = 0.5 * Math.sqrt((f - n) ** 2 + 2 * (f * f + n * n) * k2 + (f + n) ** 2 * k2 * k2); }
    r = Math.min(r, 1150);
    r = Math.pow(2, Math.ceil(Math.log2(r) * 6) / 6);
    center.copy(cp).addScaledVector(fwd, cd);
    // ışık uzayı tabanı (Matrix4.lookAt ile aynı: z = ışık yönü, x = up × z)
    lx.crossVectors(THREE.Object3D.DEFAULT_UP, lightDir);
    if (lx.lengthSq() < 1e-8) lx.set(1, 0, 0);
    lx.normalize();
    ly.crossVectors(lightDir, lx).normalize();
    const texel = (2 * r) / SM;
    const a = Math.round(center.dot(lx) / texel) * texel;
    const b = Math.round(center.dot(ly) / texel) * texel;
    const c = center.dot(lightDir);
    center.set(0, 0, 0).addScaledVector(lx, a).addScaledVector(ly, b).addScaledVector(lightDir, c);
    const back = 4000;
    light.target.position.copy(center);
    light.position.copy(center).addScaledVector(lightDir, r + back);
    const sc = light.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.near = 0.5; sc.far = 2 * r + back;
    sc.updateProjectionMatrix();
    light.shadow.normalBias = texel * 1.4;
    light.updateMatrixWorld(); light.target.updateMatrixWorld();
  }

  function update(state) {
    const elev = state.sunElev;
    P = palette(elev);
    const sd = state.sunDir;
    sunColor(elev, sunCol);
    moonDir(state.tod, mDir);

    // gök uniform'ları
    skyU.uSunDir.value.copy(sd);
    skyU.uMoonDir.value.copy(mDir);
    setV(skyU.uZen, P.zen); setV(skyU.uHor, P.hor); setV(skyU.uFog, P.fog); setV(skyU.uFogSun, P.fogSun);
    skyU.uGlowPow.value = P.glowPow;
    setV(skyU.uBandLow, P.bandLow); setV(skyU.uBandHigh, P.bandHigh); setV(skyU.uBelt, P.belt); setV(skyU.uGround, P.ground);
    const diskFade = smoothstep(-1.2, 0.3, elev);
    skyU.uSunCol.value.set(sunCol.r, sunCol.g, sunCol.b);
    skyU.uDisk.value = P.diskI * diskFade;
    setV(skyU.uCloudLit, P.cloudLit); setV(skyU.uCloudBase, P.cloudBase); skyU.uCloudCov.value = P.cloudCov;
    skyU.uMoon.value = 1.6 * smoothstep(-3, -9, elev) * smoothstep(-2, 6, Math.asin(mDir.y) / D2R);
    const g0 = heightAt ? heightAt(camera.position.x, camera.position.z) : 0;
    const hz = skyU.uHaze.value;
    hz.set(1 / 220, P.density, Math.max(0, camera.position.y - g0), 0);
    sky.position.copy(camera.position);
    sky.updateMatrixWorld();

    // sis
    scene.fog.color.setRGB(P.fog[0], P.fog[1], P.fog[2]);
    scene.fog.density = P.density * 0.9;
    const A = FOG_U.atmoFogA.value, B = FOG_U.atmoFogB.value, Cc = FOG_U.atmoFogC.value;
    A[0] = sd.x; A[1] = sd.y; A[2] = sd.z; A[3] = 1;
    B[0] = P.fogSun[0]; B[1] = P.fogSun[1]; B[2] = P.fogSun[2]; B[3] = P.glowPow;
    Cc[0] = 1 / 220; Cc[1] = P.density; Cc[2] = 0; Cc[3] = 8500;

    // ışık: güneş (yükseklik > −1.5°) ya da ay
    const sunFade = smoothstep(-1.0, 2.0, elev);
    const moonFade = smoothstep(-2.5, -9, elev);
    if (elev > -1.5) {
      light.color.copy(sunCol);
      light.intensity = P.sunI * sunFade;
      updateShadowFrustum(sd);
    } else {
      light.color.setRGB(0.62, 0.72, 1.0);
      light.intensity = P.moonI * moonFade;
      updateShadowFrustum(mDir.y > 0.05 ? mDir : tmpV.set(mDir.x, 0.05, mDir.z).normalize());
    }
    light.shadow.radius = elev > -1.5 ? 1 : 3;
    fill.intensity = 0.3 * smoothstep(-1.5, -14, elev);

    // ortam (yalnızca tod'a bağlı → anahtar = tod)
    const key = state.tod.toFixed(5);
    if (key !== envKey) {
      envMat.uniforms.uHaze.value.set(1 / 220, P.density, 30, 0);
      envMat.uniforms.uDisk.value = Math.min(skyU.uDisk.value, 30) * 0.25;
      cubeCam.update(renderer, envScene);
      envRT = pmrem.fromCubemap(cubeRT.texture, envRT);
      scene.environment = envRT.texture;
      envKey = key;
    }
    scene.environmentIntensity = P.envI;

    // geri dönüş yolu (render() çökerse main doğrudan çizer)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = P.exposure;
    frameNo = Math.round((state.t || 0) * 30) % 4096;
  }

  function render(state) {
    // 1) sahne → HDR
    renderer.setRenderTarget(hdrRT);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    // 2) bloom zinciri
    const du = downMat.uniforms;
    du.uThresh.value = P.thresh; du.uKnee.value = Math.max(0.2, P.thresh * 0.5);
    let src = hdrRT.texture, sw = W, sh = H;
    for (let i = 0; i < LEVELS; i++) {
      du.tSrc.value = src; du.uTexel.value.set(1 / sw, 1 / sh); du.uPrefilter.value = i === 0 ? 1 : 0;
      blit(downMat, down[i]);
      src = down[i].texture; sw = down[i].width; sh = down[i].height;
    }
    let low = down[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      upMat.uniforms.tLow.value = low.texture; upMat.uniforms.tHigh.value = down[i].texture;
      upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      blit(upMat, up[i]);
      low = up[i];
    }
    // 3) anamorfik iz (çeyrek genişlik, 1/8 yükseklik)
    const su = streakMat.uniforms;
    if (P.streak > 0.001) {
      su.tSrc.value = down[1].texture; su.uTexel.value.set(1 / streakA.width, 1 / streakA.height); su.uStep.value = 1;
      blit(streakMat, streakA);
      su.tSrc.value = streakA.texture; su.uStep.value = 4;
      blit(streakMat, streakB);
      su.tSrc.value = streakB.texture; su.uStep.value = 14;
      blit(streakMat, streakA);
    }
    // 4) son: ton eşleme + derecelendirme → ekran
    const fu = finalMat.uniforms;
    fu.tHDR.value = hdrRT.texture; fu.tBloom.value = up[0].texture; fu.tHal.value = down[1].texture;
    fu.tStreak.value = streakA.texture;
    fu.uRes.value.set(W, H);
    fu.uExposure.value = P.exposure; fu.uBloom.value = P.bloom; fu.uHal.value = P.hal; fu.uStreak.value = P.streak;
    fu.uWB.value.set(P.wb[0], P.wb[1], P.wb[2]); fu.uLift.value.set(P.lift[0], P.lift[1], P.lift[2]);
    fu.uSat.value = P.sat; fu.uContrast.value = P.contrast; fu.uVig.value = P.vig; fu.uGrain.value = P.grain;
    fu.uFrame.value = frameNo;
    blit(finalMat, null);
  }

  function resize(w, h, dpr = 1) {
    allocTargets(Math.round(w * dpr), Math.round(h * dpr));
  }

  // ?atmoglass=1 → yansıma denetimi için cam kule (yalnızca hata ayıklama)
  if (ctx.params?.get('atmoglass') === '1') {
    const gm = new THREE.MeshPhysicalMaterial({ color: 0x8a9aa6, metalness: 0.9, roughness: 0.06 });
    for (const [x, z, h, ry] of [[-60, -40, 150, 0.3], [120, 60, 110, -0.5]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(36, h, 28), gm);
      m.position.set(x, (heightAt ? heightAt(x, z) : 0) + h / 2, z); m.rotation.y = ry;
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
  }

  if (ctx.params?.get('atmobench') === '1') window.__atmoA = { update, render, get hdrRT() { return hdrRT; } };

  scene.add(group);
  return {
    object3D: group,
    update,
    render,
    resize,
    dispose() {
      scene.remove(group);
      for (const t of [hdrRT, streakA, streakB, cubeRT, envRT, ...down, ...up]) t?.dispose();
      pmrem.dispose();
      for (const m of [skyMat, envMat, downMat, upMat, streakMat, finalMat]) m.dispose();
      skyGeo.dispose(); fsGeo.dispose();
      if (scene.environment === envRT?.texture) scene.environment = null;
      scene.fog = null;
      uninstallFog();
    },
  };
}
