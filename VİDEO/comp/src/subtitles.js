// Altyazı katmanı: transkriptten 2–4 kelimelik öbekler, söylenen kelime vurgulu. Saf t fonksiyonu.
import { C, SAFE, SUBTITLE_Y, SUB_HI, W, alpha, clamp, ease, lerp, range } from './theme.js';
import { h } from './kit.js';

const MAX_WORDS = 4, MAX_CHARS = 24, TARGET = 15, LEAD = 0.06, HOLD = 0.55;
const MIN_SHOW = 0.5, MERGE_CHARS = 34; // ekranda bundan kısa kalan öbek komşusuyla birleşir (birleşik en çok ~2 satır)
// Yatay güvenli sütun: Reels'in sağdaki düğme sütunu x≈900'den sonrasını örtebilir. Yazı (kontur dahil) 70–900 arasında kalır,
// bu sütuna göre ortalanır; sığmayan öbek iki satıra kırılır (punto sabit).
export const SUB_COL = { left: 70, right: 900 };
const COL_PAD = 18, COL_X = SUB_COL.left + COL_PAD, COL_W = SUB_COL.right - SUB_COL.left - 2 * COL_PAD, COL_CX = (SUB_COL.left + SUB_COL.right) / 2;
const SENT_END = /[.?!…]["”']?$/, SOFT_END = /[,;:—–]$/;
const lc = (s) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}']/gu, '');
// Öbeğin SONUNDA kalmaması gerekenler (arkasındaki kelimeye bağlı) / BAŞINDA olmaması gerekenler (öncekine bağlı)
const NO_END = new Set(['bir', 've', 'bu', 'şu', 'o', 'çok', 'tek', 'her', 'daha', 'en', 'yüz', 'iki', 'ne', 'ile', 'kendi', 'farklı', 'ayrı', 'kare', 'baş', 'size', 'siz', 'sizi', 'ana', 'claude', 'tam', 'gözden']);
const NO_START = new Set(['de', 'da', 'mi', 'mı', 'mu', 'mü', 'ki', 'ise', 'gibi', 'için', 'kadar', 'olarak', 'dolara', 'binlerce']);

/** words: [{ text, start, end }] (global sn) → chunks: [{ words, start, end }]
 *  Cümle içinde dinamik programlama: 2–4 kelime, ~15 harf hedef; virgülü/duraklamayı içine almak, bağlaç/sayıyla bitirmek cezalı. */
