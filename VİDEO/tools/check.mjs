// Determinizm sınaması: aynı t'leri iki ayrı sayfada farklı sırayla (ileri / karışık + araya başka anlar) çizer, pikselleri karşılaştırır.
//   node tools/check.mjs                      her sahneden 2 an
//   node tools/check.mjs 12.3 40 --scene vaat  (yerel sn)   --size WxH (vars. 540x960)   --strict (bit düzeyinde eşitlik iste)   --only vaat (yalnız bu modül; diğerleri yer tutucu)
// GPU kenar yumuşatma / gradyan yuvarlaması aynı kareyi birkaç pikselde ±1–2 seviye oynatabilir (görünmez; SVG çizgi kenarı,
// büyük gradyan). Bu "≈" diye geçer: en çok 3 seviye fark ve piksellerin ‰1'inden azı. Gerçek sızıntı (rastgelelik, durum) bunu aşar.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ROOT, grab, openBrowser, openComp, parseArgs } from './lib-browser.mjs';

const args = parseArgs();
let [W, H] = [540, 960];
if (args.size) [W, H] = String(args.size).split('x').map(Number);
const env = await openBrowser();
let code = 0;
try {
  const query = args.only ? { only: String(args.only) } : {};
  const A = await openComp(env, { width: W, height: H, query });
  const tl = await A.page.evaluate(() => window.__timeline);
  const sc = args.scene ? tl.find((s) => s.id === args.scene) : null;
  let times = args._.map(Number).filter(Number.isFinite).map((x) => (sc ? sc.start + x : x));
  if (!times.length) times = tl.flatMap((s) => [s.start + 0.37 * (s.end - s.start), s.start + 0.81 * (s.end - s.start)]);
  const sha = (b) => createHash('sha1').update(b).digest('hex');
  const raw = (png) => spawnSync('ffmpeg', ['-v', 'error', '-f', 'image2pipe', '-i', '-', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { input: png, maxBuffer: 1 << 28 }).stdout;
  /** İki PNG'nin farkı: { n: farklı piksel sayısı, max: en büyük kanal farkı } */
  const diff = (p, q) => {
    const x = raw(p), y = raw(q);
    if (!x?.length || x.length !== y?.length) return { n: Infinity, max: 255 };
    let n = 0, max = 0;
    for (let i = 0; i < x.length; i += 3) {
      const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
      if (d) { n++; if (d > max) max = d; }
    }
    return { n, max };
  };
  const LIMIT = Math.round(W * H * 0.001), png = { a: {}, b: {}, c: {} };
  const a = {};
  for (const t of times) a[t] = sha(png.a[t] = await grab(A.page, t));
  const ctx = await env.browser.newContext({ viewport: { width: W, height: H } });
  const B = await openComp({ ...env, browser: ctx }, { width: W, height: H, query });
  const order = [...times].reverse();
  const b = {};
  for (const [k, t] of order.entries()) {
    await grab(B.page, (t * 7.31 + k * 13.7) % (tl[tl.length - 1].end)); // araya alakasız bir an
    b[t] = sha(png.b[t] = await grab(B.page, t));
  }
  // Aynı sayfada tekrar (durum sızıntısı denetimi)
  const c = {};
  for (const t of times) c[t] = sha(png.c[t] = await grab(A.page, t));
  let bad = 0, near = 0;
  for (const t of times) {
    let ok = a[t] === b[t] && a[t] === c[t], note = '';
    if (!ok) {
      const d = [a[t] === b[t] ? { n: 0, max: 0 } : diff(png.a[t], png.b[t]), a[t] === c[t] ? { n: 0, max: 0 } : diff(png.a[t], png.c[t])];
      const n = Math.max(d[0].n, d[1].n), max = Math.max(d[0].max, d[1].max);
      note = `${n} piksel, en çok ${max} seviye (A~B ${d[0].n}, A~A2 ${d[1].n})`;
      if (!args.strict && max <= 3 && n <= LIMIT) { ok = true; near++; note = '≈ ' + note; }
    }
    if (!ok) bad++;
    const s = tl.find((x) => t >= x.start && t < x.end) || tl[tl.length - 1];
    console.log(`${ok ? '✓' : '✗'} t=${t.toFixed(3).padStart(8)}  ${s.id.padEnd(8)} ${note}`);
  }
  const errs = [...new Set([...A.errors, ...B.errors])];
  if (errs.length) console.log('sayfa hataları:\n  ' + errs.join('\n  '));
  console.log(bad ? `[check] ✗ ${bad}/${times.length} an deterministik DEĞİL` : `[check] ✓ ${times.length} an, iki sırada da aynı${near ? ` (${near} anda yalnız GPU yuvarlama farkı: ≤3 seviye, ≤${LIMIT} piksel)` : ''}`);
  code = bad || errs.length ? 1 : 0;
} catch (e) { console.error('[check] başarısız:', e.message); code = 1; } finally { await env.close(); }
process.exit(code);
void ROOT;
