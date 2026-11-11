// Kaynak videodan kare dizisi (jpg) + manifest.json → sahnede ctx.frames('<klasör>') ile gösterilir.
//   node tools/frames.mjs <video> comp/assets/<sahne>/<ad> [--fps 30] [--from 0] [--to 48.5] [--width 1080] [--crop W:H:X:Y] [--q 3]
// Kare i, kaynağın (from + i/fps) anıdır. Kaynak dosyalar salt okunur; yalnızca çıkış klasörüne yazar.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, ffmpeg, parseArgs } from './lib-browser.mjs';

const args = parseArgs();
const [src, dst] = args._;
if (!src || !dst) { console.error('kullanım: node tools/frames.mjs <video> comp/assets/<sahne>/<ad> [--fps 30] [--from s] [--to s] [--width px] [--crop W:H:X:Y]'); process.exit(1); }
const out = resolve(ROOT, dst);
if (!out.startsWith(join(ROOT, 'comp', 'assets'))) { console.error('çıkış comp/assets/ altında olmalı'); process.exit(1); }
const fps = Number(args.fps) || 30;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const vf = [`fps=${fps}`];
if (args.crop) vf.push(`crop=${args.crop}`);
if (args.width) vf.push(`scale=${Number(args.width)}:-2:flags=lanczos`);
await ffmpeg(['-y', '-hide_banner', '-loglevel', 'error',
  ...(args.from ? ['-ss', String(args.from)] : []), ...(args.to ? ['-to', String(args.to)] : []), '-i', resolve(src),
  '-vf', vf.join(','), '-q:v', String(args.q || 3), '-start_number', '0', join(out, 'f%05d.jpg')]);
const count = readdirSync(out).filter((f) => /^f\d{5}\.jpg$/.test(f)).length;
writeFileSync(join(out, 'manifest.json'), JSON.stringify({ source: src, from: Number(args.from) || 0, fps, count, pattern: 'f%05d.jpg' }, null, 1));
console.log(`[frames] ✓ ${relative(ROOT, out)}: ${count} kare @${fps} fps (${(count / fps).toFixed(2)} sn)`);
