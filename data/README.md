# data/ — Mecidiyeköy sahne verisi

Üretim: `python tools/build-data.py` (ağ kullanmaz). Ham indirmeler `data/raw/` altında, bir kez:
`tools/fetch-overpass.py`, `tools/fetch-overture.py`, `tools/fetch-cop30.py` (dosya varsa yeniden indirmez).
Python: `pip install numpy scipy shapely tifffile imagecodecs overturemaps`. Node bağımlılığı yok.
İndirme tarihi: 2026-11-10. Ayrıntılı istatistik: `data/raw/build-stats.json`.
**Tur 2 (2026-11-10):** tek ek Overpass sorgusu `tools/fetch-overpass-landuse.py` → `raw/overpass-landuse.json`
(landuse/leisure/natural/amenity alanları, duvar/çit, ibadethaneler; overpass.kumi.systems aynasından; ilk deneme
tüm aynalarda 502 verdi, veri gelmedi, aynı sorgu bir kez yinelendi). Yeni çıktı `landuse.json`; landmarks düzeltildi.

**Orijin** (41.0665 K, 28.9920 D) = D100 orta refüjündeki **Mecidiyeköy Metrobüs peronları** (way 745420396, merkez ≈ (4, 3)).
Ona göre: Trump Towers (31, −192) ~190 m K · Mecidiyeköy Meydanı (269, −6) ~270 m D, viyadüğün batı ucunun altında ·
Cevahir (82, 412) ~420 m G · Şişli Plaza (−36, 654) ~650 m G · Torun Center kuleleri (647, 145) ~660 m D (sahne doğu kenarı) ·
metro girişleri ortalaması (64, 85) · viyadük x≈185 → doğu kenarı.

