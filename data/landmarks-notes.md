# Simge yapılar — ölçü ve kaynak notları (landmarks.js)

`refs/` klasörü boştu (2026-11-10); oranlar web kaynaklarından ve Wikimedia Commons fotoğraflarından alındı.
**tahmin** = yayımlanmış kaynağı yok, fotoğraftan/akıl yürütmeden.

## Kaynaklar
- [W-TT] Wikipedia "Trump Towers Istanbul" — https://en.wikipedia.org/wiki/Trump_Towers_Istanbul
- [EA-TT] e-architect, Trump Towers Istanbul (Brigitte Weber) — https://www.e-architect.com/istanbul/trump-towers-istanbul
- [W-SP] Wikipedia "Şişli Plaza" — https://en.wikipedia.org/wiki/%C5%9Ei%C5%9Fli_Plaza
- [SB] ScraperBase: Sisli_Plaza, Torun_Center_East_Tower, Torun_Center_South_Tower, Quasar_Residences — https://www.scraperbase.com/Turkey/Istanbul/…
- [W-ASY] Wikipedia "Ali Sami Yen Stadium" (koordinat) — https://en.wikipedia.org/wiki/Ali_Sami_Yen_Stadium
- [ARUP/EK/MIPIM] Quasar İstanbul: iki ~40 katlı kule (Fairmont otel + rezidans), restore likör fabrikası (Robert Mallet-Stevens) — arama özetleri (arup.com, emlakkonut.com.tr, MIPIM 2014)
- [EAA] Emre Arolat Architecture, "Mecidiyeköy" projesi: likör fabrikası + eski stadyum arsası, parçalı kütleler, gökbahçeler — https://emrearolat.com/?p=1988
- [TC-emlak] emlakkulisi vb.: Torun Center = 42 katlı 2 rezidans kulesi + 36 katlı 1 ofis kulesi
- [CM] Wikimedia Commons fotoğrafları: Category:Trump Towers, Istanbul; Category:Torun Center; Category:Fairmont Quasar;
  Category:Şişli Plaza (Istanbul 1180099.jpg); Category:Istanbul Cevahir; "Mecidiyeköy Metrobüs.jpg"; "Sunset over Mecidiyeköy.jpg"

