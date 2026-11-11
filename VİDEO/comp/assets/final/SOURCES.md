# comp/assets/final — kare dizileri (yeniden üretim)
Kaynaklar salt okunur, projeye ait render çıktıları (dış lisans yok):
- Fable ekibi: `out/final/mecidiyekoy.mp4` (48,5 sn) · Opus ekibi: `animate_villages2/out/final/mecidiyekoy.mp4` (40 sn)

`node tools/frames.mjs <video> comp/assets/final/<ad> --fps 30 --from A --to B [--crop 704:1920:188:0 --width 528 --q 2 | --q 3 | wc: --q 2 (gece göğü bantlanmasın)]`

| ad | kaynak | saniye | genişlik | kullanım |
|---|---|---|---|---|
| f1 / f2 / f3 | Fable | 16.4–20.4 / 25.3–29.3 / 36.0–40.0 | orta 704 px → 528×1440 | kıyas: gün batımı / alacakaranlık / gece |
| o1 / o2 / o3 | Opus | 16.0–20.0 / 23.0–27.0 / 29.0–33.0 | orta 704 px → 528×1440 | kıyas: gün batımı / alacakaranlık / gece |
| wa / wb / wc | Fable | 11.3–16.9 / 23.5–31.0 / 40.0–48.5 | 1080 | kazanan, tam ekran (0,8 sn erimeyle birleşir) |

`teaser-f.jpg` / `teaser-o.jpg`: `f1/f00006.jpg` ve `o1/f00006.jpg` karelerinin bulanık hâli (perdenin ardındaki ön görüntü):
`ffmpeg -i f1/f00006.jpg -vf "gblur=sigma=9,eq=saturation=0.85" -q:v 3 teaser-f.jpg`
