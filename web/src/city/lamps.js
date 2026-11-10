// Sokak lambaları: direk (instanced), ışık başı (billboard, HDR), yerdeki ışık havuzu (eklemeli çıkartma).
// Her lamba sabit bir θ eşiği taşır; uLit > θ olunca yanar (sodyum ısınması gibi kısa bir geçişle).
import { rightNormals, clamp, h1 } from './util.js';

const SODIUM = [1.0, 0.56, 0.2];
const WARM = [1.0, 0.76, 0.48];
const LED = [0.8, 0.9, 1.0];

const CFG = {
  trunk: { sp: 38, h: 12, col: SODIUM, r: 20, side: 'right' },
  trunk_link: { sp: 36, h: 10, col: SODIUM, r: 16, side: 'right' },
  primary: { sp: 30, h: 9.5, col: WARM, r: 15, side: 'alt' },
  primary_link: { sp: 32, h: 9, col: WARM, r: 14, side: 'right' },
  secondary: { sp: 31, h: 9, col: WARM, r: 14, side: 'alt' },
  secondary_link: { sp: 32, h: 8, col: WARM, r: 13, side: 'right' },
  tertiary: { sp: 34, h: 8, col: SODIUM, r: 12.5, side: 'alt' },
  tertiary_link: { sp: 34, h: 8, col: SODIUM, r: 12, side: 'right' },
  residential: { sp: 37, h: 7, col: SODIUM, r: 11, side: 'alt' },
  living_street: { sp: 37, h: 6.5, col: SODIUM, r: 10, side: 'alt' },
  unclassified: { sp: 37, h: 7, col: SODIUM, r: 11, side: 'alt' },
};

