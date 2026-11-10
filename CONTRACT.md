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
Üretim: `python tools/build_data.py [--overview]` (numpy, scipy, shapely, tifffile; ağ yok, deterministik).
Kuşbakışı denetim: `out/shots/data_overview.png`, `data_overview_core.png`. Tahmin listesi: `docs/estimated_heights.md`.

**Orijin (kesin):** `lat0=41.066886, lon0=28.991723` = Mecidiyeköy metrobüs peronu (OSM way 1305577747)
merkezi, D-100 ekseninde. Y=0 ↔ 120.97 m (yumuşatılmış COP30). Dikkat: D-100 orijinde dolgu üstünde, yol kotu y≈+4.
- Veri bbox'ı (ham indirme) x −900…946, z −842…1038; çekirdek (§1) x −648…695, z −566…761 (`meta.bbox`, `meta.core`).
- **Mecidiyeköy Meydanı** (OSM way 1007293783, `pois.squares`): merkez (303, 37), viyadüğün batı ucunun hemen
  güneyi/altı. Metrobüs peronları: (0,0) ve (−67,−5); İETT peron alanı (12,43). Metro: M2 Şişli-Mecidiyeköy
  (88,263), M7 Mecidiyeköy (319,189).

**Arazi:** ızgara 134×136, 20 m, x −1300…1360, z −1260…1440 (bbox + ~400 m). y aralığı ızgarada −108.6…+5.2,
bbox'ta −81.7…+5.2, çekirdekte −56…+4. Orijin sırtın tepesinde; her yöne iner (KD'da %30'a varan eğim, Kağıthane'ye).
COP30 %15 yüzdelik + Gauss (~50 m) ile yumuşatıldı; sokak ölçeğinde ayrıntı yok. `heights[iz*nx+ix]`, x=x0+ix·dx, z=z0+iz·dz.

