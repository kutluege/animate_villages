// YER TUTUCU — sahibi (ışık-atmosfer ajanı B) değiştirecek.
// Arayüz örneği: create(ctx) → { update(state), render?(state), resize?(w,h) }.
// A yer tutucusuyla aynı iskelet, daha soğuk/kontrastlı palet; ayrıca render(state)
// kancasının nasıl kullanıldığını gösterir (kendi composer'ınız buraya gelir).
export async function create(ctx) {
  const { THREE, scene, camera, renderer } = ctx;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const sky = new THREE.Color();
  scene.background = sky;
  scene.fog = new THREE.FogExp2(sky, 0.00022);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x2c2f38, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, sun, sun.target);

  const DAY = new THREE.Color(0x6fa3df);
  const DUSK = new THREE.Color(0xd9737a);
  const NIGHT = new THREE.Color(0x060a18);
  const SUN_HI = new THREE.Color(0xffffff);
  const SUN_LO = new THREE.Color(0xff7d3c);
  const MOON = new THREE.Color(0x6f8fd8);

  return {
    update(state) {
      const { sunDir, sunElev, night } = state;
      const dusk = Math.exp(-((sunElev / 0.14) ** 2));
      sky.copy(DAY).lerp(DUSK, dusk * 0.85).lerp(NIGHT, night);

      const above = Math.min(1, Math.max(0, sunElev / 0.12 + 0.3));
      const warm = 1 - Math.min(1, Math.max(0, sunElev / 0.45));
      if (above > 0.01) {
        sun.position.copy(sunDir).multiplyScalar(2000);
        sun.color.copy(SUN_HI).lerp(SUN_LO, warm);
        sun.intensity = 3.8 * above;
      } else {
        sun.position.set(0.5, 0.75, 0.4).multiplyScalar(2000);
        sun.color.copy(MOON);
        sun.intensity = 0.4 * night;
      }
      hemi.color.copy(sky).lerp(SUN_HI, 0.25);
      hemi.intensity = 0.2 + 1.3 * (1 - night);
    },
    render(state) {
      void state;
      renderer.render(scene, camera); // gerçek modül: composer.render()
    },
    resize(w, h) {
      void w;
      void h; // gerçek modül: composer.setSize(w, h)
    },
  };
}
