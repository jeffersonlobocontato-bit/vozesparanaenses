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

# A busca do site é por formulário (POST com token); em vez disso, percorre a
# listagem de galerias da AEN e filtra pelo título (slug) de cada uma.
FILTRO = {
  "pm": r"policia-militar|\bpm\b|-pm-|rotam|bpmoa|choque|policiamento|operacao-verao|viatura",
  "civil": r"policia-civil|pcpr|delegad",
  "bombeiros": r"bombeir|siate|resgate|salvamento|incendio",
  "cientifica": r"cientifica|pericia|iml",
  "rodoviaria": r"rodoviaria|bprv|blitz|fiscalizacao-nas-rodovias|fiscalizacao-nas-estradas",
  "penal": r"policia-penal|penitenciar|deppen",
  "samu": r"samu|ambulanc",
  "defesa-civil": r"defesa-civil",
  "chuva": r"chuva|temporal|tempestade|granizo|enchente|alagamento|vendaval",
  "frio": r"geada|frio|neve|temperatura",
  "calor": r"calor|estiagem|seca|queimada",
  "sesp": r"^sesp|seguranca-publica",
}
EVITA = r"inaugur|nova-sede|sede-|entrega|solenidade|formatura|governador|palacio|reuniao|visita|posse|homenag|aniversario|medalha|assina"
slugs = []
for pagina in range(0, 260):
    try: h = txt(f"https://www.parana.pr.gov.br/aen/Galerias?page={pagina}")
    except Exception as e: print("lista falhou", pagina, e); continue
    novos = [m.group(1) for m in re.finditer(r'href="(/Galeria-de-Imagens/[^"?#]+)"', h)]
    novos = [s for s in novos if s not in slugs]
    if not novos: break
    slugs += novos
print("galerias listadas", len(slugs))
por_tema = {t: [] for t in FILTRO}
for s in slugs:
    nome = s.split("/")[-1].lower()
    if re.search(EVITA, nome): continue
    for t, rx in FILTRO.items():
        if re.search(rx, nome): por_tema[t].append("https://www.parana.pr.gov.br" + s); break
for t, gs in por_tema.items():
    print(t, "galerias", len(gs))
    n = 0
    for g in gs[:14]:
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
        for u in urls[:10]:
            if guardar(u, t, g, cred): k += 1; n += 1
            if k >= 4: break
        if n >= 32: break
    print(t, "fotos", n)

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