**Binalar (3005 kayıt):** `ring` açık (ilk nokta tekrarlanmaz), (x,z)'de saat yönünün tersine; `holes` 1 kayıtta.
- Yükseklik kaynağı: osm 52, overture 0 (Overture yükseklikleri OSM'nin kopyası), levels 223, **estimate 2730 (%90.8)**;
  çekirdekte 1242/1445. Tahminler 2.6–36 m, medyan ~17 m (komşu kat medyanı + tip + alan + tohum).
- `height` = çatı üstü, `minHeight` = hacmin altı; ikisi de `baseY`'den ölçülür. `baseY` = ayak izi altındaki EN DÜŞÜK
  zemin (bina havada kalmaz). Ek alan `groundY` (ortalama zemin, fark ≥0.5 m ise): eğimde çatıyı
  `(groundY ?? baseY) + height`'a koymak daha doğru.
- Şemaya ekler: `part:true` + `partOf` (building:part hacmi), `hasParts:true` (ana hat duruyor, üstünde parçalar var),
  `footprint:"ms"|"overture-osm"` (ayak izi OSM'de yok, Overture'dan; 927'si Microsoft ML → kaba şekilli), `groundY`.
- Parça kuralı: parçalar ana hattın ≥%60'ını kaplıyorsa ana hat atıldı (22 bina), yalnız parçalar var. Değilse ana hat
  (podyum) + parçalar (kule) birlikte; ortak `baseY`. Hepsini çizmek doğru sonuç verir.
- **Simge yapılar** (`landmark` alanı; şehir ajanı çizmez):
  - `trump`: podyum `w163629174` (Trump AVM, x 14…82, z −292…−62, 9.6 m, 3 kat) + `w1222286465` Residence Tower
    (x 41…70, z −139…−81; 39 kat → 124.8 m, minHeight 9.6) + `w1455454989` Office Tower (x 34…59, z −263…−218;
    37 kat → 118.4 m). baseY −21.2 (arsa kuzeye sert iner; groundY −9.4). Yükseklikler kat×3.2 — ölçüm DEĞİL;
    bilinen değerler ~155/145 m civarı (veride yok, simge ajanı doğrulasın).
  - `torun`: dört kule `w728793798…801` (hepsi OSM height=160, 42 kat; x 535…789, z 141…220), alçak blok `w728793802`
    (5 m), ve "Torun Center" adlı küçük ofis `w1321569694` (503,97; yüksekliği TAHMİN 25.7 m). OSM 4 kule gösteriyor;
    gerçek kule sayısı/yükseklikleri doğrulanmadı.
  - `cevahir`: `w46962419` (x −18…208, z 344…610; 32 600 m²; 6 kat → 19.2 m; baseY −16.3, groundY −7.9).
- Diğer yüksekler (landmark değil, şehir ajanı çizer): Nurol Tower `w1107093994` 152 m (−466,−93); Marriott
  `w761269718` 135 m (−313,331); Elit Residence kulesi `w1457770436` 115 m (28,570).

**Yollar (1492):** `cls` = OSM highway değeri (trunk, trunk_link, primary…, residential, service, living_street, busway,
footway, steps, pedestrian, platform, corridor). `pts` ≤15 m aralıkla sıklaştırıldı; `y` mutlak (arazi + ofset).
- **D-100** = `cls:"trunk"`, ad "1. Çevre Yolu", yön başına ayrı tek yönlü yol (3–4 şerit), z≈−60…+30 koridoru, B–D.
- **Viyadük** = `viaduct:true` (+`bridge:true`): `w23291917` ve `w227564892` (D-100'ün iki yönü) + `w176284271`
  (ortadaki metrobüs), x 208…1080. Tabliye düz kiriş: y +3.5 (batı) → −0.2 (doğu), zeminden 7–13 m; altından
  Büyükdere Cd. (x≈375) ve meydan geçer. Kısa köprüler x −600…−420, −300, 60…120.
- **Metrobüs** = `busway:true` (12 yol), D-100'ün ortasında; kimi yerde tek çift-yönlü yol (7.5 m), kimi yerde iki tek
  yönlü (4 m). Tek sürekli çizgi için `pois.metrobusLines` (34 hattı, yön başına sıralı `[x,y,z]`, x −1079…1080).
- Kotlar MODEL, ölçüm değil (OSM'de `ele` yok): köprü = zemin + 6 m×layer (viyadük 7 m), rampalar komşu yollara
  %3.5–6 eğimle yayılır. Yani `bridge:false` olup `y − heightAt > 0.5` olan yollar var (D-100 x −700…220 arası 1–6 m
  dolgu üstünde) → dolgu/istinat duvarı ya da etek gerekir.
- Tüneller `tunnel:true`, y zeminin altında (taşıt: Abide-i Hürriyet Cd. alt geçidi, batı uçta; kalanı yaya alt
  geçitleri/metro koridorları, `indoor:true` olabilir). Yüzeyde çizme.
- Genişlik: yalnız 1 yolda `width` etiketi var; kalanı şerit×~3.3–3.6 m (+banket) ya da sınıf varsayılanı.
  Ana yollar (trunk/primary/busway) arazi ızgarası sınırına, diğerleri bbox+40 m'ye kırpıldı; parçalar `w123_1` gibi.

**POI (`pois.json`):** `stations` (metro/metrobüs; x,y,z), `entrances` (15 metro girişi), `busStops` (65, `metrobus` bayrağı),
`signals` [[x,z]] (53), `trees` [[x,z]] (**yalnız 54** — OSM'de ağaç neredeyse yok, prosedürel ekim gerekir),
`greens` (59 çokgen: grass/park/playground/pitch/garden/dog_park/wood), `squares` (ring + center),
`platforms`, `metrobusLines`.

**Ham veride eksik / bilinen kusurlar**
- Orijinin GB'sındaki büyük boşluk (x −350…150, z 60…400, içinde yalnız patikalar): ham veride arazi kullanımı
  çokgeni yok (mezarlık olması muhtemel; `landuse=cemetery` indirilmemiş). Bina yok diye hata sanma.
- Ölçülmüş yükseklik çok az (52 bina); doku yükseklikleri büyük oranda tahmin. Trump/Cevahir kat sayısından.
- Yol/köprü kotu, şerit çizgisi, kaldırım, bina cephe/çatı bilgisi yok. `w728378108` height=3 etiketi 4 katla
  çelişiyordu → kat kullanıldı (`meta.heightTagWarnings`).
