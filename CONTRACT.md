# CONTRACT — Mecidiyeköy: gündüzden geceye

Her ajan işe başlamadan önce bu dosyayı okur. Modüller birbirleriyle yalnızca burada
tanımlı arayüz üzerinden konuşur. Sözleşmede değişiklik gerekiyorsa kendi başına
değiştirme; raporunda orkestratöre yaz. (İstisna: veri ajanı en alttaki "Veri notları"
bölümünü doldurur.)

## 1. Ne yapıyoruz
Mecidiyeköy çekirdeği (41.060–41.072 K, 28.984–29.000 D) — gerçek veriden three.js sahnesi.
Çıktılar: (1) `http://localhost:5174` serbest kamera + gündüz/gece sayfası,
(2) aynı sahneden kare kare üretilen dikey 1080×1920, 30 fps, sessiz, 36 sn MP4.
Fikir: "Mecidiyeköy'de bir gün, gündüzden geceye." İstanbul'un en sıkışık kavşağı:
viyadüğün altındaki gölge, kalabalığın üstünde yükselen kuleler, gün batımının camdaki
yansıması, tek tek yanan pencereler, ışık şeridine dönen metrobüs hattı.

## 2. Koordinat sistemi
- Yerel metre, three.js Y-yukarı. **+X = doğu, +Z = güney (kuzey = −Z), +Y = yukarı.**
- Orijin = Mecidiyeköy meydanı. Geçici değer `lat0=41.0668, lon0=28.9925`; veri ajanı
  OSM'den meydan/metrobüs durağına göre kesinleştirir ve `meta.json` + "Veri notları"na yazar.
  Kod orijini her zaman `meta.json`'dan okur, sabit gömmez.
- `x = (lon−lon0)·111320·cos(lat0)`, `z = −(lat−lat0)·110574`.
- Y=0, orijindeki yumuşatılmış arazi kotu. Zemin kotu `ctx.heightAt(x,z)`.

## 3. Dosya yapısı ve sahiplik (başkasının dosyasına yazma)
```
CONTRACT.md, USAGE.md            orkestratör
package.json, vite ayarı         iskelet ajanı (bağımlılık gerekiyorsa raporla)
data/raw/                        ham indirmeler — SALT OKUNUR, yeniden indirme YOK
tools/build_data.py              veri ajanı  → web/public/data/*.json
web/index.html, web/src/core/    iskelet ajanı (main.js, geo.js, timeline.js, rng.js, ui.js)
web/src/city/                    şehir dokusu ajanı (zemin, binalar, yollar, viyadük, metrobüs, trafik, lambalar)
web/src/landmarks/               simge yapı ajanı (Trump Towers, Torun Center, Cevahir, meydan/istasyon)
web/src/atmo/a/, web/src/atmo/b/ ışık-atmosfer ajanları (iki ayrı yorum)
web/src/camera/                  kamera-kurgu ajanı (rota, kesmeler; timeline.js anahtar karelerini ayarlayabilir)
tools/render.mjs, tools/shots.mjs kamera-kurgu ajanı (Playwright + ffmpeg)
docs/sources.md                  simge yapı araştırma kaynakları, bilinen eksikler
out/                             üretilenler (gitignore); yalnız out/final/ commit edilir
```
Git: ajanlar commit/push YAPMAZ; orkestratör yapar. `.env` asla commit edilmez, anahtar
tarayıcıya giden koda girmez. Bu klasörün dışına hiçbir şey yazılmaz. Port **5174**
(5173 başka oturumun). Overpass / Overture / OpenTopography ÇAĞRILMAZ.

## 4. İşlenmiş veri (`web/public/data/`, hepsi yerel metre)
- `meta.json` — `{lat0, lon0, bbox, sources, counts, generatedAt}`
- `buildings.json` — `[{id, ring:[[x,z],…], holes?, height, minHeight, baseY, heightSource, estimated, levels?, name?, kind?, landmark?}]`
  - `heightSource ∈ "osm" | "overture" | "levels" | "estimate"`; `estimated:true` ⇔ yükseklik tahmin.
  - `landmark ∈ "trump" | "torun" | "cevahir"` → şehir ajanı bunları ÇİZMEZ, simge ajanı elle modeller.
- `roads.json` — `[{id, cls, pts:[[x,y,z],…], width, lanes, oneway, bridge, tunnel, layer, name?, busway}]`
  (`busway:true` = metrobüs hattı; viyadük `bridge:true`, `y` tabliye kotu dahil.)
