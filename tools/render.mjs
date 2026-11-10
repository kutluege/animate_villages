#!/usr/bin/env node
// KARE KARE ÜRETİM — deterministik, ekran kaydı DEĞİL (CONTRACT §7–§8).
// Playwright ile /?render=1 sayfasını açar; her kare için __setFrame(i) → __capture() (PNG),
// sonra ffmpeg ile H.264 / yuv420p / 30 fps / sessiz MP4 (kare dizisi sabit kare hızıyla; her PNG = 1 video karesi).
//
//   node tools/render.mjs --draft            540×960  → out/draft/draft.mp4
//   node tools/render.mjs                    1080×1920 → out/final/mecidiyekoy.mp4 + out/final/cover.png
//   seçenekler:
//     --atmo a|b        atmosfer (varsayılan a)
//     --from N --to M   kare aralığı (dahil; varsayılan 0 … son kare)
//     --step K          her K. kare (önizleme; video yine 30 fps, kareler tekrarlanır)
//     --fresh           var olan kareleri at, baştan üret
//     --keep            kaynak değişmiş olsa bile eski kareleri koru (yalnız eksikleri üret)
//     --no-encode       yalnız kareler
//     --jobs J          paralel sayfa sayısı (varsayılan 1)
//     --out yol.mp4     çıktı adını değiştir
//     --port P          (varsayılan 5174)
// Üretim sırasında kaynak değişirse (ortak sunucu, başka ajanlar) sayfa yeniden yüklenmez; ama
// bitişte özet farklıysa uyarı basılır — nihai üretimde komutu yeniden çalıştır.
//
// Yarıda kalırsa: aynı komutu yeniden çalıştır; diskteki kareler atlanır. Kareler
// out/frames/<gxy>_<atmo>/f00000.png. web/src ya da veri değiştiyse (içerik özeti) eski kareler
// geçersiz sayılır ve silinir (--keep ile korunur).
// Tam aralık değilse video out/tmp/'ye yazılır; resmi çıktıya dokunulmaz.
//
// Sunucu: 5174'te Vite açıksa onu kullanır; kapalıysa başlatır ve AÇIK BIRAKIR.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'out');
export const CHROMIUM_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

export function parseArgs(argv, spec) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      o._.push(a);
      continue;
    }
    let key = a.slice(2);
    let val;
    const eq = key.indexOf('=');
    if (eq >= 0) {
      val = key.slice(eq + 1);
      key = key.slice(0, eq);
    }
    if (!(key in spec)) throw new Error(`bilinmeyen seçenek: --${key}`);
    if (spec[key] === 'bool') o[key] = val === undefined ? true : val !== '0' && val !== 'false';
    else {
      if (val === undefined) val = argv[++i];
      if (val === undefined) throw new Error(`--${key} değer ister`);
      o[key] = spec[key] === 'num' ? Number(val) : val;
      if (spec[key] === 'num' && !Number.isFinite(o[key])) throw new Error(`--${key} sayı olmalı`);
    }
  }
  return o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp(base) {
  try {
    const res = await fetch(base + '/', { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Ortak Vite sunucusu: açıksa kullan, kapalıysa başlat (ayrık süreç; biz çıkınca yaşamaya devam eder). */
export async function ensureServer(port = 5174) {
  const base = `http://127.0.0.1:${port}`;
  if (await isUp(base)) return base;
  fs.mkdirSync(path.join(OUT, 'tmp'), { recursive: true });
  const log = fs.openSync(path.join(OUT, 'tmp', 'vite.log'), 'a');
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite], { cwd: ROOT, detached: true, stdio: ['ignore', log, log], windowsHide: true });
  child.unref();
  console.log(`[sunucu] Vite başlatılıyor (pid ${child.pid}, port ${port}; açık bırakılacak)`);
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    if (await isUp(base)) return base;
  }
  throw new Error(`Vite ${port} portunda açılmadı (bkz. out/tmp/vite.log)`);
}

export async function launchBrowser() {
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true, args: CHROMIUM_ARGS });
}

