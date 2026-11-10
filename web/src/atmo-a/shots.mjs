// Atmosfer A deneme görüntüleri → out/atmo-a/
//   node web/src/atmo-a/shots.mjs [--testscene] [--tod 16.5,18.75] [--view genel,bati] [--size 540x960] [--tag x]
//   [--video 0,12,24] (edit.js kareleri)  [--q draft]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, openScene, parseArgs } from '../../../tools/lib-browser.mjs';
import { ROOT } from '../../../tools/serve.mjs';

const VIEWS = {
  genel: { position: [650, 420, 750], target: [0, 20, 0], fov: 40 },
  bati: { position: [620, 160, 60], target: [-250, 60, -20], fov: 45 },
  meydan: { position: [140, 28, 170], target: [-40, 45, -30], fov: 55 },
  sokak: { position: [60, 6, 120], target: [-60, 30, -80], fov: 60 },
};
const args = parseArgs();
const [w, h] = String(args.size || '540x960').split('x').map(Number);
const tods = args.tod ? String(args.tod).split(',').map(Number) : [16.5, 18.75, 19.3, 19.85, 21.5];
const views = args.view ? String(args.view).split(',') : ['genel', 'bati', 'meydan'];
const t = Number.isFinite(Number(args.t)) ? Number(args.t) : 10;
const tag = args.tag && args.tag !== true ? String(args.tag) + '-' : '';
const outDir = join(ROOT, 'out', 'atmo-a');
mkdirSync(outDir, { recursive: true });

const env = await openBrowser();
let code = 0;
try {
  const query = { render: '1', w, h, q: args.q === 'draft' ? 'draft' : 'final', atmo: args.atmo && args.atmo !== true ? String(args.atmo) : 'a' };
  if (args.testscene) query.testscene = '1';
  if (args.glass) query.atmoglass = '1';
  if (args.dbg) query.atmodbg = String(args.dbg);
  const { page, gpu, errors } = await openScene(env, { query, width: w, height: h });
  console.log(`[atmo-a] ${w}x${h} GPU: ${gpu}`);
  console.log('[atmo-a] modüller:', JSON.stringify(await page.evaluate(() => window.__modules)));
  const canvas = page.locator('canvas');
  for (const v of views) for (const tod of tods) {
    const t0 = Date.now();
    await page.evaluate((view) => window.__renderView(view), { ...VIEWS[v], tod, t });
    const file = join(outDir, `${tag}${v}-${tod.toFixed(2)}.png`);
    await canvas.screenshot({ path: file });
    console.log('  →', file, `${Date.now() - t0} ms`);
  }
  if (args.video) {
    for (const s of String(args.video).split(',').map(Number)) {
      await page.evaluate((tt) => window.__renderFrame(tt), s);
      const file = join(outDir, `${tag}video-${s.toFixed(1)}s.png`);
      await canvas.screenshot({ path: file });
      console.log('  →', file);
    }
  }
  if (args.bench) {
    const N = 30, t0 = Date.now();
    for (let i = 0; i < N; i++) await page.evaluate((tt) => window.__renderFrame(tt), 5 + i / 30);
    console.log(`[atmo-a] __renderFrame ortalama ${((Date.now() - t0) / N).toFixed(1)} ms/kare`);
  }
  if (errors.length) console.log(`[atmo-a] sayfada ${errors.length} hata`);
} catch (e) {
  console.error('[atmo-a] başarısız:', e.message); code = 1;
} finally {
  await env.close();
}
process.exit(code);
