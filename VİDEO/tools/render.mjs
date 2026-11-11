// Kare kare deterministik render → ses miksi → MP4.
//   node tools/render.mjs --draft              540×960, 15 fps → out/draft/icerik-draft.mp4
//   node tools/render.mjs                      1080×1920, 30 fps → out/icerik.mp4
//   node tools/render.mjs --draft --from 20 --to 31   kısmi (sesli) → out/draft/icerik-draft-20.0-31.0.mp4
// Seçenekler: --fps N  --size WxH  --crf N  --workers N  --fresh  --no-encode  --no-audio  --png  --out dosya.mp4  --swiftshader
// Kaldığı yerden devam eder: her karenin bağımlılık özeti (ortak kod + o anda görünen sahnelerin kod/asset'i) manifestte;
// yalnızca değişen sahnelerin kareleri yeniden çizilir.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ROOT, ffmpeg, grab, openBrowser, openComp, parseArgs } from './lib-browser.mjs';
import { mixAudio } from './mix.mjs';

const args = parseArgs();
const draft = !!args.draft;
let [W, H] = draft ? [540, 960] : [1080, 1920];
if (args.size) [W, H] = String(args.size).split('x').map(Number);
const FPS = Number(args.fps) || (draft ? 15 : 30);
const crf = Number(args.crf) || (draft ? 23 : 16);
const WORKERS = Math.max(1, Number(args.workers) || 4);
const EXT = args.png ? 'png' : 'jpg';
const job = `${draft ? 'draft' : 'final'}-${W}x${H}-${FPS}-${EXT}`;
const framesDir = join(ROOT, 'out', 'frames', job);
const manifestPath = join(framesDir, 'manifest.json');
const frameName = (i) => `f${String(i).padStart(5, '0')}.${EXT}`;

// ---- bağımlılık özetleri ----
function hashTree(h, dir, { content = true, re = /./ } = {}) {
  if (!existsSync(dir)) return;
  const st = statSync(dir);
  if (st.isFile()) { h.update(relative(ROOT, dir)); h.update(content ? readFileSync(dir) : `${st.size}:${st.mtimeMs}`); return; }
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f), s = statSync(p);
    if (s.isDirectory()) hashTree(h, p, { content, re });
    else if (re.test(f)) { h.update(relative(ROOT, p)); h.update(content ? readFileSync(p) : `${s.size}:${s.mtimeMs}`); }
  }
}
function commonDigest() {
  const h = createHash('sha256');
  hashTree(h, join(ROOT, 'comp', 'index.html'));
  for (const f of readdirSync(join(ROOT, 'comp', 'src')).sort()) if (/\.js$/.test(f)) hashTree(h, join(ROOT, 'comp', 'src', f));
  hashTree(h, join(ROOT, 'comp', 'assets', 'fonts'), { content: false });
  hashTree(h, join(ROOT, 'work', 'transcript.json'));
  hashTree(h, join(ROOT, 'work', 'timeline.json'));
  h.update(JSON.stringify({ W, H, FPS, EXT }));
  return h.digest('hex').slice(0, 16);
}
function sceneDigest(id) {
  const h = createHash('sha256');
  h.update(id);
  hashTree(h, join(ROOT, 'comp', 'src', 'scenes', `${id}.js`));
  hashTree(h, join(ROOT, 'comp', 'src', 'scenes', id));
  hashTree(h, join(ROOT, 'comp', 'assets', id), { content: false });
  return h.digest('hex').slice(0, 16);
}

const env = await openBrowser({ swiftshader: !!args.swiftshader });
let interrupted = false;
process.on('SIGINT', () => {
  if (interrupted) process.exit(130);
  interrupted = true;
  console.log('\n[render] kesildi — tamamlanan kareler duruyor, aynı komutla devam edilebilir.');
});

