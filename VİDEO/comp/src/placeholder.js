// Eksik/hatalı sahne modülü yerine gösterilen yer tutucu (saf t fonksiyonu).
// Aynı zamanda kartografik yapı taşlarının (kit.js) canlı örneği: mapCard, coordLabel, legend, marker, scaleBar, route.
import { C, SAFE, clamp, ease, range } from './theme.js';
import { coordLabel, h, legend, mapCard, mapSvg, marker, route, scaleBar } from './kit.js';

export function createPlaceholder(ctx, error = null) {
  const bar = h('div', { style: { position: 'absolute', left: '0', top: '0', height: '100%', width: '0%', background: C.window } });
  const clock = h('div', { class: 't-label t-num', style: { color: C.dim } });
  const card = mapCard({ x: SAFE.left, y: SAFE.top + 60, w: SAFE.width, title: error ? 'sahne hatası — yer tutucu' : 'yer tutucu',
    coord: `${ctx.start.toFixed(2)}–${ctx.end.toFixed(2)} sn`, accent: error ? C.ember : C.pink, pad: 36 },
  h('div', { class: 't-hero', style: { color: C.ink } }, ctx.id),
  h('div', { style: { marginTop: '22px' } }, coordLabel(`comp/src/scenes/${ctx.id}.js${ctx.silent ? ' · sessiz' : ''}`)),
  error ? h('div', { style: { marginTop: '24px', font: `500 30px/1.3 var(--mono)`, color: C.ember, wordBreak: 'break-word' } }, error) : null,
  h('div', { class: 't-body', style: { marginTop: '36px', color: C.dim, fontSize: '36px', maxHeight: '420px', overflow: 'hidden' } },
    ctx.text || (ctx.silent ? 'Sessiz final: yan yana kıyas, sonra Fable videosu.' : '')));
  const svg = mapSvg();
  const road = route('M-20 1180 C 260 1120, 420 1010, 640 1040 S 960 960, 1100 900', { kind: 'road' });
  const rail = route('M-20 1010 C 300 1000, 700 1090, 1100 1060', { kind: 'rail' });
  const march = route('M150 1150 C 300 940, 560 900, 800 990', { kind: 'march', arrow: true });
  svg.append(rail, road, march);
  const pin = marker({ x: 800, y: 990, label: 'marker()', color: C.pink });
  const leg = mapCard({ x: SAFE.left, y: 1120, w: 430, title: 'lejant', pad: 24, strong: true },
    legend([{ color: C.pink, label: 'vurgu' }, { color: C.road, label: 'yol', kind: 'line' }, { color: C.sunset, label: 'hat', kind: 'line' },
      { color: C.cyan, label: 'metrobüs', kind: 'dash', value: '34' }]));
  const el = h('div', { class: 'scene' }, svg, card, pin, leg,
    h('div', { class: 'abs', style: { right: W_RIGHT + 'px', top: '1430px' } }, scaleBar()),
    h('div', { class: 'abs', style: { left: SAFE.left + 'px', top: SAFE.bottom - 60 + 'px', width: SAFE.width + 'px' } },
      clock,
      h('div', { style: { position: 'relative', marginTop: '18px', height: '6px', background: C.navy3, borderRadius: '3px', overflow: 'hidden' } }, bar)));
  return {
    el,
    update(t) {
      const k = clamp(t / ctx.duration);
      bar.style.width = (k * 100).toFixed(3) + '%';
      clock.textContent = `${ctx.id}  ${t.toFixed(2)} / ${ctx.duration.toFixed(2)} sn`;
      road.draw(range(t, 0.1, 1.2, ease.outCubic)); rail.draw(range(t, 0, 1.0, ease.outCubic)); march.draw(range(t, 0.6, 2.2, ease.inOutCubic));
      pin.style.opacity = range(t, 2.0, 2.4).toFixed(3);
    },
  };
}
const W_RIGHT = 72;
