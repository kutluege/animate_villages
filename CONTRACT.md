# CONTRACT — Mecidiyeköy: Gündüzden Geceye

Her ajan işe başlamadan önce bu dosyayı okur. Buradaki arayüzü değiştirmen gerekiyorsa
değiştirme; raporunda öner. Orkestratör günceller.

## 1. Amaç
Mecidiyeköy çekirdeği (41.060–41.072 K, 28.984–29.000 D) gerçek veriye dayalı three.js sahnesi.
Çıktılar: (a) serbest kameralı, gündüz/gece kaydırıcılı sayfa; (b) aynı sahneden kare kare
üretilen dikey 1080×1920, 30 fps, 36 sn (1080 kare), sessiz MP4. Asıl vitrin video.

## 2. Koordinat sistemi
- Orijin (meydan): `LAT0 = 41.0665`, `LON0 = 28.9920`. Sabit; değiştirilmez.
- Birim metre. three.js sağ el: **+X doğu, +Y yukarı, −Z kuzey** (+Z güney).
- `x = (lon − LON0) · 111320 · cos(LAT0°)`, `z = −(lat − LAT0) · 110574`.
- `y = 0`: orijindeki yumuşatılmış zemin kotu. Tüm yükseklikler buna göre.
- Sahne kapsamı yaklaşık x ∈ [−670, 670], z ∈ [−610, 720].

## 3. Dosya yapısı
```
CONTRACT.md
.env                    OPENTOPO_API_KEY (commit edilmez, tarayıcıya gitmez)
refs/                   kullanıcının fotoğrafları (simge yapılar için asıl referans)
tools/                  Node betikleri: serve.mjs, fetch-*.mjs, build-data.mjs, render.mjs, shots.mjs
data/raw/               ham indirmeler (overpass, overture, cop30) — bir kez indirilir
data/*.json             işlenmiş, yerel metre (aşağıda)
web/index.html
web/vendor/             three.js ve eklentileri (yerel kopya, CDN yok)
web/src/main.js         kurulum + döngü (iskelet ajanı)
web/src/timeline.js     tod → durum (iskelet ajanı)
web/src/terrain.js      arazi (iskelet ajanı)
web/src/city.js         şehir dokusu: binalar, yollar, trafik, sokak lambaları
web/src/landmarks.js    simge yapılar
web/src/atmosphere.js   gök, güneş, sis, ışıklar, post-process (a/b varyant: atmosphere.a.js, atmosphere.b.js)
web/src/edit.js         kamera rotası + kurgu (video zaman çizelgesi)
out/                    kareler, taslaklar, ekran görüntüleri (ignore); out/final/*.mp4 commit edilir
```
Her ajan yalnızca kendi dosyalarına yazar. Git commit/push'u orkestratör yapar; ajanlar yapmaz.

## 4. Veri şemaları (data/)
- `buildings.json`: `{ origin, buildings: [{ id, footprint: [[x,z],…], holes?, height, heightSource, baseY, levels?, name?, kind? }] }`
  `heightSource ∈ "osm" | "osm_levels" | "overture" | "estimate"`. Tahminler **mutlaka** `estimate`.
- `roads.json`: `{ roads: [{ id, kind, name?, pts: [[x,z],…], width, lanes?, oneway?, bridge, tunnel, layer }] }`
  `kind`: motorway, trunk, primary, secondary, tertiary, residential, service, footway, busway (metrobüs), rail…
- `terrain.json`: `{ nx, nz, x0, z0, dx, dz, heights: [row-major, z sonra x] }` — COP30, çatı etkisi giderilecek
  kadar yumuşatılmış; yalnızca genel eğim.
- `landmarks.json`: `{ landmarks: [{ key, name, center:[x,z], osmIds:[…], footprints, height, heightSource, notes }] }`
  Anahtarlar en az: `trump_towers`, `torun_center`, `cevahir`, `viaduct`, `metrobus_station`, `metro_station`, `square`.
  `osmIds` içindeki binalar city.js tarafından çizilmez; landmarks.js çizer.
- `points.json`: metro girişleri, duraklar, ağaçlar vb. `{ points: [{ kind, x, z, name? }] }`
- `data/README.md`: kaynak, tarih, lisans, yükseklik istatistikleri, tahmin sayısı.

Veri ajanının eklediği alanlar (ayrıntı `data/README.md`): binalarda `minHeight` (yerden yükseltilmiş parça tabanı),
`part` (building:part mı), `landmark` (ait olduğu simge yapı anahtarı; city.js bunları çizmez). landmarks'ta
`heightSource: "reference"` = kamuya açık bilinen yükseklik. Binaların %91'inin yüksekliği `estimate`.
Bilinen boşluklar: Şişli Plaza kulesinin OSM izi yok; Torun Center izlerinden biri Quasar olabilir.

## 4b. Işık anlaşması (modüller arası)
- Doğrusal HDR iş akışı. Tone mapping, exposure ve bloom atmosferin; başka modül `renderer.toneMapping*` ayarlamaz.
- Yayıcı yoğunlukları (bloom eşiği ≈ 1 varsayımıyla): yanan pencere ≈ 1.5–4, tabela/LED ≈ 3–6, sokak lambası ve
  far/stop ≈ 6–12. Gündüz (`lightsOn = 0`) hepsi 0.
