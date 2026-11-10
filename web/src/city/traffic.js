// Trafik: gündüz sıkışık ve ağır araç gövdeleri; gece uzun pozlama gibi ışık izleri.
// Konum yalnız state.t'nin saf fonksiyonu: s = s0 + vGündüz·t + (vGece − vGündüz)·F(t), F = ∫ akışkanlık dτ.
import { Path, lin, offsetLine, smoothstep, clamp } from './util.js';
import { todAt, DURATION, FPS } from '../core/timeline.js';
import { carGeometry, vanGeometry, longGeometry, vehicleMaterial } from './vehicles.js';

const REG = {
  trunk: { gap: 7.4, vDay: 2.6, vNight: 21, keep: 0.5 },
  trunk_link: { gap: 11, vDay: 3.0, vNight: 13, keep: 0.5 },
  primary: { gap: 9.5, vDay: 3.2, vNight: 12.5, keep: 0.5 },
  primary_link: { gap: 12, vDay: 3.0, vNight: 11, keep: 0.5 },
  secondary: { gap: 12, vDay: 3.4, vNight: 11, keep: 0.45 },
  secondary_link: { gap: 14, vDay: 3.0, vNight: 10, keep: 0.45 },
  tertiary: { gap: 19, vDay: 3.4, vNight: 9, keep: 0.4 },
  tertiary_link: { gap: 19, vDay: 3.0, vNight: 8, keep: 0.4 },
};
const PARK = new Set(['residential', 'living_street', 'unclassified']);

const CAR_COLORS = [
  [0xd2d2ce, 30], [0xbfc2c4, 16], [0x8d9296, 12], [0x2a2c30, 14], [0x15161a, 6], [0x2b3d5c, 6],
  [0x8e1f1c, 5], [0xd9aa12, 5], [0x6b5a48, 2], [0x3d5a4a, 1.5],
].map(([h, w]) => ({ c: lin(h), w }));

const BUS_COLORS = [0x8c1d24, 0x8c1d24, 0x3c7a4a, 0xd8b21a, 0x2f5f9f, 0xcfcfca].map(lin);
const VAN_COLORS = [0xd9aa12, 0xd9aa12, 0xd9aa12, 0xd2d2ce, 0xd2d2ce, 0x9fb7cf, 0x2a2c30, 0x8d9296].map(lin); // sarı = dolmuş
const K = 6; // iz başına parça
const fluidity = (tod) => (tod >= 12 ? smoothstep(18.9, 20.5, tod) : 1 - smoothstep(4.5, 6.5, tod));