- `terrain.json` — `{nx, nz, x0, z0, dx, dz, heights:[…]}` satır-öncelikli, yumuşatılmış COP30 (çatılar ayıklanmış, yalnız genel eğim).
- `pois.json` — metro/metrobüs durakları, girişler, ağaçlar, yeşil alanlar vb.

## 5. Modül arayüzü
Her modül `index.js` içinde şunu dışa verir:
```js
export async function create(ctx) { …; return { update(state) {…} }; }
```
`ctx = { THREE, scene, camera, renderer, data:{meta,buildings,roads,terrain,pois}, heightAt(x,z), rng(seed), uniforms, params }`
- `ctx.uniforms = { uTime, uTod, uNight, uLit, uSunDir }` — paylaşılan uniform nesneleri (`{value}`); iskelet her karede günceller, shader'lar doğrudan bağlanır.
- `state = { t, dt, tod, sunDir, sunElev, day, night, lit, film }` (bkz. §6).
- Atmosfer modülü ek olarak `render(state)` döndürebilir (kendi composer'ı); varsa iskelet onu çağırır. Gök, güneş/ay, sis, ışıklar, `scene.environment` (cam yansıması), tone mapping ve post atmosferindir. Seçim: `?atmo=a|b`.
- Kamera modülü: `create(ctx)` → `{ update(state) }` film modunda `ctx.camera`'yı `state.t`'den kurar; ayrıca `export const DURATION`.
- **Işıkların yanması:** her pencere/lamba/tabela sabit bir eşik `θ∈[0,1]` (tohumlu rastgele) taşır ve `lit > θ` iken yanar → "tek tek yanma". Emisyon şiddeti `uLit/uNight` ile çarpılır; renk seçimi nesnenin sahibinde.
- **Determinizm (zorunlu):** `Math.random`, `Date.now`, `performance.now` YOK. Rastgelelik `ctx.rng("isim")`; tüm hareket (araçlar, bulutlar, yanıp sönme) yalnızca `state.t`'nin saf fonksiyonu. Aynı `t` → aynı piksel.

## 6. Zaman çizelgesi (tek parametre)
Her şeyi **`tod`** (günün saati, ondalık saat) sürer. `web/src/core/timeline.js`:
```js
export const FPS = 30, DURATION = 36;          // 1080 kare
export function todAt(t)        // film saniyesi → tod (anahtar kareli, monoton)
export function stateAt(t, tod) // → {t, tod, sunDir, sunElev, day, night, lit}
```
Başlangıç anahtar kareleri (kurgu ajanı ince ayar yapabilir, imzalar sabit):
`t=0→15.0` (sert gündüz) · `t=13→18.6` (altın saat) · `t=16–20→19.0–19.8` (gün batımı camda)
· `t=20–27→19.8–20.9` (ışıklar tek tek) · `t=36→22.5` (gece, kapak karesi).
`night = smoothstep(19.0, 20.4, tod)`, `lit = smoothstep(19.3, 20.8, tod)`, `day = 1−night`.
Güneş: İstanbul, haziran sonu; batış ≈ 19.7, azimut batı-kuzeybatı.

## 7. Sayfa modları
- `/` — serbest kamera (OrbitControls), `tod` kaydırıcısı, gündüz/gece düğmesi, "filmi oynat".
- `/?film=1` — kamera rotasını gerçek zamanlı oynatır.
- `/?render=1&w=1080&h=1920` — arayüz yok; `await window.__ready`, sonra
  `await window.__setFrame(i)` kareyi `t=i/FPS` için kurar ve çizer (kare kare yakalama).
  `window.__setTod(tod)` ve `window.__setView({pos,target,fov})` denetim ekran görüntüleri için.
- Headless Chromium bayrakları: `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`.

## 8. Çıktı yolları
`out/shots/` ekran görüntüleri · `out/frames/` kareler · `out/draft/draft.mp4` taslak
(540×960) · `out/final/mecidiyekoy.mp4` nihai · `out/final/cover.png` son kare.

## 9. Rapor biçimi
Ajan orkestratöre en fazla 150 kelime döner: ne yaptı, hangi dosyalar, neyi doğrulayamadı.
Ham veri, uzun kod, kare dökümü rapora konmaz.

## Veri notları (veri ajanı doldurur)
_(boş)_
