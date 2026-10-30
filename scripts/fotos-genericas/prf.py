# Baixa fotos da galeria oficial da PRF no Paraná (Flickr prfparana) para
# escolher as neutras (agente/viatura em fiscalização) do banco genérico.
import urllib.request, json, os
from PIL import Image, ImageDraw
LISTA = json.load(open("scripts/fotos-genericas/prf.json"))
os.makedirs("scripts/fotos-genericas/prf", exist_ok=True)
ok = []
for f in LISTA:
    dst = f"scripts/fotos-genericas/prf/{f['id']}.jpg"
    try:
        req = urllib.request.Request(f["u"], headers={"User-Agent": "VozesParanaensesBot/1.0"})
        open(dst, "wb").write(urllib.request.urlopen(req, timeout=30).read())
        ok.append(f)
        print("ok", f["id"])
    except Exception as e:
        print("erro", f["id"], e)
# folha de contato
W, H = 400, 260
cols = 4
rows = (len(ok) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, rows * (H + 24)), "white")
d = ImageDraw.Draw(sheet)
for i, f in enumerate(ok):
    im = Image.open(f"scripts/fotos-genericas/prf/{f['id']}.jpg").convert("RGB")
    im.thumbnail((W, H))
    x, y = (i % cols) * W, (i // cols) * (H + 24)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + H + 4), f"{i+1}. {f['id']}", fill="black")
sheet.save("scripts/fotos-genericas/prf/folha.jpg", quality=80)
