// Sabit kadrajlardan ekran görüntüleri → out/shots/
//   npm run shots
//   npm run shots -- --atmo a --out out/benim-klasorum --tod 16.5,19.2,21.5 --size 1080x1920 --view genel,meydan --t 10 --q draft
// Varsayılan: tüm kadrajlar × gündüz (16:30) / altın saat (18:45) / gece (21:30), 540×960 dikey.
// Ayrıca --video 0,12,24,35 → edit.js'in o saniyelerdeki kareleri (shotAt ile).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openBrowser, openScene, parseArgs } from './lib-browser.mjs';
import { ROOT } from './serve.mjs';

export const VIEWS = {
  // Güneydoğudan genel hava çekimi, meydana bakış
  genel: { position: [650, 420, 750], target: [0, 20, 0], fov: 40 },
  // Doğudan batıya, güneşe karşı (gün batımı silüeti)
  bati: { position: [620, 160, 60], target: [-250, 60, -20], fov: 45 },
  // Meydanın içinden, göz hizasına yakın
  meydan: { position: [140, 28, 170], target: [-40, 45, -30], fov: 55 },
  // Kuş bakışı, kuzey yukarıda
  plan: { position: [0, 1500, 260], target: [0, 0, 0], fov: 45 },
};
const DEFAULT_TODS = [16.5, 18.75, 21.5];
const todName = (h) => `${String(Math.floor(h)).padStart(2, '0')}${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;

const args = parseArgs();
const [w, h] = String(args.size || '540x960').split('x').map(Number);
const atmo = args.atmo && args.atmo !== true ? String(args.atmo) : 'b'; // varsayılan atmosfer B
const tods = args.tod ? String(args.tod).split(',').map(Number).filter(Number.isFinite) : DEFAULT_TODS;
const views = args.view ? String(args.view).split(',').filter((v) => VIEWS[v]) : Object.keys(VIEWS);
const t = Number.isFinite(Number(args.t)) ? Number(args.t) : 10;
// --out out/<ajan-adı> (CONTRACT §4b); varsayılan out/shots
const outDir = args.out && args.out !== true ? resolve(ROOT, String(args.out)) : join(ROOT, 'out', 'shots');
mkdirSync(outDir, { recursive: true });

const env = await openBrowser({ swiftshader: !!args.swiftshader });
let code = 0;
try {
  const query = { render: '1', w, h, q: args.q === 'draft' ? 'draft' : 'final' };
  if (atmo) query.atmo = atmo;
  if (args.testscene) query.testscene = '1';
  const { page, gpu, errors } = await openScene(env, { query, width: w, height: h });
  console.log(`[shots] ${w}×${h} atmo=${atmo || 'varsayılan'} GPU: ${gpu}`);
  console.log('[shots] modüller:', JSON.stringify(await page.evaluate(() => window.__modules)));
  const canvas = page.locator('canvas');
  const prefix = atmo ? `${atmo}-` : '';
  for (const v of views) for (const tod of tods) {
    await page.evaluate((view) => window.__renderView(view), { ...VIEWS[v], tod, t });
    const file = join(outDir, `${prefix}${v}-${todName(tod)}.png`);
    await canvas.screenshot({ path: file });
    console.log('  →', file);
  }
  if (args.video) {
    for (const s of String(args.video).split(',').map(Number).filter(Number.isFinite)) {
      await page.evaluate((tt) => window.__renderFrame(tt), s);
      const file = join(outDir, `${prefix}video-${s.toFixed(1).replace('.', '_')}s.png`);
      await canvas.screenshot({ path: file });
      console.log('  →', file);
    }
  }
  if (errors.length) { console.log(`[shots] sayfada ${errors.length} hata (yukarıda)`); }
} catch (e) {
  console.error('[shots] başarısız:', e.message); code = 1;
} finally {
  await env.close();
}
process.exit(code);
