// Sokak lambaları: direk (instanced), lamba başı (yayıcı, instanceColor), zemin ışık havuzu (toplamalı decal).
// Her lamba seed'li eşik taşır; eşik cadde boyunca artar → lambalar cadde boyunca sırayla yanar.
import * as THREE from 'three';
import { Builder, Grid, radialTexture, smooth } from './util.js';

const SPEC = {
  trunk: { gap: 34, h: 11, arm: 2.2, sides: 'right', led: true, pool: 11 },
  link: { gap: 32, h: 9, arm: 1.6, sides: 'right', led: true, pool: 9 },
  primary: { gap: 28, h: 9.5, arm: 1.8, sides: 'both', led: true, pool: 10 },
  secondary: { gap: 30, h: 8, arm: 1.4, sides: 'both', led: false, pool: 8.5 },
  minor: { gap: 36, h: 7, arm: 1.0, sides: 'alt', led: false, pool: 7 },
  busway: { gap: 30, h: 10, arm: 0.2, sides: 'right', led: true, pool: 8 },
};

export function buildLamps(ctx, U, roadNet, isInside) {
  const lamps = [];
  const taken = new Grid(10);
  const near = (x, z, d) => { let hit = false; taken.query(x, z, d, (p) => { if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < d * d) { hit = true; return false; } }); return hit; };
  for (const r of roadNet.roads) {
    const sp = SPEC[r.cls];
    if (!sp || r.len < 12 || r.inCemetery) continue;
    const rr = ctx.rng('city/lamp/' + r.id);
    const kRoad = rr();
    const sodium = !sp.led && rr() < 0.6;
    let acc = rr() * sp.gap, side = rr() < 0.5 ? 1 : -1;
    for (let i = 1; i < r.pts.length; i++) {
      const seg = r.s[i] - r.s[i - 1];
      acc += seg;
      if (acc < sp.gap) continue;
      acc = 0;
      const p = r.pts[i], n = r.nrm[i];
      const elevated = r.elev[i] > 0.35;
      const sides = sp.sides === 'both' ? [side, -side] : sp.sides === 'alt' ? [side] : [1];
      side = -side;
      for (const sd of sides) {
        const off = elevated ? r.halfW - 0.35 : r.halfW + (r.cls === 'minor' ? 0.6 : 1.1);
        const x = p[0] + n[0] * off * sd, z = p[1] + n[1] * off * sd;
        if (Math.abs(x) > 900 || Math.abs(z) > 950) continue;
        if (near(x, z, 9)) continue;
        if (!elevated && isInside(x, z, 0.4)) continue;
        const y = elevated ? r.y[i] : ctx.heightAt(x, z) + 0.15;
        const yaw = Math.atan2(-n[0] * sd, -n[1] * sd); // +x yerelde yola doğru
        const k = Math.min(0.92, 0.04 + kRoad * 0.38 + (r.s[i] / r.len) * 0.22 + rr() * 0.05);
        taken.add(x, z, [x, z]);
        lamps.push({ cls: r.cls, x, y, z, yaw, h: sp.h, arm: sp.arm, k, sodium, pool: sp.pool, poolY: elevated ? r.y[i] + 0.05 : null });
      }
    }
  }
  // Direk geometrisi: taban 0, +x yönünde kol; baş (arm, h)
  const pole = (h, arm) => {
    const b = new Builder();
    const box = (x0, y0, z0, x1, y1, z1) => {
      const F = [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]], [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]],
        [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
        [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]]];
      for (const [a, bb, c, d, nn] of F) { const ids = [a, bb, c, d].map((q) => b.v(q[0], q[1], q[2], nn[0], nn[1], nn[2], [1, 1, 1])); b.quad(ids[0], ids[1], ids[2], ids[3], nn[0], nn[1], nn[2]); }
    };
    box(-0.11, 0, -0.11, 0.11, h, 0.11);
    box(-0.05, h - 0.12, -0.05, arm + 0.1, h, 0.05);
    return b.geometry();
  };
  const group = new THREE.Group(); group.name = 'city-lamps';
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 0.6, metalness: 0.5 });
  const poleSets = {};
  for (const L of lamps) (poleSets[L.cls] ||= []).push(L);
  const poleMeshes = [];
  for (const [cls, arr] of Object.entries(poleSets)) {
    const sp = SPEC[cls];
    const im = new THREE.InstancedMesh(pole(sp.h, sp.arm), poleMat, arr.length);
    im.name = 'city-lamp-poles-' + cls;
    arr.forEach((L, j) => { L.poleMesh = im; L.poleIdx = j; });
    poleMeshes.push(im);
  }
  const headGeo = new THREE.BoxGeometry(0.75, 0.16, 0.36);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const heads = new THREE.InstancedMesh(headGeo, headMat, Math.max(1, lamps.length));
  heads.count = lamps.length; heads.name = 'city-lamp-heads';
  const poolGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const poolMat = new THREE.MeshBasicMaterial({ map: radialTexture(64, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -10 });
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, Math.max(1, lamps.length));
  pools.count = lamps.length; pools.name = 'city-lamp-pools'; pools.renderOrder = 2;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  const black = new THREE.Color(0, 0, 0);
  lamps.forEach((L, i) => {
    // yaw: kolun yola bakması için yerel +x → yola yön
    const dirX = Math.sin(L.yaw), dirZ = Math.cos(L.yaw);
    q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dirX, 0, dirZ));
    m.compose(v.set(L.x, L.y, L.z), q, s.set(1, 1, 1));
    L.poleMesh.setMatrixAt(L.poleIdx, m);
    const hx = L.x + dirX * L.arm, hz = L.z + dirZ * L.arm;
    m.compose(v.set(hx, L.y + L.h - 0.14, hz), q, s.set(1, 1, 1));
    heads.setMatrixAt(i, m);
    const py = L.poolY ?? ctx.heightAt(hx, hz) + 0.45;
    m.compose(v.set(hx, py, hz), new THREE.Quaternion(), s.set(L.pool, 1, L.pool));
    pools.setMatrixAt(i, m);
    heads.setColorAt(i, black); pools.setColorAt(i, black);
  });
  for (const im of [...poleMeshes, heads, pools]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); }
  group.add(...poleMeshes, heads, pools);
  const led = new THREE.Color(1.0, 0.84, 0.66), sod = new THREE.Color(1.0, 0.55, 0.2), off = new THREE.Color(0.05, 0.05, 0.05), c = new THREE.Color();
  let lastOn = -1;
  return {
    group, count: lamps.length,
    update(state) {
      const on = state.lightsOn;
      if (Math.abs(on - lastOn) < 1e-5) return;
      lastOn = on;
      pools.visible = on > 0.004;
      for (let i = 0; i < lamps.length; i++) {
        const L = lamps[i];
        const f = smooth(L.k, L.k + 0.025, on);
        const base = L.sodium ? sod : led;
        c.copy(base).multiplyScalar(9 * f).lerp(off, 1 - f);
        heads.setColorAt(i, c);
        c.copy(base).multiplyScalar(0.2 * f);
        pools.setColorAt(i, c);
      }
      heads.instanceColor.needsUpdate = true; pools.instanceColor.needsUpdate = true;
    },
  };
}
