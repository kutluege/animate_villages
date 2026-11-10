// YER TUTUCU — sahibi (simge yapı ajanı) değiştirecek.
// Arayüz örneği: create(ctx) → { update(state) }. buildings.json'da landmark işaretli
// ayak izlerini düz renkli kütle olarak yükseltir; veri yoksa hiçbir şey çizmez.
export async function create(ctx) {
  const { THREE, scene, data, heightAt } = ctx;
  const group = new THREE.Group();
  group.name = 'landmarks-placeholder';
  scene.add(group);

  const tint = { trump: 0x6f8fa8, torun: 0x7d8b99, cevahir: 0xa89a86 };
  const mats = {};
  for (const b of Array.isArray(data.buildings) ? data.buildings : []) {
    if (!b.landmark || !b.ring || b.ring.length < 3) continue;
    const shape = new THREE.Shape(b.ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const min = b.minHeight || 0;
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(3, (b.height || 30) - min), bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, (b.baseY ?? heightAt(b.ring[0][0], b.ring[0][1])) + min, 0);
    mats[b.landmark] ??= new THREE.MeshStandardMaterial({
      color: tint[b.landmark] ?? 0x8899aa,
      roughness: 0.35,
      metalness: 0.4,
    });
    group.add(new THREE.Mesh(g, mats[b.landmark]));
  }

  return {
    update(state) {
      void state;
    },
  };
}
