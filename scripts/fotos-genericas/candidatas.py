"""Baixa as fotos das galerias oficiais listadas em galerias.txt e monta
folhas de contato numeradas para a curadoria do banco de fotos genéricas."""
import io, json, re, sys, urllib.request, html
from pathlib import Path
from PIL import Image, ImageDraw

BASE = Path(__file__).parent
OUT = BASE / "candidatas"; OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (VozesParanaenses curadoria de fotos)"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read()

manifest = []
for linha in (BASE / "galerias.txt").read_text().split():
    pagina = linha.strip()
    if not pagina: continue
    try:
        h = get(pagina).decode("utf-8", "replace")
    except Exception as e:
        print("falhou", pagina, e); continue
    host = re.match(r"https?://[^/]+", pagina).group(0)
    urls = []
    for m in re.finditer(r'(?:href|src)="([^"]+/files/imagem/[^"?]+\.(?:jpe?g|JPE?G|png))', h):
        u = m.group(1)
        if "/styles/" in u: continue
        if u.startswith("/"): u = host + u
        if u not in urls: urls.append(u)
    creditos = re.findall(r"Fotos?:\s*([^<\"\n]{3,60})", html.unescape(h))
    credito = creditos[0].strip(" .") if creditos else ""
    titulo = re.search(r"<title>([^<]+)", h)
    for u in urls[:30]:
        try:
            im = Image.open(io.BytesIO(get(u))).convert("RGB")
        except Exception as e:
            print("img falhou", u, e); continue
        if im.width < 1000 or im.width < im.height * 1.2: continue
        i = len(manifest)
        im.thumbnail((1600, 1600)); im.save(OUT / f"{i:03d}.jpg", quality=86)
        manifest.append({"id": i, "url": u, "galeria": pagina, "credito": credito,
                         "titulo": html.unescape(titulo.group(1)).strip() if titulo else ""})
        print(i, u, credito)

(BASE / "candidatas.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
# folhas de contato: 4 x 5, 380x253
W, H, C, R = 380, 253, 4, 5
for f in range(0, len(manifest), C * R):
    folha = Image.new("RGB", (C * W, R * (H + 26)), "white"); d = ImageDraw.Draw(folha)
    for k, item in enumerate(manifest[f:f + C * R]):
        im = Image.open(OUT / f"{item['id']:03d}.jpg"); im.thumbnail((W, H))
        x, y = (k % C) * W, (k // C) * (H + 26)
        folha.paste(im, (x, y)); d.text((x + 6, y + H + 4), f"#{item['id']}", fill="black")
    folha.save(BASE / f"folha-{f // (C * R):02d}.jpg", quality=80)
print("total", len(manifest))
