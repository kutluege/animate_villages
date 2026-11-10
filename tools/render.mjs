// Kare kare deterministik render → ffmpeg → MP4.
//   npm run render -- --draft                  540×960, 15 fps, hızlı → out/draft/
//   npm run render                             1080×1920, 30 fps, yüksek kalite → out/final/
// Seçenekler: --atmo a|b  --from 10 --to 14 (sn, kısmi)  --fps N  --size WxH  --crf N
//             --outdir out/<ajan> (kareler+MP4 oraya)  --fresh (kareleri sil, baştan)  --no-encode  --testscene  --swiftshader  --out dosya.mp4
// Yarıda kesilirse aynı komut kaldığı yerden devam eder (out/frames/<iş>/ altındaki tamam kareler atlanır).
// Kod/veri değiştiyse (manifest özeti tutmazsa) eski kareler otomatik silinir.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { openBrowser, openScene, parseArgs } from './lib-browser.mjs';
import { ROOT } from './serve.mjs';

const args = parseArgs();
const draft = !!args.draft;
let [W, H] = draft ? [540, 960] : [1080, 1920];
if (args.size) [W, H] = String(args.size).split('x').map(Number);
const FPS = Number(args.fps) || (draft ? 15 : 30);
const atmo = args.atmo && args.atmo !== true ? String(args.atmo) : 'b'; // varsayılan atmosfer B
const quality = draft ? 'draft' : 'final';
const crf = Number(args.crf) || (draft ? 23 : 14);
// --outdir out/<ajan-adı>: kareler <outdir>/frames/<iş>/, MP4 <outdir>/ altına (başkasının karelerine dokunmaz)
const OUTDIR = args.outdir && args.outdir !== true ? resolve(ROOT, String(args.outdir)) : null;

const job = `${quality}-${atmo}${args.testscene ? '-test' : ''}-${W}x${H}-${FPS}`;
const framesDir = OUTDIR ? join(OUTDIR, 'frames', job) : join(ROOT, 'out', 'frames', job);
const manifestPath = join(framesDir, 'manifest.json');
const frameName = (i) => `f${String(i).padStart(5, '0')}.png`;

// Sahneyi etkileyen her şeyin özeti: kare önbelleği buna bağlı.
function sceneDigest() {
  const h = createHash('sha256');
  const add = (dir, re) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).sort()) {
      const p = join(dir, f);
      if (statSync(p).isFile() && re.test(f)) { h.update(relative(ROOT, p)); h.update(readFileSync(p)); }
    }
  };
  add(join(ROOT, 'web', 'src'), /\.js$/);
  add(join(ROOT, 'web'), /\.html$/);
  add(join(ROOT, 'data'), /\.json$/);
  h.update(JSON.stringify({ W, H, FPS, atmo, quality, test: !!args.testscene }));
  return h.digest('hex').slice(0, 16);
}

