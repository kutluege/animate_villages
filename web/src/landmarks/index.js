// SİMGE YAPILAR — Trump Towers, Torun Center, Cevahir AVM (+ metro giriş totemleri).
// Ayak izleri buildings.json'dan (landmark işaretli kayıtlar); yükseklikler ve biçim
// docs/sources.md'deki araştırmaya göre (bkz. HEIGHTS). Tek birleşik gövde ağı (1 draw call,
// cephe deseni/ışıklar parça gölgelendiricide), 1 tabela ağı, 1 ikaz ışığı nokta bulutu.
// Determinizm: rastgelelik yalnız ctx.rng; hareket yalnız uTime/state.t.
import { build } from './geometry.js';
import { makeFacadeMaterial, makeBeaconMaterial } from './material.js';
import { makeSigns } from './signs.js';

export async function create(ctx) {
  const { THREE, scene, renderer } = ctx;
  const group = new THREE.Group();
  group.name = 'landmarks';
  scene.add(group);

  const built = build(ctx);
  if (!built) return { update() {} };

  const facade = makeFacadeMaterial(ctx);
  const body = new THREE.Mesh(built.geometry, facade.material);
  body.name = 'landmarks-body';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const beacon = makeBeaconMaterial(ctx);
  const pts = new THREE.Points(built.beacons, beacon.material);
  pts.name = 'landmarks-beacons';
  pts.frustumCulled = false;
  group.add(pts);

  const signs = makeSigns(ctx, built.signs);
  if (signs) group.add(signs.mesh);

  const buf = new THREE.Vector2();
  return {
    info: built.info,
    update(state) {
      facade.update(state, !!scene.environment);
      renderer.getDrawingBufferSize(buf);
      beacon.update(state, buf.y);
      if (signs) signs.update(state);
    },
  };
}
