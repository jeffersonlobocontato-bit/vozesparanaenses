# Trilha própria (gerada por código, sem direitos de terceiros): pad tecnológico
# em Lá menor, pulso suave e sub, crescendo na abertura e no fecho.
import sys, numpy as np, scipy.io.wavfile as wav
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 260.0
saida = sys.argv[2] if len(sys.argv) > 2 else "public/trilha.wav"
SR = 44100
n = int(dur * SR)
t = np.arange(n) / SR
bpm = 96; beat = 60 / bpm; compasso = beat * 4
acordes = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
f = lambda m: 440 * 2 ** ((m - 69) / 12)
pad = np.zeros(n)
for i in range(int(dur / compasso) + 1):
    a, b = int(i * compasso * SR), min(n, int((i + 1) * compasso * SR) + int(0.4 * SR))
    if a >= n: break
    tt = np.arange(b - a) / SR
    env = np.minimum(1, tt / 0.6) * np.minimum(1, (b - a) / SR - tt + 0.0001)
    env = np.clip(env, 0, 1)
    for nota in acordes[i % 4]:
        for det in (-0.08, 0.08):
            pad[a:b] += env * np.sin(2 * np.pi * f(nota) * (1 + det / 100) * tt) * 0.06
    sub = f(acordes[i % 4][0] - 12)
    pad[a:b] += env * np.sin(2 * np.pi * sub * tt) * 0.09
# pulso (semicolcheias abafadas) e "tick" de relógio a cada tempo: ar de redação
pulso = np.zeros(n)
for k in range(int(dur / (beat / 2))):
    a = int(k * beat / 2 * SR); b = min(n, a + int(0.09 * SR))
    tt = np.arange(b - a) / SR
    pulso[a:b] += np.sin(2 * np.pi * f(81) * tt) * np.exp(-tt * 45) * (0.05 if k % 2 == 0 else 0.025)
mix = pad + pulso
# filtro passa-baixa simples (média móvel) para suavizar
k = 6; mix = np.convolve(mix, np.ones(k) / k, mode="same")
# forma geral: sobe na abertura, cama baixa sob a voz, sobe no fecho
forma = np.full(n, 0.55)
ab = int(4 * SR); forma[:ab] = np.linspace(0.2, 1.0, ab)
fe = int(10 * SR); forma[-fe:] = np.linspace(0.55, 1.0, fe)
fade = int(2.5 * SR); forma[-fade:] *= np.linspace(1, 0, fade)
mix *= forma
mix /= max(1e-9, np.abs(mix).max()) / 0.8
est = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
wav.write(saida, SR, (est * 32767).astype(np.int16))
print("trilha", dur, "s")
