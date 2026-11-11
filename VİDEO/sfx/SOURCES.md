# sfx/ kaynakları

Tüm dosyalar `tools/make-sfx.mjs` ile **kodla sentezlendi** (tohumlu gürültü + biquad filtre + küçük Schroeder yankısı;
dışarıdan örnek yok). Lisans: projeye ait, serbest kullanım. Yeniden üretmek: `node tools/make-sfx.mjs` (aynı çıktı).
Biçim: 48 kHz, 16 bit, stereo WAV. Tepe düzeyleri `gain: 1` iken -15 LUFS seslendirmeye göre ayarlı.

| ad | süre | ne zaman |
|---|---|---|
| whoosh / whoosh-short | 1.0 / 0.7 sn | geçiş, kart kayması (soldan sağa stereo) |
| pop | 0.4 | küçük öğe belirmesi, etiket |
| tick | 0.2 | arayüz tık'ı, sayaç adımı |
| type-1/2/3, typing | 0.2 / 1.7 | daktilo/klavye; tek tuş ya da kısa yazma dizisi |
| shutter | 0.5 | fotoğraf deklanşörü |
| polaroid | 1.0 | deklanşör + baskı çıkarma motoru |
| drop | 0.5 | kart/kâğıt yere düşer |
| thud / hit | 1.1 / 2.6 | yumuşak darbe / sinematik vuruş (büyük açılış) |
| riser / riser-long | 2.1 / 3.6 | yükselen gerilim; ses dosyanın ~%70'inde kesilir, kuyruk yankı |
| swell | 1.4 | ortaya çıkıştan hemen önce kabaran hava (bitişi = vuruş anı) |
| chime | 2.7 | onay çınlaması (iki nota) |
| ping | 1.5 | tek yumuşak nota |
| glitch | 0.7 | dijital bozulma ("saçmalama") |

Yeni ses indirirsen: yalnızca CC0 / açık serbest lisans; buraya URL, yazar, lisans satırı ekle.

## anlatim-* (baglam / ekip / maresal / dongu sahneleri)

`comp/assets/baglam/make-anlatim-sfx.mjs` ile **kodla sentezlendi** (tohumlu; dışarıdan örnek yok). Lisans: projeye ait, serbest kullanım.
Yeniden üretmek: `node comp/assets/baglam/make-anlatim-sfx.mjs`.

| ad | süre | ne zaman |
|---|---|---|
| anlatim-stretch | 1.1 | gerilen balon gıcırtısı ("bağlam şişer") |
| anlatim-crack | 0.8 | çatlama tıkları (kutu çatlar) |
| anlatim-scan | 1.1 | yumuşak tarama tonu (ajan kare üstünde çalışır, model kareye bakar) |
| anlatim-paper | 0.5 | kâğıt hışırtısı (rapor) |
| anlatim-flag | 0.7 | flama şaklaması (başkomutan) |
| anlatim-stamp | 1.1 | ağır damga vuruşu (mareşal rozeti) |
| anlatim-march | 1.1 | dört kısa trampet vuruşu (ordular ilerler) |
| anlatim-reel | 1.8 | hızlanan film makarası ("kare kare") |
| kapanis-counter | 0.95 | sayaç: hızlı başlayıp yavaşlayan, perdesi yükselen tıkırtılar ($90 / $150 rakamı otururken) — `node sfx/kapanis-make.mjs` |
| kapanis-curtain | 1.25 | perde: yumuşak hava kabarması (final çerçeveleri açılırken) — `node sfx/kapanis-make.mjs` |
