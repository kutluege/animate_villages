// YER TUTUCU — sahibi (kamera-kurgu ajanı) değiştirecek.
// Arayüz örneği: create(ctx) → { update(state) }; film kipinde ctx.camera'yı yalnız
// state.t'den kurar (birikimli durum yok → aynı t, aynı kamera). Basit alçalan yörünge.
import { DURATION as TL_DURATION } from '../core/timeline.js';

export const DURATION = TL_DURATION;

export async function create(ctx) {
  const { camera, heightAt } = ctx;
  const cy = heightAt(0, 0);

  return {
    update(state) {
      const u = Math.min(1, Math.max(0, state.t / DURATION));
      const e = u * u * (3 - 2 * u);
      const ang = -2.2 + 1.9 * e;
      const radius = 820 - 330 * e;
      const height = 430 - 250 * e;
      camera.up.set(0, 1, 0);
      camera.position.set(Math.sin(ang) * radius, cy + height, Math.cos(ang) * radius);
      camera.lookAt(0, cy + 55, 0);
      if (camera.fov !== 38) {
        camera.fov = 38;
        camera.updateProjectionMatrix();
      }
    },
  };
}
