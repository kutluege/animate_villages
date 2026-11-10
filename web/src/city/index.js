// ŞEHİR DOKUSU — zemin, sıradan binalar, yollar, viyadük, metrobüs, trafik, lambalar, ağaçlar.
// Arayüz: create(ctx) → { update(state) } (CONTRACT §5). Işık/gök/sis/post atmosferindir; burada yalnız
// geometri + malzeme + emisyon var. Rastgelelik ctx.rng, hareket yalnız state.t.
//
// Dışa açılan ek (isteğe bağlı): dönen nesnede `info` (sayımlar) ve `groundAt(x,z)` (yollar için
// düzleştirilmiş zemin kotu — kamera/simge ajanı isterse kullanabilir).
import { prepareNetwork } from './network.js';
import { buildGround } from './ground.js';
import { buildBuildings } from './buildings.js';
import { buildRoads } from './roads.js';
import { buildTraffic } from './traffic.js';
import { buildLamps } from './lamps.js';
import { buildTrees } from './trees.js';
import { createDecals } from './decals.js';
import { buildStreet } from './street.js';

export async function create(ctx) {
  const { THREE, scene, camera, renderer } = ctx;
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const shared = { uPx: { value: 0.001 }, uFrac: { value: 0.7 }, uFlow: { value: 0 } }; // 1 m uzaklıkta 1 pikselin dünya boyu

  const net = prepareNetwork(ctx);
  const ground = buildGround(ctx, net, group);
  const bld = buildBuildings(ctx, ground, net, group);
  const decals = createDecals(ctx);
  const roadInfo = buildRoads(ctx, net, ground, group, decals);
  const lamps = buildLamps(ctx, net, ground, bld, roadInfo, group, shared);
  const traffic = buildTraffic(ctx, net, group, shared, roadInfo, { ground, bld });
  const trees = buildTrees(ctx, ground, bld, roadInfo, group);
  const street = buildStreet(ctx, net, ground, bld, roadInfo, decals, group);
  decals.finish(group);

  const sz = new THREE.Vector2();
  const info = {
    buildings: bld.count,
    filler: bld.fillerCount,
    vehicles: traffic.count,
    parked: traffic.parked,
    lamps: lamps.count,
    trees: trees.count,
    people: street.people,
    shelters: street.shelters,
    signs: street.signs,
    decals: decals.count,
  };

  if (typeof window !== 'undefined') {
    // denetim kancası (yalnız okuma): sayımlar + son çizimin draw call / üçgen sayısı
    window.__city = { info, group, trailDebug: traffic.debug, groundAt: ground.gY, renderInfo: () => {
        // yalnız şehir grubunu düz çiz (post yok) → şehir katmanının draw call / üçgen sayısı (gölge geçişi dahil)
        const vis = scene.children.map((c) => c.visible);
        scene.children.forEach((c) => { if (c !== group && !c.isLight) c.visible = false; });
        const rt = renderer.getRenderTarget();
        const ac = renderer.autoClear;
        const bg = scene.background;
        renderer.setRenderTarget(null);
        renderer.autoClear = true;
        scene.background = null;
        renderer.render(scene, camera);
        renderer.setRenderTarget(rt);
        renderer.autoClear = ac;
        scene.background = bg;
        const out = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, exposure: renderer.toneMappingExposure, toneMapping: renderer.toneMapping };
        scene.children.forEach((c, i) => { c.visible = vis[i]; });
        return out;
      } };
  }

  return {
    info,
    groundAt: ground.gY,
    update(state) {
      const h = (ctx.size && ctx.size.height) || renderer.getSize(sz).y;
      shared.uFrac.value = 2 * Math.tan((camera.fov * Math.PI) / 360);
      shared.uPx.value = shared.uFrac.value / Math.max(1, h);
      traffic.update(state);
      lamps.update(state);
    },
  };
}
