"""Terceira leva (29/10/2026): fotos NEUTRAS para matéria sem foto — viatura
ou equipe em primeiro plano, fundo desfocado, sem fachada/cidade identificável;
mais clima e Defesa Civil para alertas. Busca nas galerias da AEN por tema e
monta folhas de contato grandes (3x3) para a curadoria."""
import io, json, re, html, urllib.request, urllib.parse
from pathlib import Path
from PIL import Image, ImageDraw

BASE = Path(__file__).parent
OUT = BASE / "candidatas3"; OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
def get(u, t=25): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
def txt(u): return get(u).decode("utf-8", "replace")
def credito_de(h):
    h = html.unescape(re.sub(r"<[^>]+>", " ", h))
    m = re.search(r"(?:Foto|Fotos|Crédito|Credito)\s*:\s*([^\n|]{3,70})", h)
    return m.group(1).strip(" .") if m else ""

TEMAS = {
  "pm": ["viatura policia militar", "rotam", "policiamento"],
  "civil": ["policia civil operacao", "policia civil viatura"],
  "bombeiros": ["corpo de bombeiros", "bombeiros resgate", "siate"],
  "cientifica": ["policia cientifica"],
  "rodoviaria": ["policia rodoviaria"],
  "penal": ["policia penal"],
  "samu": ["samu ambulancia"],
  "defesa-civil": ["defesa civil"],
  "chuva": ["chuva", "temporal"],
  "frio": ["geada", "frio"],
  "calor": ["calor", "estiagem"],
}
manifest, vistas = [], set()
def guardar(url, tema, galeria, cred):
    if url in vistas: return False
    vistas.add(url)
    try: im = Image.open(io.BytesIO(get(url))).convert("RGB")
    except Exception as e: print("img falhou", url, e); return False
    if im.width < 1200 or im.width < im.height * 1.25: return False
    i = len(manifest); im.thumbnail((1600, 1600)); im.save(OUT / f"{i:03d}.jpg", quality=86)
    manifest.append({"id": i, "tema": tema, "url": url, "galeria": galeria, "credito": cred})
    return True

for tema, buscas in TEMAS.items():
    galerias = []
    for b in buscas:
        for pagina in (0, 1):
            u = "https://www.parana.pr.gov.br/Galeria-de-Imagens?" + urllib.parse.urlencode({"combine": b, "page": pagina})
            try: h = txt(u)
            except Exception as e: print("busca falhou", u, e); continue
            for m in re.finditer(r'href="(/Galeria-de-Imagens/[^"?#]+)"', h):
                g = "https://www.parana.pr.gov.br" + m.group(1)
                # Evita inauguração/entrega de sede (fachada identificável) e solenidades.
                if re.search(r"inaugur|nova-sede|sede|entrega|solenidade|formatura|governador|palacio|reuniao|visita", g, re.I): continue
                if g not in galerias: galerias.append(g)
    print(tema, "galerias", len(galerias))
    n = 0
    for g in galerias[:10]:
        try: h = txt(g)
        except Exception: continue
        cred = credito_de(h)
        urls = []
        for m in re.finditer(r'(?:href|src)="([^"]+/files/imagem/[^"?]+\.(?:jpe?g|JPE?G))', h):
            u = m.group(1)
            if "/styles/" in u: continue
            u = urllib.parse.urljoin("https://www.parana.pr.gov.br", u)
            if u not in urls: urls.append(u)
        k = 0
        for u in urls[:12]:
            if guardar(u, tema, g, cred): k += 1; n += 1
            if k >= 5: break
        if n >= 36: break
    print(tema, "fotos", n)

(BASE / "candidatas3.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
W, H, C, R = 520, 346, 3, 3
for f in range(0, len(manifest), C * R):
    folha = Image.new("RGB", (C * W, R * (H + 28)), "white"); d = ImageDraw.Draw(folha)
    for k, item in enumerate(manifest[f:f + C * R]):
        im = Image.open(OUT / f"{item['id']:03d}.jpg"); im.thumbnail((W, H))
        x, y = (k % C) * W, (k // C) * (H + 28)
        folha.paste(im, (x, y)); d.text((x + 6, y + H + 6), f"#{item['id']} {item['tema']}", fill="black")
    folha.save(BASE / f"folha3-{f // (C * R):02d}.jpg", quality=82)
print("total", len(manifest))
