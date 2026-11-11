# Fon müziği: üç seçenek

Dosyalar: `muzik-1.mp4`, `muzik-2.mp4`, `muzik-3.mp4` (1080×1920, 152,07 sn; görüntü `out/icerik.mp4`'ten `-c:v copy` ile alındı) ·
yalnız ses: `muzik/miks-1.wav` … `miks-3.wav` (48 kHz, 24 bit) · yalnız müzik yolu: `muzik/ara/muzik-N-yalniz.wav` ·
yeniden üretmek için: `node tools/muzik.mjs --secenek 1` (ana video yeniden render edilirse aynı komutla tekrar bindirilir).
Müzik 117,6 sn'de sönmeye başlar, 119,95'te biter. 120,07 sn'den sonrası dijital sıfır; o bölümün müziğini siz ekleyeceksiniz.

> **Dürüst not:** Ben sesi dinleyemiyorum. Seçimler; besteci açıklamalarına, lisans sayfalarına ve ölçümlere (tempo/vuruş ızgarası,
> zaman içinde RMS ve K-ağırlıklı yükseklik, bas oranı, spektral ağırlık merkezi, kroma) dayanıyor. Parçaların vokalsiz olduğu katalog
> bilgisine (enstrüman listesi) göre; kulakla doğrulanmadı. Son karar kulağınızın.

## 1. "Galactic Rap" — Kevin MacLeod (CC BY 4.0): meraklı, minimal elektronik nabız
120 bpm'lik sentezleyici ve perküsyon grubu. Kendini tekrar eden, gizemli ama rahat bir nabız. Besteci parçayı "%98 seslendirme dostu"
diye tanımlıyor. Açılışta müzik boğuk ve uzaktan gelir: alçak geçiren süzgeç 0–5,6 sn'de açılır (bilmece hissi verir), "Evet, burası… Mecidiyeköy"
cümlesiyle tam açılır. Parçanın kendi ton değişimi (≈95,9 sn) "Bana göre kazanan açık:" cümlesinden hemen sonraya düşer. Bunun üstüne
84–95,5 sn arasında +2 dB yükseliş var. En düz ve en güvenli seçenek bu: anlatımı hiç zorlamaz, ama yükselişi en az hissedilen de bu.

## 2. "Deep Haze" — Kevin MacLeod (CC BY 4.0): sinematik, gerilim kuran
120 bpm'lik "boş, ileri akan" atmosfer, gitar ve vurmalılar. Besteci "sürekli ama yavaş yükselir" diyor. Videoya göre kurgulandı: atmosferik giriş
16 sn (8 ölçü) uzatıldı, böylece vurmalılar "Peki… modeller nasıl yapıyor?" (≈63 sn) civarında giriyor. Tepe ≈88–112 sn'ye, yani iki kadronun
tanıtımına ve hükme oturuyor. Parça kendiliğinden ≈113 sn'de, maliyet cümlesinde ("…150 dolara yaptı") geri çekiliyor ve havada kalan
ses dokusuyla sönüyor. Anlatımın enerji eğrisine en çok uyan seçenek bu. Ölçümlere göre müzik sahne sahne −36,5 LUFS'ten −29,7 LUFS'e yükseliyor.

## 3. "Roof Tops" — HoliznaCC0 (CC0): sıcak, modern lo-fi
80 bpm, bas ağırlıklı (spektral ağırlık merkezi ≈190–250 Hz, konuşma bandının altında), yumuşak lo-fi davul. Açılışta yalnız akorlar duyulur,
davul "Evet, bu güzel ve kaotik semt…" (9,0 sn) ile girer. Mareşal sahnesinin sonunda (57–69 sn) parçanın kendi arası var; "Peki…"
sorusu orada nefes alır. Sonra davul döner ve parça hükme doğru dolgunlaşır: en yüksek sahne `sonuc` (−29,6 LUFS). Üçünün içinde en sıcak ve
en "sosyal medya" tınılı olanı bu; gerilimi en az olanı da bu.

## Öneri
**Seçenek 2 (Deep Haze).** Hikâyenin kurgusuyla (sakin bilmece → süreç → iki kadro → hüküm → sayılar → veda) ölçülen enerji eğrisi en iyi
örtüşen seçenek bu, ve parçanın kendi sönüşü son cümleye denk geliyor. Daha düz ve riski en düşük bir alt yazı yatağı isterseniz Seçenek 1'i seçin.

## Ölçüm tablosu
Ses − müzik farkı: konuşma süren 400 ms pencerelerde K-ağırlıklı anlık yükseklik farkı. "Efekt − müzik": tahmini efekt yolunun
(audio.wav − ses) yüksek olduğu anlar.

| | 1 Galactic Rap | 2 Deep Haze | 3 Roof Tops |
|---|---|---|---|
| Bütünleşik yükseklik (wav / mp4) | −14,0 / −14,0 LUFS | −14,0 / −14,0 LUFS | −14,0 / −14,0 LUFS |
| Gerçek tepe (wav / mp4) | −1,8 / −1,8 dBTP | −1,8 / −1,8 dBTP | −1,8 / −1,9 dBTP |
| Kırpılan örnek | 0 | 0 | 0 |
| Konuşmada ses − müzik, ortanca (p10–p90) | 18,0 dB (10,8–22,1) | 18,0 dB (11,1–22,5) | 18,0 dB (10,6–23,5) |
| Sahne ortancalarının aralığı | 16,6–18,9 dB | 16,0–22,1 dB | 17,4–21,9 dB |
| Boşlukta ses ortancası − müzik | 15,6 dB | 14,3 dB | 15,5 dB |
| Efekt − müzik (ortanca) | +8,7 dB | +9,0 dB | +9,2 dB |
| Sınırlayıcı (çalıştığı süre / en çok kısma) | 0,98 sn / 0,32 dB | 1,3 sn / 0,60 dB | 0,06 sn / 0,02 dB |
| Müzik yükseklik eğrisi (hook → sonuc) | −31,2 → −30,4 LUFS | −33,1 (gercek −36,5) → senaryo −29,7 / sonuc −30,5 | −35,2 → −29,6 LUFS |
| 120,07 sn sonrası (wav / mp4) | 0 / 0 | 0 / 0 | 0 / 0 |
| AAC bit hızı | 320k¹ | 192k | 256k¹ |

¹ ffmpeg'in AAC kodlayıcısı 192 kbps'de bu miksteki bir geçişte +2,9 dBTP taşma üretti (wav'da yok). Betik, tepeyi −1,5 dBTP altında tutan
ilk bit hızını seçer. Seslendirmenin p10 değeri düşük, çünkü sesin kendi dinamiği geniş: konuşmanın en sessiz %10'u ortancadan 6,3 dB aşağıda.
Müzik ortanca düzeyde sabit tutulur, hecelerle pompalanmaz.

## Lisans özeti ve atıf
- **1 ve 2 (Kevin MacLeod):** CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/. Ticari kullanım ve düzenleme serbest; **atıf zorunlu**
  ve izleyicinin görebileceği yerde olmalı. Açıklamaya şunu ekleyin:
  - `Müzik: "Galactic Rap" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/ (kesilip düzenlendi)`
  - `Müzik: "Deep Haze" Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 — https://creativecommons.org/licenses/by/4.0/ (kesilip düzenlendi)`
- **3 (HoliznaCC0):** CC0 1.0 (kamu malı) — https://creativecommons.org/publicdomain/zero/1.0/. Atıf gerekmez; istenirse:
  `Müzik: "Roof Tops" — HoliznaCC0 (CC0), freemusicarchive.org`
- Instagram'ın otomatik eşleştirmesi lisanslı parçaları bile ara sıra yanlışlıkla işaretleyebilir; bunu garanti edemem. Kaynak URL'leri,
  ISRC'ler ve itiraz notları `muzik/SOURCES.md`'de.