## Yapı yapı
| Yapı | Kullanılan | Kaynak / durum |
|---|---|---|
| Trump Rezidans kulesi (w1222286465) | 155 m çatı, 39 kat, baseY'den | [W-TT] |
| Trump Ofis kulesi (w1455454989) | 145 m çatı, 37 kat; koyu taç kutusu ~16 m + "TRUMP" | yükseklik [W-TT]; taç oranı **tahmin** [CM] |
| Trump kütle biçimi | her kule çekirdeğin iki yanında iki birim: koyu cam yarı (prizmatik, ortada dışa kırılan yüzler) + beyaz bantlı açık cam yarı (yukarı incelen), arada şeffaf çekirdek; rezidansın koyu yarısı eğik kesik çatılı | "prismatic and angular facades", "black and white", "two sides of the core as separate units" [EA-TT]; açılar/kırılma miktarları **tahmin** [CM] |
| Trump AVM podyumu | arazinin 14 m üstü (eğimi izler), 3 kat | OSM levels=3; 14 m **tahmin** |
| Torun ofis kulesi (w728793801) | 150 m; üç kaydırılmış blok (0.6H / H / 0.79H), taş taç kutusu, kırmızı T logosu, altın LED kat çizgileri (3 katta bir) | 36 kat [TC-emlak]; 150 m **tahmin** (36×~4.1 m); biçim/ışık [CM Torun_Center.jpg, Toruncenter.jpg] |
| Torun rezidans kulesi (w728793798) | 160 m; gri taş dilim + cam bloklar | 160 m OSM + [SB East Tower 160 m/43 kat]; malzeme [CM] |
| Quasar Fairmont (w728793799) | 156 m; koyu mavi cam, beyaz kat çizgileri, kırmızı dikey LED, gökbahçe boşluğu, heliport | 40 kat [ARUP/EK]; 156 m [SB tahmini]; LED/görünüş [CM Fairmont_Quasar_Istanbul.jpg] |
| Quasar Residences (w728793800) | 156 m; açık ızgara, iki gökbahçe boşluğu | [SB] 156 m/40 kat; boşluk yerleri **tahmin** |
| Likör fabrikası (w728793802) | 7.5 m beyaz | OSM 5 m / 1 kat; 7.5 m **tahmin** (Mallet-Stevens, 1930'lar) |
| w728793803 / 805 | 40 m | OSM |
| Şişli Plaza kulesi | merkez (−42, 669), u ekseni güneye; ~35×22 m gövde + kuzey ucu yarım silindir; 170.1 m; krem kaplama, delikli pencereler, doğu yüzünde mor ve pembe basamaklı bloklar, tepede 14 direkli radyo halkası + orta direk | yükseklik/kat [W-SP] (liste 152 m der); konum: Commons koordinatı 41.06040 K 28.99120 D → (−67, 676), ScraperBase 41.060342/28.991491 → (−43, 681); OSM dış hattının içine (−42, 669) konuldu — **konum ve iz tahmin**; renk/taç [CM Istanbul 1180099.jpg, Cevahir fotoğrafı] |
| Şişli Plaza A/C blokları | 9 kat ≈ 31 m (dış hattın kuzey/güney kolları) | 9 kat [W-SP]; yerleri **tahmin** |
| Cevahir | çatı = max(baseY+34, en yüksek zemin+22); yeşil cam cephe, kırma cam çatı ~68×36 m, kuzeyde beyaz giriş kulesi + tabela | 6 kat OSM; yükseklik **tahmin**; renk [CM]; cam çatı yeri **tahmin** (2500 m² yayımlanmış ama konumu değil) |
| Metrobüs peronu | OSM peron w1305577747 + w1412628025 (z≈−37…−50), tonoz sundurma 4.1+1.5 m | sundurma ölçüsü **tahmin** [CM Mecidiyeköy Metrobüs.jpg] |
| Üst geçit | OSM footway bridge w375233084 (−93,−98)→(−100,−24), tabla +6.8 m, çatılı; perona/uçlara merdiven | yükseklik **tahmin** |
| İETT peronları (orijin) | OSM platform w957443632/33/34 üstünde düz sundurmalar 3.6 m | **tahmin** |
| Metro girişleri | 14 nokta (kapsam dışı −790,−328 atlandı), cam köşk 5.2×3.2×2.7 m + kırmızı M | **tahmin** |
| Meydan | OSM poligonu; taş döşeme, orta halka + yer ışıkları, kenar direkleri | düzen **tahmin** |

## Veri ajanının açık soruları — çözüm
1. **Dört ~160 m iz:** Torun Center eski Ali Sami Yen arsasında (stadyum merkezi [W-ASY] → yerel (585, 116)).
   - w728793801 (538, 111) ve w728793798 (596, 159) stadyum arsasında → **Torun Center**. ScraperBase "East Tower" koordinatı (587, 169) w798'e düşüyor.
   - w728793799 (672, 150) ve w728793800 (741, 152) likör fabrikası (w802) ile Likör Yanı Sk. (x≈790) arasında, Ali Sami Yen Sk.'nın (z≈178; Fairmont'un adresi) hemen kuzeyinde → **Quasar İstanbul**. "QUASAR Heliport" w799'da → Fairmont; ScraperBase "Quasar Residences" koordinatı (742, 157) w800'e düşüyor.
   - Sonuç: Torun'un 3 kulesinden yalnız 2'si OSM'de; **üçüncü Torun kulesi OSM'de yüksek bina olarak yok** (w1321569694 "Torun Center" building=office 12×55 m ince iz — kule değil). Hangisinin ofis olduğu doğrulanamadı; w801 ofis (36 kat), w798 rezidans kabul edildi.
2. **Şişli Plaza kulesi:** yukarıdaki tabloda; dış hattın batı lobunda, tahmin.

## Veriyle çelişkiler (orkestratöre)
- `landmarks.json` torun_center: w728793799 ve w728793800 aslında **Quasar** (ayrı anahtar olmalı: `quasar`); OSM'de w800'ün `name=Torun Center` etiketi büyük olasılıkla yanlış.
- Quasar yüksekliği: OSM 160 m/42 kat, kaynaklar 40 kat/≈156 m → 156 m kullanıldı.
- Torun ofis kulesi: OSM w801 160 m/42 kat, kaynak 36 kat → 150 m (tahmin) kullanıldı.
- README'deki "Şişli Elit Residence 140" = OSM w1457770436, "Elit Residence" (w164288213) kompleksinin silindir kulesi; Şişli Plaza değil (city.js çiziyor).
- `metrobus_station` anahtarı orijindeki **İETT otobüs peronlarını** gösteriyor; asıl metrobüs peronu OSM w1305577747 "Mecidiyeköy" (−80,−48)→(33,−37). İkisi de çizildi.
- `metro_station` girişlerinden (−790.1, −327.7) sahne kapsamı dışında; atlandı.