/** /?render=1 sayfasını açar, __ready bekler. → { page, info } */
export async function openRenderPage(browser, base, { w, h, atmo }) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // Vite HMR soketini yut: başka bir ajan üretim sırasında dosya kaydederse sayfa yeniden
  // yüklenmesin; tüm kareler sayfanın açıldığı andaki kod anlık görüntüsünden çıkar.
  await context.routeWebSocket(/.*/, () => {});
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[sayfa hatası]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[konsol]', m.text());
  });
  await page.goto(`${base}/?render=1&w=${w}&h=${h}&atmo=${atmo}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => !!window.__ready, null, { timeout: 120000 });
  const info = await page.evaluate(() => window.__ready);
  if (!info || !info.ok) throw new Error(`sayfa hazır değil: ${JSON.stringify(info)}`);
  if (info.width !== w || info.height !== h) throw new Error(`tuval ${info.width}×${info.height}, istenen ${w}×${h}`);
  return { page, context, info };
}

/** Geçerli tuvali PNG olarak diske yazar (önce .part, sonra yeniden adlandırma → yarım dosya kalmaz). */
export async function capturePng(page, file) {
  const url = await page.evaluate(() => window.__capture('image/png'));
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (buf.length < 100) throw new Error('boş kare');
  fs.writeFileSync(file + '.part', buf);
  fs.renameSync(file + '.part', file);
  return buf.length;
}

export function ffmpegBin() {
  return process.env.FFMPEG || 'ffmpeg';
}

/** Sahneyi etkileyen her şeyin içerik özeti: web/src + web/index.html + işlenmiş veri (boyut+mtime). */
export function sourceSignature() {
  const hash = createHash('sha1');
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (!/check\.mjs$/.test(e.name)) {
        hash.update(path.relative(ROOT, p));
        hash.update(fs.readFileSync(p));
      }
    }
  };
  walk(path.join(ROOT, 'web', 'src'));
  hash.update(fs.readFileSync(path.join(ROOT, 'web', 'index.html')));
  const data = path.join(ROOT, 'web', 'public', 'data');
  if (fs.existsSync(data)) {
    for (const f of fs.readdirSync(data).sort()) {
      const st = fs.statSync(path.join(data, f));
      hash.update(`${f}:${st.size}:${Math.round(st.mtimeMs)}`);
    }
  }
  return hash.digest('hex').slice(0, 16);
}

export const frameName = (i) => `f${String(i).padStart(5, '0')}.png`;

function encode({ dir, frames, fps, step, out, crf, preset }) {
  // Kareler ffmpeg'e SIRALI bir dizi olarak, sabit kare hızıyla verilir (-framerate fps -i s%05d.png):
  // zaman damgası yuvarlaması / fps dönüştürmesi yok → her PNG tam bir video karesi (adım K ise K kare).
  // Dizi, kare dosyalarına sabit bağ (hardlink; olmazsa kopya) içeren geçici bir klasördür.
  const seq = path.join(dir, 'seq');
  fs.rmSync(seq, { recursive: true, force: true });
  fs.mkdirSync(seq, { recursive: true });
  let n = 0;
  for (const i of frames) {
    const src = path.join(dir, frameName(i));
    for (let rpt = 0; rpt < step; rpt++) {
      const dst = path.join(seq, `s${String(n++).padStart(5, '0')}.png`);
      try {
        fs.linkSync(src, dst);
      } catch {
        fs.copyFileSync(src, dst);
      }
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = out.replace(/\.mp4$/, '.part.mp4');
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(fps), '-start_number', '0', '-i', path.join(seq, 's%05d.png'),
    '-an',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
    '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-g', String(fps * 2), '-bf', '2',
    '-fps_mode', 'passthrough', '-video_track_timescale', String(fps * 512),
    '-frames:v', String(n),
    '-movflags', '+faststart',
    tmp,
  ];
  const res = spawnSync(ffmpegBin(), args, { stdio: 'inherit' });
  fs.rmSync(seq, { recursive: true, force: true });
  if (res.error) throw new Error(`ffmpeg çalışmadı: ${res.error.message} (FFMPEG ortam değişkeniyle yol verilebilir)`);
  if (res.status !== 0) throw new Error(`ffmpeg hata kodu ${res.status}`);
  // doğrulama: video kare sayısı = verilen kare sayısı
  const probe = spawnSync(ffmpegBin().replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', tmp], { encoding: 'utf8' });
  const got = parseInt((probe.stdout || '').trim(), 10);
  if (Number.isFinite(got) && got !== n) throw new Error(`kodlama kare sayısı tutmuyor: ${got} ≠ ${n}`);
  fs.renameSync(tmp, out);
  return n;
}

async function main() {
  const o = parseArgs(process.argv.slice(2), {
    draft: 'bool', atmo: 'str', from: 'num', to: 'num', step: 'num', fresh: 'bool', keep: 'bool',
    'no-encode': 'bool', jobs: 'num', out: 'str', port: 'num', w: 'num', h: 'num', help: 'bool',
  });
  if (o.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }
  const draft = !!o.draft;
  const w = o.w ?? (draft ? 540 : 1080);
  const h = o.h ?? (draft ? 960 : 1920);
  const atmo = o.atmo === 'b' ? 'b' : 'a';
  const step = Math.max(1, Math.round(o.step ?? 1));
  const jobs = Math.max(1, Math.min(8, Math.round(o.jobs ?? 1)));

  const base = await ensureServer(o.port ?? 5174);
  const browser = await launchBrowser();
  const t0 = Date.now();
  try {
    const first = await openRenderPage(browser, base, { w, h, atmo });
    const { fps, frames: total } = first.info;
    const missing = Object.entries(first.info.modules || {}).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) console.warn(`[uyarı] yüklenemeyen modül: ${missing.join(', ')}`);
    if (first.info.warnings?.length) console.warn(`[uyarı] ${first.info.warnings.join(' | ')}`);

    const from = Math.max(0, Math.round(o.from ?? 0));
    const to = Math.min(total - 1, Math.round(o.to ?? total - 1));
    if (to < from) throw new Error('--to < --from');
    const frames = [];
    for (let i = from; i <= to; i += step) frames.push(i);
    const full = from === 0 && to === total - 1;
    if (full && step === 1 && frames[frames.length - 1] !== total - 1) frames.push(total - 1);

    // kare klasörü + geçerlilik
    const dir = path.join(OUT, 'frames', `${w}x${h}_${atmo}`);
    fs.mkdirSync(dir, { recursive: true });
    const sig = sourceSignature();
    const manifestFile = path.join(dir, 'manifest.json');
    let manifest = null;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch {}
    const stale = manifest && manifest.sig !== sig;
    if (o.fresh || (stale && !o.keep)) {
      const old = fs.readdirSync(dir).filter((f) => /^f\d+\.png(\.part)?$/.test(f));
      old.forEach((f) => fs.rmSync(path.join(dir, f)));
      if (old.length) console.log(`[kareler] ${old.length} eski kare silindi (${o.fresh ? '--fresh' : 'kaynak değişti'})`);
    }
    fs.writeFileSync(manifestFile, JSON.stringify({ sig, w, h, atmo, fps, total }, null, 1));

    const todo = frames.filter((i) => !fs.existsSync(path.join(dir, frameName(i))));
    console.log(`[üretim] ${w}×${h} atmo=${atmo} kare ${from}…${to} adım ${step}: ${frames.length} kare, ${frames.length - todo.length} hazır, ${todo.length} üretilecek (${jobs} sayfa)`);

    const pages = [first];
    for (let j = 1; j < jobs && j < todo.length; j++) pages.push(await openRenderPage(browser, base, { w, h, atmo }));
    let done = 0;
    let busyMs = 0;
    const tR = Date.now();
    await Promise.all(
      pages.map(async ({ page }, j) => {
        for (let k = j; k < todo.length; k += pages.length) {
          const i = todo[k];
          const a = Date.now();
          const r = await page.evaluate((n) => window.__setFrame(n), i);
          if (!r || r.frame !== i) throw new Error(`kare ${i}: sayfa ${JSON.stringify(r)} döndürdü`);
          await capturePng(page, path.join(dir, frameName(i)));
          busyMs += Date.now() - a;
          done++;
          if (done % 30 === 0 || done === todo.length) {
            const el = (Date.now() - tR) / 1000;
            const eta = ((todo.length - done) * el) / done;
            process.stdout.write(`\r[üretim] ${done}/${todo.length}  ${(el * 1000 / done).toFixed(0)} ms/kare  kalan ~${eta.toFixed(0)} sn   `);
          }
        }
      }),
    );
    if (todo.length) {
      const wall = (Date.now() - tR) / todo.length;
      console.log(`\n[üretim] ${todo.length} kare · ${wall.toFixed(0)} ms/kare (duvar saati), ${(busyMs / todo.length).toFixed(0)} ms/kare (sayfa başına)`);
    }

    if (!o['no-encode']) {
      const official = draft ? path.join(OUT, 'draft', 'draft.mp4') : path.join(OUT, 'final', 'mecidiyekoy.mp4');
      const out = o.out
        ? path.resolve(ROOT, o.out)
        : full
          ? official
          : path.join(OUT, 'tmp', `${draft ? 'draft' : 'final'}_${atmo}_f${from}-${to}${step > 1 ? `_s${step}` : ''}.mp4`);
      encode({ dir, frames, fps, step, out, crf: draft ? 20 : 15, preset: draft ? 'medium' : 'slow' });
      console.log(`[video] ${path.relative(ROOT, out)}  (${(fs.statSync(out).size / 1e6).toFixed(1)} MB, ${(frames.length * step / fps).toFixed(2)} sn)`);
      if (!draft && full && step === 1) {
        const cover = path.join(OUT, 'final', 'cover.png');
        fs.copyFileSync(path.join(dir, frameName(total - 1)), cover);
        console.log(`[kapak] ${path.relative(ROOT, cover)}`);
      }
    }
    if (sourceSignature() !== sig) console.warn('[uyarı] üretim sırasında kaynak dosyalar değişti: bu kareler ESKİ anlık görüntüden; güncel sahne için yeniden çalıştır.');
    console.log(`[bitti] ${((Date.now() - t0) / 1000).toFixed(1)} sn`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error('\n[hata]', e.message);
    process.exit(1);
  });
}
