# Simge yapılar — kaynaklar, kullanılan değerler, bilinen eksikler

Kod: `web/src/landmarks/` (`geometry.js` içindeki `HEIGHTS` tablosu bu belgeyle aynı değerleri taşır).
Araştırma tarihi: 2026-11-10 (web araması + sayfa okuma). Ayak izlerinin TAMAMI `web/public/data/buildings.json`
(OSM) kaydından alındı; aşağıda yalnız yükseklik ve biçim kararları var.

## Bilinen eksik (önce bunu oku)
- **`refs/` klasörü BOŞ. Hiçbir biçim/cephe kararı fotoğrafla doğrulanmadı.** Web'den yalnızca metin/sayı
  (yükseklik, kat, kule sayısı) doğrulanabildi; cephe rengi, tepe biçimi, tabela yeri gibi görsel kararların
  hiçbiri bir görsele bakılarak yapılmadı. "Bellekten" diye işaretlenenler modelin genel bilgisine dayanır.
- Archello sayfası (Trump Towers mimari tanımı) 403 döndü, okunamadı.

## Kullanılan yükseklikler

| Yapı | Veride (buildings.json) | Kullanılan | Kaynak / gerekçe |
|---|---|---|---|
| Trump konut kulesi `w1222286465` | 124.8 m (39 kat × 3.2; ölçüm değil) | **155 m** (zirve) | ARAŞTIRMA: Wikipedia 155 m / 39 kat; CTBUH ~156 m; geliştirici sitesi 154 m |
| Trump ofis kulesi `w1455454989` | 118.4 m (37 kat × 3.2) | **145 m** (zirve) | ARAŞTIRMA: Wikipedia 145 m / 37 kat; CTBUH 145.1 m |
| Trump AVM podyumu `w163629174` | 9.6 m (3 kat) | **9.6 m** | VERİ. (Basın bülteni "7 katlı perakende platformu" der; OSM 3 kat + 4 bodrum = 7, tutarlı.) |
| Torun konut kuleleri `w728793799`, `w728793800` | 160 m (OSM height) | **160 m** | VERİ = ARAŞTIRMA (CTBUH: East/South Tower 160 m, 42–43 kat) |
| Torun ofis kulesi `w728793798` | 160 m (OSM height) | **144 m** | ARAŞTIRMA: CTBUH "Office Tower 144 m"; ilan siteleri "36 katlı ofis kulesi" |
| Torun 4. ayak izi `w728793801` | 160 m, 42 kat (OSM) | **40 m** | **VARSAYIM** — aşağıya bak |
| Torun alçak blok `w728793802` | 5 m | 5 m | VERİ |
| "Torun Center" küçük ofis `w1321569694` | 25.7 m (tahmin) | 25.7 m | VERİ (tahmin; doğrulanmadı) |
| Cevahir AVM `w46962419` | 19.2 m (6 kat × 3.2) | **27 m** (+5 m geri çekilmiş üst kat, +9 m cam tonoz) | **VARSAYIM**: kat sayısı (6) veri ve Wikipedia'da aynı; yükseklik için kaynak bulunamadı. 3.2 m/kat konut varsayımı AVM için düşük; 4.5 m/kat alındı. |

Yükseklikler kaydın `groundY` (ortalama zemin) kotundan ölçülür. Trump podyumunun üst kotu, arsa kuzeye sert
indiği için ayak izindeki en yüksek zemin + 9.6 m'dir (güney/D-100 cephesinde 3 kat görünür).

## Veri ↔ araştırma çelişkileri
1. **Trump kuleleri:** veri kat×3.2'den 124.8/118.4 m; kaynaklar 154–156 / 145 m. Araştırma kullanıldı (155/145).
   Kaynaklar arası ±1 m fark var (154, 155, 156); Wikipedia değeri alındı.
2. **Torun Center kule sayısı:** OSM'de dört ayak izi de `height=160, levels=42`. Tüm kaynaklar **3 kule**
   der (2 konut 160 m + 1 ofis 144 m). Karar: doğu-batı sırasındaki üç benzer ayak izi (`…798/799/800`)
   kule; sıranın dışındaki ince uzun çubuk (`…801`, 54×26 m) **yatay blok sayıldı ve 40 m verildi. Bu bir
   varsayımdır; hiçbir kaynak bu ayak izinin ne olduğunu ya da yüksekliğini söylemiyor.** Yanlışsa
   `HEIGHTS.torunBar` tek satırda düzeltilir.