export function buildLamps(ctx, net, ground, bld, roadInfo, group, shared) {
  const { THREE } = ctx;
  const rng = ctx.rng('city/lamps');
  const L = []; // {x,y,z, gy, nx,ny,nz, col, r, th, pole}
  const nrm = [0, 1, 0];
  let roadIdx = 0;
  for (const r of net.roads) {
    roadIdx++;
    const c = CFG[r.cls];
    if (!c) continue;
    const sp = r.ext ? c.sp * 1.5 : c.sp;
    const rn = rightNormals(r.pts);
    const tb = 0.05 + 0.3 * h1(roadIdx, 77);
    let acc = sp * rng();
    let k = Math.floor(rng() * 2);
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1];
      const b = r.pts[i];
      const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
      while (acc < l) {
        const t = acc / l;
        acc += sp;
        k++;
        const cool = rng() < (r.type === 2 ? 0.14 : 0.04);
        const jit = rng();
        let sd = c.side === 'right' ? 1 : k % 2 ? 1 : -1;
        const px = a[0] + (b[0] - a[0]) * t;
        const pz = a[2] + (b[2] - a[2]) * t;
        const py = a[1] + (b[1] - a[1]) * t + r.yOff;
        const off = r.width / 2 + (r.type === 2 ? 0.2 : 0.7);
        let x = px + rn[i][0] * sd * off;
        let z = pz + rn[i][1] * sd * off;
        if (!r.bridge && !r.ext && bld.inBuilding(x, z)) {
          sd = -sd;
          x = px + rn[i][0] * sd * off;
          z = pz + rn[i][1] * sd * off;
          if (bld.inBuilding(x, z)) continue;
        }
        let th = tb + 0.06 * jit;
        if (r.cls === 'trunk') th = 0.05 + 0.24 * clamp((x + 1500) / 3000, 0, 1) + 0.02 * jit;
        // havuz yolun içine doğru kayık
        const cx = px + rn[i][0] * sd * (off - Math.min(c.r * 0.3, r.width * 0.4));
        const cz = pz + rn[i][1] * sd * (off - Math.min(c.r * 0.3, r.width * 0.4));
        if (r.bridge || r.ext) {
          nrm[0] = 0; nrm[1] = 1; nrm[2] = 0;
        } else ground.gN(cx, cz, nrm);
        L.push({ x, y: py + c.h, z, by: py - 0.3, cx, cy: py + 0.14, cz, nx: nrm[0], ny: nrm[1], nz: nrm[2], col: cool ? LED : c.col, r: c.r, th, pole: true, size: r.type === 0 ? 1.25 : 0.85 });
      }
      acc -= l;
    }
  }
  // viyadük altı: tabliyeye asılı sodyum armatürler — "alt şehir" gündüz de soluk yanar
  for (const f of roadInfo.fixtures) {
    ground.gN(f.x, f.z, nrm);
    L.push({ x: f.x, y: f.y, z: f.z, by: 0, cx: f.x, cy: f.gy + 0.34, cz: f.z, nx: nrm[0], ny: nrm[1], nz: nrm[2], col: SODIUM, r: 10, th: 0.02 + 0.1 * rng(), pole: false, size: 0.5, min: 0.32 });
  }

  const n = L.length;
  // ---- direkler -----------------------------------------------------------------------------
  const poles = L.filter((l) => l.pole);
  const pg = new THREE.BoxGeometry(0.16, 1, 0.16);
  pg.translate(0, 0.5, 0);
  const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.6, metalness: 0.5 }), Math.max(1, poles.length));
  const m4 = new THREE.Matrix4();
  poles.forEach((l, i) => {
    m4.makeScale(1, l.y - l.by, 1);
    m4.setPosition(l.x, l.by, l.z);
    pm.setMatrixAt(i, m4);
  });
  pm.count = poles.length;
  pm.name = 'city-lamp-poles';
  pm.frustumCulled = false;
  group.add(pm);

  // ---- ışık başları ----------------------------------------------------------------------
  const quad = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
  const iPos = new Float32Array(n * 3);
  const iCol = new Float32Array(n * 3);
  const iPar = new Float32Array(n * 3);
  const dPos = new Float32Array(n * 3);
  const dNrm = new Float32Array(n * 3);
  const dPar = new Float32Array(n * 3);
  L.forEach((l, i) => {
    iPos.set([l.x, l.y, l.z], i * 3);
    iCol.set(l.col, i * 3);
    iPar.set([l.size, l.th, l.min || 0], i * 3);
    dPos.set([l.cx, l.cy, l.cz], i * 3);
    dNrm.set([l.nx, l.ny, l.nz], i * 3);
    dPar.set([l.r, l.th, l.min || 0], i * 3);
  });
  const hg = new THREE.InstancedBufferGeometry();
  hg.setAttribute('position', new THREE.BufferAttribute(quad, 3));
  hg.setIndex([0, 1, 2, 0, 2, 3]);
  hg.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  hg.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  hg.setAttribute('iPar', new THREE.InstancedBufferAttribute(iPar, 3));
  hg.instanceCount = n;
  const FOGF = /* glsl */ `
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float ff = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float ff = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      c *= 1.0 - ff * 0.8;
    #endif`;
  const headMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLit: { value: 0 }, uPx: { value: 0.001 }, uFrac: { value: 0.7 } }]),
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec3 iCol; attribute vec3 iPar;
      uniform float uLit; uniform float uPx; uniform float uFrac;
      varying vec2 vQ; varying vec3 vC;
      #include <common>
      #include <fog_pars_vertex>
      void main(){
        float on = max(iPar.z, smoothstep(iPar.y, iPar.y + 0.05, uLit));
        vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
        float dist = -mvPosition.z;
        float s0 = iPar.x;
        float s = max(s0, dist * uPx * 1.6);
        float gain = (s0 * s0) / (s * s);
        // yakında ekran boyutu sınırı: parıltı yüksekliğin ~%0,55'ini aşmaz (hale topu olmasın)
        float sMax = dist * uFrac * 0.0055;
        float nearK = clamp(sMax / s, 0.0, 1.0);
        s = min(s, max(sMax, 0.06));
        mvPosition.xy += position.xy * s * 1.6 * step(0.001, on);
        vQ = position.xy;
        // ısınma: önce soluk pembe-kırmızı, sonra asıl renk
        vec3 warm = mix(vec3(1.0, 0.35, 0.3), iCol, smoothstep(0.0, 0.8, on));
        vC = warm * on * (1.6 + 2.2 * gain) * mix(0.3, 1.0, gain) * mix(0.45, 1.0, nearK);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vQ; varying vec3 vC;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        float r2 = dot(vQ, vQ);
        if (r2 > 1.0) discard;
        float a = exp(-r2 * 9.0) * (1.0 - r2);
        vec3 c = vC * a;
        ${FOGF}
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: true,
  });
  headMat.uniforms.uLit = ctx.uniforms.uLit;
  headMat.uniforms.uPx = shared.uPx;
  headMat.uniforms.uFrac = shared.uFrac;
  const heads = new THREE.Mesh(hg, headMat);
  heads.name = 'city-lamp-heads';
  heads.frustumCulled = false;
  heads.renderOrder = 21;
  group.add(heads);

  // ---- ışık havuzları ----------------------------------------------------------------------
  const dq = new Float32Array([-1, 0, -1, -1, 0, 1, 1, 0, 1, 1, 0, -1]);
  const dg = new THREE.InstancedBufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dq, 3));
  dg.setIndex([0, 1, 2, 0, 2, 3]);
  dg.setAttribute('iPos', new THREE.InstancedBufferAttribute(dPos, 3));
  dg.setAttribute('iNrm', new THREE.InstancedBufferAttribute(dNrm, 3));
  dg.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  dg.setAttribute('iPar', new THREE.InstancedBufferAttribute(dPar, 3));
  dg.instanceCount = n;
  const poolMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uLit: { value: 0 } }]),
    vertexShader: /* glsl */ `
      attribute vec3 iPos; attribute vec3 iNrm; attribute vec3 iCol; attribute vec3 iPar;
      uniform float uLit;
      varying vec2 vQ; varying vec3 vC;
      #include <common>
      #include <fog_pars_vertex>
      void main(){
        float on = max(iPar.z * 0.55, smoothstep(iPar.y, iPar.y + 0.05, uLit));
        vec3 nn = normalize(iNrm);
        vec3 tx = normalize(cross(vec3(0.0, 0.0, 1.0), nn));
        vec3 tz = cross(nn, tx);
        vec3 wp = iPos + (tx * position.x + tz * position.z) * iPar.x * step(0.001, on);
        vQ = position.xz;
        vC = iCol * on;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vQ; varying vec3 vC;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        float r = length(vQ);
        if (r > 1.0) discard;
        float a = pow(1.0 - r, 2.0) * 0.62 + exp(-r * r * 22.0) * 0.5;
        vec3 c = vC * a;
        ${FOGF}
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -6,
  });
  poolMat.uniforms.uLit = ctx.uniforms.uLit;
  const pools = new THREE.Mesh(dg, poolMat);
  pools.name = 'city-lamp-pools';
  pools.frustumCulled = false;
  pools.renderOrder = 10;
  group.add(pools);

  return {
    count: n,
    update(state) {
      void state; // asgari parlaklıklı armatürler gündüz de görünür
    },
  };
}
