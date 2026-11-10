# Tahmini / dolaylı yükseklikler

`tools/build_data.py` tarafından üretilir; elle düzenleme (yeniden üretimde ezilir).

Yükseklik önceliği: OSM `height` → Overture `height` → kat sayısı × 3.2 m → tahmin.
Tahmin = 150 m içindeki etiketli binaların kat medyanı + bina tipi + taban alanı + kimlikten tohumlanan
sapma (2–11 kat). Tahminler `estimated:true`, `heightSource:"estimate"` taşır.

Toplam 3005 kayıt: osm 52, overture 0, levels 223, estimate 2730 → tahmin oranı %90.8.

## Simge yapılar (verideki değerler)

`osm` = OSM `height` etiketi (doğrulanmadı). `levels` = kat × 3.2 m; ölçüm değil, kuleler için büyük
olasılıkla gerçeğin altında. `estimate` = tahmin. Simge ajanı gerçek yükseklikleri ayrıca araştırmalı.

| id | ad | tip | yükseklik (m) | kaynak | taban (m²) | x, z |
|---|---|---|---|---|---|---|
| w1222286465 | Trump Residence Tower | residential | 124.8 | levels | 1358 | 56, -110 |
| w1321569694 | Torun Center | office | 25.7 | estimate | 596 | 503, 97 |
| w1455454989 | Trump Office Tower | office | 118.4 | levels | 958 | 46, -241 |
| w163629174 | Trump Alışveriş Merkezi | — | 9.6 | levels | 12279 | 51, -171 |
| w46962419 | İstanbul Cevahir Alışveriş ve Eğlence Merkezi | — | 19.2 | levels | 32625 | 106, 475 |
| w728793798 | Torun Center | — | 160.0 | osm | 1005 | 615, 204 |
| w728793799 | Torun Center | — | 160.0 | osm | 1620 | 691, 194 |
| w728793800 | Torun Center | — | 160.0 | osm | 1228 | 771, 199 |
| w728793801 | Torun Center | — | 160.0 | osm | 1227 | 561, 155 |
| w728793802 | Torun Center | — | 5.0 | osm | 2161 | 725, 147 |

## Adı olan, yüksekliği TAHMİN binalar (140)