- Atmosfer `scene.environment`'ı (gökten PMREM) tod'a göre günceller. Cam cepheler düşük pürüzlü/yüksek metalik
  Standard/Physical malzeme kullanır ki gün batımı camda yansısın; kendi envMap'ini üretmez.
- Gölge: tek yönlü güneş ışığı atmosferin; `castShadow/receiveShadow` bayraklarını ağ sahibi ayarlar.
- Ekran görüntüsü/deneme çıktıları `out/<ajan-adı>/` altına; başkasının klasörüne yazma. 5173'te sunucu zaten
  çalışıyorsa onu kullan, ikincisini açma.

## 5. Zaman — tek parametre
Tüm görsel durum **`tod`** (günün saati, ondalık saat, 0–24) ile sürülür. İkinci girdi `t` (saniye,
animasyon saati): trafik, yanıp sönme gibi hareketler `t`'nin **saf fonksiyonudur**.
`timeline.js` → `timeState(tod, t)` şu `state` nesnesini döndürür:
```
{ tod, t,
  sunDir: THREE.Vector3,  // sahneden güneşe birim vektör (batış batıda, −X tarafı)
  sunElev,                // derece
  day,      // 1 gündüz → 0 gece
  golden,   // 0..1, gün batımı çevresinde tepe
  night,    // 0..1
  lightsOn  // 0..1; sunElev ≈ +2° → −8° arasında yükselir
}
```
"Tek tek yanma": her pencere/lamba/tabela seed'li sabit bir eşik `k ∈ [0,1]` taşır; `lightsOn > k` ise yanar.
Referans saatler: 16:30 parlak ikindi · 18:45 altın saat · 19:20 batış · 19:50 mavi saat · 21:30 tam gece.

## 6. Modül arayüzü
Her sahne modülü ES module, tek export:
```js
export async function create(ctx) { … return { object3D?, update(state), dispose?() } }
```
`ctx = { THREE, scene, camera, renderer, data: {buildings, roads, terrain, landmarks, points},
         heightAt(x,z), rng(seedStr) → () => [0,1), quality: "draft"|"final", params: URLSearchParams }`
- `atmosphere.js` ayrıca `render(state)` döndürebilir (post-process zinciri); varsa main onu çağırır.
  Gök, güneş/ay ışığı, sis, exposure, bloom atmosferin; yayıcı (emissive) malzemeler sahibinin.
- `edit.js`: `export const DURATION = 36; export function shotAt(t) → { position:[x,y,z], target:[x,y,z], fov, tod, roll? }`
  Saf fonksiyon. Videoda `tod`'u kurgu belirler.
- main.js eksik modülü hata vermeden atlar (paralel geliştirme için).
- `roll` birimi **derece**. Modüller isteğe bağlı `resize(w, h, dpr)` döndürebilir (post-process hedefleri için).
- Ek ctx alanları: `ctx.render` (bool, render modunda mıyız), `ctx.ground` (arazi Object3D'si; yoksa undefined).
  Veri dosyası yoksa ilgili `ctx.data.*` alanı `null` gelir; modül buna dayanıklı olmalı.
- `?testscene=1`: çatıyı tek başına sınayan yer tutucu kutular (gerçek modüllerle birlikte kullanma).
- Headless Chromium GPU bayrakları `tools/lib-browser.mjs` içinde; kendi Playwright betiğini yazarsan oradan al.

## 7. Determinizm (pazarlıksız)
- `Math.random`, `Date.now`, `performance.now`, `clock.getDelta` sahne durumunu **etkileyemez**. Yalnızca `ctx.rng(seed)`.
- Biriken durum yok: her kare yalnızca `(tod, t)`'den hesaplanır. `t=12.3` karesi tek başına çizildiğinde aynı çıkar.
- Render kancası: `?render=1&w=1080&h=1920` arayüzü gizler, rAF döngüsünü durdurur.
  `await window.__ready` → `await window.__renderFrame(tSeconds)` kareyi çizer. `window.__duration` süre.
  `?atmo=a|b` varyant seçer. `?tod=19.2` serbest modda başlangıç saati. `?q=draft|final`.

## 8. Çalıştırma
- `npm run dev` → `tools/serve.mjs`, repo kökünü `http://localhost:5173` üzerinden sunar; sayfa `/web/`.
- `npm run shots` → out/shots/ altına gündüz+gece ekran görüntüleri.
- `npm run render -- --draft` (540×960, 15 fps) / `npm run render` (final) → Playwright kare kare + ffmpeg.

## 9. Gizlilik ve kotalar
- OpenTopography anahtarı yalnızca `tools/` betiklerinde `process.env`'den okunur. Loglara, dosyalara, URL çıktılarına yazılmaz.
- COP30 **tek çağrı**; `data/raw/cop30.tif` varsa betik yeniden indirmez. Günlük sınır 50.
- Overpass'a nazik davran: tek birleşik sorgu, sonucu `data/raw/` altına kaydet, tekrar çağırma.

## 10. Ajan raporu
En fazla 150 kelime: ne yaptın, hangi dosyalar, neyi **doğrulayamadın**. Ham veri/uzun kod yapıştırma.
