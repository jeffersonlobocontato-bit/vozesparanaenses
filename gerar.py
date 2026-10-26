# Baixa os trechos da locução (Magnific/ElevenLabs, voz Tiago Macedo) e monta locucao.mp3:
# trechos do mesmo bloco seguidos com 0,35 s; entre blocos, 0,7 s.
import os, subprocess, urllib.request, wave, json
FF=os.environ.get("FFMPEG","ffmpeg")
itens=[l.split() for l in open("urls.txt") if l.strip()]
def sil(n,t): subprocess.run([FF,"-v","error","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t",str(t),n],check=True)
sil("s_curta.wav",0.35); sil("s_bloco.wav",0.7)
lista=[]; t0=0.0; trechos=[]; ant=None
for i,(b,u) in enumerate(itens):
    urllib.request.urlretrieve(u,f"p{i:02d}.mp3")
    subprocess.run([FF,"-v","error","-y","-i",f"p{i:02d}.mp3","-ac","1","-ar","44100",f"p{i:02d}.wav"],check=True)
    w=wave.open(f"p{i:02d}.wav"); d=w.getnframes()/w.getframerate(); w.close()
    if ant is not None:
        p="s_curta.wav" if b==ant else "s_bloco.wav"; lista.append(f"file {p}"); t0+=0.35 if b==ant else 0.7
    trechos.append({"bloco":int(b),"inicio":round(t0,3),"duracao":round(d,3)})
    lista.append(f"file p{i:02d}.wav"); t0+=d; ant=b
open("lista.txt","w").write("\n".join(lista))
subprocess.run([FF,"-v","error","-y","-f","concat","-safe","0","-i","lista.txt","-c:a","libmp3lame","-b:a","192k","locucao.mp3"],check=True)
json.dump({"voz":"Tiago Macedo (ElevenLabs v4, Magnific)","duracao":round(t0,2),"trechos":trechos},open("locucao.json","w"),ensure_ascii=False)
print("duracao",t0)
