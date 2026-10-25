#!/usr/bin/env python3
"""Narração do Reels: gera a voz de cada cena (edge-tts, pt-BR) com os tempos
de cada palavra, ajusta a duração das cenas à fala e corta notícias se o
vídeo passar de ~60 s. Atualiza public/roteiro.json e grava public/audio/voz-N.wav.

Uso: python3 scripts/voz.py   (variáveis: REELS_VOZ, REELS_VELOCIDADE)
"""
import asyncio
import json
import os
import subprocess

import edge_tts

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(AQUI, "..", "public")
VOZ = os.environ.get("REELS_VOZ", "pt-BR-FranciscaNeural")
VELOCIDADE = os.environ.get("REELS_VELOCIDADE", "+12%")
VOZ_ATRASO = 0.4
TRANS = 0.5
LIMITE = float(os.environ.get("REELS_LIMITE_S", "60"))


async def falar(texto, destino_mp3):
    try:
        com = edge_tts.Communicate(texto, VOZ, rate=VELOCIDADE, boundary="WordBoundary")
    except TypeError:  # versões antigas não têm `boundary`
        com = edge_tts.Communicate(texto, VOZ, rate=VELOCIDADE)
    palavras = []
    with open(destino_mp3, "wb") as f:
        async for parte in com.stream():
            if parte["type"] == "audio":
                f.write(parte["data"])
            elif parte["type"] == "WordBoundary":
                t = parte["offset"] / 1e7
                palavras.append({"t": round(t, 3), "fim": round(t + parte["duration"] / 1e7, 3), "texto": parte["text"]})
    return palavras


def duracao(caminho):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", caminho])
    return float(out.strip())


async def main():
    caminho = os.path.join(PUBLIC, "roteiro.json")
    r = json.load(open(caminho, encoding="utf-8"))
    os.makedirs(os.path.join(PUBLIC, "audio"), exist_ok=True)
    for i, c in enumerate(r["cenas"]):
        texto = c.get("narracao")
        if not texto:
            continue
        mp3 = os.path.join(PUBLIC, "audio", f"voz-{i}.mp3")
        wav = os.path.join(PUBLIC, "audio", f"voz-{i}.wav")
        palavras = await falar(texto, mp3)
        subprocess.check_call(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", "48000", "-ac", "1", wav])
        d = duracao(wav)
        c["voz_dur"] = round(d, 2)
        c["voz"] = f"audio/voz-{i}.wav"
        if c["tipo"] == "noticia":
            c["palavras"] = [{**p, "t": round(p["t"] + VOZ_ATRASO, 3), "fim": round(p["fim"] + VOZ_ATRASO, 3)} for p in palavras]
            c["dur"] = round(max(5.4, VOZ_ATRASO + d + 1.3), 2)
        elif c["tipo"] == "assinatura":
            c["dur"] = round(max(6.6, 2.2 + d + 0.9), 2)
        print(f"cena {i}: {d:.1f} s de voz — {texto[:70]}")

    # cabe em ~1 minuto: tira as últimas notícias se passar
    def total():
        return sum(c["dur"] for c in r["cenas"]) - TRANS * (len(r["cenas"]) - 1)

    while total() > LIMITE and sum(1 for c in r["cenas"] if c["tipo"] == "noticia") > 3:
        idx = max(i for i, c in enumerate(r["cenas"]) if c["tipo"] == "noticia")
        print(f"cortando (passa de {LIMITE:.0f} s): {r['cenas'][idx]['titulo']}")
        r["cenas"].pop(idx)
    r["audio"] = "audio/mix.wav"
    json.dump(r, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"total: {total():.1f} s")


if __name__ == "__main__":
    asyncio.run(main())
