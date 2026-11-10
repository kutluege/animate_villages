# Yol üstünde kaldığı için çizilmeyen binalar

Şehir dokusu ajanı üretir (`node out/tmp/city_onroad.mjs`); çizim süzgeciyle aynı kod: `web/src/city/onroad.js`.
Veri dosyalarına dokunulmadı — yalnız çizimde süzülür.

**Ölçüt:** ayak izi 1,5 m ızgarayla örneklenir; taşıt yolu şeridine (eksen ± genişlik/2) düşen alan ölçülür.
D-100 sistemi (trunk, trunk_link, metrobüs, veri dışı uzantı): ≥ 6 m². Öteki ana yollar (primary/secondary/tertiary ve bağlantıları): ≥ 40 m² ya da (≥ 12 m² ve ayak izinin en az %6 kadarı).
Sokak (residential, living_street, unclassified): ≥ %35 (ya da ≥ 40 m² ve ≥ %20). Servis yolları sayılmaz (avlu/pasaj).
Yalnız köprü tabliyesini delen yapılar (yüksekliği tahmin) silinmez, tabliyenin 2,4 m altına alçaltılır.
Yol adası: ayak izi merkezi 45 m içinde otoyol/rampa/metrobüs şeritleriyle çevriliyse (en büyük açıklık < 150°) ve yüksekliği tahminse 3,6 metreye alçaltılır (büfe/istasyon yapısı).
Meşru sayılanlar: çatısı tabliyenin altında kalan köprü altı yapılar; `minHeight` ile yolun ≥ 4,5 m üstünden geçen hacimler.

**Toplam: 58 bina** — 54 çizilmiyor, 4 alçaltıldı (tabliye altı ya da otoyol adası; veri: 3005). Yol sınıfına göre: busway 2, primary 7, tertiary 19, trunk 1, secondary 5, residential 22, — 2.
Ayak izi kaynağına göre: osm 32, ms 24, overture-osm 2.

## Liste

