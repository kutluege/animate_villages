# Token defteri — orkestratör: Fable 5.2 (medium), alt ajanlar: Opus 5.5 (medium)

Değerler her alt ajanın tamamlanma bildiriminden alınmıştır (`subagent_tokens`, `tool_uses`, `duration_ms`).
Orkestratörün kendi harcaması burada yok; oturum sonunda `/cost` ile ölçülür.

| # | Tur | Ajan | Token | Araç çağrısı | Süre (sn) |
|---|-----|------|-------|--------------|-----------|
| 1 | 0 | İskelet | 115.239 | 51 | 683 |
| 2 | 0 | Veri | 155.886 | 62 | 768 |
| 3 | 1 | Simge yapılar | 274.686 | 125 | 1317 |
| 4 | 1 | Atmosfer B | 228.983 | 92 | 1335 |
| 5 | 1 | Atmosfer A | 224.178 | 70 | 1393 |
| 6 | 1 | Şehir dokusu | 278.610 | 75 | 1494 |
| 7 | 1 | Kamera/kurgu | 218.939 | 75 | 1728 |
| 8 | 1 | Denetçi 1 | 129.599 | 47 | 311 |
| 9 | 2 | Atmosfer B (devam) | 259.753 | 18 | 152 |
| 10 | 2 | İskelet (devam) | 162.022 | 56 | 477 |
| 11 | 2 | Kamera/kurgu (devam) | 271.601 | 32 | 610 |
| 12 | 2 | Simge yapılar (devam) | 373.610 | 52 | 709 |
| 13 | 2 | Veri (devam) | 195.711 | 30 | 755 |
| 14 | 2 | Şehir dokusu (devam) | 415.076 | 59 | 851 |
| 15 | 2 | Denetçi 2 | 130.130 | 42 | 429 |

Not: "(devam)" satırları aynı ajana geri gönderilen turlardır. Bu satırlardaki token değeri bildirimde gelen ham
sayıdır; yalnızca o tura mı ait yoksa ajanın o ana kadarki toplamı mı olduğu bildirimden anlaşılmıyor (araç çağrısı
ve süre o tura ait görünüyor). Kesin maliyet için `/cost` esas alınmalı.
| 16 | 3 | Veri (devam) | 207.041 | 8 | 79 |
| 17 | 3 | Atmosfer B (devam) | 291.641 | 19 | 346 |
| 18 | 3 | Şehir dokusu (devam) | 470.759 | 23 | 365 |
| 19 | 3 | Simge yapılar (devam) | 425.561 | 29 | 442 |
| 20 | 3 | Kamera/kurgu (devam) | 328.657 | 42 | 1304 |
| 21 | 3 | Denetçi 3 | 109.692 | 34 | 271 |
| 22 | 4 | Atmosfer B (devam) | 308.979 | 13 | 154 |
| 23 | 4 | Şehir dokusu (devam) | 545.203 | 29 | 498 |
| 24 | 4 | Kamera/kurgu (devam) | 375.469 | 33 | 914 |
| 25 | 4 | Şehir dokusu (rötuş) | 574.591 | 20 | 214 |
| 26 | 4 | Denetçi 4 (final MP4) | 71.064 | 18 | 102 |
| 27 | 5 | Kamera/kurgu (rötuş + yeni tur) | 436.353 | 38 | 969 |
| 28 | 5 | Simge yapılar (Cevahir) | 494.870 | 28 | 408 |
| 29 | 5 | Denetçi 5 (50 sn final MP4) | 84.978 | 28 | 144 |
| 30 | 5 | Simge yapılar (Cevahir çatı rötuşu) | 515.069 | 10 | 128 |
| 31 | 5 | Kamera/kurgu (rötuş) | 454.923 | 11 | 401 |

## Özet
- 12 ayrı alt ajan (7 üretici, 5 denetçi; atmosfer A yalnızca 1. turda), 31 çalıştırma, 5 üretim turu + rötuşlar.
- Her ajanın **ilk** bildirimindeki değerlerin toplamı: üreticiler 1.496.521 + denetçiler 525.463 = 2.021.984 token.
- Devam/rötuş satırlarının ham toplamı 7.106.889. Bu değerler büyük olasılıkla ajanın o ana kadarki toplamını
  gösterdiği için doğrudan toplanması harcamayı olduğundan büyük gösterir.
- Değerler kümülatifse (her ajanın son bildirimi = o ajanın toplamı): üreticiler 2.446.803 + denetçiler 525.463 =
  **2.972.266 token**. Kümülatif değilse üst sınır 2.021.984 + 7.106.889 = 9.128.873.
- Orkestratörün kendi harcaması bu defterde yok. Kesin karşılaştırma için `/cost`.
