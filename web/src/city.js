// Şehir dokusu — binalar, yollar + viyadük, trafik + metrobüs, sokak lambaları, çatı kalabalığı, ağaçlar.
// CONTRACT §6 arayüzü; tüm hareket (tod, t)'nin saf fonksiyonu (§7). Işık: §4b (HDR yayıcılar, gündüz 0).
// Ayrıntılar web/src/city/ altında.
import * as THREE from 'three';
import { Grid } from './city/util.js';
import { buildRoads } from './city/roads.js';
import { buildBuildings, footprintTester } from './city/buildings.js';
import { buildTraffic } from './city/traffic.js';
import { buildLamps } from './city/lamps.js';
import { buildProps } from './city/props.js';
import { smooth } from './city/util.js';

const SHOP_CLS = { primary: 0.9, secondary: 0.85, link: 0.6, minor: 0.4, path: 0.7 };

export async function create(ctx) {
  const t0 = performance.now();
  const root = new THREE.Group(); root.name = 'city';
  const U = {
    uLightsOn: { value: 0 }, uTrail: { value: 0 }, uCarI: { value: 0 }, uStripI: { value: 0 },
  };

  const net = buildRoads(ctx, U);
  root.add(net.group);

  // dükkân sırası: ana cadde/sokak kenarındaki binaların zemin katı
  const shopGrid = new Grid(20);
  for (const r of net.roads) {
    const p = SHOP_CLS[r.cls];
    if (!p) continue;
    if (r.cls === 'path' && r.kind !== 'pedestrian') continue;
    for (let i = 0; i < r.pts.length; i += 1) if (r.elev[i] < 0.3) shopGrid.add(r.pts[i][0], r.pts[i][1], [r.pts[i][0], r.pts[i][1], r.halfW, p]);
  }
  const nearShopRoad = (ring) => {
    let best = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      shopGrid.query(mx, mz, 16, (it) => {
        const d = Math.hypot(it[0] - mx, it[1] - mz) - it[2];
        if (d < 7.5 && it[3] > best) best = it[3];
      });
    }
    return best;
  };

  const blds = buildBuildings(ctx, U, nearShopRoad);
  root.add(blds.mesh);
  const isInside = footprintTester(blds.footprints, Grid);

  const traffic = buildTraffic(ctx, U, net, isInside);
  root.add(traffic.group);
  const lamps = buildLamps(ctx, U, net, isInside);
  root.add(lamps.group);
  const props = buildProps(ctx, U, blds.footprints, isInside);
  root.add(props.group);

  ctx.scene.add(root);
  const stats = { buildings: blds.footprints.length, roads: net.roads.length, lamps: lamps.count, ...traffic.counts, ...props.counts, ms: Math.round(performance.now() - t0) };
  console.info('[city] hazır', JSON.stringify(stats));
  if (typeof window !== 'undefined') window.__city = { stats, root };

  return {
    object3D: root,
    update(state) {
      const on = state.lightsOn;
      U.uLightsOn.value = on;
      U.uTrail.value = 22 * smooth(0.05, 0.7, on);
      U.uCarI.value = 5.5 * smooth(0.0, 0.35, on);
      U.uStripI.value = 8;
      traffic.update(state);
      lamps.update(state);
      props.update(state);
    },
    dispose() {
      ctx.scene.remove(root);
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose(); x.dispose(); }); } });
    },
  };
}
