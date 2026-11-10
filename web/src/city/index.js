// YER TUTUCU — sahibi (şehir dokusu ajanı) değiştirecek.
// Arayüz örneği: create(ctx) → { update(state) }. Arazi örtüsü + veri varsa kaba bina
// kütleleri ve yol çizgileri; veri yoksa tohumlu kutular. Diğer ajanlar ölçek görebilsin diye.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export async function create(ctx) {
  const { THREE, scene, data, heightAt } = ctx;
  const group = new THREE.Group();
  group.name = 'city-placeholder';
  scene.add(group);

  // Zemin: heightAt ile kabartılmış ızgara.
  const S = 2400;
  const N = 96;
  const ground = new THREE.PlaneGeometry(S, S, N, N);
  ground.rotateX(-Math.PI / 2);
  const p = ground.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
  ground.computeVertexNormals();
  group.add(new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.95 })));

  // Binalar: ring → kaba ekstrüzyon (landmark olanlar simge ajanına ait, atlanır).
  const geos = [];
  const list = Array.isArray(data.buildings) ? data.buildings : [];
  for (const b of list) {
    if (b.landmark || !b.ring || b.ring.length < 3) continue;
    const shape = new THREE.Shape(b.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const min = b.minHeight || 0;
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(2, (b.height || 9) - min), bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, (b.baseY ?? heightAt(b.ring[0][0], b.ring[0][1])) + min, 0);
    geos.push(g);
  }
  if (!list.length) {
    const r = ctx.rng('city-placeholder');
    for (let i = 0; i < 260; i++) {
      const x = r.range(-650, 650);
      const z = r.range(-650, 650);
      if (Math.hypot(x, z) < 60) continue;
      const h = 9 + 30 * r() * r() + (r() < 0.04 ? r.range(60, 150) : 0);
      const g = new THREE.BoxGeometry(r.range(14, 34), h, r.range(14, 34));
      g.rotateY(r.range(0, Math.PI));
      g.translate(x, heightAt(x, z) + h / 2, z);
      geos.push(g);
    }
  }
  if (geos.length) {
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    geos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0xb9b4aa, roughness: 0.85 })));
  }

  // Yollar: çizgi olarak (viyadük kotu pts[.][1]'de).
  const seg = [];
  for (const rd of Array.isArray(data.roads) ? data.roads : []) {
    const pts = rd.pts || [];
    for (let i = 0; i + 1 < pts.length; i++) {
      seg.push(pts[i][0], pts[i][1] + 0.6, pts[i][2], pts[i + 1][0], pts[i + 1][1] + 0.6, pts[i + 1][2]);
    }
  }
  if (seg.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1c1d20 })));
  }

  return {
    update(state) {
      // Gerçek modül: trafik vb. yalnız state.t'nin saf fonksiyonu olmalı.
      void state;
    },
  };
}
