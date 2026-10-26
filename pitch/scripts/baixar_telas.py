# Baixa as capturas de tela do vídeo-pitch (bucket público article-videos, pasta pitch/).
import json, os, sys, urllib.request
BASE = "https://flcgtpzfnsrxawvyzzgh.supabase.co/storage/v1"
KEY = "sb_publishable_fMVraOMiN5QsfLcdVmjLTA_VfukX2cx"  # chave publicável (leitura pública)
dest = sys.argv[1] if len(sys.argv) > 1 else "public/telas"
os.makedirs(dest, exist_ok=True)
req = urllib.request.Request(f"{BASE}/object/list/article-videos", method="POST",
    data=json.dumps({"prefix": "pitch/", "limit": 1000, "sortBy": {"column": "name", "order": "asc"}}).encode(),
    headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
itens = json.load(urllib.request.urlopen(req))
n = 0
for it in itens:
    nome = it["name"]
    if not nome.lower().endswith((".jpg", ".png")): continue
    urllib.request.urlretrieve(f"{BASE}/object/public/article-videos/pitch/{nome}", os.path.join(dest, nome)); n += 1
print("telas:", n)
