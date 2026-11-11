# Müzik kaynakları ve lisanslar

İndirme tarihi (üçü için): **11 Kasım 2026**. Dosyalar `muzik/kaynak/` altında; yalnızca ffmpeg ile ses olarak açıldı.
Kullanım yeri: videonun 0–119,95 sn arası (anlatım bölümü), seslendirmenin altında. 120,07 sn'den sonra müzik yok.

| # | Parça | Sanatçı | Kaynak URL | Lisans | Lisans sayfası |
|---|---|---|---|---|---|
| 1 | Galactic Rap (2:22, 120 bpm, ISRC USUAN2300009) | Kevin MacLeod | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Galactic%20Rap.mp3 (katalog: https://incompetech.com/music/royalty-free/music.html) | CC BY 4.0 | https://creativecommons.org/licenses/by/4.0/ · sanatçının lisans sayfası https://incompetech.com/music/royalty-free/licenses/ |
| 2 | Deep Haze (2:02, 120 bpm, ISRC USUAN1100886) | Kevin MacLeod | https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deep%20Haze.mp3 | CC BY 4.0 | https://creativecommons.org/licenses/by/4.0/ · https://incompetech.com/music/royalty-free/licenses/ |
| 3 | Roof Tops (3:34, 80 bpm; albüm "Summer Air (Lo-fi)") | HoliznaCC0 | https://freemusicarchive.org/music/holiznacc0/summer-air-lo-fi/roof-tops/ | CC0 1.0 (kamu malı adanması) | https://creativecommons.org/publicdomain/zero/1.0/ |

SHA-256: `kmac-galactic-rap.mp3` dbf1de02e2a109c551eb9df55c79c7c6118fb297411a02eb07abca654b571863 ·
`kmac-deep-haze.mp3` 3773f35d30769b56d83e5b86767e0a77cd721f2b35c564ebddde49d0bdac81dc ·
`holizna-roof-tops.mp3` f6e619fbfdc0898c409494d5c810d34d9cd29be2b75bb2d8c197e1edb37155b5

## Lisans metinlerinden okunanlar
- **Kevin MacLeod / incompetech (1, 2):** Lisans sayfası: "Creative Commons – Free. No charge. Requires that you credit the music."
  SSS: YouTube videolarında kullanım serbest, para kazanılabilir; "for something else? Probably. Be sure to credit me". Atıf
  "izleyicinin görebileceği yerde" olmalı (açıklama metni yeterli). CC BY 4.0 ticari kullanıma ve değiştirmeye (kesme, döngü, miks)
  izin verir; değişiklik yapıldığı belirtilmelidir (atıf satırında var). Instagram ayrıca adıyla anılmıyor; CC BY 4.0 mecra sınırı koymaz.
- **HoliznaCC0 (3):** FMA parça sayfası: "Roof Tops by HoliznaCC0 is licensed under a CC0 1.0 Universal License." CC0'da atıf zorunlu değil
  (yine de nezaketen verilebilir), ticari kullanım ve değiştirme serbest.

## Videonun açıklamasına konacak atıf satırları
Seçenek 1 seçilirse:
```
Müzik: "Galactic Rap" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
(kesilip videoya göre düzenlendi)
```
Seçenek 2 seçilirse:
```
Müzik: "Deep Haze" Kevin MacLeod (incompetech.com)
Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/
(kesilip videoya göre düzenlendi)
```
Seçenek 3 seçilirse (atıf zorunlu değil; istenirse):
```
Müzik: "Roof Tops" — HoliznaCC0 (CC0 / kamu malı), freemusicarchive.org
```

## Otomatik telif eşleştirmesi (dürüst not)
Lisans uygun olsa da Instagram/Meta'nın otomatik eşleştirmesi bir parçayı yanlışlıkla işaretleyebilir (üçüncü kişiler serbest parçaları
kendi kayıtlarına katıp sistemlere yükleyebiliyor). Bunu garanti edemem. İşaretlenirse itirazda kullanılacaklar: yukarıdaki kaynak ve lisans
URL'leri, Kevin MacLeod parçaları için ISRC numaraları (incompetech SSS'si bunu önerir), Roof Tops için FMA'daki CC0 sayfası.
CC0 parçalar yeniden yüklemeye en açık olanlardır; Kevin MacLeod parçaları çok yaygın kullanıldığından yanlış eşleşme raporları bilinir.

## Denenen / elenen kaynaklar
- **Pixabay Music:** sayfa 403 döndü (bot engeli), kullanılmadı.
- **Scott Buckley (CC BY 4.0, sinematik):** site otomatik istemciye 406 döndü; engel aşılmaya çalışılmadı, kullanılmadı.
- **Free Music Archive:** Chris Zabriskie, Kai Engel, Lee Rosevere sayfaları 404 (arşivden kalkmış); HoliznaCC0 erişilebildi.
- **Openverse API** (CC0/CC BY süzgeçli): sonuçlar çoğunlukla Jamendo, açıklaması zayıf; kullanılmadı.
- İndirilip ölçülen ama seçilmeyenler (dosyaları silindi): Kevin MacLeod "Rising Tide", "The Escalation" (iç tempo değişiyor; kurgu
  için uygun değil), "Late Night Radio", "Floating Cities"; HoliznaCC0 "Walking Away", "Tranquil Mindscape", "Shimmer",
  "When Time Called Me Darling".

## Kurgu (parça zamanı ↔ video zamanı; ölçümle belirlendi, ayrıntı `tools/muzik.mjs` başında)
- 1 Galactic Rap: parça baştan çalar (video t = parça t). Ton değişimi (≈95,9 sn) "Bana göre kazanan açık:" sonrasına düşer.
- 2 Deep Haze: 0–41,95 parça 0–41,95; 41,95'te parça 25,95'e döner (16 sn = 8 ölçü atmosferik giriş tekrarı, 60 ms çapraz geçiş,
  ölçü başı vuruşundan hemen önce). Video t ≥ 41,95 → parça t − 16.
- 3 Roof Tops: parça 2,98 sn'den başlar (video t = parça t + 2,98; ölçü ızgarasına oturur).
- Üçünde de 117,6 → 119,95 sn kosinüs söniş; 120,07 sn'den sonra dijital sıfır.
