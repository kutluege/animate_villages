// §7 sınaması: aynı t karesi (a) taze sayfada tek başına, (b) baştan sırayla gelinerek,
// (c) ileri atlayıp geri dönülerek çizilir; pikseller karşılaştırılır.
//   node tools/check-determinism.mjs [--t 12.3] [--fps 15] [--size 540x960] [--atmo a] [--testscene]
import { openBrowser, openScene, parseArgs } from './lib-browser.mjs';

const args = parseArgs();
const T = Number(args.t ?? 12.3);
const FPS = Number(args.fps) || 15;
const [W, H] = String(args.size || '540x960').split('x').map(Number);
const query = { render: '1', w: W, h: H, q: args.q === 'final' ? 'final' : 'draft' };
if (args.atmo && args.atmo !== true) query.atmo = String(args.atmo);
if (args.testscene) query.testscene = '1';

const env = await openBrowser();
const shot = (page) => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
let code = 0;
try {
  const a = await openScene(env, { query, width: W, height: H });
  await a.page.evaluate((t) => window.__renderFrame(t), T);
  const A = await shot(a.page);

  const b = await openScene(env, { query, width: W, height: H, log: false });
  for (let i = 0; i / FPS < T - 1e-9; i++) await b.page.evaluate((t) => window.__renderFrame(t), i / FPS);
  await b.page.evaluate((t) => window.__renderFrame(t), T);
  const B = await shot(b.page);

  await a.page.evaluate(async (d) => { await window.__renderFrame(d * 0.9); await window.__renderFrame(1.7); }, await a.page.evaluate(() => window.__duration));
  await a.page.evaluate((t) => window.__renderFrame(t), T);
  const C = await shot(a.page);

  // Piksel karşılaştırması tarayıcıda (PNG çözücü bağımlılığı yok)
  const diff = async (x, y) => (x.equals(y) ? { same: true, max: 0, count: 0 } : b.page.evaluate(async ([p, q]) => {
    const load = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height).data; };
    const [u, v] = [await load(p), await load(q)];
    let max = 0, count = 0;
    for (let i = 0; i < u.length; i++) { const d = Math.abs(u[i] - v[i]); if (d) { count++; if (d > max) max = d; } }
    return { same: false, max, count };
  }, [x.toString('base64'), y.toString('base64')]));
  const ab = await diff(A, B), ac = await diff(A, C);
  console.log(`[determinizm] t=${T}  tek-başına vs sıralı: ${ab.same ? 'AYNI (bayt)' : `max fark ${ab.max}, ${ab.count} kanal`}`);
  console.log(`[determinizm] t=${T}  tek-başına vs atla-dön: ${ac.same ? 'AYNI (bayt)' : `max fark ${ac.max}, ${ac.count} kanal`}`);
  if (!(ab.max <= 2 && ac.max <= 2)) { console.log('[determinizm] BAŞARISIZ'); code = 1; } else console.log('[determinizm] geçti');
} catch (e) { console.error('[determinizm] hata:', e.message); code = 1; } finally { await env.close(); }
process.exit(code);