let code = 0;
const pages = [];
try {
  const first = await openComp(env, { width: W, height: H });
  pages.push(first);
  const info = await first.page.evaluate(() => ({ duration: window.__duration, timeline: window.__timeline, modules: window.__modules, sfx: window.__sfx }));
  const N = Math.round(info.duration * FPS);
  const from = args.from !== undefined ? Math.max(0, Math.round(Number(args.from) * FPS)) : 0;
  const to = args.to !== undefined ? Math.min(N, Math.round(Number(args.to) * FPS)) : N;
  console.log(`[render] ${job}: ${W}×${H} @${FPS} fps, ${info.duration.toFixed(2)} sn, kareler ${from}..${to - 1} / ${N}`);
  console.log('[render] modüller:', Object.entries(info.modules.modules).map(([k, v]) => `${k}=${v}`).join('  '));

  const common = commonDigest();
  const sd = Object.fromEntries(info.timeline.map((s) => [s.id, sceneDigest(s.id)]));
  const frameHash = (i) => {
    const t = i / FPS;
    const vis = info.timeline.filter((s) => t >= s.from && (t < s.to || (s.to >= info.duration && t <= info.duration)));
    return createHash('sha1').update(common + vis.map((s) => s.id + sd[s.id]).join('|')).digest('hex').slice(0, 16);
  };

  mkdirSync(framesDir, { recursive: true });
  let man = { hashes: {} };
  if (args.fresh) { rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true }); }
  else try { man = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch {}
  man.hashes ||= {};
  const saveMan = () => writeFileSync(manifestPath + '.tmp', JSON.stringify({ W, H, FPS, EXT, N, hashes: man.hashes })) || renameSync(manifestPath + '.tmp', manifestPath);

  const todo = [];
  for (let i = from; i < to; i++) {
    const p = join(framesDir, frameName(i));
    if (!(existsSync(p) && statSync(p).size > 0 && man.hashes[i] === frameHash(i))) todo.push(i);
  }
  if (todo.length < to - from) console.log(`[render] ${to - from - todo.length} kare güncel, ${todo.length} kare çizilecek`);

  // İşçiler: ayrı bağlamlarda sayfalar (paralel süreçler)
  const nw = Math.min(WORKERS, Math.max(1, Math.ceil(todo.length / 30)));
  while (pages.length < nw) {
    const ctx = await env.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    pages.push(await openComp({ ...env, browser: ctx }, { width: W, height: H, log: false }));
  }
  const t0 = Date.now();
  let done = 0, next = 0, lastSave = 0;
  const shotOpts = EXT === 'jpg' ? { type: 'jpeg', quality: draft ? 90 : 95 } : { type: 'png' };
  async function worker(w) {
    let scene = pages[w], retries = 0;
    while (!interrupted) {
      const k = next++;
      if (k >= todo.length) return;
      const i = todo[k];
      try {
        const bufr = await grab(scene.page, i / FPS, shotOpts);
        if (bufr.length < 500) throw new Error('boş kare');
        const p = join(framesDir, frameName(i));
        writeFileSync(p + '.tmp', bufr);
        renameSync(p + '.tmp', p);
        man.hashes[i] = frameHash(i);
      } catch (e) {
        if (interrupted) return;
        if (++retries > 3) throw e;
        console.warn(`\n[render] kare ${i} başarısız (${e.message.split('\n')[0]}) — sayfa yeniden açılıyor (${retries}/3)`);
        await scene.page.close().catch(() => {});
        const ctx = await env.browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
        scene = pages[w] = await openComp({ ...env, browser: ctx }, { width: W, height: H, log: false });
        todo.push(i); continue;
      }
      done++;
      if (done - lastSave >= 60) { lastSave = done; saveMan(); }
      if (done % Math.max(1, FPS) === 0 || done === todo.length) {
        const el = (Date.now() - t0) / 1000, rate = done / el;
        process.stdout.write(`\r[render] ${done}/${todo.length} kare  ${rate.toFixed(1)} kare/sn  kalan ~${((todo.length - done) / rate).toFixed(0)} sn   `);
      }
    }
  }
  await Promise.all(pages.map((_, w) => worker(w)));
  saveMan();
  if (todo.length) process.stdout.write('\n');
  const pageErrors = pages.flatMap((p) => p.errors);
  if (pageErrors.length) console.log(`[render] sayfa hataları (${pageErrors.length}):\n  ` + [...new Set(pageErrors)].slice(0, 12).join('\n  '));
  if (interrupted) { code = 130; throw new Error('kesildi'); }

  if (!args['no-encode']) {
    const missing = [];
    for (let i = from; i < to; i++) if (!existsSync(join(framesDir, frameName(i)))) missing.push(i);
    if (missing.length) throw new Error(`${missing.length} kare eksik (ilk: ${missing[0]})`);
    const partial = from > 0 || to < N;
    const outDir = draft || partial ? join(ROOT, 'out', 'draft') : join(ROOT, 'out');
    mkdirSync(outDir, { recursive: true });
    const base = `icerik${draft ? '-draft' : ''}`;
    const out = args.out && args.out !== true ? resolve(String(args.out))
      : join(outDir, partial ? `${base}-${(from / FPS).toFixed(1)}-${(to / FPS).toFixed(1)}.mp4` : `${base}.mp4`);
    let audio = null;
    if (!args['no-audio']) {
      audio = join(ROOT, 'work', 'audio.wav');
      await mixAudio({ cues: info.sfx, duration: info.duration, timeline: info.timeline, out: audio });
    }
    const len = (to - from) / FPS;
    const enc = [
      '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
      '-framerate', String(FPS), '-start_number', String(from), '-i', join(framesDir, `f%05d.${EXT}`),
      ...(audio ? ['-ss', (from / FPS).toFixed(4), '-t', len.toFixed(4), '-i', audio] : []),
      '-frames:v', String(to - from),
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', String(crf),
      '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      ...(draft ? [] : ['-tune', 'film']),
      '-g', String(FPS * 2), '-r', String(FPS),
      ...(audio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-map', '0:v:0', '-map', '1:a:0', '-t', len.toFixed(4)] : ['-an']),
      '-movflags', '+faststart', out,
    ];
    console.log('[render] ffmpeg kodluyor…');
    await ffmpeg(enc);
    const mb = (statSync(out).size / 1048576).toFixed(1);
    console.log(`[render] ✓ ${relative(ROOT, out)} (${mb} MB, ${len.toFixed(2)} sn${audio ? ', sesli' : ''})`);
  }
} catch (e) {
  if (e.message !== 'kesildi') { console.error('[render] başarısız:', e.message); code = code || 1; }
} finally {
  await env.close();
}
process.exit(code);
