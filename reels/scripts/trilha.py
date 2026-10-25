#!/usr/bin/env python3
"""Trilha do Reels "Resumo do dia" — composta por código (licença própria).

Lê o roteiro (public/roteiro.json) e as vozes já geradas (public/audio/voz-N.wav)
e escreve public/audio/mix.wav: tema de manchete em Ré menor a 120 BPM, com
batida e baixo pulsando, acordes de sintetizador, "stab" de telejornal a cada
notícia, efeitos sincronizados com as transições (whoosh, glitch, íris,
balão), tique-taque nos contadores, impacto na assinatura e a voz por cima
com ducking (a música abaixa quando alguém fala).

Uso: python3 scripts/trilha.py [public/roteiro.json]
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
BPM = 120.0
BATIDA = 60.0 / BPM
TRANS = 0.5  # mesma DURACAO_TRANSICAO de src/tipos.ts
VOZ_ATRASO = 0.4  # a voz entra 0,4 s depois do início da cena
RNG = np.random.default_rng(7)

AQUI = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(AQUI, "..", "public")


# ---------------------------------------------------------------- utilidades
def t_amostras(seg):
    return int(round(seg * SR))


def env_adsr(n, a=0.005, d=0.1, s=0.6, r=0.1):
    """Envelope ADSR com n amostras (r dentro de n)."""
    a, d, r = t_amostras(a), t_amostras(d), t_amostras(r)
    sus = max(0, n - a - d - r)
    e = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.linspace(1, s, max(d, 1), endpoint=False),
        np.full(sus, s),
        np.linspace(s, 0, max(r, 1)),
    ])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def passa_baixa(x, fc, ordem=2):
    sos = butter(ordem, min(fc, SR / 2 - 100) / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x)


def passa_alta(x, fc, ordem=2):
    sos = butter(ordem, fc / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x)


def passa_faixa(x, f1, f2, ordem=2):
    sos = butter(ordem, [f1 / (SR / 2), min(f2, SR / 2 - 100) / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x)


def serra(freq, n, detune=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    return 2 * ((t * f) % 1.0) - 1


def quadrada(freq, n):
    t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * freq * t))


def nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def soma(dest, sinal, inicio, ganho=1.0, pan=0.0):
    """Mistura um sinal mono em dest (estéreo) a partir de `inicio` (s)."""
    i = t_amostras(inicio)
    if i >= dest.shape[0] or i + len(sinal) <= 0:
        return
    if i < 0:
        sinal = sinal[-i:]
        i = 0
    j = min(dest.shape[0], i + len(sinal))
    s = sinal[: j - i] * ganho
    esq = np.cos((pan + 1) * np.pi / 4)
    dir_ = np.sin((pan + 1) * np.pi / 4)
    dest[i:j, 0] += s * esq * 1.41
    dest[i:j, 1] += s * dir_ * 1.41


# ------------------------------------------------------------- instrumentos
def bumbo(dur=0.45):
    n = t_amostras(dur)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t * 28)
    fase = 2 * np.pi * np.cumsum(f) / SR
    corpo = np.sin(fase) * np.exp(-t * 7)
    clique = passa_alta(RNG.standard_normal(n), 2500) * np.exp(-t * 180) * 0.25
    return np.tanh((corpo + clique) * 1.6)


def palma(dur=0.25):
    n = t_amostras(dur)
    t = np.arange(n) / SR
    ruido = passa_faixa(RNG.standard_normal(n), 900, 5000)
    e = np.exp(-t * 26)
    for k in (0.0, 0.011, 0.022):  # três batidas juntas, como palma
        e += (t >= k) * np.exp(-(t - k).clip(0) * 90) * 0.6
    return ruido * e * 0.45


def chimbal(dur=0.06, aberto=False):
    n = t_amostras(0.22 if aberto else dur)
    t = np.arange(n) / SR
    return passa_alta(RNG.standard_normal(n), 7000) * np.exp(-t * (14 if aberto else 70)) * 0.22


def baixo(freq, dur):
    n = t_amostras(dur)
    s = serra(freq, n) * 0.6 + serra(freq * 0.5, n) * 0.5
    t = np.arange(n) / SR
    fc = 260 + 900 * np.exp(-t * 18)  # "pluck" do filtro
    y = np.zeros(n)
    # filtro que se fecha: aplica em blocos
    blocos = 8
    for b in range(blocos):
        a, z = b * n // blocos, (b + 1) * n // blocos
        y[a:z] = passa_baixa(s, float(fc[a]))[a:z]
    return np.tanh(y * env_adsr(n, 0.003, 0.08, 0.55, 0.05) * 1.4) * 0.7


def pad(freqs, dur):
    n = t_amostras(dur)
    s = sum(serra(f, n, d) for f in freqs for d in (-0.004, 0.0, 0.005))
    s = passa_baixa(s / (3 * len(freqs)), 1600)
    return s * env_adsr(n, 0.25, 0.3, 0.8, 0.35)


def stab(freqs, dur=0.55):
    """O "pá!" de abertura de telejornal: metais sintéticos curtos."""
    n = t_amostras(dur)
    t = np.arange(n) / SR
    s = sum(serra(f, n) * 0.6 + quadrada(f * 2, n) * 0.15 for f in freqs) / len(freqs)
    fc_env = 600 + 5200 * np.exp(-t * 9)
    y = np.zeros(n)
    for b in range(10):
        a, z = b * n // 10, (b + 1) * n // 10
        y[a:z] = passa_baixa(s, float(fc_env[a]))[a:z]
    return np.tanh(y * 2.0) * np.exp(-t * 3.2) * 0.55


def tique(alto=True):
    n = t_amostras(0.035)
    t = np.arange(n) / SR
    f = 2600 if alto else 1900
    return np.sin(2 * np.pi * f * t) * np.exp(-t * 160) * 0.5


def whoosh(dur=0.5, sobe=True, brilho=1.0):
    n = t_amostras(dur)
    t = np.linspace(0, 1, n)
    ruido = RNG.standard_normal(n)
    y = np.zeros(n)
    blocos = 24
    for b in range(blocos):
        a, z = b * n // blocos, (b + 1) * n // blocos
        k = (b + 0.5) / blocos
        centro = 300 + (k if sobe else 1 - k) * 4200 * brilho
        y[a:z] = passa_faixa(ruido, max(80, centro * 0.6), centro * 1.6)[a:z]
    env = np.sin(np.pi * t) ** 1.5
    return y * env * 0.9


def riser(dur=1.2):
    n = t_amostras(dur)
    t = np.linspace(0, 1, n)
    f = 200 + 1800 * t ** 2
    tom = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (whoosh(dur, True, 1.3) * 0.7 + tom) * t ** 1.8


def impacto(dur=2.0):
    n = t_amostras(dur)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 2.2)
    estalo = passa_baixa(RNG.standard_normal(n), 3000) * np.exp(-t * 22) * 0.6
    cauda = passa_baixa(RNG.standard_normal(n), 900) * np.exp(-t * 3) * 0.18
    return np.tanh((sub * 1.3 + estalo + cauda) * 1.2)


def glitch_sfx(dur=0.3):
    n = t_amostras(dur)
    y = np.zeros(n)
    i = 0
    while i < n:
        tam = int(RNG.integers(300, 2400))
        tipo = RNG.integers(0, 3)
        trecho = np.arange(min(tam, n - i)) / SR
        if tipo == 0:
            y[i:i + len(trecho)] = np.sign(np.sin(2 * np.pi * RNG.integers(200, 1600) * trecho)) * 0.5
        elif tipo == 1:
            y[i:i + len(trecho)] = np.round(RNG.standard_normal(len(trecho)) * 2) / 4
        i += tam
    return passa_alta(y, 300) * 0.55


def pop(f0=900):
    n = t_amostras(0.12)
    t = np.arange(n) / SR
    f = f0 * (1 + 1.5 * np.exp(-t * 60))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 38) * 0.6


def brilho_iris(dur=0.6):
    n = t_amostras(dur)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * nota(m) * t) for m in (86, 89, 93, 98)) / 4
    return s * np.minimum(1, t / dur * 2.2) * np.exp(-t * 3) * 0.35 + whoosh(dur, True, 0.8) * 0.4


# ------------------------------------------------------------------- roteiro
def inicios(cenas):
    out, t = [], 0.0
    for i, c in enumerate(cenas):
        out.append(t)
        t += c["dur"] - (TRANS if i < len(cenas) - 1 else 0)
    return out, t


def instante_numero(c):
    for w in c.get("palavras", []):
        if any(ch.isdigit() for ch in w["texto"]):
            return w["t"]
    return 0.9


def ler_wav(caminho):
    sr, x = wavfile.read(caminho)
    x = x.astype(np.float32)
    if x.dtype != np.float32 or np.abs(x).max() > 2:
        x = x / 32768.0
    if x.ndim == 2:
        x = x.mean(axis=1)
    if sr != SR:
        idx = np.arange(0, len(x), sr / SR)
        x = np.interp(idx, np.arange(len(x)), x)
    return x


# Progressão em Ré menor (um acorde por compasso de 2 s): Dm – B♭ – F – C
ACORDES = [(50, [62, 65, 69]), (46, [62, 65, 70]), (53, [60, 65, 69]), (48, [60, 64, 67])]


def compor(roteiro):
    cenas = roteiro["cenas"]
    ini, total = inicios(cenas)
    total += 1.2  # cauda do último acorde
    musica = np.zeros((t_amostras(total), 2))
    efeitos = np.zeros_like(musica)
    voz = np.zeros(t_amostras(total))

    abertura_fim = ini[1] if len(ini) > 1 else 3.5
    assin_ini = ini[-1] if cenas[-1]["tipo"] == "assinatura" else total

    # --- abertura: tique-taque, riser e a pancada do "RESUMO" (frame 16)
    t = 0.0
    k = 0
    while t < abertura_fim - 0.1:
        soma(efeitos, tique(k % 2 == 0), t, 0.5, -0.3 if k % 2 else 0.3)
        t += BATIDA / 2
        k += 1
    soma(efeitos, impacto(1.4), 16 / 30, 0.55)
    soma(efeitos, stab([nota(62), nota(65), nota(69), nota(74)], 0.8), 16 / 30, 0.7)
    soma(efeitos, riser(abertura_fim - 1.0), 0.9, 0.35)

    # --- tema: do fim da abertura até a assinatura, alinhado à grade de 120 BPM
    inicio_tema = abertura_fim
    fim_tema = assin_ini + 0.6
    passo = BATIDA / 4  # semicolcheias
    n_passos = int((fim_tema - inicio_tema) / passo)
    for s in range(n_passos):
        tt = inicio_tema + s * passo
        compasso = int(s // 16)
        raiz, acorde = ACORDES[compasso % 4]
        pos = s % 16
        if pos in (0, 8):
            soma(musica, bumbo(), tt, 0.85)
        if pos in (6,) and compasso % 2:
            soma(musica, bumbo(0.3), tt, 0.5)
        if pos in (4, 12):
            soma(musica, palma(), tt, 0.35, 0.1)
        soma(musica, chimbal(aberto=(pos == 14)), tt, 0.2 if pos % 4 == 2 else 0.1, 0.35)
        if pos % 2 == 0:
            soma(musica, baixo(nota(raiz - 12 if pos % 4 else raiz - 12), passo * 1.7), tt, 0.55)
        if pos == 0:
            soma(musica, pad([nota(m) for m in acorde], BATIDA * 4), tt, 0.32, -0.2)

    # --- cada notícia: stab no início, efeito da transição e tique nos contadores
    for i, c in enumerate(cenas):
        if c["tipo"] != "noticia":
            continue
        t0 = ini[i]
        tr = c.get("transicao", "corte")
        if tr == "chicote":
            soma(efeitos, whoosh(0.5, True), t0 - 0.05, 0.6, 0.4)
        elif tr == "glitch":
            soma(efeitos, glitch_sfx(0.32), t0 + 0.1, 0.5)
            soma(efeitos, whoosh(0.35, False), t0, 0.3)
        elif tr == "balao":
            soma(efeitos, whoosh(0.45, True, 0.7), t0, 0.5, -0.3)
            soma(efeitos, pop(700), t0 + 0.42, 0.55)
        elif tr == "iris":
            soma(efeitos, brilho_iris(0.6), t0, 0.6)
        elif tr == "luz":
            soma(efeitos, whoosh(0.7, True, 0.5), t0 - 0.1, 0.45)
        else:
            soma(efeitos, impacto(0.8), t0 + 0.25, 0.4)
        raiz = ACORDES[0][0] + 12
        soma(efeitos, stab([nota(raiz + 12), nota(raiz + 15), nota(raiz + 19)], 0.45), t0 + 0.25, 0.32)
        soma(efeitos, pop(1200), t0 + 0.3, 0.25)  # chapéu-balão
        if c.get("estilo") == "numero" and c.get("numero"):
            tn = t0 + max(0.35, instante_numero(c) - 0.2)
            for k in range(14):
                soma(efeitos, tique(k % 2 == 0), tn + k * 0.075, 0.22 + 0.02 * k)
            soma(efeitos, pop(1500), tn + 1.1, 0.4)
        if c.get("estilo") == "alerta":
            for k in range(3):
                soma(efeitos, quadrada(880, t_amostras(0.12)) * np.exp(-np.arange(t_amostras(0.12)) / SR * 20) * 0.18, t0 + 0.35 + k * 0.3, 1.0)
        # voz
        caminho = os.path.join(PUBLIC, c["voz"]) if c.get("voz") else ""
        if caminho and os.path.exists(caminho):
            v = ler_wav(caminho)
            a = t_amostras(t0 + VOZ_ATRASO)
            voz[a:a + len(v)] += v[: max(0, len(voz) - a)]

    # --- assinatura: riser, impacto, ponto que cai, toque no Seguir, acorde final
    if cenas[-1]["tipo"] == "assinatura":
        soma(efeitos, riser(1.3), assin_ini - 1.1, 0.4)
        soma(efeitos, whoosh(0.5, True, 0.7), assin_ini, 0.5)
        soma(efeitos, impacto(2.4), assin_ini + 0.85, 0.75)
        soma(efeitos, pop(520), assin_ini + 0.85, 0.6)
        soma(efeitos, whoosh(0.4, False, 0.6), assin_ini + 1.35, 0.3)
        soma(efeitos, pop(1300), assin_ini + 3.7, 0.7)
        soma(efeitos, brilho_iris(0.5), assin_ini + 3.72, 0.4)
        final = [nota(m) for m in (50, 57, 62, 65, 69, 74)]
        soma(musica, pad(final, total - assin_ini - 0.8), assin_ini + 0.85, 0.55)
        soma(musica, stab([nota(62), nota(65), nota(69)], 1.2), assin_ini + 0.85, 0.5)
        caminho = os.path.join(PUBLIC, cenas[-1]["voz"]) if cenas[-1].get("voz") else ""
        if caminho and os.path.exists(caminho):
            v = ler_wav(caminho)
            a = t_amostras(assin_ini + 2.2)
            voz[a:a + len(v)] += v[: max(0, len(voz) - a)]
    caminho = os.path.join(PUBLIC, cenas[0]["voz"]) if cenas[0].get("voz") else ""  # abertura
    if caminho and os.path.exists(caminho):
        v = ler_wav(caminho)
        a = t_amostras(0.9)
        voz[a:a + len(v)] += v[: max(0, len(voz) - a)]

    # --- ducking: a música abaixa ~9 dB enquanto há voz
    env = np.abs(voz)
    janela = t_amostras(0.12)
    env = np.convolve(env, np.ones(janela) / janela, mode="same")
    tem_voz = np.clip(env / 0.02, 0, 1)
    suave = np.convolve(tem_voz, np.ones(t_amostras(0.25)) / t_amostras(0.25), mode="same")
    ganho_musica = 1.0 - 0.65 * suave
    musica = np.stack([passa_baixa(musica[:, 0], 9000), passa_baixa(musica[:, 1], 9000)], axis=1)
    mix = musica * ganho_musica[:, None] * 0.5 + efeitos * 0.75
    mix[:, 0] += voz * 1.0
    mix[:, 1] += voz * 1.0
    # fade-out no fim
    fo = t_amostras(0.9)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
    # limitador suave
    pico = np.abs(mix).max() or 1
    mix = np.tanh(mix / pico * 1.25) * 0.92
    return mix, total


def main():
    caminho = sys.argv[1] if len(sys.argv) > 1 else os.path.join(PUBLIC, "roteiro.json")
    roteiro = json.load(open(caminho, encoding="utf-8"))
    mix, total = compor(roteiro)
    os.makedirs(os.path.join(PUBLIC, "audio"), exist_ok=True)
    saida = os.path.join(PUBLIC, "audio", "mix.wav")
    wavfile.write(saida, SR, (mix * 32767).astype(np.int16))
    print(f"mix.wav: {total:.1f} s")


if __name__ == "__main__":
    main()