3. **Hangi Torun kulesi ofis (144 m)?** Kaynak yok. Batıdaki (`…798`, Büyükdere Cd.'ye yakın) varsayıldı.
4. **Torun kat sayısı:** 42 (Wikipedia listesi, OSM) ↔ 43 (CTBUH). Yalnız cephe kat aralığını etkiler; 42 alındı.
5. **Cevahir:** bir Wikipedia aynasının bilgi kutusu "20 kat" der; metin ve OSM "6 perakende katı". 6 alındı.

## Biçim ve cephe kararları (hepsi fotoğrafsız)
- **Trump Towers:** kaynaklı — iki kule, farklı boy (39/37 kat), altta AVM, mimar Brigitte Weber.
  Bellekten/doğrulanmadı — eğik kesik tepe (uzun eksen boyunca; zirve güney uçta, düşüş 21 m / 16 m),
  mavi cam + açık renkli yatay spandrel bantları, tepe kenarında LED hattı, kule tepesinde "TRUMP" yazısı,
  podyumda tabela, iki kule arasında ışıklık. Eğimin YÖNÜ özellikle belirsiz.
- **Torun Center:** kaynaklı — 2 konut + 1 ofis kulesi, eski Ali Sami Yen arsası. Bellekten/doğrulanmadı —
  koyu nötr cam, güçlü dikey dikmeler, her 11 katta koyu derz katı, tepede mekanik taç bandı.
- **Cevahir:** kaynaklı — 6 perakende katı, ~2 500 m² cam çatı (26×96 m tonoz olarak modellendi), üstünde dev
  saat (modellenmedi). Bellekten/doğrulanmadı — bej taş kaplama, geri çekilmiş üst kat, tonozun yönü ve yeri,
  "Cevahir" tabelalarının yeri/rengi.
- Metro giriş totemleri: `pois.entrances` konumlarında genel kırmızı ışıklı kutu; gerçek totem tasarımı değil.

## Tur 2 — Torun Center yeniden araştırma (2026-11-10)
Bulunan (metin):
- Mimar **Emre Arolat (EAA)**; "3 kuleden oluşan proje", "42 katlı kuleler"; kamuya açık **10 000 m² kent
  meydanı**; kule podyumunda **iki katlı yatay "garden office"ler** (Hürriyet, 2014).
- EAA proje sayfası: yapı alanı 258 000 m² (arama özeti; sayfa `emrearolat.com/?p=1988` araçla AÇILAMADI).
- CTBUH: East 160 m, South 160 m, Office 144 m (değişmedi).

Bulunamayan: **cephe sistemi, cam rengi, kule tepe biçimi, kuleler arası ilişki ve podyumun biçimi hakkında
hiçbir metin kaynağı bulunamadı** (EAA sayfası engelli, emlakkulisi 403, cephe firması araması sonuçsuz).
Fotoğraf da yok. Dolayısıyla Tur 2'deki biçim kararları VARSAYIMDIR:
- Her kule, OSM'deki L biçimli ayak izi ağırlık merkezinden ikiye bölünerek **birbirine kaymış iki cam dilim**
  olarak kuruldu; dilimlerden biri 3 kat (11.4 m) alçak → basamaklı tepe. (Ayak izi veri; bölme ve fark varsayım.)
- Açık mavi-yeşil yansıtıcı cam, açık renk dikey dikmeler, ince koyu spandrel, 14 katta bir panjurlu mekanik
  kat (Tur 1'deki siyah bantlar kaldırıldı), cam parapet + tepe LED hattı, çift kat yüksekliğinde ışıklı lobi.
- Podyum/garden office: veride yalnız `w728793802` (5 m, 1 kat) var; Hürriyet "iki katlı" der. Veri korundu,
  ayrı podyum ayak izi UYDURULMADI. Meydan modellenmedi.
- **Dördüncü ayak izi (`w728793801`) hâlâ varsayım:** 40 m yatay blok. Kaynaklar 3 kule dediği için kule
  yapılmadı; ne olduğu ve yüksekliği doğrulanmadı.
- Hangi kulenin ofis (144 m) olduğu hâlâ varsayım (batıdaki).

Ek URL'ler: https://www.hurriyet.com.tr/3-buyukler-ali-sami-yende-bulusuyor-26242747 ·
https://emrearolat.com/?p=1988 (açılamadı) · https://emlakkulisi.com/guncel/torunlar-gyo-torun-center-resimleri/510743 (403)

Gece ışık örüntüsü (ofis kat bantları, 5 panellik daire birimleri, mekanik katlar, lobi) ve gün batımı parlaması
(panel başına normal sapması, mat derzler, parlama tavanı) birer görsel modeldir; gerçek yapıların kat planına
ya da aydınlatmasına dayanmaz.

## Tur 4 — Cevahir yeniden araştırma (2026-11-10)
- Yeni metin kaynağı YOK: yükseklik (m), cephe malzemesi, cam çatının biçimi, giriş ve otopark düzeni için
  arama sonuç vermedi. ITÜ A|Z makalesi (https://www.az.itu.edu.tr/jfa/article/download/885/743/18949) PDF
  olarak indi ama metni okunamadı. **Yükseklik 27 m hâlâ VARSAYIM** (6 kat × 4.5 m).
- Doğrulanan küçük ayrıntılar (arama özeti): adres Büyükdere Cd. No. 22; M2 Şişli-Mecidiyeköy istasyonuna
  doğrudan bağlı (https://www.malls.com/malls/cevahir/, Wikipedia).
- Veriden: otopark girişi, OSM servis yolu rampalarının (`w1463654669/70/71/77/88`) dayandığı güneybatı
  yüzüne kondu (yer veriden, biçim varsayım).
- VARSAYIM olan eklemeler: batı/güneybatı yüzündeki camlı giriş holleri ve saçak (gerçek ana girişin yeri
  doğrulanmadı), tonozun yanındaki küçük ışıklıklar, ek çatı mekaniği, ışıklı reklam panolarının yeri/rengi,
  cam tonozun içeriden "fener" gibi ışıması.

Yol denetimi (`out/tmp/r4_roadcheck.cjs`): simge yapı ayak izlerinin hiçbiri taşıt yolu üstünde değil; yalnız
Trump ve Cevahir kenarlarına servis yolu (otopark rampası) dayanıyor. Yola 2.5 m'den yakın 3 metro totemi kaldırıldı.

## URL'ler
- https://en.wikipedia.org/wiki/Trump_Towers_Istanbul — 155 m / 145 m, 39 / 37 kat, mimar
- https://www.skyscrapercenter.com/complex/503 ve https://www.skyscrapercenter.com/building/trump-tower-2/4192 — 156 m / 145.1 m (arama özeti)
- https://trumpistanbul.com.tr/en/concept.aspx.html — 154 m, 39/37 kat (arama özeti)
- https://prnewswire.com/news-releases/donald-j-trump-and-ivanka-trump-visit-istanbul-to-celebrate-the-opening-of-highly-anticipated-trump-towers-mall-150816665.html — "seven floor retail platform" (arama özeti)
- https://archello.com/project/trump-towers-istanbul — 403, okunamadı
- https://www.skyscrapercenter.com/complex/1287 — Torun Center: East 160 m, South 160 m, Office 144 m
- https://www.spaceistanbul.com/en/development/torun_center-ili_stanbul/448 — 3 kule, ofis 36 kat
- https://www.emlakplatform.com.tr/tr/projects/torum-center — "42 katlı iki rezidans kulesi, 36 katlı ofis kulesi" (arama özeti)
- https://en.wikipedia.org/wiki/Istanbul_Cevahir — 6 perakende katı, 2 500 m² cam çatı, saat, 62 475 m² arsa
- OSM etiketleri: `data/raw/overpass.json` (Torun dört yol: height=160, levels=42; Cevahir levels=6; Trump levels 39/37/3)
