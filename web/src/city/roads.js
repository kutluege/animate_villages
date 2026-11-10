// Yol şeritleri (tek ağ, çizgiler gölgelendiricide), köprü/viyadük gövdesi, ayaklar, bariyerler, metrobüs durağı.
import { GeoBuilder, GLSL_NOISE, lin, rightNormals, segDist, Grid2, clamp, h1 } from './util.js';
import { TILES } from './decals.js';

const C_DECK = lin(0x8d8a84);
const C_UNDER = lin(0x5d5b57);
const C_GIRDER = lin(0x77746e);
const C_PIER = lin(0x9a968f);
const C_BARRIER = lin(0xb4b1aa);
const C_PLAT = lin(0xa5a199);
const C_STEEL = lin(0x4a5058);
const C_CANOPY = lin(0xc9ccd0);
const UP = [1, 1, 1];

export function buildRoads(ctx, net, ground, group, decals) {
  const { THREE, data } = ctx;
  const rb = new GeoBuilder(); // yol yüzeyi
  const sb = new GeoBuilder(); // beton yapı
  const piers = []; // viyadük ayakları (konumları SABİT — kamera rotası buna göre)
  const fixtures = []; // tabliye altına asılı armatürler (gündüz de soluk yanar)
  const C_FIX = [1.0, 0.62, 0.26];
  let pierNo = 0;
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

    const strip = (A, yTopOff, yBotOff, outward, col, fl = 0) => {
      // A: kenar noktaları; outward: +1 sağ kenar, −1 sol kenar
      let prev = null;
      for (let i = 0; i < n; i++) {
        const nx = rn[i][0] * outward;
        const nz = rn[i][1] * outward;
        const t = sb.vert(A[i][0], A[i][1] + yTopOff, A[i][2], nx, 0, nz, col, 0, 0, 0, 0, fl);
        const bt = sb.vert(A[i][0], A[i][1] + yBotOff, A[i][2], nx, 0, nz, col, 0, 0, 0, 0, fl);
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
          const a = sb.vert(A[i][0], A[i][1] + dy, A[i][2], 0, -1, 0, col, 0, 0, 0, 0, 1);
          const b = sb.vert(B[i][0], B[i][1] + dy, B[i][2], 0, -1, 0, col, 0, 0, 0, 0, 1);
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
          strip(GR, -slab, -depth, 1, C_GIRDER, 1);
          strip(GL, -slab, -depth, -1, C_GIRDER, 1);
          soffit(GL, GR, -depth, C_UNDER);
        }
        // enine kirişler (8 m ritim) + aralarında asılı armatürler
        let dAcc = 4;
        let dk = 0;
        for (let i = 1; i < n; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
          const ang = Math.atan2(b[2] - a[2], b[0] - a[0]);
          while (dAcc < l) {
            const t = dAcc / l;
            const x = a[0] + (b[0] - a[0]) * t;
            const z = a[2] + (b[2] - a[2]) * t;
            const y = a[1] + (b[1] - a[1]) * t + r.yOff;
            sb.box(x, y - depth + 0.12, z, 0.16, depth - slab - 0.1, hw - 0.12, ang, C_GIRDER, [1, 0, 0, 0], false, true);
            dk++;
            if (dk % 2 === 0) {
              const gy = ground.gY(x, z);
              if (y - depth - gy > 4) {
                const sdv = (dk % 4 === 0 ? 1 : -1) * hw * 0.45;
                const fx = x + 4 * Math.cos(ang) - Math.sin(ang) * sdv;
                const fz = z + 4 * Math.sin(ang) + Math.cos(ang) * sdv;
                const fy = y - depth - 0.55;
                sb.box(fx, fy + 0.1, fz, 0.03, 0.5, 0.03, ang, C_STEEL, [1, 0, 0, 0], false, false);
                sb.box(fx, fy, fz, 0.5, 0.12, 0.16, ang, C_STEEL, [1, 0, 0, 0], true, false);
                lightStrips.box(fx, fy - 0.03, fz, 0.44, 0.03, 0.12, ang, C_FIX, [0.03 + 0.08 * h1(dk, i, 5), 0.4, 0, 0], false, true);
                fixtures.push({ x: fx, y: fy - 0.05, z: fz, gy: ground.gY(fx, fz) });
              }
            }
            dAcc += 8;
          }
          dAcc -= l;
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
              sb.box(x, y - capH, z, 1.1, capH, hw * 0.82, ang, C_PIER, [1, 0, 0, 0], false, true);
              const hz = Math.min(1.6, hw * 0.3);
              pierDecals(decals, x, gy, z, ang, 0.9, hz, y - capH - gy, pierNo++);
              // yağmur iniş borusu
              sb.box(x + Math.cos(ang) * 0.98 - Math.sin(ang) * (hz - 0.25), gy - 0.5, z + Math.sin(ang) * 0.98 + Math.cos(ang) * (hz - 0.25), 0.07, y - capH - gy + 0.5, 0.07, ang, C_STEEL);
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
    lightStrips.box(cx, py + 3.16, cz, hx - 2.4, 0.1, 1.9, ang, [0.5, 0.86, 1.0], [0.02, 0.12, 2.2, 0], false, true);
    for (const s of [-1.86, 1.86]) lightStrips.box(cx - s * sa, py - 0.06, cz + s * ca, hx - 0.5, 0.07, 0.06, ang, [0.45, 0.85, 1.0], [0.03, 0, 2.0, 0], true, false);
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
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo; varying vec3 vCityPos; varying vec3 vCityN; varying float vUnder;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCityPos = position; vCityN = normal; vUnder = aInfo.x;');
    sh.uniforms.uLit = ctx.uniforms.uLit;
    sh.uniforms.uNight = ctx.uniforms.uNight;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vCityPos; varying vec3 vCityN; varying float vUnder; uniform float uLit; uniform float uNight; vec3 cEmis;\n${GLSL_NOISE}`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cEmis;')
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
          // tabliye altı: su izi, kireç çiçeği, is; zeminden seken ılık ışık ve gece sodyum yıkaması
          float down = smoothstep(-0.2, -0.7, vCityN.y);
          float leak = smoothstep(0.55, 0.8, cFbm(q * vec2(0.5, 0.07) + 11.0));
          float soot = smoothstep(0.35, 0.75, cFbm(q * 0.09 + 3.0));
          float lime = smoothstep(0.8, 0.9, cNoise(q * vec2(5.0, 0.4) + 5.0)) * 0.22;
          diffuseColor.rgb *= mix(1.0, (1.0 - 0.45 * leak) * (1.0 - 0.3 * soot), vUnder);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.55), lime * vUnder);
          float boards = 1.0 - 0.2 * down * (1.0 - smoothstep(0.0, 0.03, abs(fract(q.y / 0.6) - 0.5) - 0.46));
          diffuseColor.rgb *= mix(1.0, boards, vUnder);
          float side = mix(0.4, 1.0, down);
          cEmis = diffuseColor.rgb * vUnder * side * (vec3(0.62, 0.52, 0.42) * 0.3 * (1.0 - uNight)
            + vec3(1.0, 0.55, 0.22) * 0.32 * smoothstep(0.02, 0.2, uLit) * (0.35 + 0.65 * cNoise(vCityPos.xz * 0.07)));
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
        '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.58, max(smoothstep(-0.2, -0.7, vCityN.y), vUnder)); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }',
      );
    };
  }
  sMat.customProgramCacheKey = () => 'city-concrete-v4';
  const sMesh = new THREE.Mesh(sb.build(THREE, { uvw: false }), sMat);
  sMesh.name = 'city-structures';
  sMesh.castShadow = true;
  sMesh.receiveShadow = true;
  group.add(sMesh);

  // saçak / üst geçit ışıkları: eşikli emisif (aInfo.x = θ)
  const lMat = new THREE.ShaderMaterial({
    uniforms: { uLit: ctx.uniforms.uLit },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo; attribute vec3 color; varying vec3 vC; varying vec3 vTh;
      #include <common>
      #include <fog_pars_vertex>
      void main(){ vC = color; vTh = aInfo.xyz;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLit; varying vec3 vC; varying vec3 vTh;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        // aInfo: x = θ, y = gündüz asgari parlaklık, z = gece kazancı (0 → 1)
        float on = max(vTh.y, smoothstep(vTh.x, vTh.x + 0.03, uLit));
        gl_FragColor = vec4(mix(vC * 0.5, vC * 2.6 * (vTh.z > 0.0 ? vTh.z : 1.0), on), 1.0);
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

  return { piers, fixtures, stations, onRoad, onCarriageway, underDeck };
}

// Ayak yüzlerine afiş / grafiti / numara / ikaz şeridi / yön levhası.
function pierDecals(decals, x, gy, z, ang, hx, hz, h, no) {
  if (!decals || h < 3) return;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // yüzler: [normal (yerel), yüz yarı genişliği, merkezden uzaklık]
  const faces = [[1, 0, hz, hx], [-1, 0, hz, hx], [0, 1, hx, hz], [0, -1, hx, hz]];
  faces.forEach(([lx, lz, fw, fd], f) => {
    const nx = lx * ca - lz * sa;
    const nz = lx * sa + lz * ca;
    const rx = nz;
    const rz = -nx;
    const cx = x + nx * fd;
    const cz = z + nz * fd;
    const put = (tile, off, y0, hw2, hh, glow = -1) => decals.add(tile, [cx + rx * off, gy + y0 + hh, cz + rz * off], [rx * hw2, 0, rz * hw2], [0, hh, 0], [nx, 0, nz], glow);
    put(TILES.hazard, 0, 0.05, fw, 0.5);
    const r0 = h1(no, f, 1);
    const r1 = h1(no, f, 2);
    const r2 = h1(no, f, 3);
    if (f === 0) put(TILES.num(no), 0, Math.min(h - 1.2, 3.0), Math.min(fw, 0.6), Math.min(fw, 0.6));
    if (r0 < 0.75) {
      const k = Math.max(1, Math.floor(fw / 0.42));
      for (let j = 0; j < k; j++) {
        if (h1(no, f * 7 + j, 4) < 0.3) continue;
        put(TILES.poster(Math.floor(h1(no, f * 7 + j, 5) * 16)), (j - (k - 1) / 2) * 0.72, 1.15 + 0.25 * h1(no, f * 7 + j, 6), 0.33, 0.44);
      }
    }
    if (r1 < 0.4 && fw > 0.8) put(TILES.graf(Math.floor(r2 * 8)), 0, 2.15, Math.min(fw, 1.1), 0.55);
    if (f < 2 && h > 5.6 && h1(no, f, 8) < 0.3) put(TILES.sign(Math.floor(h1(no, f, 9) * 8)), 0, 3.3, Math.min(fw + 0.25, 1.6), Math.min(fw + 0.25, 1.6));
  });
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
      .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ float cAo = mix(1.0, 0.72, vInfo.w); reflectedLight.indirectDiffuse *= cAo; reflectedLight.indirectSpecular *= cAo; }');
  };
  mat.customProgramCacheKey = () => 'city-road-v3';
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
  {
    // yama, yağ lekesi, rögar kapağı (yakında okunur, uzakta söner)
    float fine = (1.0 - smoothstep(0.06, 0.3, fu)) * step(type, 3.5);
    vec2 pc = floor(vec2(u / 2.3, v / 7.0));
    float ph = cH21(pc + type * 3.0);
    asp *= mix(1.0, 0.72 + 0.6 * cH21(pc + 9.0), step(0.84, ph) * fine);
    float oil = smoothstep(0.6, 0.85, cNoise(vec2(u * 2.5, v * 0.22))) * smoothstep(0.3, 0.0, abs(lanePos - 0.5));
    asp *= 1.0 - 0.4 * oil * fine;
    vec2 mc = vec2(u - lw * (floor(u / lw) + 0.5), mod(v, 37.0) - 18.0);
    float md = length(mc);
    float mh = step(0.6, cH21(vec2(floor(u / lw), floor(v / 37.0)))) * fine;
    asp = mix(asp, vec3(0.03), (1.0 - smoothstep(0.34, 0.38, md)) * mh);
    asp *= 1.0 + 0.8 * mh * (smoothstep(0.38, 0.4, md) - smoothstep(0.44, 0.47, md));
    float crack = (1.0 - smoothstep(0.0, 0.05, abs(cNoise(vec2(u * 0.6, v * 0.5)) - 0.5))) * fine;
    asp *= 1.0 - 0.3 * crack;
  }
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
  float wet = smoothstep(0.5, 0.7, cFbm(vCityPos.xz * 0.11 + 4.0)) * (0.2 + 0.8 * vInfo.w) * step(type, 3.5);
  cRough = mix(cRough, 0.16, wet * 0.85);
  diffuseColor.rgb = col * (1.0 - 0.3 * wet) * mix(1.0, 0.92, vInfo.w);
}
`;
