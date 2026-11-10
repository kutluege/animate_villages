// YER TUTUCU — sahibi (ışık-atmosfer ajanı A) değiştirecek.
// Arayüz örneği: create(ctx) → { update(state), render?(state), resize?(w,h) }.
// Düz gök rengi + yarıküre ışığı + güneş/ay yön ışığı + sis. Post yok; render() tanımlı
// değil, bu yüzden iskelet renderer.render(scene, camera) çağırır.
export async function create(ctx) {
  const { THREE, scene, renderer } = ctx;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const sky = new THREE.Color();
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 900, 7000);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3630, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(hemi, sun, sun.target);

  const DAY = new THREE.Color(0x8db7e6);
  const DUSK = new THREE.Color(0xe59a6c);
  const NIGHT = new THREE.Color(0x0a0f1f);
  const SUN_HI = new THREE.Color(0xfff4e0);
  const SUN_LO = new THREE.Color(0xff9a52);
  const MOON = new THREE.Color(0x7f93c8);

  return {
    update(state) {
      const { sunDir, sunElev, night } = state;
      const dusk = Math.exp(-((sunElev / 0.16) ** 2)); // ufuk çevresinde tepe
      sky.copy(DAY).lerp(DUSK, dusk * 0.8).lerp(NIGHT, night);
      scene.fog.color.copy(sky);

      const above = Math.min(1, Math.max(0, sunElev / 0.12 + 0.3));
      const warm = 1 - Math.min(1, Math.max(0, sunElev / 0.5));
      if (above > 0.01) {
        sun.position.copy(sunDir).multiplyScalar(2000);
        sun.color.copy(SUN_HI).lerp(SUN_LO, warm);
        sun.intensity = 3.2 * above;
      } else {
        sun.position.set(-0.4, 0.8, 0.45).multiplyScalar(2000); // ay
        sun.color.copy(MOON);
        sun.intensity = 0.35 * night;
      }
      hemi.color.copy(sky).lerp(SUN_HI, 0.35);
      hemi.intensity = 0.25 + 1.5 * (1 - night);
    },
  };
}