function ffmpeg(argv) {
  return new Promise((ok, fail) => {
    const p = spawn('ffmpeg', argv, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg çıkış kodu ' + c))));
  });
}

const env = await openBrowser({ swiftshader: !!args.swiftshader });
let interrupted = false;
process.on('SIGINT', async () => {
  if (interrupted) process.exit(130);
  interrupted = true;
  console.log('\n[render] kesildi — tamamlanan kareler duruyor, aynı komutla devam edilebilir.');
});

let code = 0;
try {
  const query = { render: '1', w: W, h: H, q: quality };
  if (atmo) query.atmo = atmo;
  if (args.testscene) query.testscene = '1';
  const open = () => openScene(env, { query, width: W, height: H });
  let scene = await open();
  const duration = await scene.page.evaluate(() => window.__duration);
  const N = Math.round(duration * FPS);
  const from = args.from !== undefined ? Math.max(0, Math.ceil(Number(args.from) * FPS - 1e-6)) : 0;
  const to = args.to !== undefined ? Math.min(N, Math.ceil(Number(args.to) * FPS - 1e-6)) : N;
  console.log(`[render] ${job}: ${W}×${H} @${FPS} fps, ${duration} sn, kareler ${from}..${to - 1} / ${N}`);
  console.log(`[render] GPU: ${scene.gpu}`);
  console.log('[render] modüller:', JSON.stringify(await scene.page.evaluate(() => window.__modules.modules)));

  // Önbellek geçerliliği
  const digest = sceneDigest();
  mkdirSync(framesDir, { recursive: true });
  let man = null;
  try { man = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
  if (args.fresh || (man && man.digest !== digest)) {
    if (man && man.digest !== digest) console.log('[render] kod/veri değişmiş — eski kareler siliniyor');
    rmSync(framesDir, { recursive: true, force: true });
    mkdirSync(framesDir, { recursive: true });
  }
  writeFileSync(manifestPath, JSON.stringify({ digest, W, H, FPS, duration, N, atmo, quality }, null, 2));

  const todo = [];
  for (let i = from; i < to; i++) {
    const p = join(framesDir, frameName(i));
    if (!(existsSync(p) && statSync(p).size > 0)) todo.push(i);
  }
  if (todo.length < to - from) console.log(`[render] ${to - from - todo.length} kare zaten var, ${todo.length} kare çizilecek`);

  const t0 = Date.now();
  let done = 0, retries = 0;
  for (let k = 0; k < todo.length && !interrupted; k++) {
    const i = todo[k];
    const t = i / FPS;
    try {
      // Kanvas pikselleri doğrudan (preserveDrawingBuffer açık): page.screenshot'tan ~4× hızlı, kompozitör yok.
      const dataUrl = await scene.page.evaluate(async (tt) => {
        await window.__renderFrame(tt);
        return window.__ctx.renderer.domElement.toDataURL('image/png');
      }, t);
      const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      if (buf.length < 1000) throw new Error('boş kare');
      const p = join(framesDir, frameName(i));
      writeFileSync(p + '.tmp', buf);
      renameSync(p + '.tmp', p); // yarım dosya kalmasın
    } catch (e) {
      if (interrupted) break;
      if (++retries > 3) throw e;
      console.warn(`[render] kare ${i} başarısız (${e.message.split('\n')[0]}) — sayfa yeniden açılıyor (${retries}/3)`);
      await scene.page.close().catch(() => {});
      scene = await open();
      k--; continue;
    }
    done++;
    if (done % Math.max(1, Math.round(FPS)) === 0 || k === todo.length - 1) {
      const el = (Date.now() - t0) / 1000, rate = done / el;
      process.stdout.write(`\r[render] ${done}/${todo.length} kare  ${rate.toFixed(1)} kare/sn  kalan ~${((todo.length - done) / rate).toFixed(0)} sn   `);
    }
  }
  if (todo.length) process.stdout.write('\n');
  await scene.page.close().catch(() => {});
  if (interrupted) { code = 130; throw new Error('kesildi'); }

  // Kodlama
  if (!args['no-encode']) {
    const missing = [];
    for (let i = from; i < to; i++) if (!existsSync(join(framesDir, frameName(i)))) missing.push(i);
    if (missing.length) throw new Error(`${missing.length} kare eksik (ilk: ${missing[0]})`);
    const partial = from > 0 || to < N;
    // out/final/ commit edilir: yalnızca tam, final, test sahnesiz videolar oraya gider.
    const outDir = OUTDIR || join(ROOT, 'out', !draft && !partial && !args.testscene ? 'final' : 'draft');
    mkdirSync(outDir, { recursive: true });
    const base = `mecidiyekoy${draft ? '-draft' : ''}${atmo !== 'b' ? '-' + atmo : ''}${args.testscene ? '-test' : ''}`;
    const out = args.out && args.out !== true ? String(args.out)
      : join(outDir, partial ? `${base}-${(from / FPS).toFixed(1)}-${(to / FPS).toFixed(1)}s.mp4` : `${base}.mp4`);
    const enc = [
      '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
      '-framerate', String(FPS), '-start_number', String(from), '-i', join(framesDir, 'f%05d.png'),
      '-frames:v', String(to - from),
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', String(crf),
      '-profile:v', 'high', '-level:v', '4.2', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      ...(draft ? [] : ['-tune', 'film', '-x264-params', 'aq-mode=3:deblock=-1,-1']),
      '-g', String(FPS * 2), '-r', String(FPS),
      '-movflags', '+faststart', '-an', out,
    ];
    console.log('[render] ffmpeg kodluyor…');
    await ffmpeg(enc);
    const mb = (statSync(out).size / 1048576).toFixed(1);
    console.log(`[render] ✓ ${relative(ROOT, out)} (${mb} MB, ${((to - from) / FPS).toFixed(1)} sn)`);
  }
} catch (e) {
  if (e.message !== 'kesildi') { console.error('[render] başarısız:', e.message); code = code || 1; }
} finally {
  await env.close();
}
process.exit(code);
