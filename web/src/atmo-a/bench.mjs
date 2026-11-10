// Atmosfer A kare maliyeti: update+render (gl.finish ile) ortalaması; tod her karede değişir (PMREM her kare).
import { openBrowser, openScene, parseArgs } from '../../../tools/lib-browser.mjs';
const args = parseArgs();
const [w, h] = String(args.size || '1080x1920').split('x').map(Number);
const env = await openBrowser();
try {
  const query = { render: '1', w, h, q: args.q === 'draft' ? 'draft' : 'final', atmo: 'a', atmobench: '1' };
  if (args.testscene) query.testscene = '1';
  const { page } = await openScene(env, { query, width: w, height: h });
  const r = await page.evaluate(async () => {
    const { timeState } = await import('/web/src/timeline.js');
    const A = window.__atmoA, gl = window.__ctx.renderer.getContext();
    const now = () => new Date().getTime();
    const run = (fn, n) => { gl.finish(); const t0 = now(); for (let i = 0; i < n; i++) fn(i); gl.finish(); return (now() - t0) / n; };
    const sc = window.__ctx.scene, cam = window.__ctx.camera, R = window.__ctx.renderer;
    const N = 40;
    const full = run((i) => { const s = timeState(19 + i * 0.01, i / 30); A.update(s); A.render(s); }, N);
    const sameTod = run((i) => { const s = timeState(19.5, i / 30); A.update(s); A.render(s); }, N);
    const plain = run(() => { R.setRenderTarget(null); R.render(sc, cam); }, N);
    return { full, sameTod, plain };
  });
  console.log(`[bench ${w}x${h}] atmo update+render (tod değişken): ${r.full.toFixed(2)} ms · (tod sabit): ${r.sameTod.toFixed(2)} ms · çıplak renderer.render: ${r.plain.toFixed(2)} ms`);
} finally { await env.close(); }
