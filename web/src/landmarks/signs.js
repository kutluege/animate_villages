// Tabelalar: tek tuval atlası + tek ağ (1 draw call). Gündüz mat harf, gece ışıklı kutu harf.
// Her tabela sabit eşik θ taşır (CONTRACT §5); yanma köşe renginin gölgelendiricide açılmasıyla.
export function makeSigns(ctx, specs) {
  const { THREE, uniforms } = ctx;
  if (!specs.length || typeof document === 'undefined') return null;

  const texts = [];
  for (const s of specs) {
    const key = `${s.font || 'sans'}|${s.track || 0}|${s.text}`;
    let t = texts.find((q) => q.key === key);
    if (!t) texts.push((t = { key, text: s.text, font: s.font, track: s.track || 0 }));
    s.tex = t;
  }
  const W = 2048, ROW = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.max(128, 2 ** Math.ceil(Math.log2(ROW * texts.length)));
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, canvas.height);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  texts.forEach((t, i) => {
    const px = 92;
    g.font = `${t.font === 'serif' ? '700' : '800'} ${px}px ${t.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif'}`;
    const gap = t.track * px;
    const chars = [...t.text];
    const widths = chars.map((c) => g.measureText(c).width);
    let w = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    const k = Math.min(1, (W - 24) / w);
    g.save();
    g.translate(12, i * ROW + ROW / 2 + 4);
    g.scale(k, 1);
    let x = 0;
    chars.forEach((c, j) => {
      g.fillText(c, x, 0);
      x += widths[j] + gap;
    });
    g.restore();
    t.u0 = 6 / W;
    t.u1 = (12 + w * k + 6) / W;
    t.v0 = 1 - (i * ROW + ROW) / canvas.height;
    t.v1 = 1 - (i * ROW) / canvas.height;
    t.aspect = (w * k + 12) / ROW;
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const pos = [], uv = [], col = [], th = [];
  specs.forEach((s, i) => {
    const t = s.tex;
    let h = s.h, w = h * t.aspect;
    if (w > s.maxW) { w = s.maxW; h = w / t.aspect; }
    // dışarıdan bakana göre sağ: up × n
    const r = [s.n[1], -s.n[0]];
    const x0 = s.x - r[0] * w / 2, z0 = s.z - r[1] * w / 2;
    const x1 = s.x + r[0] * w / 2, z1 = s.z + r[1] * w / 2;
    const y0 = s.y - h / 2, y1 = s.y + h / 2;
    const P = [[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]];
    const U = [[t.u0, t.v0], [t.u1, t.v0], [t.u1, t.v1], [t.u0, t.v1]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...P[k]);
      uv.push(...U[k]);
      col.push(...(s.col || [1, 1, 1]));
      th.push(0.08 + 0.05 * (i % 4), s.glow || 1);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('aTh', new THREE.Float32BufferAttribute(th, 2));

  const material = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uLit: uniforms.uLit, uNight: uniforms.uNight, uDay: { value: 1 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      attribute vec3 color; attribute vec2 aTh;
      varying vec2 vUv; varying vec3 vCol; varying vec2 vTh;
      void main() { vUv = uv; vCol = color; vTh = aTh;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uLit; uniform float uNight; uniform float uDay;
      varying vec2 vUv; varying vec3 vCol; varying vec2 vTh;
      void main() {
        float a = texture2D(map, vUv).a;
        if (a < 0.02) discard;
        float on = smoothstep(vTh.x, vTh.x + 0.04, uLit);
        vec3 c = vCol * (0.5 * uDay + 0.05) + vCol * on * 2.6 * vTh.y * mix(0.6, 1.0, uNight);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  material.name = 'landmarks-signs';
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'landmarks-signs';
  mesh.renderOrder = 2;
  return {
    mesh,
    update(state) {
      // gündüz harfler güneş yüksekliğiyle kabaca aydınlanır (ışıksız malzeme)
      material.uniforms.uDay.value = Math.min(1, Math.max(0, state.sunElev / 0.25 + 0.25)) * (1 - 0.8 * state.night);
    },
  };
}