export function buildTraffic(ctx, net, group, shared, roadInfo, env) {
  const { THREE } = ctx;
  const rng = ctx.rng('city/traffic');
  const pick = () => {
    let x = rng() * 97.5;
    for (const e of CAR_COLORS) {
      x -= e.w;
      if (x <= 0) return e.c;
    }
    return CAR_COLORS[0].c;
  };

  // ---- araç listesi ------------------------------------------------------------------------
  const V = []; // {lane, s0, kind(0 araba,1 uzun), len, wid, hgt, col, hide, th, br}
  const lanes = [];
  for (const ln of net.lanes) {
    const reg = REG[ln.cls];
    if (!reg || ln.path.length < 30) continue;
    const lf = ln.n > 1 ? 1.14 - 0.28 * (ln.k / (ln.n - 1)) : 1;
    const li = lanes.length;
    lanes.push({ path: ln.path, vd: reg.vDay * lf, dv: (reg.vNight - reg.vDay) * lf, bus: false });
    const N = Math.floor(ln.path.length / reg.gap);
    const rightmost = ln.k === ln.n - 1;
    for (let i = 0; i < N; i++) {
      const r = rng();
      const jit = rng() * Math.max(0, reg.gap - 6.2);
      const hide = rng() > reg.keep ? 0.2 + 0.6 * rng() : 9;
      const th = 0.02 + 0.22 * rng();
      const br = 0.65 + 0.7 * rng();
      if (rng() < 0.06) continue; // boşluk
      if (rightmost && r < (ln.type === 1 ? 0.1 : 0.05) && i + 1 < N && reg.gap < 13) {
        // otobüs / kamyon: iki yuva kaplar
        const bus = rng() < 0.6;
        V.push({ lane: li, s0: (i + 0.5) * reg.gap + 2.5, kind: 1, len: bus ? 11.8 : 8.5, wid: 2.5, hgt: bus ? 3.0 : 3.3, col: bus ? BUS_COLORS[Math.floor(rng() * BUS_COLORS.length)] : pick(), hide, th, br });
        i++;
        rng(); rng(); rng(); rng(); rng(); rng();
        continue;
      }
      if (r > 0.9) V.push({ lane: li, s0: i * reg.gap + jit * 0.3, kind: 2, len: 1, wid: 1, hgt: 0.95 + 0.1 * rng(), half: 2.7, col: VAN_COLORS[Math.floor(rng() * VAN_COLORS.length)], hide, th, br });
      else V.push({ lane: li, s0: i * reg.gap + jit, kind: 0, len: 0.92 + 0.14 * rng(), wid: 1, hgt: 0.94 + 0.16 * rng(), col: pick(), hide, th, br });
    }
  }
  // metrobüsler
  for (const path of net.busLines) {
    const li = lanes.length;
    lanes.push({ path, vd: 11, dv: 3.5, bus: true });
    const gap = 135;
    const N = Math.floor(path.length / gap);
    for (let i = 0; i < N; i++) {
      V.push({ lane: li, s0: i * gap + rng() * 40, kind: 1, len: 18.5, wid: 2.55, hgt: 3.1, col: [0.82, 0.83, 0.84], hide: 9, th: 0.02 + 0.1 * rng(), br: 1.5, bus: 1 });
    }
  }

  const counts = [0, 0, 0];
  for (const v of V) v.slot = counts[v.kind]++;
  const bodyMat = vehicleMaterial(THREE, ctx.uniforms, true);
  const geos = [carGeometry(THREE), longGeometry(THREE), vanGeometry(THREE)];
  const meshes = geos.map((g, k) => {
    const m = new THREE.InstancedMesh(g, bodyMat, Math.max(1, counts[k]));
    m.count = counts[k];
    m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = ['city-cars', 'city-buses', 'city-vans'][k];
    g.setAttribute('aAo', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, counts[k])), 1).setUsage(THREE.StaticDrawUsage));
    group.add(m);
    return m;
  });
  const colC = new THREE.Color();
  for (const v of V) {
    colC.setRGB(v.col[0], v.col[1], v.col[2]);
    meshes[v.kind].setColorAt(v.slot, colC);
  }
  for (const m of meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  const cars = meshes[0];

  // ---- park etmiş arabalar (durağan) -----------------------------------------------------
  const parked = [];
  const o6 = new Float32Array(6);
  for (const r of net.roads) {
    if (!PARK.has(r.cls) || r.bridge || r.ext) continue;
    const pts = r.pts.map((p) => [p[0], p[1] + r.yOff, p[2]]);
    const sides = r.width >= 6 ? [1, -1] : [rng() < 0.5 ? 1 : -1];
    for (const sd of sides) {
      const path = new Path(offsetLine(pts, sd * (r.width / 2 - 1.05)));
      const occ = 0.35 + 0.45 * rng();
      for (let s = 7; s < path.length - 7; s += 5.5) {
        const keep = rng() < occ;
        const c = pick();
        const sc = 0.92 + 0.14 * rng();
        if (!keep) continue;
        path.at(s, o6);
        parked.push([o6[0], o6[1], o6[2], o6[3] * sd, o6[5] * sd, c, sc]);
      }
    }
  }
  // boş parseller: zemin gölgelendiricisindeki otopark hücreleriyle aynı ızgara (48 m hücre, 2.7 m göz, 8 m sıra)
  {
    const free = (x, z) => !env.bld.inBuilding(x, z) && !roadInfo.onRoad(x, z);
    let lot = 0;
    for (let iz = -19; iz <= 19 && lot < 5200; iz++) {
      for (let ix = -19; ix <= 19; ix++) {
        const ty = (((ix * 3 + iz * 5) % 7) + 7) % 7;
        if (ty > 2) continue;
        for (let z = iz * 48; z < iz * 48 + 48; z += 8) {
          for (let x = ix * 48; x < ix * 48 + 48 - 0.1; x += 2.7) {
            const keep = rng() < 0.52;
            const c = pick();
            const sc = 0.92 + 0.14 * rng();
            const cx = x + 1.35;
            const cz = z + 2.5;
            if (!keep || !free(cx, cz) || !free(cx, cz + 3.4) || !free(cx, cz - 3.4) || !free(cx + 2.2, cz) || !free(cx - 2.2, cz)) continue;
            parked.push([cx, env.ground.gY(cx, cz) + 0.1, cz, 0, (Math.round(z / 8) & 1) ? 1 : -1, c, sc]);
            lot++;
          }
        }
      }
    }
  }
  const pkGeo = cars.geometry.clone();
  pkGeo.setAttribute('aAo', new THREE.InstancedBufferAttribute(Float32Array.from(parked.length ? parked.map((p) => roadInfo.underDeck(p[0], p[2], p[1])) : [0]), 1));
  const pk = new THREE.InstancedMesh(pkGeo, vehicleMaterial(THREE, ctx.uniforms, false), Math.max(1, parked.length));
  pk.name = 'city-parked';
  const m4 = new THREE.Matrix4();
  parked.forEach((p, i) => {
    const l = Math.hypot(p[3], p[4]) || 1;
    const fx = p[3] / l;
    const fz = p[4] / l;
    const s = p[6];
    m4.set(fx * s, 0, -fz * s, p[0], 0, s, 0, p[1], fz * s, 0, fx * s, p[2], 0, 0, 0, 1);
    pk.setMatrixAt(i, m4);
    colC.setRGB(p[5][0], p[5][1], p[5][2]);
    pk.setColorAt(i, colC);
  });
  pk.count = parked.length;
  pk.castShadow = false;
  pk.receiveShadow = true;
  pk.frustumCulled = false;
  group.add(pk);

  // ---- ışık izleri -------------------------------------------------------------------------
  const nV = V.length;
  const VPT = (K + 1) * 2;
  const tPos = new Float32Array(nV * VPT * 3);
  const tDir = new Float32Array(nV * VPT * 3);
  const tPar = new Float32Array(nV * VPT * 4);
  const tIdx = new Uint32Array(nV * K * 6);
  for (let i = 0; i < nV; i++) {
    for (let j = 0; j < K; j++) {
      const a = i * VPT + j * 2;
      const q = (i * K + j) * 6;
      tIdx[q] = a; tIdx[q + 1] = a + 1; tIdx[q + 2] = a + 2;
      tIdx[q + 3] = a + 1; tIdx[q + 4] = a + 3; tIdx[q + 5] = a + 2;
    }
    for (let j = 0; j <= K; j++) {
      for (let sd = 0; sd < 2; sd++) {
        const a = (i * VPT + j * 2 + sd) * 4;
        tPar[a] = sd ? 1 : -1;
        tPar[a + 1] = j / K;
        tPar[a + 2] = V[i].bus ? 1 : 0;
        tPar[a + 3] = 0;
      }
    }
  }
  // DİKKAT: ANGLE/D3D11'de DynamicDrawUsage/StreamDrawUsage ile her kare güncellenen köşe tamponu ara sıra
  // bir önceki karenin verisiyle çiziliyor (aynı t → farklı piksel). StaticDrawUsage ile kararlı; ölçüldü.
  const TRAIL_USAGE = THREE.StaticDrawUsage;
  const tg = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(tPos, 3).setUsage(TRAIL_USAGE);
  const aDir = new THREE.BufferAttribute(tDir, 3).setUsage(TRAIL_USAGE);
  const aPar = new THREE.BufferAttribute(tPar, 4).setUsage(TRAIL_USAGE);
  tg.setAttribute('position', aPos);
  tg.setAttribute('aDir', aDir);
  tg.setAttribute('aParam', aPar);
  tg.setIndex(new THREE.BufferAttribute(tIdx, 1));
  const trailMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPx: { value: 0.001 }, uGain: { value: 1 } }]),
    vertexShader: /* glsl */ `
      attribute vec3 aDir; attribute vec4 aParam;
      uniform float uPx;
      varying vec3 vCol; varying vec3 vP;
      #include <common>
      #include <fog_pars_vertex>
      void main(){
        vec3 wp = position;
        vec3 toCam = cameraPosition - wp;
        float dist = length(toCam);
        vec3 vd = toCam / dist;
        vec3 sideV = cross(aDir, vd);
        float sl = length(sideV);
        sideV = sl > 1e-4 ? sideV / sl : vec3(0.0, 1.0, 0.0);
        // kameraya yakın izler incelir ve söner (yakında ışık levhası gibi durmasın)
        float nearF = smoothstep(14.0, 85.0, dist);
        float hw = mix(0.74, 1.15, aParam.z) * mix(0.45, 1.0, nearF);
        float minHw = dist * uPx * 1.15;
        float gain = pow(min(1.0, hw / minHw), 0.55);
        hw = max(hw, minHw);
        wp += sideV * aParam.x * hw;
        float toward = dot(aDir, vd);
        float wr = smoothstep(-0.14, 0.14, toward);
        vec3 c = mix(vec3(1.0, 0.055, 0.02) * 1.7, vec3(1.0, 0.93, 0.8) * 2.2, wr);
        c = mix(c, vec3(0.38, 0.86, 1.0) * 2.6, aParam.z);
        vCol = c * aParam.w * gain * mix(0.14, 1.0, nearF);
        vP = vec3(aParam.x, aParam.y, gain);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uGain;
      varying vec3 vCol; varying vec3 vP;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        float x = vP.x;
        float single = pow(max(0.0, 1.0 - x * x), 1.5);
        float tw = (abs(x) - 0.52) / 0.26;
        float twin = exp(-tw * tw); // pow(negatif, 2.0) tanımsız → NaN → kare kare farklı piksel
        float across = mix(single, twin, smoothstep(0.6, 1.0, vP.z));
        float along = pow(clamp(1.0 - vP.y, 0.0, 1.0), 1.1) * 0.85 + exp(-vP.y * 22.0) * 0.9;
        vec3 c = vCol * across * along * uGain;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            float ff = smoothstep(fogNear, fogFar, vFogDepth);
          #endif
          c *= 1.0 - ff * 0.85;
        #endif
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
    side: THREE.DoubleSide,
    fog: true,
  });
  trailMat.uniforms.uPx = shared.uPx;
  // eklemeli karışımda yüz sırası önemsiz → tek geçiş yeter (iki geçişin her karedeki program yenilemesi boşa)
  trailMat.forceSinglePass = true;
  const trails = new THREE.Mesh(tg, trailMat);
  trails.name = 'city-trails';
  trails.frustumCulled = false;
  trails.renderOrder = 20;
  group.add(trails);

  // ---- sürekli ışık şeritleri -------------------------------------------------------------
  // kip 0: metrobüs — D-100'ün ortasında kesintisiz, akan camgöbeği bant.
  // kip 1: D-100 şeritleri — uzakta tek tek izler noktaya dağılmasın diye mesafeyle beliren
  //        sürekli çizgi (kameraya gelen yön beyaz, giden kırmızı); ufka kadar okunur.
  {
    const gp = [];
    const gd = [];
    const gq = [];
    const gmo = [];
    const gi = [];
    let gv = 0;
    const q6 = new Float32Array(6);
    const glowPaths = net.busLines.map((p) => [p, 0]).concat(net.lanes.filter((l) => l.cls === 'trunk').map((l) => [l.path, 1]));
    for (const [path, mode] of glowPaths) {
      const Lp = path.length;
      let prev = -1;
      for (let s = 0; s <= Lp; s += mode ? 14 : 8) {
        path.at(s, q6);
        const th = mode ? 0.12 + 0.2 * clamp(Math.abs(q6[0]) / 1500, 0, 1) : 0.08 + 0.5 * clamp(Math.abs(q6[0]) / 1500, 0, 1);
        const fade = smoothstep(0, 60, s) * smoothstep(0, 60, Lp - s);
        for (let sd = 0; sd < 2; sd++) {
          gp.push(q6[0], q6[1] + 1.75, q6[2]);
          gd.push(q6[3], q6[4], q6[5]);
          gq.push(sd ? 1 : -1, s, th, fade);
          gmo.push(mode);
        }
        if (prev >= 0) gi.push(prev, prev + 1, gv, prev + 1, gv + 1, gv);
        prev = gv;
        gv += 2;
      }
    }
    if (gv) {
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
      gg.setAttribute('aDir', new THREE.Float32BufferAttribute(gd, 3));
      gg.setAttribute('aParam', new THREE.Float32BufferAttribute(gq, 4));
      gg.setAttribute('aMode', new THREE.Float32BufferAttribute(gmo, 1));
      gg.setIndex(gi);
      const gm = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPx: { value: 0.001 }, uLit: { value: 0 }, uTime: { value: 0 }, uFlow: { value: 0 } }]),
        vertexShader: /* glsl */ `
          attribute vec3 aDir; attribute vec4 aParam; attribute float aMode;
          uniform float uPx; uniform float uLit; uniform float uFlow;
          varying vec4 vG; varying vec3 vGC;
          #include <common>
          #include <fog_pars_vertex>
          void main(){
            vec3 wp = position;
            vec3 toCam = cameraPosition - wp;
            float dist = length(toCam);
            vec3 vd = toCam / dist;
            vec3 sideV = cross(aDir, vd);
            float sl = length(sideV);
            sideV = sl > 1e-4 ? sideV / sl : vec3(0.0, 1.0, 0.0);
            float hw = mix(1.55, 0.8, aMode);
            float minHw = dist * uPx * mix(1.4, 1.0, aMode);
            float gain = sqrt(min(1.0, hw / minHw));
            wp += sideV * aParam.x * max(hw, minHw);
            float on = smoothstep(aParam.z, aParam.z + 0.05, uLit);
            float wr = smoothstep(-0.14, 0.14, dot(aDir, vd));
            vec3 car = mix(vec3(1.0, 0.055, 0.02) * 1.5, vec3(1.0, 0.93, 0.8) * 1.7, wr);
            vGC = mix(vec3(0.26, 0.8, 1.0) * 2.3, car, aMode);
            // şerit çizgisi yalnız uzakta belirir ve yalnız trafik akışkanken (gece)
            float farIn = mix(1.0, smoothstep(200.0, 560.0, dist) * uFlow, aMode);
            vG = vec4(aParam.x, aParam.y, on * aParam.w * gain * farIn, aMode);
            vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec4 vG; varying vec3 vGC;
          #include <common>
          #include <fog_pars_fragment>
          void main(){
            float across = pow(max(0.0, 1.0 - vG.x * vG.x), 1.3);
            float k = mix(0.045, 0.02, vG.w);
            float flow = 0.72 + 0.28 * sin(vG.y * k - uTime * 0.9) * sin(vG.y * 0.0113 + 1.3 + uTime * 0.13);
            vec3 c = vGC * across * flow * vG.z;
            #ifdef USE_FOG
              #ifdef FOG_EXP2
                float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
              #else
                float ff = smoothstep(fogNear, fogFar, vFogDepth);
              #endif
              c *= 1.0 - ff * 0.7;
            #endif
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        side: THREE.DoubleSide,
        fog: true,
      });
      gm.forceSinglePass = true;
      gm.uniforms.uPx = shared.uPx;
      gm.uniforms.uLit = ctx.uniforms.uLit;
      gm.uniforms.uTime = ctx.uniforms.uTime;
      gm.uniforms.uFlow = shared.uFlow;
      const glowMesh = new THREE.Mesh(gg, gm);
      glowMesh.name = 'city-light-ribbons';
      glowMesh.frustumCulled = false;
      glowMesh.renderOrder = 19;
      group.add(glowMesh);
    }
  }

  // ---- akışkanlık integrali (film zamanı) ------------------------------------------------
  const NT = DURATION * FPS + 1;
  const Ftab = new Float32Array(NT);
  for (let i = 1; i < NT; i++) Ftab[i] = Ftab[i - 1] + (0.5 * (fluidity(todAt((i - 1) / FPS)) + fluidity(todAt(i / FPS)))) / FPS;
  const nEnd = fluidity(todAt(DURATION));
  const Fint = (t) => {
    if (t <= 0) return 0;
    if (t >= DURATION) return Ftab[NT - 1] + (t - DURATION) * nEnd;
    const x = t * FPS;
    const i = Math.floor(x);
    return Ftab[i] + (Ftab[i + 1] - Ftab[i]) * (x - i);
  };

  const o = new Float32Array(6);
  const mArr = meshes.map((m) => m.instanceMatrix.array);
  const aoAttr = meshes.map((m) => m.geometry.attributes.aAo);

  function update(state) {
    const t = state.t;
    const n = fluidity(state.tod);
    shared.uFlow.value = n;
    const F = state.film ? Fint(t) : n * t;
    const lit = state.lit;
    const showTrails = lit > 0.004;
    const exposure = 0.22 + 2.9 * n;
    let tv = 0; // yazılan iz köşesi (araç sayısı cinsinden)
    for (let i = 0; i < nV; i++) {
      const v = V[i];
      const ln = lanes[v.lane];
      const path = ln.path;
      const L = path.length;
      let s = v.s0 + ln.vd * t + ln.dv * F + (1 - n) * (ln.bus ? 0 : 2.2 * Math.sin(0.45 * t - v.s0 * 0.04));
      s = ((s % L) + L) % L;
      path.at(s, o);
      const endFade = smoothstep(0, 14, s) * smoothstep(0, 14, L - s);
      const vis = v.hide < 2 ? 1 - smoothstep(v.hide - 0.05, v.hide + 0.05, n) : 1;
      const sc = endFade * vis;
      // gövde matrisi: X = ileri, Y = yukarı, Z = sağ
      const fx = o[3], fy = o[4], fz = o[5];
      const hl = Math.hypot(fx, fz) || 1;
      const rx = -fz / hl, rz = fx / hl;
      const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
      const sx = sc * v.len;
      const sy = sc * v.hgt;
      const sz = sc * v.wid;
      const arr = mArr[v.kind];
      const b = v.slot * 16;
      arr[b] = fx * sx; arr[b + 1] = fy * sx; arr[b + 2] = fz * sx; arr[b + 3] = 0;
      arr[b + 4] = ux * sy; arr[b + 5] = uy * sy; arr[b + 6] = uz * sy; arr[b + 7] = 0;
      arr[b + 8] = rx * sz; arr[b + 9] = 0; arr[b + 10] = rz * sz; arr[b + 11] = 0;
      arr[b + 12] = o[0]; arr[b + 13] = o[1]; arr[b + 14] = o[2]; arr[b + 15] = 1;
      aoAttr[v.kind].array[v.slot] = roadInfo.underDeck(o[0], o[2], o[1]);

      if (!showTrails || sc < 0.02) continue;
      const on = smoothstep(v.th, v.th + 0.04, lit);
      if (on <= 0) continue;
      const speed = ln.vd + ln.dv * n;
      let TL = clamp(speed * exposure, 2.4, 86);
      if (v.bus) TL = clamp(speed * exposure * 2.6, 14, 210);
      const bright = on * sc * v.br;
      const half = v.kind === 1 ? v.len * 0.5 : v.half || 2.15;
      for (let j = 0; j <= K; j++) {
        // baş (j=0) aracın önünde; kuyruk geride
        const sj = s + half - (j / K) * TL;
        path.at(sj, o);
        const fadeEnd = smoothstep(0, 10, sj);
        for (let sd = 0; sd < 2; sd++) {
          const a = (tv * VPT + j * 2 + sd);
          tPos[a * 3] = o[0]; tPos[a * 3 + 1] = o[1] + (j === 0 ? 0.8 : 1.62); tPos[a * 3 + 2] = o[2];
          tDir[a * 3] = o[3]; tDir[a * 3 + 1] = o[4]; tDir[a * 3 + 2] = o[5];
          tPar[a * 4] = sd ? 1 : -1;
          tPar[a * 4 + 1] = j / K;
          tPar[a * 4 + 2] = v.bus ? 1 : 0;
          tPar[a * 4 + 3] = bright * fadeEnd;
        }
      }
      tv++;
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    for (const a of aoAttr) a.needsUpdate = true;
    trails.visible = showTrails && tv > 0;
    if (trails.visible) {
      tg.setDrawRange(0, tv * K * 6);
      // yalnız kullanılan bölüm yüklenir
      for (const [at, sz] of [[aPos, 3], [aDir, 3], [aPar, 4]]) {
        at.clearUpdateRanges();
        at.addUpdateRange(0, tv * VPT * sz);
        at.needsUpdate = true;
      }
    }
  }

  const debug = () => { const r = tg.drawRange.count; const nv = (r / (K * 6)) * VPT; const hh = (arr, n) => { const u = new Uint32Array(arr.buffer, 0, n); let h = 2166136261; for (let i = 0; i < n; i++) h = Math.imul(h ^ u[i], 16777619); return h >>> 0; }; return { range: r, s: hh(tPos, nv * 3) + '/' + hh(tDir, nv * 3) + '/' + hh(tPar, nv * 4), vis: trails.visible }; };
  return { update, debug, count: nV, parked: parked.length };
}
