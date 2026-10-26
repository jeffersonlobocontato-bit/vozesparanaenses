# Tempo de cada palavra da locução (faster-whisper), para as legendas e para
# sincronizar as telas com a fala. Saída: public/legendas.json [{w, s, e}].
import json, sys
from faster_whisper import WhisperModel
audio = sys.argv[1] if len(sys.argv) > 1 else "public/locucao.mp3"
saida = sys.argv[2] if len(sys.argv) > 2 else "public/legendas.json"
dica = ("Vozes Paranaenses, Paraná, prefeituras, Método DEL, criticidade, 5W1H, SEO, Portal da Imprensa, "
        "Instagram, Reels, pipeline, compliance, commodity, tokens.")
m = WhisperModel("small", device="cpu", compute_type="int8")
segs, _ = m.transcribe(audio, language="pt", word_timestamps=True, initial_prompt=dica, vad_filter=False)
palavras = []
for s in segs:
    for w in s.words or []:
        palavras.append({"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)})
json.dump(palavras, open(saida, "w"), ensure_ascii=False)
print("palavras:", len(palavras))