| id | ad | tip | yükseklik (m) | kaynak | taban (m²) | x, z |
|---|---|---|---|---|---|---|
| w923076022 | T.C. Şişli Belediye Başkanlığı | townhall | 19.5 | estimate | 4986 | -707, 271 |
| w164288215 | Sişli Plaza | — | 19.4 | estimate | 4142 | -10, 683 |
| w82681192 | Kuştepe Merkez Camii | mosque | 9.1 | estimate | 1893 | -12, -533 |
| w923076091 | Türkiye Hastanesi | hospital | 19.3 | estimate | 1763 | -813, 43 |
| w218230839 | Migros | — | 16.5 | estimate | 1393 | 723, -223 |
| w1544284406 | Blok 5 | construction | 19.9 | estimate | 1290 | 894, -426 |
| w750399402 | Halim Meriç is Merkezi | apartments | 23.0 | estimate | 1287 | 727, -441 |
| w1544284407 | Blok 4 | construction | 19.4 | estimate | 1285 | 869, -477 |
| w699553233 | Radisson Blu | — | 16.2 | estimate | 1282 | -247, 594 |
| w437439483 | Şehit Murat Demirci Ortaokulu | school | 16.5 | estimate | 1274 | 207, 867 |
| w1544284405 | Blok 6 | construction | 20.1 | estimate | 1158 | 875, -370 |
| w219346241 | Konyalı Hacı Tevfik Ağazade Camii | mosque | 10.1 | estimate | 1041 | 659, -138 |
| w1544284409 | Blok 3 | construction | 19.6 | estimate | 1036 | 833, -435 |
| w1455454984 | Antikacılar Çarşısı | — | 28.8 | estimate | 1015 | -216, -176 |
| w744323192 | Cem Plaza | — | 19.3 | estimate | 942 | -175, 442 |
| w1328695222 | Şişli Trafo Merkezi | service | 2.8 | estimate | 819 | 216, 543 |
| w1544284411 | Blok 2 | construction | 23.3 | estimate | 717 | 831, -390 |
| w699553278 | Wish More Hotel Şişli | hotel | 23.4 | estimate | 715 | -346, 832 |
| w605641777 | Çelik İş Merkezi A-Blok | office | 23.2 | estimate | 666 | 845, -252 |
| w216952064 | Çelik İş Merkezi B-Blok | office | 17.0 | estimate | 666 | 837, -229 |
| w1544284410 | Blok 2A | construction | 22.7 | estimate | 666 | 799, -389 |
| w498861906 | Cengiz Topel Camii | mosque | 12.0 | estimate | 627 | -422, -606 |
| w219346243 | Osman Sağnak Camii | mosque | 13.7 | estimate | 613 | 455, -640 |
| w301911158 | Fulya Mehmetcik Camii | mosque | 10.2 | estimate | 613 | 338, 519 |
| w1321569694 | Torun Center | office | 25.7 | estimate | 596 | 503, 97 |
| w410544768 | Mecidiyeköy Merkez Camii | mosque | 11.5 | estimate | 583 | 475, -164 |
| w1038257591 | Şişli İlçe Emniyet Müdürlüğü | police | 23.1 | estimate | 571 | 272, -16 |
| w699553253 | İstanbul Lab | restaurant | 19.9 | estimate | 558 | -307, 674 |
| w549036048 | Sema Palas | apartments | 16.7 | estimate | 552 | -649, 742 |
| w265741308 | Şişli Merkez Camii | mosque | 9.5 | estimate | 547 | -334, 603 |
| w548861930 | Balıkçıoğlu Apartmanı | apartments | 16.0 | estimate | 507 | -660, 997 |
| w352578921 | Fulya Balçık Cami | mosque | 9.5 | estimate | 498 | 241, 921 |
| w729263899 | Güngen İş Merkezi | commercial | 28.8 | estimate | 480 | 868, 359 |
| w662019517 | Özel Elif Kız Öğrenci Yurdu | dormitory | 13.3 | estimate | 468 | 535, 495 |
| w643421539 | Meşale Hukuk Bürosu | residential | 16.1 | estimate | 454 | 577, -263 |
| w437439482 | Şişli Belediyesi Ek Hizmet Binası | — | 16.7 | estimate | 446 | 226, 573 |
| w549036061 | Kumru Palas | apartments | 19.6 | estimate | 440 | -655, 678 |
| w763128212 | Mehmet Emin Sungur Kompleksi | — | 19.5 | estimate | 436 | -52, 819 |
| w1544284408 | Blok 8 | construction | 16.8 | estimate | 428 | 808, -449 |
| w549793447 | Köşe Palas | apartments | 16.4 | estimate | 419 | -629, 533 |
| w463251168 | Fulya Yeni Cami | mosque | 13.8 | estimate | 391 | 763, 731 |
| w255759427 | Akbank T.A.Ş.Mensupları Tekaüt Sandığı Vakfı | commercial | 35.3 | estimate | 369 | 221, -184 |
| w549036056 | Yıldız Apartmanı | apartments | 16.1 | estimate | 365 | -653, 703 |
| w549202904 | Ressam Lütfü Apartmanı | apartments | 19.6 | estimate | 360 | -613, 753 |
| w549202906 | Ersin Apartmanı | apartments | 16.9 | estimate | 359 | -612, 738 |
| w1317415974 | Mustafa Sarıgül İlkokulu | school | 12.9 | estimate | 344 | -390, -193 |
| w203251877 | Mustafa Sarıgül Ana Okulu | school | 13.3 | estimate | 344 | -392, -213 |
| w290303712 | Hacı Sefer Dursun Camii | mosque | 11.0 | estimate | 338 | 849, -660 |
| w548990906 | Cevizköşk Apartmanı | apartments | 22.7 | estimate | 319 | -646, 779 |
| w548990903 | Zülfikarlar İş Merkezi | commercial | 23.2 | estimate | 311 | -642, 813 |
| w561182855 | Mumcu apt | apartments | 19.3 | estimate | 304 | 26, 755 |
| w549791172 | Akın Apartmanı | apartments | 20.2 | estimate | 303 | -659, 646 |
| w549791174 | Şen Apartmanı | apartments | 13.7 | estimate | 298 | -660, 621 |
| w382843576 | İzzetpaşa Camii | mosque | 9.8 | estimate | 297 | -362, -354 |
| w549791177 | Yaprak Apartmanı | apartments | 19.9 | estimate | 280 | -659, 593 |
| w549036053 | San Salan Apartmanı | apartments | 16.4 | estimate | 279 | -651, 716 |
| w874170903 | Özel Kadıoğlu Hastanesi | clinic | 13.0 | estimate | 278 | 248, 443 |
| w1465114007 | The Hill Cafe | cafe | 17.0 | estimate | 277 | -155, -82 |
| w549793446 | Birlik Apartmanı | apartments | 19.5 | estimate | 276 | -628, 547 |
| w1317415973 | Mustafa Sarıgül Ortaokulu | school | 13.6 | estimate | 274 | -389, -234 |
| w549202910 | Songül Apartmanı | apartments | 13.1 | estimate | 273 | -622, 667 |
| w1141046085 | Özen Apartmanı | house | 23.4 | estimate | 257 | 819, -575 |
| w549791173 | Günaydın 1 Apartmanı | apartments | 19.7 | estimate | 256 | -659, 633 |
| w548892464 | Uzay Apartmanı | apartments | 13.6 | estimate | 254 | -627, 883 |
| w548990905 | Doğanay Apartmanı | apartments | 16.7 | estimate | 253 | -646, 792 |
| w662046599 | Türk Kalp Vakfı | clinic | 19.5 | estimate | 250 | 38, 873 |
| w549793444 | İrma Apartmanı | apartments | 23.4 | estimate | 249 | -628, 564 |
| w548990908 | Uğur Apartmanı | apartments | 19.2 | estimate | 248 | -648, 759 |
| w699553256 | McDonald's | fast_food | 22.6 | estimate | 243 | -319, 699 |
| w549202911 | Amaç Apartmanı | apartments | 16.4 | estimate | 242 | -621, 679 |
| w662018999 | Nehir Kız öğrenci yurdu | dormitory | 16.9 | estimate | 241 | 486, 516 |
| w549793439 | Erak Apartmanı | apartments | 17.0 | estimate | 239 | -625, 606 |
| w352580306 | İspark | garage | 3.1 | estimate | 239 | 230, 889 |
| w1321569696 | Hospitadent | dentist | 23.0 | estimate | 232 | 468, 103 |
| w1226683501 | İBB Şişli Yükseköğrenim Erkek Öğrenci Yurdu | dormitory | 36.2 | estimate | 228 | -273, -314 |
| w549793434 | Huzur Apartmanı | apartments | 19.7 | estimate | 228 | -622, 650 |
| w545747113 | Öz Harman | cafe | 16.9 | estimate | 227 | 737, -320 |
| w549202908 | Eyüp Ateş Apartmanı | apartments | 16.6 | estimate | 227 | -616, 718 |
| w728793794 | Mecidiyeköy İtfaiye İstasyonu | fire_station | 20.1 | estimate | 227 | 427, 110 |
| w549202902 | Yağar Apartmanı | apartments | 16.3 | estimate | 223 | -611, 784 |
| w549793440 | Platin Apartmanı | apartments | 20.1 | estimate | 216 | -627, 597 |
| w548990907 | Anadolu Apartmanı | apartments | 16.7 | estimate | 214 | -647, 768 |
| w548861932 | Güneş Apartmanı | apartments | 16.4 | estimate | 214 | -653, 976 |
| w548892459 | Uludağ Apartmanı | apartments | 10.0 | estimate | 209 | -644, 938 |
| w1554067441 | Meriç & Işıktutan Apartmanı | apartments | 19.8 | estimate | 204 | 210, -623 |
| w548892470 | Arzu Apartmanı | apartments | 16.6 | estimate | 202 | -634, 907 |
| w549202907 | Nimet Apartmanı | apartments | 12.9 | estimate | 201 | -615, 726 |
| w549036059 | Saadet Apartmanı | apartments | 16.3 | estimate | 199 | -653, 691 |
| w515326381 | Zoom Bahçe Cafe Restaurant | restaurant | 16.0 | estimate | 194 | 733, -245 |
| w225429956 | Dostlar Restaurant | — | 20.1 | estimate | 189 | 613, -145 |
| w549202903 | Akşit Apartmanı | apartments | 19.7 | estimate | 188 | -612, 768 |
| w549036051 | Huzur Apartmanı | apartments | 19.3 | estimate | 187 | -650, 727 |
| w549793443 | Sevim Apartmanı | apartments | 16.4 | estimate | 183 | -628, 573 |
| w549793437 | Emek Apartmanı | apartments | 16.9 | estimate | 182 | -626, 626 |
| w548990902 | Emel Apartmanı | apartments | 19.3 | estimate | 179 | -645, 823 |
| w549791176 | Yonca Apartmanı | apartments | 19.5 | estimate | 176 | -658, 604 |
| w549036063 | Yeşilli Apartmanı | apartments | 19.5 | estimate | 176 | -654, 664 |
| w549793435 | Balin Apartmanı | apartments | 13.3 | estimate | 172 | -626, 640 |
| w664469921 | Notre Dame De Lourdes Eglise Georgienne | place_of_worship | 16.5 | estimate | 167 | -731, 910 |
| w549791179 | Özler Apartmanı | apartments | 16.1 | estimate | 166 | -657, 574 |
| w548861936 | Hotel Bomonti | — | 13.6 | estimate | 166 | -648, 951 |
| w548861929 | Yeşilköşe Apartmanı | apartments | 16.8 | estimate | 165 | -672, 1011 |
| w548990904 | Dilek Apartmanı | apartments | 16.6 | estimate | 161 | -642, 802 |
| w548990899 | Berrak Apartmanı | apartments | 19.5 | estimate | 161 | -618, 803 |
| w1356638970 | Çelik İş Merkezi | commercial | 25.8 | estimate | 160 | 809, -155 |
| w549793445 | Dilek Apartmanı | apartments | 16.7 | estimate | 160 | -629, 555 |
| w1544284404 | Satış Ofisi | — | 23.1 | estimate | 159 | 809, -317 |
| w548861934 | Sebat Apartmanı | apartments | 13.6 | estimate | 157 | -651, 962 |
| w548990892 | Köşem Apartmanı | apartments | 16.9 | estimate | 156 | -625, 854 |
| w761268822 | Metamorfos Rum Kilisesi | church | 9.7 | estimate | 155 | -82, 304 |
| w548861933 | Yıldırım Apartmanı | apartments | 23.3 | estimate | 155 | -653, 969 |
| w548990898 | Filiz Apartmanı | apartments | 16.9 | estimate | 152 | -616, 814 |
| w548892461 | Başak Apartmanı | apartments | 9.8 | estimate | 147 | -638, 924 |
| w1123115163 | Sema Apartmanı | — | 19.6 | estimate | 147 | 172, 229 |
| w548755024 | Üçler Apartmanı | apartments | 19.9 | estimate | 137 | -677, 1030 |
| w548892462 | Çanakkale Apartmanı | apartments | 16.5 | estimate | 136 | -637, 918 |
| w549793442 | Işık Apartmanı | apartments | 20.0 | estimate | 134 | -630, 581 |
| w549793441 | Konak Apartmanı | apartments | 16.4 | estimate | 131 | -629, 588 |
| w548990894 | Hayat Apartmanı | apartments | 23.3 | estimate | 127 | -617, 841 |
| w549791175 | Özel Boğaziçi Erkek Öğrenci Yurdu | dormitory | 19.7 | estimate | 124 | -659, 610 |
| w548990897 | Gülnur Apartmanı | apartments | 23.0 | estimate | 124 | -616, 822 |
| w548990895 | Şirin Apartmanı | apartments | 20.0 | estimate | 123 | -617, 835 |
| w548990900 | Rüyam Apartmanı | apartments | 20.1 | estimate | 123 | -640, 843 |
| w549793438 | Cumalıoğlu Apartmanı | apartments | 22.8 | estimate | 121 | -627, 614 |
| w548990896 | Murat Apartmanı | apartments | 16.7 | estimate | 119 | -616, 829 |
| w219346242 | Gülbahar Mahallesi Muhtarlığı | public | 16.2 | estimate | 116 | 636, -496 |
| w548892468 | Varol Apartmanı | apartments | 13.7 | estimate | 115 | -632, 900 |
| w549792708 | Yalçın Apartmanı | apartments | 16.8 | estimate | 113 | -661, 565 |
| w548892460 | Refia Apartmanı | apartments | 13.7 | estimate | 113 | -642, 929 |
| w1118771190 | Mecidiyeköy Meydan Tuvaleti | toilets | 3.1 | estimate | 112 | 208, 74 |
| w549793436 | Kerim Apartmanı | apartments | 20.1 | estimate | 107 | -626, 633 |
| w548892465 | Kale Apartmanı | apartments | 13.0 | estimate | 105 | -623, 876 |
| w548892463 | Ben Türk Apartmanı | apartments | 12.9 | estimate | 96 | -635, 913 |
| w548892469 | Yiğit Apartmanı | apartments | 13.2 | estimate | 92 | -630, 895 |
| w548892467 | Tesalya Apartmanı | apartments | 13.7 | estimate | 90 | -629, 891 |
| w548861935 | Alp Apartmanı | apartments | 9.6 | estimate | 89 | -650, 957 |
| w548892466 | Berk Apartmanı | apartments | 10.3 | estimate | 87 | -623, 871 |
| w549792709 | Aydoğan Apartmanı | apartments | 10.4 | estimate | 79 | -657, 551 |
| w549202905 | R. Erdoğan Apartmanı | apartments | 6.6 | estimate | 48 | -623, 740 |
| w1465114008 | İstanbul Halk Ekmek | — | 3.6 | estimate | 9 | -163, -67 |