## Kaynaklar ve lisans
| Veri | Kaynak | Lisans |
|---|---|---|
| Bina izleri, yollar, metrobüs, metro, duraklar, ağaçlar | OpenStreetMap, Overpass (overpass-api.de), tek sorgu → `raw/overpass.json` | ODbL © OSM katkıcıları |
| Ek bina izleri (OSM'de olmayan) | Overture Maps buildings (Microsoft ML Buildings kaynaklı) → `raw/overture_buildings.geojson` | ODbL |
| Arazi | Copernicus GLO-30 DEM (COP30) via OpenTopography → `raw/cop30.tif` | Copernicus DEM lisansı © DLR/ESA |
| Simge yapı yükseklikleri | Wikipedia (Trump Towers Istanbul, Şişli Plaza, List of tallest buildings in Istanbul), CTBUH/ScraperBase | alıntı |

## Koordinatlar
CONTRACT §2: metre, +X doğu, −Z kuzey, 0.1 m'ye yuvarlı. Veri kapsamı x ∈ [−925, 925], z ∈ [−885, 995]
(sahneden geniş; yollar bu kutuya kırpıldı, binalar temsil noktası kutu içindeyse alındı).
Ayak izleri: dış halka saat yönü tersine (x,z düzleminde), delikler (holes) ters yönde.

## Binalar — yükseklik kaynakları (2972 bina)
Öncelik: OSM `height` → OSM `building:levels` (kat × 3.1 m; ≥12 katlı ofis/ticari 3.8 m) → Overture (`height`/`num_floors`) → tahmin.
| heightSource | adet |
|---|---|
| osm | 53 |
| osm_levels | 219 |
| overture | **0** — Overture'daki yükseklikler bu bölgede yalnızca OSM'den türetilmiş; yeni bilgi eklemedi |
| estimate | **2700** (%91) — bunların 905'i OSM'de olmayan Overture/Microsoft ML izleri (`footprintSource: "overture_msml"`) |

Tahmin yöntemi: 120 m içindeki ölçülü (osm/osm_levels) apartmanların kat medyanı (4–9 arasına sıkıştırılmış) ± kararlı
(id-hash) ≤1.5 kat oynama; küçük izler (<70 m² → ≤3 kat, <110 m² → ≤5 kat), garaj/kulübe/<40 m² → 1 kat, ev 2–3,
okul 4, cami 14 m, `roof` = 3.5–4.5 m sundurma, köprü/viyadük altındaki tahminler 1 kat. Kat yüksekliği 3.1 m + 0.6 m parapet.
Sonuç: medyan yükseklik 16.1 m (5 kat); kat dağılımı 5–7 katta yoğun.

Alanlar: `baseY` = izin köşelerindeki arazi kotunun minimumu (terrain.json ile aynı bilineer örnekleme);
`height` = baseY'den çatıya; **ek alan** `minHeight` = gövdenin baseY üstünde başladığı yükseklik (building:part, sundurma);
`part: true` = OSM building:part (dış hattın ≥%50'sini parçalar kaplıyorsa dış hat atıldı: 23 bina); `landmark` = landmarks anahtarı
(city.js bunları çizmemeli). Yeraltı yapıları (layer<0, ör. metro istasyon kutusu) bina olarak alınmadı.

En yüksek 10: Torun Center/Quasar 4×160 (osm) · Trump Residence 155 · Nurol Tower 152 (osm; Wikipedia listesi 160) ·
Trump Office 145 · Şişli Elit Residence 140 · Marriott 135 · w1175523984 108.6 (30 kat, kapsam köşesi) · Selenium Residence 75.
**Not:** Şişli Plaza (170 m) buildings.json'da 20 m podyum tahmini; kule izi OSM'de yok → landmarks.sisli_plaza.

## Simge yapılar (landmarks.json)
`heightSource: "reference"` = yayımlanmış kaynak (CONTRACT enum'unda yok; yalnız landmarks'ta kullanıldı).
| key | yükseklik | kaynak |
|---|---|---|
| trump_towers | 155 / 145 m (+ podyum 20 m) | Wikipedia; podyum **estimate** |
| torun_center | 160 m (w801 varsayılan ofis, w798 rezidans; + w803/805 40 m) | OSM; 3. Torun kulesi OSM'de yok; ofis ataması **doğrulanamadı** (kaynak 36 kat ≈150 m tahmin) |
| quasar | 156 m (w799 Fairmont + heliport, w800 Residences, w802 likör fabrikası) | ScraperBase (40 kattan tahmini); buildings.json OSM 160 m'yi korur |
| cevahir | 34 m | **estimate** (6 kat, OSM/Wikipedia) |
| sisli_plaza | 170.1 m | Wikipedia (liste 152 m der); kule izi/konumu **bilinmiyor** |
| viaduct | tabliye 9 m | **estimate**; geometri OSM bridge=viaduct (D100 iki yön + metrobüs) |
| metrobus_station | sundurma ~5.6 m | **estimate**; gerçek metrobüs peronu w1305577747 (+w1412628025), üst geçit w375233084 (açık yollar centerline+width) |
| bus_platforms | sundurma 3.6 m | **estimate**; İETT otobüs peronları w745420396 (orijin burada) + w957443632/33/34 |
| metro_station | giriş köşkü 3 m | **estimate**; 15 giriş noktası |
| square | 0 | OSM place=square |
| metrobus_line | — | busway grafiğinden iki yönlü kesintisiz rota (doğu/batı, 1855 m, köşe başına `layer`) |

## Yollar (roads.json)
1508 parça; `kind` = OSM highway (busway = metrobüs, subway = metro tüneli, platform). `bridge`/`tunnel`/`layer` OSM'den
(köprüde layer yoksa 1). Köprü etiketli: D100 ("1. Çevre Yolu") viyadük + batı köprüleri, metrobüs köprüleri, Çağlayan bağlantıları.
`bridgeType: "viaduct"` ana viyadükte. Genişlik: `lanes × 3.3` ya da türe göre varsayılan (tahmin). Ek: `areas` = yaya alanı poligonları.

## Arazi kullanımı (landuse.json, Tur 2)
`{ areas: [{ id, kind, name?, footprint, holes?, osm, area, kindSource? }], walls: [{ id, kind, pts, height? }] }`;
alanlar büyükten küçüğe sıralı (sonra çizilen üstte). 92 alan: cemetery 5 (≈450 000 m²; Zincirlikuyu kapsam dışı
çoğunlukla), park 18, grass 24, parking 18 (yer altı/katlı hariç), construction 10, pitch 11, plaza 3, forest 2, water 1.
Orijin güneyi (x −270…150, z 30…300) %82 mezarlık: Ermenî Kabristanı, Ermeni Katolik, Metamorfos Rum, İtalyan Musevî;
Metamorfos Rum Kilisesi buildings.json'da (w761268822). Duvar/çit 36 çizgi (mezarlık çevre duvarı w52871994 dahil).
**Torun Center arsası** OSM'de yalnız `landuse=commercial`; `plaza` olarak eklendi, `kindSource: "estimate"`.
Tur 3: okul/hastane/üniversite kampüsleri (19 alan, `osm.amenity`) da `plaza` + `kindSource: "estimate"` (plaza toplam 22).
Bilinen boşluk: x −418…−293, z −239…−115 (Çağlayan yönü) ham veride yalnız genel `landuse=residential` (w1414386347),
yollar ve Çetin Emeç Parkı içeriyor; OSM'de de Overture/MS'de de bina yok → hiçbir şey uydurulmadı.
Mezarlık içindeki 17 servis/patika yolu roads.json'da `kind: "path"`, `inCemetery: true`, `osmKind` = asıl tür.
points.json'a ibadethane/tarihî düğümler (place_of_worship, historic) eklendi.

## Arazi (terrain.json)
COP30 (yüzey modeli) → morfolojik açma 7 px (~200 m) + Gauss σ=3 px → 50 m ızgara, 41×43, x −1000…1000, z −950…1150.
`originElevation` = 118.5 m (EGM2008). Sahne kutusu içinde −53.5…+2 m; tüm ızgara −86…+2 m.
Orijin Mecidiyeköy sırtında; kuzeye (Kağıthane vadisi) ve güneye (Fulya) iner. Yalnız genel eğim — sokak ölçeği yok.

## Noktalar (points.json)
subway_entrance 15, station 3, metrobus_stop 4, bus_stop 61, traffic_signals 53, tree 54 (OSM) + 394 (`source: "synthetic"`,
park/yeşil alan içinde 12 m ızgara — tahmin). Ek: `greens` = park/çim/koru poligonları.
