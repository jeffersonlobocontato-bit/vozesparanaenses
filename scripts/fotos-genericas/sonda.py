import urllib.request, re
from pathlib import Path
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) Chrome/124"}
out=Path(__file__).parent/"sonda"; out.mkdir(exist_ok=True)
for nome,u in [("lista","https://www.parana.pr.gov.br/Galeria-de-Imagens"),("busca","https://www.parana.pr.gov.br/Galeria-de-Imagens?combine=bombeiros"),("aen","https://www.parana.pr.gov.br/aen/galerias"),("aenbusca","https://www.parana.pr.gov.br/aen/galerias?combine=bombeiros"),("aenfotos","https://www.parana.pr.gov.br/aen/Galeria-de-Imagens?combine=bombeiros")]:
    try:
        r=urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30); h=r.read().decode("utf-8","replace")
        (out/f"{nome}.html").write_text(h); print(nome, r.status, r.url, len(h))
        print("  links galeria:", sorted(set(re.findall(r'href="([^"]*[Gg]aleria[^"]*)"',h)))[:15])
        print("  forms:", re.findall(r'<form[^>]*>', h)[:5]); print("  inputs:", re.findall(r'<input[^>]*name="([^"]+)"', h)[:15])
    except Exception as e: print(nome,"erro",e)
