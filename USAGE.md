# USAGE — alt ajan token defteri

Değerler ajan tamamlanma bildiriminden alınır; bildirimde yoksa "yok".

| # | rol | tur | subagent_tokens | tool_uses | duration_ms |
|---|-----|-----|-----------------|-----------|-------------|
| 1 | iskelet | 1 | 82522 | 25 | 349976 |
| 2 | veri | 1 | 155721 | 18 | 728734 |
| 3 | simge yapılar | 1 | 179999 | 61 | 927696 |
| 4 | atmosfer B | 1 | 243668 | 95 | 2044089 |
| 5 | atmosfer A | 1 | 240671 | 84 | 2081973 |
| 6 | şehir dokusu | 1 | 317456 | 99 | 2150554 |
| 7 | kamera-kurgu | 1 | 309821 | 69 | 2527913 |
| 8 | denetçi | 1 | 108707 | 26 | 182065 |
| 9 | iskelet | 2 | 87989 | 4 | 68037 |
| 10 | atmosfer B | 2 | 273616 | 13 | 295776 |
| 11 | simge yapılar | 2 | 226414 | 21 | 340135 |
| 12 | şehir dokusu | 2 | 398502 | 29 | 610702 |
| 13 | kamera-kurgu | 2 | 365589 | 20 | 640806 |
| 14 | denetçi | 2 | 157537 | 19 | 217809 |
| 15 | simge yapılar | 3 | 241287 | 6 | 92095 |
| 16 | atmosfer B | 3 | 298863 | 15 | 465701 |
| 17 | kamera-kurgu | 3 | 404279 | 16 | 668356 |
| 18 | şehir dokusu | 3 | 472928 | 40 | 1236174 |
| 19 | denetçi | 3 | 185505 | 9 | 196914 |
| 20 | kamera-kurgu | 4 | 446089 | 22 | 534940 |
| 21 | kamera-kurgu | 5 | 469331 | 13 | 418530 |
| 22 | denetçi | 4 | 213959 | 12 | 118236 |
| 23 | simge yapılar | 4 | 271329 | 15 | 243643 |
| 24 | şehir dokusu | 4 | 520722 | 26 | 418591 |
| 25 | kamera-kurgu | 6 | 531495 | 23 | 631127 |
| 26 | denetçi | 5 | 257563 | 13 | 145436 |
| 27 | kamera-kurgu | 7 | 561449 | 14 | 459093 |
| 28 | denetçi | 6 | 286930 | 9 | 75516 |

Satır 23–28: kullanıcının ilk nihai videodan sonraki geri bildirimiyle yapılan yeniden kurgu
(40 sn, uzun alacakaranlık, mezarlık + Cevahir, yol üstü binaların süzülmesi).

## Toplam

- Satır (ajan çağrısı / tur girişi): **28** (ilk teslime kadar 22; ilk teslimdeki toplamlar: 5 880 453 token, 716 araç çağrısı, 16 897 211 ms)
- Ayrı ajan sayısı: **8** (iskelet, veri, şehir dokusu, simge yapılar, atmosfer A, atmosfer B, kamera-kurgu, denetçi)
- Tur sayısı: **3** tam üretim turu + kamera-kurgu için 2 bitiş turu (rötuş + yeniden kodlama) + geri bildirim sonrası **1** üretim turu ve 1 kamera rötuşu; **6** denetim turu
- subagent_tokens, satırların düz toplamı: **8 309 941**
- tool_uses toplamı: **816**
- duration_ms toplamı: **18 870 617** (ajanlar paralel çalıştığı için duvar saati değil)

Not (orkestratörün yorumu, bildirimde yazmıyor): aynı ajana geri gönderilen turlarda
`subagent_tokens` her seferinde bir öncekinden büyük geldi (ör. iskelet 82 522 → 87 989, yalnız
4 araç çağrısıyla); değer ajan başına kümülatif görünüyor. Öyleyse düz toplam fazla sayar; her
ajanın SON bildirimindeki değerlerin toplamı **2 423 674** (ilk teslimde 2 180 749). Kıyaslamada hangisinin kullanılacağı
öbür oturumun defteriyle aynı yönteme göre seçilmeli. Orkestratörün kendi token kullanımı bu
deftere dahil değil.

