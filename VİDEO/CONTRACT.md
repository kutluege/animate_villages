# CONTRACT — Instagram içerik videosu ("Mecidiyeköy'ü Claude ile kod yazarak kurdum")

Her ajan işe başlamadan önce bu dosyayı okur. Arayüzü değiştirmen gerekiyorsa değiştirme; raporunda öner.

## 1. Çıktı
- `VİDEO/out/icerik.mp4`: dikey 1080×1920, 30 fps, H.264 yuv420p, AAC ses, +faststart.
- Yapı: **A bölümü** = seslendirmeli anlatım (7 ses kaydı art arda, ~130 sn; altyazı + grafik + ses efekti, müzik YOK).
  **B bölümü** = sonuç (~30–35 sn, **tamamen sessiz**; kullanıcı müziği sonradan ekleyecek): önce iki ekibin videosu
  yan yana etiketli kıyas (8–10 sn), sonra Fable ekibinin videosundan en iyi 20–25 sn tam ekran. Son kare kapak olur.
- İzleyici: Instagram Reels, Türkçe, telefon. Üst 220 px ve alt 420 px arayüzle kapanır; önemli yazı oraya konmaz.

## 2. Kaynaklar (salt okunur; kopyala, değiştirme)
- Ses: `VİDEO/1.mp3 … 7.mp3` (sırayla). Metnin aslı: `VİDEO/SCRIPT.md` (ses kaydı esas; metinden sapabilir).
- Harita (açılış): `C:\Users\USER\Desktop\ege_repolar\animate_villages2\out\shots\data_overview.png` (topografyalı),
  `data_overview_core.png` (çekirdek kroki). Pembe alanların adları o klasörün `data/` verisinden **doğrulanır**.
- Fable ekibinin videosu (kazanan): `out/final/mecidiyekoy.mp4` (48,5 sn). Opus ekibinin videosu:
  `C:\Users\USER\Desktop\ege_repolar\animate_villages2\out\final\mecidiyekoy.mp4` (40 sn).
- Süreç kareleri: `out/compare/`, `out/critic1..5/`, `out/edit/`, `out/orch4/`, `out/orch6/` (ör. tur 1→tur 5 gelişimi,
  kontak tabakaları, A/B atmosfer kıyası). Kullanıcının istediği polaroidler: `out/compare/b/b-video-8_0s.png`,
  `out/critic5/full-20.png`, `out/critic3/full/b-genel-2130.png`, `out/critic2/b-bati-1845.png`. Güzel duranı seç.
- Gerçek ekip yapısı: orkestratör + iskelet, veri, şehir dokusu, simge yapılar, atmosfer A/B, kamera-kurgu ajanları
  + her turdan sonra kod yazmamış bağımsız denetçi (ekran görüntülerine bakıp en büyük üç kusuru raporlar). Uydurma rakam yok.

## 3. Teknik çatı (iskelet ajanı kurar)
```
VİDEO/CONTRACT.md, SCRIPT.md
VİDEO/work/voice.wav            7 kaydın art arda birleşimi (aralarında kısa nefes payı olabilir)
VİDEO/work/transcript.json      kelime düzeyi zamanlar (voice.wav saatine göre), elle düzeltilmiş Türkçe yazım
VİDEO/work/timeline.json        sahneler: [{ id, start, end, owner }] — sınırlar transkriptteki cümlelere göre
VİDEO/comp/index.html           1080×1920 sahne; ?render=1 ; window.__ready, window.__renderFrame(t), window.__duration
VİDEO/comp/src/main.js          sahne yükleyici + altyazı katmanı (iskelet)
VİDEO/comp/src/scenes/<id>.js   export function create(ctx) → { el, update(tLocal, tGlobal), sfx?: [{ t, name, gain? }] }
VİDEO/comp/assets/              sahnelerin görselleri (kendi alt klasörün: assets/<id>/)
VİDEO/sfx/                      ses efektleri (wav) + SOURCES.md
VİDEO/tools/render.mjs          kare kare Playwright + ffmpeg; --draft (540×960, 15 fps), --from/--to
VİDEO/tools/mix.mjs             voice.wav + sahnelerin sfx ipuçları → work/audio.wav ; B bölümü sessiz
VİDEO/out/                      kareler, taslaklar, icerik.mp4 ; ekran görüntülerin out/<ajan>/ altına
```
- Determinizm: her kare yalnızca `t`'nin saf fonksiyonu. CSS animation/transition, rAF, `Date`, `Math.random` görseli
  süremez; her şey `update(t)` içinde hesaplanır. Video öğeleri `currentTime` ile sürülmez: kaynak videolardan
  ffmpeg ile kare dizisi (jpg) çıkar, kare numarasıyla göster.
