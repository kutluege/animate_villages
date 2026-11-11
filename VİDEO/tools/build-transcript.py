# work/asr-raw.json (ham whisper) + work/spoken.txt (elle düzeltilmiş, ses kaydına sadık metin) + work/voice.json (kesim tablosu)
#   → work/transcript.json  (kelime zamanları voice.wav saatine göre)
#   python tools/build-transcript.py
# Düzeltilmiş kelimeler ham kelimelerle hizalanır (difflib); değişen parçalarda süre harf sayısına göre bölüştürülür.
# Ardından kelime sınırları kaynak kayıttaki ince sessizlik tespitiyle (-50 dB, ≥0.08 sn) sıkılaştırılır
# (whisper, sessizlikten sonraki ilk kelimenin başını erken verir).
import json, os, re, subprocess, difflib, sys
sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
W = lambda *p: os.path.join(ROOT, *p)
asr = json.load(open(W('work', 'asr-raw.json'), encoding='utf-8'))
voice = json.load(open(W('work', 'voice.json'), encoding='utf-8'))
spoken = {}
for line in open(W('work', 'spoken.txt'), encoding='utf-8'):
    if '\t' in line:
        f, txt = line.rstrip('\n').split('\t', 1)
        spoken[f] = txt.split()

def norm(s):
    s = s.replace('I', 'ı').replace('İ', 'i').lower()
    return re.sub(r'[^\w]', '', s)

def silences(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-50dB:d=0.08', '-f', 'null', '-'],
                         capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    out, s = [], None
    for line in err.splitlines():
        m = re.search(r'silence_start: ([\d.]+)', line)
        if m: s = float(m.group(1))
        m = re.search(r'silence_end: ([\d.]+)', line)
        if m: out.append((s or 0.0, float(m.group(1)))); s = None
    return out

words_out, report = [], []
for cut in voice['cuts']:
    f = cut['file']
    raw = asr['files'][f]['words']
    # whisper'ın ayrı verdiği kesme ekli parçaları ('ın, 'u) önceki kelimeye kat
    toks = []
    for w in raw:
        t = w['w'].strip()
        if toks and (t.startswith("'") or t.startswith('’')):
            toks[-1]['w'] += t; toks[-1]['e'] = w['e']
        else:
            toks.append({'w': t, 's': w['s'], 'e': w['e']})
    fixed = spoken[f]
    a = [norm(t['w']) for t in toks]; b = [norm(t) for t in fixed]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    timed = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == 'equal':
            for k in range(j2 - j1):
                timed.append([fixed[j1 + k], toks[i1 + k]['s'], toks[i1 + k]['e']])
        elif op in ('replace', 'insert'):
            if op == 'replace':
                s0, e0 = toks[i1]['s'], toks[i2 - 1]['e']
            else:  # ham metinde karşılığı yok: komşular arasına sıkıştır
                s0 = toks[i1 - 1]['e'] if i1 > 0 else toks[0]['s']
                e0 = toks[i1]['s'] if i1 < len(toks) else s0 + 0.3
                if e0 - s0 < 0.12: s0 = max(0, e0 - 0.12 * (j2 - j1))
            lens = [max(2, len(norm(x))) for x in fixed[j1:j2]]; tot = sum(lens); acc = s0
            for k, L in enumerate(lens):
                d = (e0 - s0) * L / tot
                timed.append([fixed[j1 + k], acc, acc + d]); acc += d
            report.append(f"{f}: {' '.join(t['w'] for t in toks[i1:i2]) or '∅'} → {' '.join(fixed[j1:j2])}")
        elif op == 'delete':
            report.append(f"{f}: (atıldı) {' '.join(t['w'] for t in toks[i1:i2])}")
    # sessizlikle sıkılaştır (kaynak saatinde)
    sil = silences(W(f))
    for k, w in enumerate(timed):
        for ss, se in sil:
            if ss - 0.01 <= w[1] and w[2] <= se + 0.01:  # kelime tamamen sessizlikte: whisper kaydırmış → sessizlik sonrasına al
                if k + 1 < len(timed) and timed[k + 1][2] > se + 0.15:  # sonraki kelimeyle süreyi harf oranında paylaş
                    n = timed[k + 1]; L1, L2 = len(norm(w[0])) or 1, len(norm(n[0])) or 1
                    w[1], w[2] = se, se + (n[2] - se) * L1 / (L1 + L2); n[1] = w[2]
                else:
                    w[1], w[2] = se, se + 0.2
                report.append(f"{f}: '{w[0]}' sessizlikten çıkarıldı → {se:.2f}")
                continue
            if ss - 0.01 <= w[1] < se and se < w[2] - 0.05: w[1] = se
            if ss < w[2] <= se + 0.01 and ss > w[1] + 0.05: w[2] = ss
        if k and w[1] < timed[k - 1][2]:
            w[1] = timed[k - 1][2]; w[2] = max(w[2], w[1] + 0.08)
    # kaynak → voice saati
    off = cut['outStart'] - cut['srcStart']
    prev_end = words_out[-1]['end'] if words_out else 0
    for text, s, e in timed:
        s = max(s + off, cut['outStart'], prev_end); e = max(e + off, s + 0.05); e = min(e, cut['outEnd'])
        words_out.append({'text': text, 'start': round(s, 3), 'end': round(e, 3), 'clip': f})
        prev_end = words_out[-1]['end']

# cümleler
sentences, cur = [], []
for i, w in enumerate(words_out):
    cur.append(i)
    if re.search(r'[.?!…]$', w['text']) or i == len(words_out) - 1:
        ws = [words_out[k] for k in cur]
        sentences.append({'text': ' '.join(x['text'] for x in ws), 'start': ws[0]['start'], 'end': ws[-1]['end'],
                          'w0': cur[0], 'w1': cur[-1], 'clip': ws[0]['clip']})
        cur = []

out = {'source': 'work/voice.wav', 'duration': voice['duration'],
       'note': 'faster-whisper large-v3 kelime zamanları + work/spoken.txt elle düzeltmesi; zamanlar voice.wav saatine göre (sn).',
       'words': words_out, 'sentences': sentences, 'corrections': report}
json.dump(out, open(W('work', 'transcript.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f"[transcript] {len(words_out)} kelime, {len(sentences)} cümle")
for r in report: print('  düzeltme:', r)
