// Yol şeritleri (tek ağ, çizgiler gölgelendiricide), köprü/viyadük gövdesi, ayaklar, bariyerler, metrobüs durağı.
import { GeoBuilder, GLSL_NOISE, lin, rightNormals, segDist, Grid2, clamp } from './util.js';

const C_DECK = lin(0x8d8a84);
const C_UNDER = lin(0x5d5b57);
const C_GIRDER = lin(0x77746e);
const C_PIER = lin(0x9a968f);
const C_BARRIER = lin(0xb4b1aa);
const C_PLAT = lin(0xa5a199);
const C_STEEL = lin(0x4a5058);
const C_CANOPY = lin(0xc9ccd0);
const UP = [1, 1, 1];

export function buildRoads(ctx, net, ground, group) {
  const { THREE, data } = ctx;
  const rb = new GeoBuilder(); // yol yüzeyi
  const sb = new GeoBuilder(); // beton yapı
  const piers = []; // lambalar için: viyadük altı noktaları
  const lightStrips = new GeoBuilder(); // durak/üst geçit aydınlatması (emisif)

  // zemindeki taşıt yolları: ayak yerleşimi bunlardan kaçınır
  const under = new Grid2(50);
  for (const r of net.roads) {
    if (r.bridge || !r.veh || r.ext) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const m = r.width / 2 + 2.5;
      under.addBox(Math.min(a[0], b[0]) - m, Math.min(a[2], b[2]) - m, Math.max(a[0], b[0]) + m, Math.max(a[2], b[2]) + m, { a, b, m, c: r.width / 2 - 1 });
    }
  }
  const onCarriageway = (x, z) => {
    for (const s of under.at(x, z)) if (segDist(x, z, s.a[0], s.a[2], s.b[0], s.b[2]) < s.c) return true;
    return false;
  };
  const onRoad = (x, z) => {
    for (const s of under.at(x, z)) if (segDist(x, z, s.a[0], s.a[2], s.b[0], s.b[2]) < s.m) return true;
    return false;
  };

  // köprü altı kalıcı gölge: tabliyenin altında kalan yol köşeleri koyulaştırılır (gölge haritasından bağımsız)
  const decks = new Grid2(60);
  for (const r of net.roads) {
    if (!r.bridge || !r.veh) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const m = r.width / 2 + 1.5;
      decks.addBox(Math.min(a[0], b[0]) - m, Math.min(a[2], b[2]) - m, Math.max(a[0], b[0]) + m, Math.max(a[2], b[2]) + m, { a, b, m });
    }
  }
  const underDeck = (x, z, y) => {
    let k = 0;
    for (const s of decks.at(x, z)) {
      if (Math.min(s.a[1], s.b[1]) - y < 3) continue;
      const d = segDist(x, z, s.a[0], s.a[2], s.b[0], s.b[2]);
      k = Math.max(k, 1 - clamp((d - (s.m - 3)) / 3, 0, 1));
    }
    return k;
  };

  for (const r of net.roads) {
    const draw = r.veh || r.cls === 'pedestrian' || r.bridge;
    if (!draw) continue;
    const pts = r.pts;
    const n = pts.length;
    const rn = rightNormals(pts);
    const hw = r.width / 2;
    const theta = r.type === 3 ? 0.1 + 0.5 * clamp(Math.abs(pts[0][0]) / 1400, 0, 1) : 0;
    let v = 0;
    const L = [];
    const R = [];
    const row = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      if (i > 0) v += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
      const y = p[1] + r.yOff;
      const lx = p[0] - rn[i][0] * hw;
      const lz = p[2] - rn[i][1] * hw;
      const rx = p[0] + rn[i][0] * hw;
      const rz = p[2] + rn[i][1] * hw;
      L.push([lx, y, lz]);
      R.push([rx, y, rz]);
      const th = r.type === 3 ? 0.1 + 0.5 * clamp(Math.abs(p[0]) / 1400, 0, 1) : theta;
      const a = rb.vert(lx, y, lz, 0, 1, 0, UP, 0, v, r.width, r.lanes, r.type, r.oneway ? 1 : 0, th, r.bridge ? 0 : underDeck(lx, lz, y));
      const b = rb.vert(rx, y, rz, 0, 1, 0, UP, r.width, v, r.width, r.lanes, r.type, r.oneway ? 1 : 0, th, r.bridge ? 0 : underDeck(rx, rz, y));
      row.push([a, b]);
      if (i > 0) rb.idx.push(row[i - 1][0], row[i - 1][1], a, row[i - 1][1], b, a);
    }

    const strip = (A, yTopOff, yBotOff, outward, col) => {
      // A: kenar noktaları; outward: +1 sağ kenar, −1 sol kenar
      let prev = null;
      for (let i = 0; i < n; i++) {
        const nx = rn[i][0] * outward;
        const nz = rn[i][1] * outward;
        const t = sb.vert(A[i][0], A[i][1] + yTopOff, A[i][2], nx, 0, nz, col);
        const bt = sb.vert(A[i][0], A[i][1] + yBotOff, A[i][2], nx, 0, nz, col);
        if (prev) {
          if (outward > 0) sb.idx.push(prev[0], prev[1], t, prev[1], bt, t);
          else sb.idx.push(prev[0], t, prev[1], prev[1], t, bt);
        }
        prev = [t, bt];
      }
    };
    const barrier = (A, outward, h, th) => {
      // kenarın iç tarafında th kalınlığında, h yüksekliğinde bariyer
      const inner = A.map((p, i) => [p[0] - rn[i][0] * outward * th, p[1], p[2] - rn[i][1] * outward * th]);
      strip(A, h, -0.1, outward, C_BARRIER);
      strip(inner, h, -0.02, -outward, C_BARRIER);
      let prev = null;
      for (let i = 0; i < n; i++) {
        const a = sb.vert(A[i][0], A[i][1] + h, A[i][2], 0, 1, 0, C_BARRIER);
        const b = sb.vert(inner[i][0], inner[i][1] + h, inner[i][2], 0, 1, 0, C_BARRIER);
        if (prev) {
          if (outward > 0) sb.idx.push(prev[1], prev[0], b, prev[0], a, b);
          else sb.idx.push(prev[0], prev[1], a, prev[1], b, a);
        }
        prev = [a, b];
      }
    };

    if (r.bridge) {
      const foot = !r.veh;
      const slab = foot ? 0.5 : 0.55;
      const depth = foot ? 0.5 : 1.6;
      strip(R, 0, -slab, 1, C_DECK);
      strip(L, 0, -slab, -1, C_DECK);
      // alt yüz (döşeme altı) + boyuna kirişler: alttan bakınca düz bir levha değil, taşıyıcı okunur
      const soffit = (A, B, dy, col) => {
        let prev = null;
        for (let i = 0; i < n; i++) {
          const a = sb.vert(A[i][0], A[i][1] + dy, A[i][2], 0, -1, 0, col);
          const b = sb.vert(B[i][0], B[i][1] + dy, B[i][2], 0, -1, 0, col);
          if (prev) sb.idx.push(prev[0], a, prev[1], prev[1], a, b);
          prev = [a, b];
        }
      };
      soffit(L, R, -slab, C_UNDER);
      if (!foot) {
        const ng = Math.max(2, Math.round(r.width / 3.1));
        for (let k = 0; k < ng; k++) {
          const o = -hw + ((k + 0.5) * 2 * hw) / ng;
          const GL = pts.map((p, i) => [p[0] + rn[i][0] * (o - 0.38), p[1] + r.yOff, p[2] + rn[i][1] * (o - 0.38)]);
          const GR = pts.map((p, i) => [p[0] + rn[i][0] * (o + 0.38), p[1] + r.yOff, p[2] + rn[i][1] * (o + 0.38)]);
          strip(GR, -slab, -depth, 1, C_GIRDER);
          strip(GL, -slab, -depth, -1, C_GIRDER);
          soffit(GL, GR, -depth, C_UNDER);
        }
      }
      barrier(R, 1, foot ? 1.2 : 0.9, foot ? 0.12 : 0.35);
      barrier(L, -1, foot ? 1.2 : 0.9, foot ? 0.12 : 0.35);
      // ayaklar
      const step = foot ? 22 : 32;
      let acc = step * 0.5;
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
        while (acc < l) {
          const t = acc / l;
          let x = a[0] + (b[0] - a[0]) * t;
          let z = a[2] + (b[2] - a[2]) * t;
          const y = a[1] + (b[1] - a[1]) * t + r.yOff - depth;
          const ang = Math.atan2(b[2] - a[2], b[0] - a[0]);
          // alttaki taşıt yolunun ortasına ayak koyma: boyuna kaydırmayı dene
          let free = false;
          for (const sh of [0, 7, -7, 13, -13]) {
            const qx = x + ((b[0] - a[0]) / l) * sh;
            const qz = z + ((b[2] - a[2]) / l) * sh;
            if (!onCarriageway(qx, qz)) {
              x = qx;
              z = qz;
              free = true;
              break;
            }
          }
          const gy = ground.gY(x, z);
          if (y - gy > 2.2 && free) {
            if (foot) {
              sb.box(x, gy - 1, z, 0.35, y - gy + 1, 0.35, ang, C_STEEL);
            } else {
              const capH = 1.3;
              sb.box(x, gy - 1.5, z, 0.9, y - gy + 1.5 - capH, Math.min(1.6, hw * 0.3), ang, C_PIER);
              sb.box(x, y - capH, z, 1.1, capH, hw * 0.82, ang, C_PIER, [0, 0, 0, 0], false, true);
              if (r.viaduct || y - gy > 5) piers.push({ x, z, y: y - 0.25, gy, w: hw });
            }
          }
          acc += step;
        }
        acc -= l;
      }
    } else if (r.type === 0 || r.type === 3 || r.type === 5) {
      const d = r.ext ? -22 : -5;
      strip(R, 0, d, 1, C_PIER);
      strip(L, 0, d, -1, C_PIER);
      if (r.type === 3) {
        barrier(R, 1, 0.8, 0.3);
        barrier(L, -1, 0.8, 0.3);
      }
    }
  }

  // ---- metrobüs durakları ----------------------------------------------------------------
  const plats = ((data.pois && data.pois.platforms) || []).filter((p) => p.kind === 'metrobus' && !p.closed && p.pts && p.pts.length >= 2);
  const busRoads = net.roads.filter((r) => r.type === 3 && !r.ext);
  const yNear = (x, z, fallback) => {
    let best = 1e9;
    let y = fallback;
    for (const r of busRoads) {
      for (const p of r.pts) {
        const d = (p[0] - x) ** 2 + (p[2] - z) ** 2;
        if (d < best) {
          best = d;
          y = p[1] + r.yOff;
        }
      }
    }
    return best < 40 * 40 ? y : fallback;
  };
  const stations = [];
  for (const p of plats) {
    const a = p.pts[0];
    const b = p.pts[p.pts.length - 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 40) continue;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const cx = (a[0] + b[0]) / 2;
    const cz = (a[1] + b[1]) / 2;
    // D-100 ortasındaki ada peron mu? (İETT peronları meydan tarafında, onlar yalnız boyalı)
    const y0 = yNear(cx, cz, null);
    if (y0 === null) continue;
    const ya = yNear(a[0], a[1], y0);
    const yb = yNear(b[0], b[1], y0);
    const yTop = Math.max(y0, ya, yb);
    const hx = len / 2;
    sb.box(cx, Math.min(ya, yb, y0) - 0.5, cz, hx, yTop - Math.min(ya, yb, y0) + 0.5 + 0.38, 1.9, ang, C_PLAT);
    const py = yTop + 0.38;
    // saçak: iki sıra direk + ince çatı
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let d = -hx + 4; d <= hx - 4; d += 8) {
      for (const s of [-1.2, 1.2]) sb.box(cx + d * ca - s * sa, py, cz + d * sa + s * ca, 0.09, 3.3, 0.09, ang, C_STEEL);
    }
    sb.box(cx, py + 3.3, cz, hx - 2, 0.22, 2.6, ang, C_CANOPY, [0, 0, 0, 0], true, true);
    // saçak altı ışık şeridi + peron kenarı çizgileri
    lightStrips.box(cx, py + 3.2, cz, hx - 3, 0.1, 0.5, ang, [0.86, 0.95, 1.0], [0.02, 0, 0, 0], false, true);
    stations.push({ x: cx, z: cz, y: py, ang, hx });
  }
  // yaya üst geçitleri: korkuluk boyunca ışık çizgisi
  for (const r of net.roads) {
    if (!r.bridge || r.veh) continue;
    for (let i = 0; i + 1 < r.pts.length; i++) {
      const a = r.pts[i];
      const b = r.pts[i + 1];
      const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (l < 0.5) continue;
      lightStrips.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + r.yOff + 1.2, (a[2] + b[2]) / 2, l / 2, 0.08, r.width / 2 + 0.05, Math.atan2(b[2] - a[2], b[0] - a[0]), [1.0, 0.9, 0.7], [0.12, 0, 0, 0], true, false);
    }
  }

  // ---- ağlar -------------------------------------------------------------------------------
  const roadMat = roadMaterial(THREE, ctx.uniforms);
  const roadMesh = new THREE.Mesh(rb.build(THREE, { color: false }), roadMat);
  roadMesh.name = 'city-roads';
  roadMesh.receiveShadow = true;
  roadMesh.castShadow = false;
  group.add(roadMesh);

  const sMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.45 });
  // beton: dünya uzayında leke / akıntı izi / kalıp derzi
  sMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityPos; varying vec3 vCityN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCityPos = position; vCityN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCityPos; varying vec3 vCityN;\n${GLSL_NOISE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 an = abs(vCityN);
          vec2 q = an.y > 0.6 ? vCityPos.xz : (an.x > an.z ? vCityPos.zy : vCityPos.xy);
          float n1 = cFbm(q * 0.22);
          float n2 = cNoise(q * 2.1);
          float streak = cNoise(vec2(q.x * 1.3, q.y * 0.09)) * (1.0 - step(0.6, an.y));
          float joint = (1.0 - step(0.6, an.y)) * (1.0 - smoothstep(0.0, 0.04, abs(fract(q.y / 1.5) - 0.5) - 0.47));
          diffuseColor.rgb *= (0.74 + 0.38 * n1) * (0.95 + 0.1 * n2) * (1.0 - 0.22 * streak) * (1.0 - 0.12 * joint);
        }`,
      );
  };
  {
    const prev = sMat.onBeforeCompile;
    sMat.onBeforeCompile = (sh) => {
      prev(sh);
      // aşağı bakan yüzler (tabliye ve kiriş altları) gökten ışık almaz
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <aomap_fragment>',
        '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.3, smoothstep(-0.2, -0.7, vCityN.y)); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }',
      );
    };
  }
  sMat.customProgramCacheKey = () => 'city-concrete-v2';
  const sMesh = new THREE.Mesh(sb.build(THREE, { uvw: false, info: false }), sMat);
  sMesh.name = 'city-structures';
  sMesh.castShadow = true;
  sMesh.receiveShadow = true;
  group.add(sMesh);

  // saçak / üst geçit ışıkları: eşikli emisif (aInfo.x = θ)
  const lMat = new THREE.ShaderMaterial({
    uniforms: { uLit: ctx.uniforms.uLit },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo; attribute vec3 color; varying vec3 vC; varying float vTh;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vC = color; vTh = aInfo.x;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLit; varying vec3 vC; varying float vTh;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        float on = smoothstep(vTh, vTh + 0.03, uLit);
        gl_FragColor = vec4(mix(vC * 0.5, vC * 2.6, on), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
    side: THREE.DoubleSide,
  });
  if (lightStrips.count) {
    const lm = new THREE.Mesh(lightStrips.build(THREE, { uvw: false }), lMat);
    lm.name = 'city-lightstrips';
    group.add(lm);
  }

  return { piers, stations, onRoad };
}

function roadMaterial(THREE, uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, envMapIntensity: 0.3 });
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -2;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = uniforms.uLit;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aUvw; attribute vec4 aInfo; varying vec4 vUvw; varying vec4 vInfo; varying vec3 vCityPos;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUvw = aUvw; vInfo = aInfo; vCityPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vUvw; varying vec4 vInfo; varying vec3 vCityPos;
        uniform float uLit;
        vec3 cEmis; float cRough;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${ROAD_GLSL}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = cRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cEmis;')
      // tabliye altı: ortam ışığı ve gök yansıması kısılır (kalıcı gölge)
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.22, vInfo.w); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }');
  };
  mat.customProgramCacheKey = () => 'city-road-v2';
  return mat;
}

const ROAD_GLSL = /* glsl */ `
cEmis = vec3(0.0); cRough = 0.9;
{
  float u = vUvw.x; float v = vUvw.y; float w = vUvw.z; float lanes = max(1.0, vUvw.w);
  float type = vInfo.x; float oneway = vInfo.y;
  float n1 = cFbm(vCityPos.xz * 0.07);
  float n2 = cNoise(vCityPos.xz * 1.3);
  vec3 asp = vec3(0.07, 0.07, 0.073);
  if (type > 1.5 && type < 2.5) asp = vec3(0.092, 0.09, 0.088);
  if (type > 3.5 && type < 4.5) asp = vec3(0.36, 0.34, 0.31);
  if (type > 2.5 && type < 3.5) asp = vec3(0.075, 0.066, 0.062);
  asp *= 0.8 + 0.4 * n1 + (n2 - 0.5) * 0.12;
  float lw = w / lanes;
  float fu = fwidth(u); float fv = fwidth(v);
  // teker izleri: şerit ortası biraz açık, izler koyu
  float lanePos = fract(u / lw);
  float major = step(type, 1.5) + step(2.5, type) * step(type, 3.5) + step(4.5, type);
  asp *= 1.0 - 0.1 * major * smoothstep(0.25, 0.0, abs(abs(lanePos - 0.5) - 0.24)) * (1.0 - smoothstep(0.2, 0.6, fu / lw));
  vec3 col = asp;
  if (major > 0.5) {
    float hwid = 0.09;
    float aaU = max(fu, 1e-4);
    float vis = clamp(hwid * 2.0 / aaU, 0.0, 1.0);
    // kenar çizgileri
    float de = min(abs(u - 0.35), abs(u - (w - 0.35)));
    float edge = (1.0 - smoothstep(hwid - aaU * 0.5, hwid + aaU * 0.5, de)) * vis;
    // şerit çizgileri
    float line = 0.0;
    if (lanes > 1.5) {
      float k = floor(u / lw + 0.5);
      float dl = abs(u - k * lw);
      float inner = step(0.5, k) * step(k, lanes - 0.5);
      float center = (1.0 - oneway) * step(abs(k - lanes * 0.5), 0.25);
      float dash = mix(step(fract(v / 9.0), 0.36), 1.0, center);
      dash = mix(dash, 0.36, smoothstep(2.0, 6.0, fv) * (1.0 - center));
      line = (1.0 - smoothstep(hwid - aaU * 0.5, hwid + aaU * 0.5, dl)) * inner * dash * vis;
    }
    float mark = max(edge, line);
    col = mix(asp, vec3(0.62, 0.62, 0.6) * (0.75 + 0.3 * n2), mark * 0.9);
  }
  if (type > 2.5 && type < 3.5) {
    // metrobüs: kenarlarda kesintisiz ışık şeridi, yüzeyde hafif ışıma
    float on = smoothstep(vInfo.z, vInfo.z + 0.035, uLit);
    float bw = max(0.3, fu * 1.4);
    float band = 1.0 - smoothstep(bw * 0.6, bw, min(u, w - u));
    float gain = 0.3 / bw;
    band *= 1.3;
    vec3 sc = vec3(0.42, 0.8, 1.0);
    cEmis = sc * on * (band * 9.0 * mix(1.0, gain * 2.2, smoothstep(0.3, 1.2, bw)) + 0.14);
  }
  cRough = 0.9 + 0.08 * n1;
  diffuseColor.rgb = col * mix(1.0, 0.8, vInfo.w);
}
`;
