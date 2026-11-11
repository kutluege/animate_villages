// Tarayıcıda elle gezinme: kaydırıcı, oynat/durdur (sesle), sahneye atla, güvenli alan. Render modunda yüklenmez.
// Kısayollar: boşluk oynat/durdur · ←/→ 1 kare · Shift+←/→ 1 sn · S güvenli alan
import { h } from './kit.js';
import { C, FONT } from './theme.js';

export function initPreview({ renderFrame, duration, scenes, startT = 0, safe, root }) {
  const FPS = 30;
  let t = startT, playing = false, busy = false, want = null, t0 = 0, wall0 = 0;
  const audio = new Audio();
  fetch(new URL('work/audio.wav', root), { method: 'HEAD' }).then((r) => { audio.src = new URL(r.ok ? 'work/audio.wav' : 'work/voice.wav', root).href; });

  const css = { font: `500 14px/1 ${FONT.mono}`, color: C.ink };
  const btn = h('button', { style: { ...css, width: '64px', height: '40px', background: C.navy2, border: `1px solid ${C.navy3}`, borderRadius: '8px', cursor: 'pointer' } }, '▶');
  const slider = h('input', { type: 'range', min: '0', max: String(duration), step: String(1 / FPS), value: String(t), style: { flex: '1', accentColor: C.window } });
  const label = h('div', { style: { ...css, minWidth: '210px', fontVariantNumeric: 'tabular-nums' } });
  const sel = h('select', { style: { ...css, background: C.navy2, border: `1px solid ${C.navy3}`, height: '40px', borderRadius: '8px' } },
    scenes.map((s) => h('option', { value: String(s.start) }, `${s.id}  ${s.start.toFixed(1)}`)));
  const safeBox = h('input', { type: 'checkbox' });
  if (safe.style.display === 'block') safeBox.checked = true;
  const bar = h('div', { style: { position: 'fixed', left: '0', right: '0', bottom: '0', height: '76px', display: 'flex', gap: '14px', alignItems: 'center',
    padding: '0 18px', background: C.glassStrong, borderTop: `1px solid ${C.navy3}`, boxSizing: 'border-box', zIndex: 10 } },
  btn, slider, label, sel, h('label', { style: { ...css, display: 'flex', gap: '6px', alignItems: 'center' } }, safeBox, 'güvenli alan'));
  document.body.append(bar);

  const sceneAt = (x) => scenes.find((s) => x >= s.start && x < s.end) || scenes[scenes.length - 1];
  function show(x) {
    t = Math.max(0, Math.min(duration, x));
    slider.value = String(t);
    const sc = sceneAt(t);
    label.textContent = `${t.toFixed(2)} s · ${sc.id} +${(t - sc.start).toFixed(2)}`;
    const u = new URL(location.href); u.searchParams.set('t', t.toFixed(2)); history.replaceState(null, '', u);
    if (busy) { want = t; return; }
    busy = true;
    renderFrame(t).finally(() => { busy = false; if (want !== null) { const w = want; want = null; show(w); } });
  }
  function play(on) {
    playing = on; btn.textContent = on ? '❚❚' : '▶';
    if (on) { t0 = t; wall0 = performance.now(); audio.currentTime = t; audio.play().catch(() => {}); requestAnimationFrame(tick); }
    else audio.pause();
  }
  function tick() {
    if (!playing) return;
    const x = !audio.paused && audio.currentTime > 0 && t < audio.duration ? audio.currentTime : t0 + (performance.now() - wall0) / 1000;
    if (x >= duration) { show(duration); play(false); return; }
    if (!busy) show(x);
    requestAnimationFrame(tick);
  }
  btn.onclick = () => play(!playing);
  slider.oninput = () => { if (playing) play(false); show(Number(slider.value)); };
  sel.onchange = () => { if (playing) play(false); show(Number(sel.value) + 0.01); };
  safeBox.onchange = () => { safe.style.display = safeBox.checked ? 'block' : 'none'; };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); play(!playing); }
    else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault(); if (playing) play(false);
      show(Math.round((t + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 1 / FPS)) * FPS) / FPS);
    } else if (e.key === 's' || e.key === 'S') { safeBox.checked = !safeBox.checked; safeBox.onchange(); }
  });
  show(t);
}
