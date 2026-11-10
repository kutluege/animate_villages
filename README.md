# Mecidiyeköy — gündüzden geceye

Mecidiyeköy çekirdeğinin (41.060–41.072 K, 28.984–29.000 D) gerçek veriye dayalı three.js sahnesi ve aynı sahneden
kare kare üretilen dikey video.

- Video: [`out/final/mecidiyekoy.mp4`](out/final/mecidiyekoy.mp4) — 1080×1920, 30 fps, 36 sn, H.264, sessiz.
- Modüller arası sözleşme: [`CONTRACT.md`](CONTRACT.md). Veri ayrıntısı: [`data/README.md`](data/README.md),
  simge yapı ölçüleri ve kaynakları: [`data/landmarks-notes.md`](data/landmarks-notes.md).

## Sayfayı çalıştırma

```
npm install          # three + playwright; three web/vendor altına kopyalanır
npx playwright install chromium   # yalnızca render/ekran görüntüsü için
npm run dev          # http://localhost:5173/web/
```

Serbest kamera (sürükle/tekerlek), günün saati kaydırıcısı, gündüz↔gece oynatma ve "videoyu önizle" düğmesi var.
Parametreler: `?tod=19.2` başlangıç saati, `?atmo=a` diğer atmosfer yorumu, `?q=draft` hafif kalite.

## Videoyu yeniden üretme

```
npm run render -- --crf 20     # out/final/mecidiyekoy.mp4 (repodaki sürüm)
npm run render                 # aynı kareler, CRF 14 (~100 MB ana kopya)
npm run render -- --draft      # 540×960, 15 fps hızlı taslak → out/draft/
```

Zaman koddan ilerletilir: her kare `window.__renderFrame(t)` ile çizilir, Playwright (headless Chromium, GPU) ile
alınır, ffmpeg ile birleştirilir. ffmpeg PATH'te olmalı. Yarıda kesilirse aynı komut kaldığı yerden sürer;
`--from/--to` kısmi aralık, `--fresh` kareleri baştan alır. `node tools/check-determinism.mjs` aynı karenin farklı
sırayla çizildiğinde aynı çıktığını sınar; `node tools/check-route.mjs --scene` kamera rotasını çarpışmaya karşı sınar.

## Veriyi yeniden üretme

Ham indirmeler `data/raw/` altında commit edilmiştir; betikler dosya varsa yeniden indirmez.

```
python tools/build-data.py     # data/raw → data/*.json
```

Sıfırdan indirmek için `tools/fetch-overpass.py`, `fetch-overpass-landuse.py`, `fetch-overture.py`, `fetch-cop30.py`.
COP30 için repo kökünde `.env` içinde `OPENTOPO_API_KEY` gerekir (commit edilmez; günlük sınır 50 çağrı).

## Neyin veri, neyin tahmin olduğu

- 2972 binanın 2700'ünün (%91) yüksekliği **tahmin** (`heightSource: "estimate"`); 219'u OSM kat sayısından, 53'ü OSM
  yüksekliğinden. Overture bu bölgede yeni yükseklik getirmedi, 905 eksik bina izi ekledi.
- Simge yapılar: Trump Towers 155/145 m ve Şişli Plaza 170 m yayımlanmış kaynaktan; Torun Center/Quasar 160 m OSM'den.
  Tahmin olanlar: tüm podyumlar, Cevahir (34 m), viyadük tabliyesi (9 m) ve köprü kotları, Torun'un OSM'de olmayan üçüncü
  kulesi (konum, iz, yükseklik), Şişli Plaza kulesinin konumu ve izi, durak/üst geçit/sundurma ölçüleri.
- Veriye dayanmayan, kodda `userData.procedural` ile işaretli doku: veri kutusunun dışındaki dolgu şehir (~36 bin blok)
  ve kutu içinde OSM'de bina izi bulunmayan beş konut adasındaki 232 bina.
- Arazi: COP30 yüzey modeli güçlü biçimde yumuşatıldı; yalnızca genel eğim.

## Bilinen eksikler

- `refs/` boş: simge yapıların oranı ve cephesi kullanıcı fotoğraflarıyla değil web/Wikimedia kaynaklarıyla kuruldu.
- Hangi Torun kulesinin ofis olduğu doğrulanamadı.
- Açılış viyadüğün altından değil, metrobüs durağının kenarından başlar.
- Kapak karesi tek başına çizildiğinde sıralı çizime göre birkaç renk kanalında 1 birimlik fark çıkabiliyor
  (kule tepe ışıkları çevresi); video sıralı üretildiği için sonucu etkilemez.
- Dolgu doku serbest sayfada çok uzaktan bakıldığında yamalı görünür.
- Araçlar ve apartmanlar bilinçli olarak düşük poligonlu; yakın planda stilize durur.
