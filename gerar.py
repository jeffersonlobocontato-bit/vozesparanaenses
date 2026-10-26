import asyncio, json, edge_tts, subprocess
V="pt-BR-AntonioNeural"
blocos=[l.strip() for l in open("blocos.txt",encoding="utf-8") if l.strip()]
async def um(i,t):
    c=edge_tts.Communicate(t,V,boundary="WordBoundary"); ws=[]
    with open(f"b{i:02d}.mp3","wb") as f:
        async for ch in c.stream():
            if ch["type"]=="audio": f.write(ch["data"])
            elif ch["type"]=="WordBoundary": ws.append({"w":ch["text"],"s":ch["offset"]/1e7,"e":(ch["offset"]+ch["duration"])/1e7})
    return ws
async def main():
    pal=[];t0=0.0;lst=[]
    pausa=0.7
    subprocess.run(["ffmpeg","-v","error","-y","-f","lavfi","-i","anullsrc=r=24000:cl=mono","-t",str(pausa),"sil.wav"],check=True)
    for i,t in enumerate(blocos):
        ws=await um(i,t)
        subprocess.run(["ffmpeg","-v","error","-y","-i",f"b{i:02d}.mp3","-ac","1","-ar","24000",f"b{i:02d}.wav"],check=True)
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"b{i:02d}.wav"]))
        for w in ws: pal.append({"w":w["w"],"s":round(w["s"]+t0,3),"e":round(w["e"]+t0,3),"bloco":i})
        lst.append(f"file b{i:02d}.wav"); t0+=d
        if i<len(blocos)-1: lst.append("file sil.wav"); t0+=pausa
    open("lista.txt","w").write("\n".join(lst))
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i","lista.txt","-c:a","libmp3lame","-b:a","160k","locucao.mp3"],check=True)
    json.dump({"voz":V,"duracao":round(t0,2),"palavras":pal},open("locucao.json","w"),ensure_ascii=False)
    print("duracao",t0)
asyncio.run(main())
