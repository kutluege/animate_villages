# Sahne ajanı kılavuzu (önce CONTRACT.md, özellikle §4b görsel yön)
**Önizleme:** `node tools/serve.mjs` → http://127.0.0.1:5288/comp/ — kaydırıcı, boşluk=oynat (sesli), ←/→ kare, S güvenli alan. `?t=12.5` `?only=vaat` `?safe=1` `?nosubs=1`
**Modül:** `comp/src/scenes/<id>.js` → `export async function create(ctx) { return { el, update(tLocal, tGlobal), ...isteğe bağlı } }`
- `el`: 1080×1920 kök (`h('div', { class: 'scene' })`); `update` her karede çağrılır, tLocal sahne başından saniye. Her şey yalnızca t'den hesaplanır.
- İsteğe bağlı alanlar: `sfx: [{ t: yerelSn, name: 'whoosh', gain: 0.8 }]` · `subtitleY: 760` ya da `(tl) => px` (blok merkezi) ·
  `subtitles: false | (tl) => bool` · `grain: false` · `backdrop: false | 0..1 | (tl) => …` (ortak fonu kapat/kıs) ·
  `extend: { before: 0.4, after: 0.4 }` → sahne [start−before, end+after] boyunca görünür, `update` tLocal<0 / >duration ile de çağrılır; sonraki
  sahne üstte. Geçişte boş an (yalnız fon+altyazı) kalmasın: çıkan sahne `after` ile eriyerek kalsın ya da giren `before` ile erken başlasın.
- Yasak: CSS animation/transition, rAF, setTimeout, Date, Math.random (→ `theme.rng(seed)`), video öğesi. Eksik/hatalı modül → yer tutucu (çatı çökmez).

**Ortak fon (çatı çizer, `comp/src/backdrop.js`):** bütün sahnelerin ARKASINDA açılış haritasının topografya zemini durur: koyu yosun yeşili
  tonlama, ince eş yükselti çizgileri, silik ızgara + nirengi artıları (fonda okunur metin yok); t ile çok yavaş kayar ve nefes alır. Bu yüzden:
- **Sahne kökünü opak boyama** (`.scene` saydamdır). Tam ekran harita/fotoğraf/video anı serbest; o sırada `backdrop: false` verebilirsin.
- **Renk yalnız `theme.js` belirteçlerinden** (hex/rgba uydurma; saydamlık için `alpha(C.pink, 0.3)`). Yazı krem `C.ink` / `C.dim`; uzun/küçük metin `C.glass` / `C.glassStrong` zeminli kartta.

**theme.js:** `C`: zemin `night navy navy2 navy3 forest moss topoLow/Mid/High` · yazı `ink dim faint` · vurgu `pink` (ANA) `window`=`road` (krem-sarı)
  `sunset ember cyan sky ok` · harita `building street park line` · yüzey `glass glassStrong glassLine hair shadow paper paperInk`.
  `TEAM.fable` (pembe) / `TEAM.opus` (camgöbeği), `ROUTE` (çizgi stilleri), `GEO`, `GRAD`, `FONT.display` (Inter Tight) / `FONT.mono` (JetBrains Mono), `TYPE`,
  `ease.*` (outCubic, inOutCubic, outExpo, outBack, spring), `DUR`, `range(t,a,b,ease)`, `envelope`, `lerp`, `clamp`, `rng`, `hash01`, `alpha`, `SAFE`.
  CSS: `.t-hero .t-title .t-head .t-body .t-label .card .glass .polaroid .chip .accent .accent2-4` + aşağıdaki yapı taşlarının sınıfları.
**kit.js:** `h()`, `s()` (SVG), `tf({x,y,s,r})`, `splitWords()` + **kartografik yapı taşları** (dokuz sahne tek elden çıkmış gibi dursun diye bunları kullan):
- `mapCard({ x, y, w, h, title, coord, accent, pad, strong }, ...çocuk)` → ince krem çerçeveli, köşe çentikli kart; `.body`, `.head`.
- `coordLabel(metin?, { color, size })` (artı işaretli mono etiket; boşsa Mecidiyeköy koordinatı) · `fmtCoord(lat, lon)` · `crosshair(size, color)`.
- `legend([{ color, label, kind: 'fill'|'line'|'dash'|'dot'|'ring', value }], { title })` / `legendRow(...)` · `marker({ x, y, label, color, r, side })`
  (`.ring .dot .label`) · `scaleBar({ w, label })`.
- `mapSvg()` + `route(d, { kind: 'road'|'street'|'rail'|'bus'|'march'|'link', width, color, arrow })` → `g.draw(k)` 0..1 çizilme (ok başı k ile yürür),
  `g.pointAt(k)` → `{x,y,angle}`. road = krem-sarı yol, rail = turuncu-kırmızı hat, bus = camgöbeği, march = kesikli pembe harekât oku.
  Canlı örnek: `comp/src/placeholder.js`. Önemli yazı SAFE içinde (y 220–1500).
**Altyazı (çatı):** krem, koyu konturlu, 86 px; söylenen kelime krem-sarı (`theme.SUB_HI`; pembe/camgöbeği kadro rengi). Tek eksen y=1372, sütun x 70–900 (Reels düğmeleri): `subtitleY` verme, altında yazı/kart bırakma.

**ctx:** `id start end duration W H SAFE theme words text` · `ctx.at('mareşal')` → kelimenin yerel `{start,end}` (sesle senkron için) ·
  `await ctx.image('foto.jpg')` → decode edilmiş `<img>` (`comp/assets/<id>/`) · `ctx.asset(rel)`, `ctx.url('work/..')`, `ctx.setSrc(img, url)` ·
  `const seq = await ctx.frames('fable')` → `seq.el` (img), `seq.at(sn)` / `seq.show(i)`, `seq.duration` (kare dizisi; decode beklenir).
**Kare dizisi:** `node tools/frames.mjs "C:\…\mecidiyekoy.mp4" comp/assets/<id>/fable --fps 30 --from 10 --to 35 --width 1080` (jpg + manifest). Kareler git'te
  YOK (`.gitignore`): klondan sonra her dizinin komutu `comp/assets/{final,dongu,ekip}/SOURCES.md` tablosunda (aralık/fps: yanındaki `manifest.json`).
**sfx/:** whoosh, whoosh-short, pop, tick, type-1/2/3, typing, shutter, polaroid, drop, thud, hit, riser, riser-long, swell, chime, ping, glitch (`sfx/SOURCES.md`).
  Miks kuralı (`tools/mix.mjs` başı): `gain` niyettir; çatı her efekti ses altı bir banda çeker, konuşmada kısar; master −14 LUFS / −1,5 dBTP. `node tools/mix.mjs --list | --report`.
**Denetim:** `node tools/shot.mjs 0 2.5 5 --scene vaat --out out/<ajan> --sheet` (yerel sn; `--full` 1080×1920, `--safe`, `--every 1`, `--only vaat`)
  · `node tools/check.mjs --scene vaat 1 3 5 [--only vaat]` (determinizm; GPU yuvarlaması ≤3 seviye/‰1 piksel "≈" diye geçer, `--strict` kapatır)
  · `node tools/render.mjs --draft --from 9.5 --to 20.6` (sesli taslak, out/draft/). **Zaman:** `work/timeline.json` (final süresi: `final.duration`), `work/transcript.json` (kelimeler, voice.wav saati). Varlıklar `comp/assets/<id>/` + SOURCES.md.
