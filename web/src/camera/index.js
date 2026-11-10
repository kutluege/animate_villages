// KAMERA-KURGU modülü (CONTRACT §5): create(ctx) → { update(state) }.
// Film kipinde ctx.camera yalnız state.t'den kurulur (birikimli durum yok → aynı t, aynı kamera).
// Rota ve kurgu notları: ./route.js · doğrulama: node web/src/camera/check.mjs
import { DURATION as TL_DURATION } from '../core/timeline.js';
import { poseAt, CUTS } from './route.js';

export const DURATION = TL_DURATION;
export { poseAt, CUTS };

export async function create(ctx) {
  const { camera } = ctx;

  return {
    update(state) {
      const p = poseAt(state.t);
      camera.up.set(0, 1, 0); // ufuk düz: yatış (roll) yok
      camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
      camera.lookAt(p.target[0], p.target[1], p.target[2]);
      if (Math.abs(camera.fov - p.fov) > 1e-6) {
        camera.fov = p.fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
