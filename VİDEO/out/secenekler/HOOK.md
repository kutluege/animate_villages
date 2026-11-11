# Açılış (hook) seçenekleri

Her video: 1080×1920, 30 fps, 0–10 sn (seçeneğin hook'u 0–5,57 + mevcut `gercek` sahnesi + `vaat`ın ilk yarım saniyesi), seslendirme ve o seçeneğin efektleri, ana videonun miks kuralıyla (`tools/mix.mjs`) karıştırıldı. Karşılaştırma için `hook-mevcut.mp4` aynı yoldan üretildi.
Kesmeler `voice.wav`'daki gerçek hece başlarına göre ayarlandı: "mi?" ~1,57'de biter, "Bir" 2,77'de, ikinci "Burası" 4,03'te başlar ("tanıdık." ~4,75'te biter). Transkriptte bu ikinci "Burası" 3,41 olarak geçiyor, yani kayıttan 0,6 sn önce.

## A — KURGU (`hook-A.mp4`)
- **Fikir:** Her kelimede bir kesme var. "Burası" Trump Towers'a, "neresi?" Torun Center'a, "Tanıyabildiniz" Cevahir AVM'ye kesiyor. Bunlar sıkı yakın planlar; pembe kütleler yükseklikleri ve gölgeleriyle çiziliyor ve kelime ekranın üstünde dev puntoyla duruyor. "mi?"de kamera hareket bulanıklığıyla geri fırlıyor ve üç alan birlikte görünüyor. Sessiz arada üç pembe ad plakası 0,34 sn arayla damga gibi çakılıyor. "Bir dakika ya." ve "Burası çok tanıdık." birer atlama kesmesi; son kesme Trump Towers'a dönüyor (`gercek`in ilk fotoğrafı da Trump Towers).
- **İlk kare:** Trump Towers'ın yakın planı, üstte dev "BURASI", köşelerde çekim künyesi (01 / 03 ve koordinat).
- **Ses:** Her kesmede kuru, sıkı bir vuruş (`hook-a-cut`). Geri fırlamada kısa bir emme (`hook-a-whip`), ardından iniş vuruşu (`hook-a-impact`). Üç plakada yükselen üç notalı damga (`hook-a-stamp-1/2/3`). `gercek`e geçişte yine emme sesi kullanılıyor.

## B — TEK PLAN (`hook-B.mp4`) — önerilen
- **Fikir:** Tek, kesintisiz bir kamera hamlesi. Video Trump Towers'ın kulelerine çok yakından, tepeden başlıyor; kuleler perspektifle kameraya doğru uzanıyor. Kamera soru boyunca dönerek geri çekiliyor ve "mi?" bitince (1,56) duruyor. Tam o anda üç pembe alan birden parlıyor ve halka dalgaları yayılıyor: tek güçlü vuruş. Sessiz arada adlar ince çağrı çizgileriyle süzülerek açılıyor. "tanıdık."tan sonra kamera Trump Towers'a dalıyor; `gercek`in ilk fotoğrafı (Trump + viyadük) tam o anda düşüyor.
- **İlk kare:** Soyut, "bu ne?" dedirten pembe kuleler ve gölgeleri; üstte "Burası neresi?".
- **Ses:** 1,55 sn'lik tek yükselen ton (`hook-b-rise`): oktav kayan tını, hızlanan titreşim ve açılan hava. Sonu tek bir vuruşa kesiliyor (`hook-b-boom`): telefon hoparlöründe de duyulsun diye doyurulmuş bas, uzun yankılı kuyruk. Adlarda ince çan parıltısı var (`hook-b-glint`), dalışta kabaran hava (`hook-b-dive`).

## C — TESPİT (`hook-C.mp4`)
- **Fikir:** Harita bir keşif ekranına dönüşüyor. Dönen tarama kolunun geçtiği yer bir an aydınlanıyor; ekranda mesafe halkaları, arayan üç nişangâh ve akan koordinatlar var. Kol pembe bir alanın üstünden geçtiğinde "temas" sesi geliyor. Sessiz arada nişangâhlar sırayla kilitleniyor ve adlar ile eşleşme yüzdesi okunuyor. "Bir dakika ya." ile nirengi çizgileri çiziliyor ve koordinatlar oturuyor. "tanıdık."ta "EŞLEŞME BULUNDU" çıkıyor; yer adı söylenmiyor, cevabı `gercek` veriyor.
- **İlk kare:** Koyulaştırılmış harita, tarama kolu ve ışık izi, KONUM ARANIYOR göstergesi, koordinat ve "Burası neresi?".
- **Ses:** Kolun her turunda bir tarama sesi (`hook-c-sweep`), temas bip'i (`hook-c-blip`), kilitte üç yükselen bip ve tık (`hook-c-lock`), veri tıkırtısı (`hook-c-data`) ve eşleşmede onay akoru (`hook-c-match`).

## Seçilen seçeneği ana videoya takma
1. `comp/src/scenes/hook.<a|b|c>.js` dosyasının içeriğini `comp/src/scenes/hook.js` yerine koyun. Eski hâli yedekte tutun; başka hiçbir sahne `hook.js`'ten bir şey içe aktarmıyor.
2. Şu dosyalar yerinde kalmalı:
   - `comp/src/scenes/hook.kit.js`: ortak harita, kamera ve 3B pembe yapılar.
   - `comp/assets/hook-lab/` (L1/L2 yakın plan karoları + `levels.json`): `node tools/hook-lab-map.mjs` ile yeniden üretilir; `animate_villages2` verisini salt okur.
   - `comp/assets/hook/map.jpg` ve `map.json`: mevcut dosyalar.
3. Gereken sfx dosyaları (`node tools/hook-lab-sfx.mjs` ile yeniden üretilebilir):
   - A: `hook-a-cut`, `hook-a-whip`, `hook-a-impact`, `hook-a-stamp-1`, `hook-a-stamp-2`, `hook-a-stamp-3`
   - B: `hook-b-rise`, `hook-b-boom`, `hook-b-glint`, `hook-b-dive`
   - C: `hook-c-sweep`, `hook-c-blip`, `hook-c-lock`, `hook-c-data`, `hook-c-match`
4. Değişiklik yalnız `hook` sahnesinin ve ona bağlı karelerin (0–10 sn) yeniden çizilmesini gerektirir. Bunun için `node tools/render.mjs` çalıştırın; render aracı değişen sahneyi kendisi algılar. `hook.kit.js` sahne özetine girmediği için, yalnız o dosya değişirse `--from 0 --to 10.1 --fresh` gerekir.
- Deneme ortamı: `comp/hook-lab.html?hook=b` (önizleme), `node tools/hook-lab.mjs shot|check|render --v b`.

## Ölçümler
- Miks: konuşma üstünde efekt−ses farkının ortancası −12,9 / −13,4 / −12,9 dB (A / B / C). Kural dışı ipucu yok. Master −14 LUFS, gerçek tepe −1,8 dBTP (kırpılma yok).
- Determinizm (`check`): A ve C bit düzeyinde aynı çıktı. B'de bir karede GPU yuvarlaması kadar fark var (PSNR 65 dB, gözle görülmez).
