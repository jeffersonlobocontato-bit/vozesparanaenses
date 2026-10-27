"""Segunda leva: galerias oficiais + sites dos clubes (og:image das notícias,
com o crédito da página). Gera candidatas2/ e folhas2-NN.jpg."""
import io, json, re, html, urllib.request
from pathlib import Path
from urllib.parse import urljoin, urlparse
from PIL import Image, ImageDraw

BASE = Path(__file__).parent
OUT = BASE / "candidatas2"; OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
def get(u, t=25): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=t).read()
def txt(u): return get(u).decode("utf-8", "replace")
def credito_de(h):
    h = html.unescape(re.sub(r"<[^>]+>", " ", h))
    m = re.search(r"(?:Foto|Fotos|Crédito|Credito)\s*:\s*([^\n|]{3,70})", h)
    return m.group(1).strip(" .") if m else ""

manifest = []
def guardar(url, origem, credito, titulo, minw=1000):
    try: im = Image.open(io.BytesIO(get(url))).convert("RGB")
    except Exception as e: print("img falhou", url, e); return
    if im.width < minw or im.width < im.height * 1.2: return
    i = len(manifest); im.thumbnail((1600, 1600)); im.save(OUT / f"{i:03d}.jpg", quality=86)
    manifest.append({"id": i, "url": url, "origem": origem, "credito": credito, "titulo": titulo})
    print(i, origem, url, "|", credito)

for linha in (BASE / "fontes2.txt").read_text().splitlines():
    if not linha.strip(): continue
    tipo, pagina = linha.split(None, 1)
    try: h = txt(pagina)
    except Exception as e: print("falhou", pagina, e); continue
    host = re.match(r"https?://[^/]+", pagina).group(0)
    if tipo == "galeria":
        urls = []
        for m in re.finditer(r'(?:href|src)="([^"]+/files/imagem/[^"?]+\.(?:jpe?g|JPE?G))', h):
            u = m.group(1)
            if "/styles/" in u: continue
            u = urljoin(host, u)
            if u not in urls: urls.append(u)
        cred = credito_de(h)
        for u in urls[:25]: guardar(u, pagina, cred, "")
    else:
        dom = urlparse(pagina).netloc.replace("www.", "")
        links = []
        for m in re.finditer(r'href="([^"#]+)"', h):
            u = urljoin(pagina, m.group(1))
            p = urlparse(u)
            if p.netloc.replace("www.", "") != dom: continue
            if len(p.path.strip("/").split("/")) < 2 and "noticia" not in p.path: continue
            if re.search(r"\.(jpg|png|css|js|pdf)$|/(tag|categoria|category|author|page)/", p.path): continue
            if u not in links: links.append(u)
        print(pagina, "links", len(links))
        n = 0
        for u in links[:40]:
            try: a = txt(u)
            except Exception: continue
            og = re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', a) or re.search(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', a)
            if not og: continue
            t = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', a)
            antes = len(manifest)
            guardar(html.unescape(og.group(1)), u, credito_de(a), html.unescape(t.group(1)) if t else "", minw=900)
            if len(manifest) > antes: n += 1
            if n >= 12: break

(BASE / "candidatas2.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
W, H, C, R = 380, 253, 4, 5
for f in range(0, len(manifest), C * R):
    folha = Image.new("RGB", (C * W, R * (H + 26)), "white"); d = ImageDraw.Draw(folha)
    for k, item in enumerate(manifest[f:f + C * R]):
        im = Image.open(OUT / f"{item['id']:03d}.jpg"); im.thumbnail((W, H))
        x, y = (k % C) * W, (k // C) * (H + 26)
        folha.paste(im, (x, y)); d.text((x + 6, y + H + 4), f"#{item['id']} {urlparse(item['origem']).netloc[:30]}", fill="black")
    folha.save(BASE / f"folha2-{f // (C * R):02d}.jpg", quality=80)
print("total", len(manifest))
