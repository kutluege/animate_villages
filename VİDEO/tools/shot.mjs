// Verilen anlar için PNG (sahne ajanları kendi işini bununla denetler).
//   node tools/shot.mjs 1.5 3 10.2                       global saniye → out/shots/t001.500.png …
//   node tools/shot.mjs 0 2.5 5 --scene vaat --out out/ajan-1   sahneye göre (yerel) saniye
//   node tools/shot.mjs --scene vaat --every 1           sahne boyunca her 1 sn
// Seçenekler: --size WxH (vars. 540x960; tam boy: --full)  --safe (IG bölgelerini çiz)  --only vaat (yalnız bu modülü yükle)
//             --nosubs  --sheet (hepsini yan yana tek PNG: <out>/sheet.png)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, ffmpeg, grab, openBrowser, openComp, parseArgs } from './lib-browser.mjs';

const args = parseArgs();
let [W, H] = args.full ? [1080, 1920] : [540, 960];
if (args.size) [W, H] = String(args.size).split('x').map(Number);
const outDir = resolve(ROOT, args.out && args.out !== true ? String(args.out) : 'out/shots');
mkdirSync(outDir, { recursive: true });
const query = {};
if (args.safe) query.safe = '1';
if (args.only) query.only = String(args.only);
if (args.nosubs) query.nosubs = '1';

const env = await openBrowser();
let code = 0;
try {
  const { page, errors } = await openComp(env, { width: W, height: H, query });
  const tl = await page.evaluate(() => window.__timeline);
  const sc = args.scene ? tl.find((s) => s.id === args.scene) : null;
  if (args.scene && !sc) throw new Error(`sahne yok: ${args.scene} (var olanlar: ${tl.map((s) => s.id).join(', ')})`);
  let times = args._.map(Number).filter(Number.isFinite);
  if (args.every && sc) for (let x = 0; x < sc.end - sc.start; x += Number(args.every)) times.push(x);
  if (!times.length) times = sc ? [0, (sc.end - sc.start) / 2, sc.end - sc.start - 0.1] : [0];
  const files = [];
  for (const x of times) {
    const t = sc ? sc.start + x : x;
    const png = await grab(page, t);
    const name = sc ? `${sc.id}-${x.toFixed(2).padStart(6, '0')}.png` : `t${t.toFixed(3).padStart(7, '0')}.png`;
    writeFileSync(join(outDir, name), png);
    files.push(join(outDir, name));
    const cur = tl.find((s) => t >= s.start && t < s.end) || tl[tl.length - 1];
    console.log(`[shot] t=${t.toFixed(3)} (${cur.id} +${(t - cur.start).toFixed(2)}) → ${relative(ROOT, join(outDir, name))}`);
  }
  if (args.sheet && files.length > 1) {
    const ins = files.flatMap((f) => ['-i', f]);
    await ffmpeg(['-y', '-hide_banner', '-loglevel', 'error', ...ins, '-filter_complex',
      files.map((_, k) => `[${k}:v]scale=${Math.round(640 * W / H)}:640[s${k}]`).join(';') + ';' + files.map((_, k) => `[s${k}]`).join('') + `hstack=inputs=${files.length}`,
      join(outDir, 'sheet.png')], { quiet: true });
    console.log(`[shot] ✓ ${relative(ROOT, join(outDir, 'sheet.png'))}`);
  }
  if (errors.length) { console.log(`[shot] sayfa hataları:\n  ${[...new Set(errors)].join('\n  ')}`); code = 2; }
} catch (e) { console.error('[shot] başarısız:', e.message); code = 1; } finally { await env.close(); }
process.exit(code);