| id | işlem | merkez (x,z) | yükseklik | alan m² | ana yolda m² | sokakta m² | % | yol | ayak izi | tür/ad |
|---|---|---|---|---|---|---|---|---|---|---|
| w995400704 | alçaltıldı → 4.7 m (tabliye altı) | 316, 27 | 22.9 | 248 | 248 | 0 | 100 | busway (köprü) Metrobüs | osm | civic |
| ov6a57ca02a33d | çizilmiyor | -857, 569 | 16.9 | 4079 | 133 | 176 | 8 | primary Çifte Cevizler Caddesi | ms |  |
| ovfee23f7686e0 | çizilmiyor | -342, -511 | 19.6 | 333 | 59 | 29 | 26 | tertiary Vefa Poyraz Caddesi | ms |  |
| w995400703 | alçaltıldı → 4.9 m (tabliye altı) | 286, 46 | 26.6 | 252 | 59 | 0 | 23 | trunk (köprü) 1. Çevre Yolu | osm | civic |
| ov66d88f6f5d37 | çizilmiyor | -686, 592 | 13.1 | 623 | 56 | 0 | 9 | tertiary Kazım Orbay Caddesi | ms |  |
| ov59620f66b9ba | çizilmiyor | -128, -250 | 35.3 | 286 | 54 | 0 | 19 | tertiary İnönü Caddesi | ms |  |
| ov6f6551417179 | çizilmiyor | -502, -405 | 16.3 | 1031 | 50 | 20 | 7 | tertiary Hudut Caddesi | ms |  |
| ova783a388ea36 | çizilmiyor | -315, 431 | 16.4 | 1706 | 47 | 72 | 7 | primary Abide-i Hürriyet Caddesi | ms |  |
| ovb1e5384e868a | çizilmiyor | -650, -749 | 16.6 | 491 | 47 | 0 | 10 | tertiary Kurşun Sokağı | ms |  |
| w729308400 | çizilmiyor | 372, 544 | 13.5 | 315 | 45 | 0 | 14 | tertiary Mehmetçik Caddesi | osm |  |
| ov1dcd2e1f32e4 | çizilmiyor | -76, -749 | 19.6 | 245 | 43 | 0 | 17 | tertiary İnönü Caddesi | ms |  |
| w662047395 | çizilmiyor | 440, 866 | 10.1 | 257 | 43 | 0 | 17 | tertiary Mehmetçik Caddesi | osm |  |
| w729308423 | çizilmiyor | 211, 387 | 13.1 | 511 | 43 | 0 | 8 | secondary Aytekin Kotil Caddesi | osm |  |
| w1565499176 | çizilmiyor | 595, 0 | 29.2 | 500 | 41 | 0 | 8 | primary Büyükdere Caddesi | osm | apartments |
| ova6f806abc685 | çizilmiyor | -889, 570 | 19.9 | 452 | 38 | 7 | 10 | primary Çifte Cevizler Caddesi | ms |  |
| w688754243 | çizilmiyor | 487, -30 | 28.8 | 261 | 34 | 0 | 13 | tertiary Selahattin Pınar Caddesi | osm | commercial K Plaza |
| w1038257592 | çizilmiyor | 243, -19 | 19.8 | 317 | 29 | 0 | 9 | primary Mecidiyeköy Yolu Caddesi | osm |  |
| w545747089 | çizilmiyor | 573, -500 | 13 | 342 | 27 | 0 | 8 | tertiary Şehit Ertuğrul Kabataş Caddesi | osm |  |
| ov6ede6a527400 | çizilmiyor | -821, -709 | 20.2 | 124 | 23 | 0 | 18 | secondary Taşocağı Caddesi | ms |  |
| w729308421 | çizilmiyor | 175, 353 | 16.4 | 180 | 23 | 0 | 13 | secondary Aytekin Kotil Caddesi | osm |  |
| w729308422 | çizilmiyor | 187, 365 | 13.7 | 250 | 23 | 0 | 9 | secondary Aytekin Kotil Caddesi | osm |  |
| w643421547 | çizilmiyor | 470, -362 | 19.2 | 212 | 18 | 27 | 21 | residential Pak Sokağı | osm |  |
| ov770bf90d8287 | çizilmiyor | -74, -772 | 13.3 | 90 | 18 | 0 | 20 | tertiary İnönü Caddesi | ms |  |
| ovaf9d184ea65e | çizilmiyor | -192, -614 | 13.3 | 131 | 18 | 0 | 14 | tertiary Arif Sokağı | ms |  |
| ovda457fde7b7d | çizilmiyor | -56, 1 | 3.8 | 36 | 18 | 0 | 50 | busway Metrobüs | ms |  |
| w1292933233 | çizilmiyor | 197, 1006 | 22.4 | 299 | 18 | 0 | 6 | secondary 19 Mayıs Caddesi | osm | apartments |
| w548990899 | çizilmiyor | -616, 803 | 19.5 | 162 | 18 | 0 | 11 | tertiary Sıra Cevizler Caddesi | osm | apartments Berrak Apartmanı |
| ov4f8d5adde153 | çizilmiyor | -105, -455 | 19.3 | 212 | 16 | 0 | 7 | tertiary Köz Sokağı | ms |  |
| ov5cec6449d86a | çizilmiyor | -311, -574 | 19.7 | 128 | 16 | 0 | 12 | tertiary Hudut Caddesi | ms |  |
| ovf8a76c04d75b | çizilmiyor | -278, -605 | 19.3 | 115 | 16 | 0 | 14 | tertiary Hudut Caddesi | ms |  |
| w1191897868 | çizilmiyor | 176, -778 | 23.4 | 209 | 16 | 0 | 8 | tertiary Şehit Er Cihan Namlı Caddesi | osm |  |
| w549202911 | çizilmiyor | -623, 679 | 16.4 | 248 | 16 | 0 | 6 | tertiary Sıra Cevizler Caddesi | osm | apartments Amaç Apartmanı |
| w956717756 | çizilmiyor | 170, 203 | 2.6 | 115 | 16 | 0 | 14 | primary Büyükdere Caddesi | osm | roof |
| ovdacc2a9c4e05 | çizilmiyor | 499, 0 | 22.6 | 182 | 14 | 0 | 7 | primary Büyükdere Caddesi | overture-osm | commercial |
| w548990898 | çizilmiyor | -616, 814 | 16.9 | 149 | 14 | 0 | 9 | tertiary Sıra Cevizler Caddesi | osm | apartments Filiz Apartmanı |
| w545747091 | çizilmiyor | 581, -473 | 9.6 | 236 | 11 | 50 | 26 | residential Darcan Sokağı | osm |  |
| w643421548 | çizilmiyor | 463, -375 | 19.2 | 173 | 5 | 81 | 49 | residential Taç Sokağı | osm |  |
| ovb269002bc40c | çizilmiyor | -297, -665 | 19.5 | 448 | 0 | 92 | 21 | residential Meltem Sokağı | ms |  |
| ovdf9639eabf18 | çizilmiyor | 575, -5 | 29 | 383 | 0 | 88 | 23 | residential Naci Kasım Sokağı | overture-osm | commercial |
| w545747085 | çizilmiyor | 605, -569 | 16.4 | 326 | 0 | 86 | 26 | residential Kasımpatı Sokağı | osm |  |
| w1234852902 | çizilmiyor | 438, -804 | 16.8 | 279 | 0 | 56 | 20 | residential  | osm |  |
| w1193229498 | çizilmiyor | 521, -743 | 19.2 | 259 | 0 | 52 | 20 | residential  | osm |  |
| w1141052091 | çizilmiyor | 813, -502 | 16.7 | 173 | 0 | 50 | 29 | residential Harman Yolu Üst Sokağı | osm |  |
| w1148432999 | çizilmiyor | 541, -310 | 16.4 | 189 | 0 | 47 | 25 | residential  | osm | apartments |
| w1184459411 | çizilmiyor | 519, -501 | 16 | 198 | 0 | 47 | 24 | residential Çınarlı Sokağı | osm |  |
| w1148432978 | çizilmiyor | 647, -267 | 13.1 | 198 | 0 | 45 | 23 | residential Burç Sokağı | osm | apartments |
| w1184459421 | çizilmiyor | 546, -463 | 19.7 | 90 | 0 | 45 | 50 | residential Çınarlı Sokağı | osm |  |
| w1141052092 | çizilmiyor | 827, -499 | 19.4 | 185 | 0 | 43 | 23 | residential Harman Yolu Alt Sokağı | osm |  |
| w1234240452 | çizilmiyor | 679, -627 | 19.8 | 187 | 0 | 43 | 23 | residential Güney 1 Sokağı | osm |  |
| w1184458608 | çizilmiyor | 555, -466 | 19.7 | 135 | 0 | 41 | 30 | residential Çınarlı Sokağı | osm |  |
| ov4cefe938968e | çizilmiyor | 710, 216 | 3.4 | 34 | 0 | 14 | 40 | residential Ali Sami Yen Sokağı | ms |  |
| ov0f7bd5e51067 | çizilmiyor | -40, -347 | 6.6 | 27 | 0 | 11 | 42 | residential Şehit Özer Ayrancı Sokağı | ms |  |
| ov49bec84cfa39 | çizilmiyor | -641, -841 | 3.3 | 16 | 0 | 11 | 71 | residential Ağaç Sokağı | ms |  |
| ov61cb832a568a | çizilmiyor | -178, -800 | 3.6 | 20 | 0 | 11 | 56 | residential Kıvılcım Sokağı | ms |  |
| ovf1edecdc315e | çizilmiyor | -138, -669 | 2.9 | 11 | 0 | 9 | 80 | residential Alev Sokağı | ms |  |
| ov1260e3e6efe1 | çizilmiyor | 139, -812 | 2.7 | 14 | 0 | 7 | 50 | residential Kızılcık Mahmut Sokağı | ms |  |
| ovdfff2d0019c2 | alçaltıldı → 3.6 m (otoyol adası) | -662, -98 | 20.1 | 605 | 0 | 0 | 0 | — (yol adası: otoyol/rampa şeritleriyle çevrili) | ms |  |
| w1456656225 | alçaltıldı → 3.6 m (otoyol adası) | -34, 28 | 17 | 137 | 0 | 0 | 0 | — (yol adası: otoyol/rampa şeritleriyle çevrili) | osm |  |

Dolgu (ufuk) binaları, otopark arabaları, ağaçlar ve duraklar aynı sınayıcıyla üretim anında elenir; sayıları `window.__city.info.onRoad` içinde.