// Bağımlılıksız statik sunucu: VİDEO/ kökü → http://127.0.0.1:5288/comp/  (üst projenin serve.mjs'inden uyarlandı)
// Nokta ile başlayan yol parçaları, anahtar dosyaları sunulmaz. Önbellek kapalı. Range isteklerini destekler (ses önizleme).
//   node tools/serve.mjs [--port 5288]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
export const PORT = 5288;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};
const FORBIDDEN = [/^\./, /^apikey/i, /\.key$/i, /\.pem$/i, /^node_modules$/];

function deny(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(msg);
}

export function startServer({ port = PORT, host = '127.0.0.1', quiet = false } = {}) {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return deny(res, 405, 'method not allowed');
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return deny(res, 400, 'bad url'); }
    if (path.includes('\0') || path.includes('\\') || path.includes(':')) return deny(res, 400, 'bad url');
    const parts = path.split('/').filter(Boolean);
    if (parts.some((p) => p === '..' || FORBIDDEN.some((re) => re.test(p)))) return deny(res, 404, 'not found');
    if (path === '/' || path === '') { res.writeHead(302, { Location: '/comp/' }); return res.end(); }

    let file = normalize(join(ROOT, ...parts));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) return deny(res, 403, 'forbidden');
    if (relative(ROOT, file).split(sep).some((p) => FORBIDDEN.some((re) => re.test(p)))) return deny(res, 404, 'not found');
    let st;
    try { st = statSync(file); } catch { return deny(res, 404, 'not found'); }
    if (st.isDirectory()) {
      if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }); return res.end(); }
      file = join(file, 'index.html');
      try { st = statSync(file); } catch { return deny(res, 404, 'not found'); }
    }
    const headers = {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache', Expires: '0',
      'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes',
    };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m && (m[1] || m[2])) {
      let a = m[1] ? Number(m[1]) : st.size - Number(m[2]);
      let b = m[1] && m[2] ? Number(m[2]) : st.size - 1;
      a = Math.max(0, a); b = Math.min(st.size - 1, b);
      if (a > b) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
      if (req.method === 'HEAD') return res.end();
      return createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      if (!quiet) console.log(`[serve] http://127.0.0.1:${server.address().port}/comp/  (kök: ${ROOT})`);
      ok(server);
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--port');
  const port = Number(i > 0 ? process.argv[i + 1] : process.env.PORT || PORT);
  startServer({ port }).catch((e) => { console.error('[serve]', e.message); process.exit(1); });
}
