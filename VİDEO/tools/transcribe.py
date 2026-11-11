# Ham kelime zamanları: faster-whisper large-v3 (CPU int8; GPU varsa float16) → work/asr-raw.json
#   python tools/transcribe.py . work/asr-raw.json 1.mp3 2.mp3 3.mp3 4.mp3 5.mp3 6.mp3 7.mp3
# Zamanlar her kaydın kendi saatine göredir; build-transcript.py bunları voice.wav saatine taşır ve düzeltir.
import json, sys, subprocess
import numpy as np
def load(p):
    raw=subprocess.run(["ffmpeg","-v","error","-i",p,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True,check=True).stdout
    return np.frombuffer(raw,dtype=np.float32).copy()
from faster_whisper import WhisperModel

src_dir, out_path = sys.argv[1], sys.argv[2]
files = sys.argv[3:]
prompt = ("Burası neresi? Tanıyabildiniz mi? Mecidiyeköy. Claude, Opus, Fable. "
          "Mareşal, başkomutan, ajan orkestrasyonu. 90 dolar, 150 dolar.")
try:
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")
    dev = "cuda"
except Exception as e:
    print("cuda failed:", e)
    model = WhisperModel("large-v3", device="cpu", compute_type="int8")
    dev = "cpu"
res = {"device": dev, "files": {}}
for f in files:
    try:
        segs, info = model.transcribe(load(f"{src_dir}/{f}"), language="tr", word_timestamps=True,
                                      initial_prompt=prompt, beam_size=5, vad_filter=False,
                                      condition_on_previous_text=False)
        segs = list(segs)
    except Exception as e:
        if dev == "cuda":
            print("cuda transcribe failed, CPU:", e)
            model = WhisperModel("large-v3", device="cpu", compute_type="int8"); dev = "cpu"
            segs, info = model.transcribe(load(f"{src_dir}/{f}"), language="tr", word_timestamps=True,
                                          initial_prompt=prompt, beam_size=5, vad_filter=False,
                                          condition_on_previous_text=False)
            segs = list(segs)
        else:
            raise
    words = [{"w": w.word, "s": round(w.start, 3), "e": round(w.end, 3), "p": round(w.probability, 3)}
             for s in segs for w in s.words]
    res["files"][f] = {"text": " ".join(s.text.strip() for s in segs), "words": words}
    print(f, "|", res["files"][f]["text"], flush=True)
res["device"] = dev
json.dump(res, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