export function buildChunks(words) {
  const sentences = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (!next || SENT_END.test(w.text) || next.start - w.end > 0.7) { sentences.push(cur); cur = []; }
  });
  const chunks = [];
  for (const sw of sentences) {
    const n = sw.length;
    const best = new Array(n + 1).fill(Infinity), from = new Array(n + 1).fill(-1);
    best[0] = 0;
    for (let i = 1; i <= n; i++) {
      for (let k = 1; k <= Math.min(MAX_WORDS, i); k++) {
        const j = i - k;
        if (best[j] === Infinity) continue;
        const part = sw.slice(j, i);
        const chars = part.reduce((a, w) => a + w.text.length + 1, -1);
        let c = (chars - TARGET) ** 2 / 12;
        if (chars > MAX_CHARS) c += 60 + (chars - MAX_CHARS) * 10;
        if (k === 1) c += n === 1 ? 0 : 90;
        for (let q = 0; q < part.length - 1; q++) {
          if (SOFT_END.test(part[q].text)) c += 40;               // virgül öbeğin içinde kalmasın
          if (part[q + 1].start - part[q].end > 0.32) c += 30;    // uzun duraklama öbeğin içinde
        }
        if (i < n) {
          if (NO_END.has(lc(sw[i - 1].text)) && !SOFT_END.test(sw[i - 1].text)) c += 100;
          if (NO_START.has(lc(sw[i].text))) c += 45;
          if (/^\d/.test(sw[i - 1].text)) c += 100;
          if (SOFT_END.test(sw[i - 1].text)) c -= 12;              // virgülde bölmek doğal
        }
        if (best[j] + c < best[i]) { best[i] = best[j] + c; from[i] = j; }
      }
    }
    const cuts = [];
    for (let i = n; i > 0; i = from[i]) cuts.unshift([from[i], i]);
    for (const [j, i] of cuts) chunks.push({ words: sw.slice(j, i), sent: sentences.indexOf(sw) });
  }
  // Çok kısa ömürlü öbek (ör. "Peki," 0,28 sn) okunmadan geçer: komşusuyla birleştir. Önce sonraki (arada belirgin duraklama yoksa),
  // olmazsa aynı cümledeki önceki; birleşik metin MERGE_CHARS'ı aşmasın. Hiçbiri uymuyorsa öbek olduğu gibi kalır.
  const chars = (ws) => ws.reduce((a, w) => a + w.text.length + 1, -1);
  const shown = (i) => {
    const c = chunks[i], next = chunks[i + 1], last = c.words[c.words.length - 1].end;
    return (next ? Math.min(next.words[0].start, last + HOLD + LEAD) : last + HOLD + LEAD) - c.words[0].start;
  };
  for (let i = 0; i < chunks.length; i++) {
    if (shown(i) >= MIN_SHOW) continue;
    const c = chunks[i], prev = chunks[i - 1], next = chunks[i + 1];
    const okNext = next && next.words[0].start - c.words[c.words.length - 1].end < 0.6 && chars([...c.words, ...next.words]) <= MERGE_CHARS;
    const okPrev = prev && prev.sent === c.sent && chars([...prev.words, ...c.words]) <= MERGE_CHARS;
    if (okNext && (!okPrev || c.sent !== next.sent || chars(next.words) <= chars(prev.words) || SOFT_END.test(prev.words[prev.words.length - 1].text))) {
      next.words = [...c.words, ...next.words]; next.sent = c.sent; chunks.splice(i, 1); i = Math.max(-1, i - 2);
    } else if (okPrev) { prev.words = [...prev.words, ...c.words]; chunks.splice(i, 1); i = Math.max(-1, i - 2); }
  }
  chunks.forEach((c, i) => {
    c.start = c.words[0].start - LEAD;
    const next = chunks[i + 1];
    const last = c.words[c.words.length - 1].end;
    c.end = next ? Math.min(next.words[0].start - LEAD, last + HOLD) : last + HOLD;
    if (next && next.words[0].start - LEAD - c.end < 0.12) c.end = next.words[0].start - LEAD; // küçük boşlukta titreme olmasın
  });
  return chunks;
}

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const INK = hex(C.ink), HI = hex(SUB_HI);
const mix = (a, b, x) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], x))).join(',')})`;
const WAIT = mix(INK, hex(C.navy3), 0.5); // henüz söylenmemiş kelime: soluk adaçayı (opak — koyu kontur bozulmasın)

export class Subtitles {
  constructor(parent, words) {
    this.chunks = buildChunks(words);
    this.root = h('div', { id: 'subs', style: { position: 'absolute', left: '0', top: '0', width: W + 'px', height: '0', pointerEvents: 'none' } });
    this.scrim = h('div', { style: {
      position: 'absolute', left: COL_CX - (W + 120) / 2 + 'px', width: W + 120 + 'px', height: '520px', top: '0',
      background: `radial-gradient(50% 50% at 50% 50%, ${alpha(C.night, 0.74)} 0%, ${alpha(C.night, 0.42)} 48%, ${alpha(C.night, 0)} 100%)`,
    } });
    this.block = h('div', { lang: 'tr', style: {
      position: 'absolute', left: COL_X + 'px', width: COL_W + 'px', top: '0', textAlign: 'center',
      font: `800 86px/1.08 var(--display)`, letterSpacing: '-0.02em', wordSpacing: '0.1em', color: C.ink,
      webkitTextStroke: `7px ${C.night}`, paintOrder: 'stroke fill', strokeLinejoin: 'round',
      textShadow: `0 4px 0 ${alpha(C.night, 0.55)}, 0 10px 34px ${alpha(C.night, 0.8)}`, textWrap: 'balance',
    } });
    this.root.append(this.scrim, this.block);
    parent.append(this.root);
    this.cur = -1;
    this.spans = [];
  }

  chunkAt(t) {
    // ikili arama: start <= t < end
    let lo = 0, hi = this.chunks.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.chunks[m].start <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans >= 0 && t < this.chunks[ans].end ? ans : -1;
  }

  /** opts: { hidden, y } — y: bloğun dikey merkezi (px, 1920 ölçeğinde) */
  update(t, { hidden = false, y = SUBTITLE_Y } = {}) {
    const i = hidden ? -1 : this.chunkAt(t);
    if (i !== this.cur) {
      this.cur = i;
      this.block.textContent = '';
      this.spans = [];
      if (i >= 0) {
        this.chunks[i].words.forEach((w, k) => {
          if (k) this.block.append(' ');
          const sp = h('span', { style: { display: 'inline-block', transformOrigin: '50% 70%' } }, w.text);
          this.spans.push(sp); this.block.append(sp);
        });
      }
    }
    if (i < 0) { this.root.style.display = 'none'; return; }
    this.root.style.display = '';
    const c = this.chunks[i];
    const inK = range(t, c.start, c.start + 0.14, ease.outCubic);
    const outK = range(t, c.end - 0.08, c.end);
    const op = inK * (1 - outK);
    const hgt = this.block.offsetHeight;
    const top = clamp(y - hgt / 2, SAFE.top, SAFE.bottom - hgt);
    this.block.style.top = top + 'px';
    this.block.style.opacity = op.toFixed(4);
    this.block.style.transform = `translateY(${((1 - inK) * 16).toFixed(2)}px)`;
    this.scrim.style.top = top + hgt / 2 - 260 + 'px';
    this.scrim.style.opacity = (op * 0.9).toFixed(4);
    // aktif kelime: başlamış olanların sonuncusu (bitişten sonra kısa bir süre daha vurgulu kalır)
    let active = -1;
    c.words.forEach((w, k) => { if (t >= w.start - 0.02) active = k; });
    const lastEnd = c.words[c.words.length - 1].end;
    if (t > lastEnd + 0.3) active = -1;
    this.spans.forEach((sp, k) => {
      const w = c.words[k];
      if (k === active) {
        const a = range(t, w.start - 0.02, w.start + 0.07, ease.outCubic);
        sp.style.color = mix(INK, HI, a);
        sp.style.opacity = '1';
        sp.style.transform = `translateY(${(-4 * a).toFixed(2)}px) scale(${(1 + 0.045 * a).toFixed(4)})`;
      } else {
        const spoken = t >= w.start - 0.02;
        sp.style.color = spoken ? C.ink : WAIT;
        sp.style.opacity = '1';
        sp.style.transform = 'none';
      }
    });
  }
}