- Headless tarayıcı ve sunucu için üst projedeki `tools/lib-browser.mjs`, `tools/serve.mjs` örnek alınabilir
  (kopyala; üst projenin dosyalarını değiştirme). Klasör adında `İ` var: yolları tırnakla, kodda göreli yol kullan.
- Yazı tipi yerel dosya (CDN yok). Tek ortak görsel dil: `comp/src/theme.js` (renk, yazı tipi, yumuşatma eğrileri,
  güvenli alan sabitleri) — iskelet ajanı yazar, sahne ajanları kullanır.
- Ses efektleri: her sahne `sfx` ipuçlarını kendi verir; ad `VİDEO/sfx/<name>.wav`. Serbest lisanslı indirilir ya da
  kodla sentezlenir; kaynak ve lisans `sfx/SOURCES.md`'ye yazılır. İnternetten alınan her fotoğraf için de
  `comp/assets/<id>/SOURCES.md` (URL, yazar, lisans). Lisansı belirsiz içerik kullanılmaz.

## 4. Sahneler (kesin sınırlar timeline.json'da)
| id | Söylenen | Ekranda |
|---|---|---|
| `hook` | "Burası neresi? Tanıyabildiniz mi?" | Topografya haritası; pembe alanlar tek tek parlar, adları ekrana yazılır |
| `gercek` | "…yüz binlerce insanın geçtiği Mecidiyeköy" | Gerçek Mecidiyeköy fotoğrafları (serbest lisans), hafif hareket |
| `vaat` | "…Claude kullanarak, tamamen kod yazarak… sonuna kadar kalın" | Polaroid çerçeveli kareler ikişer ikişer düşer |
| `baglam` | "tek bir sohbette… bağlam şişer… saçmalamaya başlar" | Şişen bağlam metaforu |
| `ekip` | "bir ekip kurdum… yönetici işi böldü… kısa rapor" | Görev dağılımı animasyonu; ajanlar sahne kareleri üzerinde çalışıyor |
| `maresal` | "işi bölün… mareşal… ordular" | Mareşal ve ordular benzetmesi |
| `dongu` | "kare kare üreterek… kendi ürettikleri kareleri inceleyerek" | Üret → bak → düzelt döngüsü, gerçek tur 1→5 kareleriyle |
| `senaryo` | "iki farklı senaryo… Opus general/Fable asker… tam tersi" | İki kadro karşı karşıya |
| `sonuc` | "kazanan… Fable'ın yönettiği ekip… 90 dolar… 150 dolar" | Kazanan + maliyet (rakamlar ses kaydındaki gibi) |
| `final` | (sessiz) | Yan yana kıyas, sonra Fable videosundan en iyi 20–25 sn |

## 4b. Görsel yön (kullanıcı kararı)
Bütün video açılıştaki haritanın (`animate_villages2/out/shots/data_overview.png`) dünyasında geçer: koyu yosun/orman
yeşili topografya zemini, ince eş yükselti çizgileri, gri bina izleri, krem-sarı yollar, pembe (magenta) vurgu; ikincil
vurgular haritadaki turuncu-kırmızı hat, camgöbeği, mavi. Lacivert/siyah şablon görünümü yok.
- Tüm sahnelerin arkasında ortak, prosedürel, çok yavaş kayan bir topografya fonu vardır (çatı çizer). Sahne kökü
  opak düz renkle boyanmaz (tam ekran harita/fotoğraf/video anları hariç).
- Renkler yalnız `theme.js` belirteçlerinden. Kartlar, etiketler, çerçeveler kartografik dilde (koordinat işareti,
  ince çerçeve, lejant). Benzetmeler (görev dağılımı, mareşal/ordular, iki kadro) harekât haritası üstünde kurulur.
- Ölçü: "cidden profesyonel ve güzel duran bir iş".

## 5. Ajan raporu
En fazla 150 kelime: ne yaptın, hangi dosyalar, neyi **doğrulayamadın**. Ham veri/uzun kod yapıştırma.
Git commit/push'u orkestratör yapar. Yalnızca kendi dosyalarına yaz.