## Adsız ama büyük tabanlı (≥1500 m²), yüksekliği TAHMİN binalar (31)

| id | ad | tip | yükseklik (m) | kaynak | taban (m²) | x, z |
|---|---|---|---|---|---|---|
| w148461656 | — | hospital | 16.5 | estimate | 6435 | -94, 997 |
| ov6a57ca02a33d | — | — | 16.9 | estimate | 4101 | -857, 592 |
| ovefbdd0e9427e | — | — | 16.9 | estimate | 3947 | -835, 842 |
| ov1b3903618881 | — | — | 19.2 | estimate | 3638 | 840, 918 |
| ov4071e1f4cfd6 | — | — | 19.4 | estimate | 3524 | -893, -750 |
| ov191c94ca1193 | — | — | 19.8 | estimate | 3489 | -416, -827 |
| ov2fa05df3cbc3 | — | — | 16.8 | estimate | 3151 | -879, -463 |
| ovf3465bc91154 | — | — | 13.4 | estimate | 2492 | 942, 984 |
| ovc841e4015601 | — | — | 16.0 | estimate | 2335 | -534, -645 |
| w82681187 | — | — | 16.7 | estimate | 2262 | -49, -667 |
| ov01f270d6180e | — | — | 19.8 | estimate | 2231 | -751, -608 |
| ov2f77dbe541ec | — | — | 13.1 | estimate | 2211 | -730, -811 |
| ov1afdb5fbec4e | — | — | 16.8 | estimate | 2107 | -883, 689 |
| ov395355ad2197 | — | — | 13.2 | estimate | 1967 | -492, 406 |
| ovba32b4e8f18b | — | — | 19.5 | estimate | 1940 | -391, 253 |
| ov0fa8c39165f8 | — | — | 16.7 | estimate | 1875 | -735, 8 |
| ov55e7b5dabfe7 | — | — | 16.1 | estimate | 1860 | -855, -704 |
| ov4a072773a650 | — | — | 13.0 | estimate | 1749 | -614, 510 |
| ov54f4f7a6b9da | — | — | 16.2 | estimate | 1734 | -488, 692 |
| ov2cabbf62cd4b | — | — | 16.1 | estimate | 1725 | 160, -563 |
| ov5c0b1c41c55a | — | — | 13.2 | estimate | 1724 | -581, 926 |
| ova783a388ea36 | — | — | 16.4 | estimate | 1700 | -320, 440 |
| ovdb3c38b83172 | — | — | 19.3 | estimate | 1674 | -539, 396 |
| ovefe1cc1da926 | — | — | 19.8 | estimate | 1653 | 923, 414 |
| ov1ebbf25dacc1 | — | — | 16.6 | estimate | 1650 | -723, 691 |
| ov8edbf2ccd1f5 | — | — | 19.7 | estimate | 1637 | -416, 629 |
| w164329892 | — | — | 16.3 | estimate | 1617 | -92, 790 |
| ovb717f2b06706 | — | — | 20.0 | estimate | 1609 | -590, -612 |
| w1571286105 | — | — | 16.2 | estimate | 1542 | 786, 120 |
| w664469924 | — | — | 13.1 | estimate | 1540 | -839, 987 |
| ov759954e4c529 | — | — | 16.7 | estimate | 1513 | -815, -768 |

## Kat sayısından türetilen yüksek yapılar (≥45 m; ölçüm değil)

| id | ad | tip | yükseklik (m) | kaynak | taban (m²) | x, z |
|---|---|---|---|---|---|---|
| w1222286465 | Trump Residence Tower | residential | 124.8 | levels | 1358 | 56, -110 |
| w1455454989 | Trump Office Tower | office | 118.4 | levels | 958 | 46, -241 |
| w1457770436 | — | — | 115.2 | levels | 579 | 28, 570 |
| w1175523984 | — | — | 96.0 | levels | 686 | -841, 906 |
| w1572409622 | — | — | 57.6 | levels | 475 | -832, 432 |
| w1455964212 | İstanbul Adalet Sarayı Ek Bina - İcra Daireleri | office | 54.4 | levels | 824 | -252, -165 |
| w423115635 | Medianova Office | — | 51.2 | levels | 592 | 116, -117 |
| w1465114025 | — | — | 48.0 | levels | 258 | -167, -131 |
| w1465114026 | — | — | 48.0 | levels | 258 | -183, -126 |
