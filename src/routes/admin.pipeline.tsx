import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Volume2, VolumeX, Maximize2, Minimize2, Play, Radio, FileBarChart2, X } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { AGENDA_076, horaBrtAgora, type JobCron } from "@/lib/pipeline-agenda";
import { situacao, type Assinatura } from "@/lib/custos";
import {
  CIDADES_MAPA, ETAPAS, PARANA_VIEWBOX, POLO_DA_REGIAO, ciclosDoDia, cicloAtual, estadoDasEtapas, horaHoje, horasPoupadas,
  relatorioDoCiclo, rotuloHora, tocarPlim, type Ciclo, type EstadoEtapa, type EtapaId, type Evento, type Relatorio,
} from "@/lib/pipeline-ao-vivo";

export const Route = createFileRoute("/admin/pipeline")({
  component: PipelineAoVivo,
});

// Paleta da sala de controle (modo escuro próprio desta tela).
const C = {
  fundo: "#0A1412", painel: "#10201D", fundo2: "#0D1A18", borda: "#1E3531", borda2: "#2F4B45",
  txt: "#E9F1EE", mut: "#9FB3AD", laranja: "#E29F65", verde: "#5CC79E", vermelho: "#F0726A", ambar: "#E9C46A", espera: "#4E6862",
};
const PARANA_D = "m 397.01257,499.66114 -5.24,-0.03 -0.33,0.44 -1.74,0.24 -0.76,-0.07 -0.11,-0.39 -1.57,0.57 -1.35,1.43 -3.35,2.13 -1.44,-0.16 -1.23,-0.62 -3.13,-2.6 -1.03,-0.39 -0.76,-0.01 -2.84,0.73 -2.33,0.17 -0.81,-0.03 -1.42,-0.76 -1.11,0.14 -1.53,0.65 -0.59,1.47 -0.73,0.87 -1.87,0.98 -3.57,-0.41 -2,1.15 -0.72,0.77 -0.69,1.59 0.85,2.99 -0.87,0.86 -0.92,0.02 -0.75,0.38 -0.17,0.49 -1.33,-1.89 -4.25,0.13 -3.76,-0.43 -1.58,-1.18 -0.16,-0.41 -1.03,-0.63 -4.26,-0.36 -5.29,-1.68 -2.34,0.57 -2.69,-0.03 -2.02,-1.41 -0.32,-0.51 -1.06,-0.24 -0.53,-0.01 -0.71,0.37 -3.63,-0.02 0,0 -0.22,-1.21 -2.53,-4.18 0.02,-2.59 -0.99,-2.88 -3.42,-2.37 -1.09,1.13 -2.12,-0.11 -1.1,0.43 -1.07,0.9 -1.46,-1.08 -0.82,0.06 -0.28,-2.2 0.66,-1.57 1.07,-1.27 1.22,-2.18 0.06,-0.34 -0.49,-0.75 0.02,-1.24 0.9,-3.64 1.26,-3.02 -0.25,-2.3 1.28,-2.38 -0.21,-1.02 -0.84,-0.88 -0.31,-1.6 0.66,-1.06 0.79,-0.54 0,0 2.38,-1.56 0.36,-0.82 1.57,-7.92 0.33,-0.35 1.11,-0.32 1.66,-1.01 0.67,-0.68 1.45,-3.56 -0.02,-1.15 0.93,-2.33 1.11,-0.82 5.41,-2.27 0,0 3.26,-2.29 3.83,0.65 4.01,-0.11 3.27,0.29 1.21,-0.62 0.35,-0.6 0.73,-0.37 1.17,0.29 1.48,0.78 2.52,0.46 2.64,1.09 1.31,0.13 1.07,-0.54 2.58,-0.01 0.78,1 1.75,0.84 3.51,0.8 0.63,0.51 0.71,1.32 1.73,0.07 0.42,-0.34 1.65,0.15 0.66,0.54 5.31,0.13 2.97,-0.85 1.13,1.55 3.59,2.83 0.89,1.76 0.01,2.74 -0.39,0.58 -0.16,0.81 0.38,1.84 1.3,1.51 -0.08,1.76 -0.36,0.56 1.49,3 1.21,1.15 0.67,0.28 0.5,0.68 -0.05,0.89 0.92,1.97 0.6,0.29 0.25,0.44 -0.25,1.05 -1.27,2.13 0.32,2.04 0.6,0.38 1.01,0.21 2.38,-0.12 3.42,-0.53 0.5,0.39 1.58,-0.19 1.59,0.13 1.61,1.26 -0.14,0.41 -0.89,0.65 -0.69,3.3 0.35,0.78 1.07,0.53 0.65,-0.85 1.1,-2.76 0.76,-0.17 2.14,0.58 -0.4,1.95 0.73,3.3 1.42,0.58 0.16,1.32 0,0 -1.35,1.02 -0.61,1.48 -0.55,-0.12 0.27,-1.94 1.44,-0.95 -1.41,0.28 -0.89,0.49 -0.87,-0.02 -0.34,-0.39 -0.57,-0.17 -0.54,0.37 -0.28,0.93 0.52,0.8 -0.73,0.96 -0.3,0.1 -2.48,-0.53 -0.79,-0.54 -0.45,0.12 -0.18,0.9 0.34,0.37 1.61,0.56 1.4,-0.25 2.13,0.6 0.27,0.48 -0.97,0.68 -1.54,2.78 -1.24,0.77 -2.42,0.57 -0.2,0.45 2.95,-0.2 0.15,1.19 z";

const ESTILOS = `
@keyframes vzPulse{0%{box-shadow:0 0 0 0 rgba(226,159,101,.55)}70%{box-shadow:0 0 0 10px rgba(226,159,101,0)}100%{box-shadow:0 0 0 0 rgba(226,159,101,0)}}
@keyframes vzBlink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes vzScan{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@keyframes vzEntra{0%{opacity:0;transform:translateY(18px) scale(.98)}100%{opacity:1;transform:none}}
@keyframes vzVinheta{0%{opacity:0}8%{opacity:1}88%{opacity:1}100%{opacity:0}}
@keyframes vzNumero{0%{opacity:0;transform:scale(1.8)}25%{opacity:1;transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(.9)}}
@keyframes vzNovo{0%{background:rgba(226,159,101,.28)}100%{background:${C.fundo2}}}
.vz-pulse{animation:vzPulse 1.6s infinite}
.vz-blink{animation:vzBlink 1.1s infinite}
.vz-scan{animation:vzScan 1.8s linear infinite}
.vz-entra{animation:vzEntra .6s cubic-bezier(.16,1,.3,1) both}
.vz-novo{animation:vzNovo 2.4s ease-out both}
.vz-tv-oculto{cursor:none}
.vz-mono{font-family:"JetBrains Mono",ui-monospace,monospace}
.vz-cond{font-family:"Barlow Condensed",Barlow,sans-serif}
.vz-palco{font-family:Barlow,system-ui,sans-serif}
.vz-palco h1,.vz-palco h2,.vz-palco h3{font-family:Barlow,system-ui,sans-serif}
@media (prefers-reduced-motion: reduce){.vz-pulse,.vz-blink,.vz-scan,.vz-entra,.vz-novo{animation:none}}
`;

type Painel = {
  hoje: { coletadas: number; fatos: number; descartados: number; apuradas: number; redigidas: number; publicadas: number; automaticas: number; posts: number };
  revisao: number;
  fontes_ativas: number;
  instagram: { ativo: boolean | null; proximo: string | null; na_fila: number; grade: { tipo: string; classe: string | null; fundo: string | null; formato: string | null }[] };
  leitores: { agora: number; cidades_hoje: number; top: string[] };
  alertas: {
    http_falhas_1h: number; http_ultima_falha: string | null; http_total_1h?: number; http_ultima_jobs?: string | null; http_ultima_dns?: boolean;
    cron_falhas_24h: { job: string; n: number }[];
    fontes_paradas: { nome: string; ultimo: string | null }[]; fontes_paradas_total: number;
  };
};

type Replay = { ciclo: Ciclo; eventos: Evento[]; inicio: number; fim: number; comecouEm: number };
const REPLAY_SEG = 120;

const fmtHms = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour12: false });
const fmtHm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const dur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
  return (h ? String(h).padStart(2, "0") + ":" : "") + String(m).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
};
const txt = (v: unknown) => (typeof v === "string" ? v : "");

function lerSom(): boolean {
  try { return localStorage.getItem("vz-pipeline-som") === "1"; } catch { return false; }
}

function PipelineAoVivo() {
  const [jobs, setJobs] = useState<Pick<JobCron, "jobname" | "schedule">[]>(AGENDA_076);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [custoHoje, setCustoHoje] = useState<number | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [replay, setReplay] = useState<Replay | null>(null);
  const [som, setSom] = useState(false);
  const [tv, setTv] = useState(false);
  const [cursorOculto, setCursorOculto] = useState(false);
  const [vinheta, setVinheta] = useState<{ nome: string; desde: number } | null>(null);
  const [cascata, setCascata] = useState(0);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  // Palco fixo 1920×1080 (a mesma proporção da maquete), escalado para caber
  // na largura do admin ou na tela inteira da TV.
  const [escala, setEscala] = useState(0.6);
  const audio = useRef<AudioContext | null>(null);
  const vistos = useRef<Set<string> | null>(null);
  const primeiraVista = useRef(new Map<string, number>());
  const cicloAnterior = useRef<{ inicio: number; ativo: boolean } | null>(null);

  useEffect(() => { setSom(lerSom()); }, []);
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(i); }, []);

  // Grade de ciclos (cron) e janela do ciclo atual
  const ciclos = useMemo(() => ciclosDoDia(jobs), [jobs]);
  const agoraH = horaBrtAgora(new Date(agora));
  const situ = cicloAtual(ciclos, agoraH);
  const inicioCicloVivo = situ.atual ? horaHoje(situ.atual.inicio, new Date(agora)) : new Date(agora - 30 * 60_000);

  // ---------------------------------------------------------- carga
  const carregarEventos = useCallback(async (desde: Date) => {
    const sb = await getExternalBrowser();
    const { data, error } = await sb.rpc("pipeline_eventos", { p_desde: desde.toISOString() });
    if (error) throw new Error(/pipeline_eventos|does not exist|schema cache/i.test(error.message) ? "A migração 087 (pipeline ao vivo) ainda não foi aplicada no banco." : error.message);
    return (data ?? []) as Evento[];
  }, []);

  const carregarPainel = useCallback(async () => {
    try {
      const sb = await getExternalBrowser();
      const [p, c, pr, a] = await Promise.all([
        sb.rpc("pipeline_painel"),
        sb.rpc("custos_resumo"),
        sb.from("custos_parametros").select("chave, valor"),
        sb.from("assinaturas").select("*"),
      ]);
      if (p.error) throw new Error(p.error.message);
      setPainel(p.data as Painel);
      if (!c.error) setCustoHoje(Number((c.data as { hoje?: { total_brl?: number } })?.hoje?.total_brl ?? 0));
      if (!pr.error) setParams(Object.fromEntries(((pr.data ?? []) as { chave: string; valor: number }[]).map((x) => [x.chave, Number(x.valor)])));
      if (!a.error) setAssinaturas((a.data ?? []) as Assinatura[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o painel.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const { data, error } = await sb.rpc("pipeline_agenda");
        if (!error && data?.length) setJobs(data as JobCron[]);
      } catch { /* fica a grade de referência */ }
    })();
    carregarPainel();
    const i = setInterval(carregarPainel, 30_000);
    return () => clearInterval(i);
  }, [carregarPainel]);

  const inicioMs = inicioCicloVivo.getTime();
  useEffect(() => {
    if (replay) return;
    let vivo = true;
    const busca = async () => {
      try {
        const evs = await carregarEventos(new Date(inicioMs));
        if (vivo) { setEventos(evs); setErro(null); }
      } catch (e) { if (vivo) setErro(e instanceof Error ? e.message : "Erro ao carregar os eventos."); }
    };
    busca();
    const i = setInterval(busca, 5000);
    return () => { vivo = false; clearInterval(i); };
  }, [carregarEventos, inicioMs, replay]);

  // ---------------------------------------------------------- relógio da tela (ao vivo ou replay)
  const relogioReplay = replay
    ? replay.inicio + Math.max(0, Math.min(1, (agora - replay.comecouEm) / (REPLAY_SEG * 1000))) * (replay.fim - replay.inicio)
    : null;
  const agoraTela = new Date(relogioReplay ?? agora);
  const evsTela = replay ? replay.eventos.filter((e) => new Date(e.t).getTime() <= agoraTela.getTime()) : eventos;
  const inicioTela = replay ? new Date(replay.inicio) : inicioCicloVivo;
  const estados = estadoDasEtapas(evsTela, agoraTela, inicioTela);

  // Primeira vez que cada evento aparece na tela (para o efeito de digitação e o "novo")
  for (const e of evsTela) if (!primeiraVista.current.has(e.etapa + e.id)) primeiraVista.current.set(e.etapa + e.id, agora);

  // Som a cada matéria publicada
  useEffect(() => {
    const pubs = evsTela.filter((e) => e.etapa === "publicacao");
    if (vistos.current === null) { vistos.current = new Set(pubs.map((e) => e.id)); return; }
    const novas = pubs.filter((e) => !vistos.current!.has(e.id));
    novas.forEach((e) => vistos.current!.add(e.id));
    if (novas.length && som) {
      try {
        audio.current ??= new AudioContext();
        tocarPlim(audio.current);
      } catch { /* sem áudio */ }
    }
  }, [evsTela, som]);

  // Vinheta quando um ciclo começa; relatório quando ele termina (ao vivo)
  useEffect(() => {
    if (replay) return;
    const atual = situ.atual ? { inicio: situ.atual.inicio, ativo: situ.ativo } : null;
    const ant = cicloAnterior.current;
    cicloAnterior.current = atual;
    if (!ant || !atual) return;
    if (atual.ativo && (!ant.ativo || ant.inicio !== atual.inicio)) {
      setVinheta({ nome: `Ciclo ${situ.atual!.nome} · ${rotuloHora(situ.atual!.inicio)}`, desde: Date.now() });
    }
    if (ant.ativo && !atual.ativo && ant.inicio === atual.inicio) {
      setRelatorio(relatorioDoCiclo(`${situ.atual!.nome} · ${rotuloHora(situ.atual!.inicio)}`, eventos, params));
    }
  }, [situ.atual, situ.ativo, replay, eventos, params]);

  useEffect(() => {
    if (!vinheta) return;
    const t = setTimeout(() => { setVinheta(null); setCascata((c) => c + 1); }, 4200);
    return () => clearTimeout(t);
  }, [vinheta]);

  // Fim do replay → relatório
  useEffect(() => {
    if (!replay) return;
    if (agora - replay.comecouEm >= REPLAY_SEG * 1000 + 1500 && !relatorio) {
      setRelatorio(relatorioDoCiclo(`${replay.ciclo.nome} · ${rotuloHora(replay.ciclo.inicio)} (replay)`, replay.eventos, params));
    }
  }, [agora, replay, relatorio, params]);

  useEffect(() => {
    if (!relatorio || !tv) return;
    const t = setTimeout(() => setRelatorio(null), 25_000);
    return () => clearTimeout(t);
  }, [relatorio, tv]);

  // ---------------------------------------------------------- ações
  const iniciarReplay = async () => {
    const alvo = situ.ultimoConcluido ?? situ.atual;
    if (!alvo) { setErro("Ainda não houve ciclo hoje para reproduzir."); return; }
    try {
      const ini = horaHoje(alvo.inicio, new Date(agora)).getTime();
      const fim = Math.min(Date.now(), horaHoje(alvo.fim, new Date(agora)).getTime() + 2 * 3600_000);
      const sb = await getExternalBrowser();
      const { data, error } = await sb.rpc("pipeline_eventos", { p_desde: new Date(ini).toISOString(), p_ate: new Date(fim).toISOString() });
      if (error) throw new Error(error.message);
      const evs = (data ?? []) as Evento[];
      if (!evs.length) { setErro(`O ciclo das ${rotuloHora(alvo.inicio)} não teve atividade para reproduzir.`); return; }
      vistos.current = new Set();
      primeiraVista.current = new Map();
      setRelatorio(null);
      setReplay({ ciclo: alvo, eventos: evs, inicio: ini, fim: Math.max(fim, new Date(evs[evs.length - 1].t).getTime()), comecouEm: Date.now() + 4200 });
      setVinheta({ nome: `Replay · ${alvo.nome} · ${rotuloHora(alvo.inicio)}`, desde: Date.now() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível montar o replay.");
    }
  };
  const voltarAoVivo = () => { setReplay(null); vistos.current = null; setRelatorio(null); };

  const alternarSom = () => {
    const novo = !som;
    setSom(novo);
    try { localStorage.setItem("vz-pipeline-som", novo ? "1" : "0"); } catch { /* sem storage */ }
    if (novo) { try { audio.current ??= new AudioContext(); tocarPlim(audio.current); } catch { /* sem áudio */ } }
  };

  const alternarTv = async () => {
    if (!tv) {
      setTv(true);
      try { await raiz.current?.requestFullscreen?.(); } catch { /* segue no modo fixo */ }
    } else {
      setTv(false);
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ok */ }
    }
  };
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth;
      const h = tv ? el.clientHeight : Infinity;
      setEscala(Math.max(0.2, Math.min(w / 1920, h / 1080)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tv]);
  useEffect(() => {
    const sair = () => { if (!document.fullscreenElement) setTv(false); };
    document.addEventListener("fullscreenchange", sair);
    return () => document.removeEventListener("fullscreenchange", sair);
  }, []);
  useEffect(() => {
    if (!tv) { setCursorOculto(false); return; }
    let t = setTimeout(() => setCursorOculto(true), 3000);
    const mexeu = () => { setCursorOculto(false); clearTimeout(t); t = setTimeout(() => setCursorOculto(true), 3000); };
    window.addEventListener("mousemove", mexeu);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", mexeu); };
  }, [tv]);

  // ---------------------------------------------------------- números
  const hoje = painel?.hoje;
  const horas = hoje ? horasPoupadas(hoje) : 0;
  const alertas = montarAlertas(painel, assinaturas);

  let contagemRotulo: string, contagem: string, contagemTom: "laranja" | "verde" | "neutro" = "neutro";
  if (replay) {
    contagemRotulo = `Replay · ${replay.ciclo.nome} ${rotuloHora(replay.ciclo.inicio)}`;
    contagem = fmtHms(agoraTela).slice(0, 5) + " · " + Math.round((replay.fim - replay.inicio) / (REPLAY_SEG * 1000)) + "×";
    contagemTom = "laranja";
  } else if (situ.ativo && situ.atual) {
    contagemRotulo = `Ciclo ${situ.atual.nome} ${rotuloHora(situ.atual.inicio)} · rodando`;
    contagem = dur(agora - inicioCicloVivo.getTime());
    contagemTom = "laranja";
  } else if (situ.proximo) {
    contagemRotulo = `Próximo: ${situ.proximo.nome} · ${rotuloHora(situ.proximo.inicio)}`;
    contagem = dur(horaHoje(situ.proximo.inicio, new Date(agora)).getTime() - agora);
    contagemTom = "verde";
  } else {
    contagemRotulo = "Ciclos de hoje concluídos";
    contagem = "amanhã";
  }

  const conteudo = (
    <div
      ref={raiz}
      className={`${cursorOculto ? "vz-tv-oculto" : ""} ${tv ? "fixed inset-0 z-[200] flex items-center justify-center" : "w-full overflow-hidden rounded-2xl"}`}
      style={{ background: C.fundo }}
    >
      <style>{ESTILOS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=JetBrains+Mono:wght@400;500&display=swap" />
      <div style={{ width: 1920 * escala, height: 1080 * escala, position: "relative", overflow: "hidden", flex: "none" }}>
      <div className="vz-palco flex flex-col gap-4"
        style={{ width: 1920, height: 1080, padding: 28, boxSizing: "border-box", transform: `scale(${escala})`, transformOrigin: "top left", background: C.fundo, color: C.txt, position: "absolute", left: 0, top: 0 }}>

      {/* Cabeçalho */}
      <header className="flex flex-none items-center gap-6" style={{ height: 64 }}>
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true"><path d="M8 6h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 7v-7H8a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="#1E3B33" /><path d="M14 15l8 10 8-10" fill="none" stroke={C.txt} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="36" cy="8" r="4.5" fill={C.laranja} /></svg>
          <div className="flex flex-col leading-none">
            <span style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 24, fontWeight: 600 }}>vozes <span style={{ color: C.mut, fontWeight: 500 }}>paranaenses</span></span>
            <span className="vz-cond mt-1.5 uppercase" style={{ fontSize: 13, letterSpacing: ".22em", color: C.mut }}>Sala de controle do pipeline</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ border: `1px solid ${C.borda}`, background: C.painel }}>
          <span className="vz-blink h-2.5 w-2.5 rounded-full" style={{ background: replay ? C.laranja : C.vermelho }} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".14em" }}>{replay ? "REPLAY" : "AO VIVO"}</span>
          <span style={{ fontSize: 13, color: C.mut }}>{replay ? "ciclo real, em velocidade acelerada" : "atualiza a cada 5 s"}</span>
        </div>
        <div className="flex-grow" />
        <div className="flex gap-2">
          {replay ? (
            <BotaoTela onClick={voltarAoVivo} icone={<Radio className="h-4 w-4" />} ativo>Voltar ao vivo</BotaoTela>
          ) : (
            <BotaoTela onClick={iniciarReplay} icone={<Play className="h-4 w-4" />}>Replay do último ciclo</BotaoTela>
          )}
          <BotaoTela
            onClick={() => {
              const nome = replay ? `${replay.ciclo.nome} · ${rotuloHora(replay.ciclo.inicio)}` : situ.atual ? `${situ.atual.nome} · ${rotuloHora(situ.atual.inicio)}` : "Últimos 30 min";
              setRelatorio(relatorioDoCiclo(nome, evsTela, params));
            }}
            icone={<FileBarChart2 className="h-4 w-4" />}
          >Relatório do ciclo</BotaoTela>
          <BotaoTela onClick={alternarSom} icone={som ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} ativo={som} rotuloAria={som ? "Desligar o som" : "Ligar o som"}>{som ? "Som ligado" : "Som desligado"}</BotaoTela>
          <BotaoTela onClick={alternarTv} icone={tv ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}>{tv ? "Sair da tela cheia" : "Tela cheia"}</BotaoTela>
        </div>
        <div className="flex flex-col items-end leading-none">
          <span className="vz-mono" style={{ fontSize: 30 }}>{fmtHms(agoraTela)}</span>
          <span className="mt-1.5" style={{ fontSize: 13, color: C.mut }}>{agoraTela.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" })} · Brasília</span>
        </div>
      </header>

      {erro && (
        <div className="rounded-xl px-4 py-2 text-sm" style={{ background: "rgba(240,114,106,.12)", border: "1px solid rgba(240,114,106,.5)", color: "#F7A39D" }}>{erro}</div>
      )}

      {/* Linha do dia */}
      <section aria-label="Ciclos do dia" className="flex flex-none flex-row gap-4" style={{ height: 96 }}>
        <div className="flex w-[360px] flex-none flex-col justify-center rounded-2xl px-5 py-3"
          style={{ background: contagemTom === "laranja" ? "rgba(226,159,101,.08)" : C.painel, border: `1px solid ${contagemTom === "laranja" ? "rgba(226,159,101,.6)" : C.borda}` }}>
          <span className="vz-cond uppercase" style={{ fontSize: 13, letterSpacing: ".16em", color: contagemTom === "laranja" ? C.laranja : contagemTom === "verde" ? C.verde : C.mut }}>{contagemRotulo}</span>
          <span className="vz-mono" style={{ fontSize: 36, lineHeight: 1.1 }}>{contagem}</span>
        </div>
        <LinhaDoDia ciclos={ciclos} agoraH={horaBrtAgora(agoraTela)} />
      </section>

      {/* Área principal */}
      <div className="flex min-h-0 flex-grow flex-row gap-4">
        <div key={cascata} className="grid min-h-0 min-w-0 flex-grow grid-cols-4 grid-rows-2 gap-4">
          <CardColeta n={0} e={estados.coleta} fontes={painel?.fontes_ativas ?? 0} vistos={primeiraVista.current} agora={agora} />
          <CardCrivo n={1} e={estados.crivo} />
          <CardApuracao n={2} e={estados.apuracao} />
          <CardRedacao n={3} e={estados.redacao} vistos={primeiraVista.current} agora={agora} />
          <CardCriticidade n={4} e={estados.criticidade} />
          <CardImagem n={5} e={estados.imagem} />
          <CardPublicacao n={6} e={estados.publicacao} />
          <CardRedes n={7} e={estados.redes} painel={painel} agora={agora} />
        </div>

        <aside className="flex min-h-0 w-[420px] flex-none flex-col gap-4">
          <section aria-label="Horas poupadas" className="rounded-2xl px-5 py-4" style={{ background: C.painel, border: `1px solid ${C.borda}` }}>
            <span className="vz-cond uppercase" style={{ fontSize: 13, letterSpacing: ".16em", color: C.mut }}>Trabalho humano poupado hoje</span>
            <div className="flex items-baseline gap-2">
              <ContadorAnimado valor={horas} className="font-semibold" style={{ fontSize: 88, lineHeight: 1, color: C.laranja, fontFamily: "'Barlow Condensed', Barlow, sans-serif" }} />
              <span style={{ fontSize: 28, color: C.laranja, fontWeight: 600 }}>horas</span>
            </div>
            <span style={{ fontSize: 13, color: C.mut }}>≈ {Math.round(horas / 7)} profissionais em turno de 7 h · cada matéria publicada soma</span>
          </section>

          <section aria-label="Hoje" className="grid grid-cols-3 gap-3 rounded-2xl px-5 py-4" style={{ background: C.painel, border: `1px solid ${C.borda}` }}>
            <Numero rotulo="coletadas" valor={hoje?.coletadas ?? "—"} />
            <Numero rotulo="no ar" valor={hoje?.publicadas ?? "—"} cor={C.verde} />
            <Numero rotulo="custo hoje" valor={custoHoje == null ? "—" : `R$ ${custoHoje.toFixed(2).replace(".", ",")}`} pequeno />
          </section>

          <section aria-label="Alertas" className="flex min-h-0 flex-grow flex-col gap-2.5 overflow-hidden rounded-2xl px-5 py-4" style={{ background: C.painel, border: `1px solid ${C.borda}` }}>
            <div className="flex items-center">
              <span className="vz-cond uppercase" style={{ fontSize: 13, letterSpacing: ".16em", color: C.mut }}>Alertas e orientação</span>
              <span className="ml-auto vz-mono" style={{ fontSize: 12, color: C.mut }}>{alertas.filter((a) => a.tom !== "ok").length} abertos</span>
            </div>
            {alertas.map((a, i) => (
              <div key={i} className="flex gap-2.5 rounded-xl px-3 py-2.5" style={{ background: a.tom === "erro" ? "rgba(240,114,106,.1)" : a.tom === "aviso" ? "rgba(233,196,106,.08)" : "rgba(92,199,158,.08)", border: `1px solid ${a.tom === "erro" ? "rgba(240,114,106,.5)" : a.tom === "aviso" ? "rgba(233,196,106,.4)" : "rgba(92,199,158,.35)"}` }}>
                <span className={`mt-1.5 h-2.5 w-2.5 flex-none rounded-full ${a.tom === "erro" ? "vz-blink" : ""}`} style={{ background: a.tom === "erro" ? C.vermelho : a.tom === "aviso" ? C.ambar : C.verde }} />
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{a.titulo}</span>
                  <span style={{ fontSize: 13, color: "#C9D6D2", lineHeight: 1.3 }}>{a.nota}</span>
                  {a.link && !tv && <Link to={a.link} className="text-xs font-semibold" style={{ color: C.laranja }}>Abrir</Link>}
                </div>
              </div>
            ))}
          </section>

          <section aria-label="Leitores agora" className="flex items-center gap-4 rounded-2xl px-5 py-3" style={{ background: C.painel, border: `1px solid ${C.borda}` }}>
            <div className="flex flex-col">
              <span className="vz-cond uppercase" style={{ fontSize: 13, letterSpacing: ".16em", color: C.mut }}>Leituras · 5 min</span>
              <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, fontFamily: "'Barlow Condensed', Barlow, sans-serif" }}>{painel?.leitores.agora ?? "—"}</span>
            </div>
            <div className="ml-auto flex flex-col gap-0.5 text-right" style={{ fontSize: 13 }}>
              <span style={{ color: "#C9D6D2" }}>{painel?.leitores.top.length ? painel.leitores.top.join(" · ") : "—"}</span>
              <span style={{ color: C.mut }}>{painel?.leitores.cidades_hoje ?? 0} cidades diferentes hoje</span>
            </div>
          </section>
        </aside>
      </div>

      {/* Registro */}
      <footer className="flex h-11 flex-none items-center gap-6 overflow-hidden whitespace-nowrap rounded-xl px-4 vz-mono" style={{ background: C.fundo2, border: `1px solid ${C.borda}`, fontSize: 13 }}>
        <span className="flex-none" style={{ color: C.laranja }}>REGISTRO</span>
        {[...evsTela].slice(-6).reverse().map((e) => (
          <span key={e.etapa + e.id} className="flex-none" style={{ color: e.etapa === "publicacao" ? "#9ED9C1" : C.mut }}>
            {fmtHms(new Date(e.t))} {ETAPAS.find((x) => x.id === e.etapa)?.nome.toLowerCase()} · {(txt(e.d.titulo) || txt(e.d.motivo) || txt(e.d.acao)).slice(0, 60)}
          </span>
        ))}
        {!evsTela.length && <span style={{ color: C.mut }}>sem atividade no ciclo até agora</span>}
      </footer>

      </div>
      </div>
      {vinheta && <Vinheta nome={vinheta.nome} desde={vinheta.desde} agora={agora} />}
      {relatorio && <ModalRelatorio r={relatorio} onFechar={() => setRelatorio(null)} />}
    </div>
  );

  return tv ? conteudo : <div className="p-2 md:p-4">{conteudo}</div>;
}

// ================================================================ alertas

type Alerta = { tom: "erro" | "aviso" | "ok"; titulo: string; nota: string; link?: string };

function montarAlertas(p: Painel | null, assinaturas: Assinatura[]): Alerta[] {
  if (!p) return [];
  const out: Alerta[] = [];
  const a = p.alertas;
  if (a.http_falhas_1h > 0) {
    // Uma ou duas por hora é instabilidade normal de rede (o cron chama de novo
    // minutos depois); vermelho só quando a taxa sobe.
    const n = a.http_falhas_1h;
    const total = a.http_total_1h ?? 0;
    const grave = n >= 3 || (total > 0 && n / total > 0.1);
    const suspeitos = a.http_ultima_jobs ? ` Na hora rodavam: ${a.http_ultima_jobs.replace(/vozes-/g, "")}.` : "";
    const causa = a.http_ultima_dns
      ? "O banco não achou o endereço da função em 10 s (instabilidade de rede do Supabase, não erro do código)."
      : "A função demorou mais de 10 s para responder; ela costuma terminar o trabalho mesmo assim.";
    out.push({
      tom: grave ? "erro" : "aviso",
      titulo: `${n} de ${total || "?"} chamada${total === 1 ? "" : "s"} sem resposta na última hora`,
      nota: `${causa}${suspeitos} ${grave ? "Se continuar, veja os logs da função no Supabase." : "A próxima rodada do agendador tenta de novo."}`,
    });
  }
  for (const j of a.cron_falhas_24h) {
    out.push({ tom: "erro", titulo: `Agendamento ${j.job} falhou ${j.n}× em 24 h`, nota: "Confira o job no cron do banco externo (migrações 076 e 083).", link: "/admin/painel" });
  }
  if (a.fontes_paradas_total > 0) {
    out.push({ tom: a.fontes_paradas_total > 20 ? "erro" : "aviso",
      titulo: `${a.fontes_paradas_total} fonte${a.fontes_paradas_total === 1 ? "" : "s"} sem leitura há mais de 30 h`,
      nota: `Ex.: ${a.fontes_paradas.map((f) => f.nome).join(", ")}. Confira o endereço em Fontes ou desative quem não publica mais.`, link: "/admin/fontes" });
  }
  if (p.revisao > 0) {
    out.push({ tom: "aviso", titulo: `${p.revisao} matéria${p.revisao === 1 ? "" : "s"} esperando o editor`, nota: "Seguradas pela criticidade. Abra Matérias e decida: publicar, editar ou rejeitar.", link: "/admin" });
  }
  if (p.instagram.ativo === false) {
    out.push({ tom: "aviso", titulo: "Robô do Instagram desligado", nota: "Nada vai para as redes até ligar em Instagram › Configuração.", link: "/admin/instagram" });
  }
  for (const s of assinaturas.map((x) => ({ x, s: situacao(x) })).filter((y) => y.s.nivel <= 2).slice(0, 2)) {
    out.push({ tom: s.s.nivel === 0 ? "erro" : "aviso", titulo: `${s.x.nome}: ${s.s.rotulo.toLowerCase()}`, nota: "Atualize saldo ou vencimento em Custos para o alerta sair.", link: "/admin/custos" });
  }
  if (!out.length) out.push({ tom: "ok", titulo: "Tudo rodando", nota: "Nenhuma falha de função, fonte parada ou fila acumulada." });
  return out;
}

// ================================================================ peças

function BotaoTela({ children, onClick, icone, ativo, rotuloAria }: { children: ReactNode; onClick: () => void; icone: ReactNode; ativo?: boolean; rotuloAria?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={rotuloAria}
      className="flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-semibold"
      style={{ border: `1px solid ${ativo ? C.laranja : C.borda}`, background: ativo ? C.laranja : C.painel, color: ativo ? "#12201E" : C.txt }}>
      {icone}{children}
    </button>
  );
}

function Numero({ rotulo, valor, cor, pequeno }: { rotulo: string; valor: ReactNode; cor?: string; pequeno?: boolean }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: pequeno ? 26 : 36, fontWeight: 700, lineHeight: 1.05, color: cor ?? C.txt, fontFamily: "'Barlow Condensed', Barlow, sans-serif" }}>{valor}</span>
      <span style={{ fontSize: 13, color: C.mut }}>{rotulo}</span>
    </div>
  );
}

function ContadorAnimado({ valor, className, style }: { valor: number; className?: string; style?: CSSProperties }) {
  const [mostrado, setMostrado] = useState(0);
  const de = useRef(0);
  useEffect(() => {
    const inicio = performance.now();
    const origem = de.current;
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / 1600);
      const v = origem + (valor - origem) * (1 - Math.pow(1 - p, 3));
      setMostrado(v);
      if (p < 1) raf = requestAnimationFrame(passo); else de.current = valor;
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [valor]);
  return <span className={className} style={style}>{mostrado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>;
}

function LinhaDoDia({ ciclos, agoraH }: { ciclos: Ciclo[]; agoraH: number }) {
  const X = (h: number) => `${(Math.max(0, Math.min(18, h - 6)) / 18) * 100}%`;
  return (
    <div className="relative flex-grow rounded-2xl px-5 pb-2.5 pt-3" style={{ background: C.painel, border: `1px solid ${C.borda}` }}>
      <div className="relative h-11">
        {ciclos.map((c) => {
          const feito = c.fim <= agoraH, atual = c.inicio <= agoraH && agoraH < c.fim;
          return (
            <div key={c.inicio} className="absolute top-1 overflow-hidden rounded-lg px-2 py-0.5"
              style={{ left: X(c.inicio), width: `calc(${(Math.max(0.8, c.fim - c.inicio) / 18) * 100}% - 4px)`, height: 36,
                background: atual ? "rgba(226,159,101,.2)" : feito ? "rgba(92,199,158,.12)" : "transparent",
                border: `1px solid ${atual ? C.laranja : feito ? "rgba(92,199,158,.45)" : C.borda2}` }}>
              <div className="whitespace-nowrap" style={{ fontSize: 12, fontWeight: 700, color: atual ? "#F2B98A" : feito ? "#9ED9C1" : C.mut }}>{rotuloHora(c.inicio)}</div>
              <div className="truncate" style={{ fontSize: 11, color: atual ? "#F2B98A" : feito ? "#9ED9C1" : C.mut }}>{c.nome}</div>
            </div>
          );
        })}
        <div className="absolute -bottom-1.5 -top-1" style={{ left: X(agoraH), width: 2, background: C.vermelho }} />
        <div className="absolute -top-2.5 -translate-x-1/2 rounded px-1.5 vz-mono" style={{ left: X(agoraH), fontSize: 11, background: C.vermelho, color: "#12201E" }}>agora</div>
      </div>
      <div className="relative mt-1 h-4">
        {[6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 vz-mono" style={{ left: X(h), fontSize: 11, color: C.mut }}>{String(h % 24).padStart(2, "0")}h</span>
        ))}
      </div>
    </div>
  );
}

const ROTULO_STATUS = { aguardando: "aguardando", rodando: "rodando", concluido: "concluído" } as const;
const COR_STATUS = { aguardando: C.espera, rodando: C.laranja, concluido: C.verde } as const;

function Card({ n, e, id, children, alerta }: { n: number; e: EstadoEtapa; id: EtapaId; children: ReactNode; alerta?: boolean }) {
  const etapa = ETAPAS.find((x) => x.id === id)!;
  const cor = COR_STATUS[e.status];
  return (
    <article className="vz-entra relative flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-2xl px-[18px] py-4"
      style={{ animationDelay: `${n * 110}ms`, background: C.painel,
        border: `1px solid ${alerta ? "rgba(240,114,106,.6)" : e.status === "rodando" ? "rgba(226,159,101,.55)" : e.status === "concluido" ? "rgba(92,199,158,.35)" : C.borda}` }}>
      <div className="absolute left-0 top-0 h-[3px] transition-all duration-1000" style={{ width: `${Math.round(e.progresso * 100)}%`, background: cor }} />
      <div className="flex items-center gap-2.5">
        <span className={`h-3 w-3 rounded-full ${e.status === "rodando" ? "vz-pulse" : ""}`} style={{ background: cor }} />
        <span className="vz-cond" style={{ fontSize: 13, letterSpacing: ".14em", color: C.mut }}>{String(n + 1).padStart(2, "0")}</span>
        <h2 className="truncate" style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{etapa.nome}</h2>
        <span className="vz-cond ml-auto flex-none uppercase" style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".1em", color: cor }}>{ROTULO_STATUS[e.status]}</span>
      </div>
      <div className="vz-mono truncate" style={{ fontSize: 11, color: C.mut }}>{etapa.funcao}{e.ultimo ? ` · último ${fmtHm(e.ultimo.t)}` : ""}</div>
      {children}
    </article>
  );
}

function Grande({ valor, rotulo, cor }: { valor: ReactNode; rotulo: ReactNode; cor?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span style={{ fontSize: 56, fontWeight: 700, lineHeight: 0.95, color: cor ?? C.txt, fontFamily: "'Barlow Condensed', Barlow, sans-serif" }}>{valor}</span>
      <span style={{ fontSize: 14, color: C.mut, lineHeight: 1.25 }}>{rotulo}</span>
    </div>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return <div className="mt-auto rounded-lg px-3 py-2" style={{ background: C.fundo2, fontSize: 13, color: C.mut }}>{children}</div>;
}

function CardColeta({ n, e, fontes, vistos, agora }: { n: number; e: EstadoEtapa; fontes: number; vistos: Map<string, number>; agora: number }) {
  const ultimos = e.eventos.slice(-3).reverse();
  const fontesLidas = new Set(e.eventos.map((x) => txt(x.d.fonte))).size;
  return (
    <Card n={n} e={e} id="coleta">
      <Grande valor={e.eventos.length} rotulo={<>notícias lidas<br />{fontesLidas} de {fontes || "—"} fontes</>} />
      <div className="mt-auto flex flex-col gap-1.5">
        {ultimos.map((x) => {
          const novo = agora - (vistos.get("coleta" + x.id) ?? 0) < 2500;
          return (
            <div key={x.id} className={`flex flex-col rounded-lg px-2.5 py-1.5 ${novo ? "vz-novo" : ""}`} style={{ background: C.fundo2 }}>
              <span className="vz-mono" style={{ fontSize: 11, color: C.laranja }}>{txt(x.d.fonte)}</span>
              <span className="truncate" style={{ fontSize: 13 }}>{txt(x.d.titulo)}</span>
            </div>
          );
        })}
        {!ultimos.length && <Vazio>Aguardando a próxima janela de coleta.</Vazio>}
      </div>
    </Card>
  );
}

function CardCrivo({ n, e }: { n: number; e: EstadoEtapa }) {
  const ok = e.eventos.filter((x) => x.d.ok).length;
  const desc = e.eventos.length - ok;
  const motivos = new Map<string, number>();
  for (const x of e.eventos) if (!x.d.ok && x.d.motivo) motivos.set(txt(x.d.motivo), (motivos.get(txt(x.d.motivo)) ?? 0) + 1);
  const top = [...motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = top[0]?.[1] ?? 1;
  const ultimoOk = [...e.eventos].reverse().find((x) => x.d.ok);
  return (
    <Card n={n} e={e} id="crivo">
      <div className="flex gap-5">
        <Grande valor={ok} rotulo="fatos únicos" cor={C.verde} />
        <Grande valor={desc} rotulo="descartados" cor={C.mut} />
      </div>
      {ultimoOk && (
        <div className="rounded-lg px-3 py-2" style={{ background: C.fundo2, border: `1px solid ${C.borda}`, fontSize: 13 }}>
          Novo fato · {txt(ultimoOk.d.tema) || "geral"}{ultimoOk.d.cidade ? ` · ${txt(ultimoOk.d.cidade).replace(/-/g, " ")}` : ""}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-1.5">
        <span className="vz-cond uppercase" style={{ fontSize: 12, letterSpacing: ".12em", color: C.mut }}>Motivos de descarte</span>
        {top.map(([m, k]) => (
          <div key={m} className="flex items-center gap-2">
            <div className="relative h-[22px] flex-grow overflow-hidden rounded-md" style={{ background: C.fundo2 }}>
              <div className="absolute inset-y-0 left-0 transition-all duration-1000" style={{ width: `${(k / max) * 100}%`, background: "rgba(159,179,173,.28)" }} />
              <span className="relative block truncate pl-2" style={{ fontSize: 12, lineHeight: "22px" }}>{m}</span>
            </div>
            <span className="w-7 text-right vz-mono" style={{ fontSize: 12 }}>{k}</span>
          </div>
        ))}
        {!top.length && <Vazio>Nenhum descarte neste ciclo.</Vazio>}
      </div>
    </Card>
  );
}

function CardApuracao({ n, e }: { n: number; e: EstadoEtapa }) {
  const u = e.ultimo;
  const chaves: [string, string][] = [["quem", "Quem"], ["oque", "O quê"], ["quando", "Quando"], ["onde", "Onde"], ["como", "Como"], ["porque", "Por quê"]];
  const completas = e.eventos.filter((x) => x.d.quem && x.d.oque && x.d.quando && x.d.onde && x.d.porque).length;
  return (
    <Card n={n} e={e} id="apuracao">
      <div className="line-clamp-2 min-h-[46px] flex-none" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 18, fontWeight: 500, lineHeight: 1.25 }}>
        {u ? txt(u.d.titulo) || "Pauta sem título" : "Aguardando pautas do crivo…"}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {chaves.map(([k, nome]) => {
          const ok = !!u?.d[k];
          return (
            <div key={k} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: ok ? "rgba(92,199,158,.1)" : C.fundo2, border: `1px solid ${ok ? "rgba(92,199,158,.4)" : C.borda}` }}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke={ok ? C.verde : C.mut} strokeWidth="1.5" />{ok && <path d="M4.5 8.2l2.3 2.3 4.7-4.8" fill="none" stroke={C.verde} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}</svg>
              <span style={{ fontSize: 14, fontWeight: 600, color: ok ? C.verde : C.mut }}>{nome}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex gap-4" style={{ fontSize: 14, color: C.mut }}>
        <span><strong style={{ fontSize: 26, color: C.txt }}>{completas}</strong> completas</span>
        <span><strong style={{ fontSize: 26, color: C.txt }}>{e.eventos.length - completas}</strong> sem 5W1H completo</span>
      </div>
    </Card>
  );
}

function CardRedacao({ n, e, vistos, agora }: { n: number; e: EstadoEtapa; vistos: Map<string, number>; agora: number }) {
  const u = e.ultimo;
  const titulo = u ? txt(u.d.titulo) : "";
  const desde = u ? vistos.get("redacao" + u.id) ?? 0 : 0;
  const chars = Math.min(titulo.length, Math.floor((agora - desde) / 1000 * 22) + 6);
  const pecasProntas = chars >= titulo.length ? Math.min(5, Math.floor((agora - desde) / 1000 - titulo.length / 22) + 1) : 0;
  return (
    <Card n={n} e={e} id="redacao">
      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: C.fundo2, border: `1px solid ${C.borda}` }}>
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full" style={{ background: "#1E3B33" }}>
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 15l2.5-.6L14 6l-2-2-8.5 8.5L3 15z" fill="none" stroke={C.laranja} strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </span>
        <div className="flex flex-col leading-tight">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{u ? txt(u.d.agente) || `Redator ${txt(u.d.editoria) || "da editoria"}` : "Redatores em espera"}</span>
          <span style={{ fontSize: 12, color: C.mut }}>{u ? [txt(u.d.editoria), txt(u.d.cidade)].filter(Boolean).join(" · ") : "14 redatores, um por editoria"}</span>
        </div>
      </div>
      <div className="line-clamp-3 min-h-[80px] flex-none" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
        {titulo.slice(0, chars)}{u && chars < titulo.length && <span className="vz-blink" style={{ color: C.laranja }}>▍</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["Resumo", "TL;DR", "5W1H", "FAQ", "SEO"].map((p, i) => {
          const ok = !!u && i < pecasProntas;
          return <span key={p} className="rounded-full px-2.5 py-0.5" style={{ fontSize: 12, fontWeight: 600, background: ok ? "rgba(92,199,158,.12)" : "transparent", color: ok ? "#9ED9C1" : C.mut, border: `1px solid ${ok ? "rgba(92,199,158,.4)" : C.borda2}` }}>{p}</span>;
        })}
      </div>
      <div className="mt-auto" style={{ fontSize: 14, color: C.mut }}><strong style={{ fontSize: 26, color: C.txt }}>{e.eventos.length}</strong> matérias redigidas neste ciclo</div>
    </Card>
  );
}

function CardCriticidade({ n, e }: { n: number; e: EstadoEtapa }) {
  const u = e.ultimo;
  const score = u ? Math.max(0, Math.min(100, Number(u.d.score ?? (u.d.nivel === "alto" ? 75 : u.d.nivel === "medio" ? 45 : 15)))) : 0;
  const auto = !!u?.d.auto;
  const cor = !u ? C.mut : auto ? C.verde : C.ambar;
  const autos = e.eventos.filter((x) => x.d.auto).length;
  return (
    <Card n={n} e={e} id="criticidade">
      <div className="line-clamp-2 min-h-[40px] flex-none" style={{ fontSize: 15, lineHeight: 1.3 }}>{u ? txt(u.d.titulo) : "Aguardando matérias…"}</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between" style={{ fontSize: 13, color: C.mut }}><span>Risco</span><span className="vz-mono" style={{ color: cor }}>{score}/100</span></div>
        <div className="relative h-3.5 rounded-full" style={{ background: `linear-gradient(90deg, ${C.verde} 0%, ${C.ambar} 50%, ${C.vermelho} 100%)` }}>
          <div className="absolute -top-1 h-[22px] w-1 -translate-x-0.5 rounded-sm transition-all duration-700" style={{ left: `${score}%`, background: C.txt }} />
        </div>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5" style={{ background: auto ? "rgba(92,199,158,.08)" : "rgba(233,196,106,.08)", border: `1px solid ${cor}` }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: cor }}>{!u ? "—" : auto ? "Publica direto" : "Vai para o editor"}</span>
        <span style={{ fontSize: 13, color: "#C9D6D2" }}>{u ? txt(u.d.motivo) || `nível ${txt(u.d.nivel) || "baixo"}` : "sem matéria em análise"}</span>
      </div>
      <div className="mt-auto flex gap-4" style={{ fontSize: 14, color: C.mut }}>
        <span><strong style={{ fontSize: 26, color: C.verde }}>{autos}</strong> publicam direto</span>
        <span><strong style={{ fontSize: 26, color: C.ambar }}>{e.eventos.length - autos}</strong> vão ao editor</span>
      </div>
    </Card>
  );
}

const ORIGENS: { chave: string[]; nome: string }[] = [
  { chave: ["fonte_autorizada"], nome: "Foto da fonte · crédito institucional" },
  { chave: ["cidade_geral", "commons"], nome: "Foto livre da cidade ou do tema" },
  { chave: ["ilustracao_ia"], nome: "Ilustração do tema" },
  { chave: ["nenhuma"], nome: "Só texto · sem foto liberada" },
];

function CardImagem({ n, e }: { n: number; e: EstadoEtapa }) {
  const u = e.ultimo;
  const origem = u ? txt(u.d.origem) || "nenhuma" : "";
  const comFoto = e.eventos.filter((x) => x.d.tem).length;
  return (
    <Card n={n} e={e} id="imagem">
      <div className="relative grid h-28 place-items-center overflow-hidden rounded-xl" style={{ background: C.fundo2, border: `1px solid ${C.borda}` }}>
        <svg width="64" height="48" viewBox="0 0 64 48" aria-hidden="true"><rect x="1" y="1" width="62" height="46" rx="6" fill="none" stroke={C.borda2} strokeWidth="2" /><circle cx="20" cy="16" r="5" fill={C.borda2} /><path d="M4 42l18-16 12 10 10-8 16 14" fill="none" stroke={C.borda2} strokeWidth="2" /></svg>
        {e.status === "rodando" && <div className="vz-scan absolute inset-y-0 left-0 w-2/5" style={{ background: "linear-gradient(90deg, rgba(226,159,101,0), rgba(226,159,101,.22), rgba(226,159,101,0))" }} />}
        {u && <span className="absolute bottom-2 left-2.5 vz-mono" style={{ fontSize: 11, color: "#C9D6D2" }}>{txt(u.d.credito) || (origem === "nenhuma" ? "sem foto: vai como texto" : "")}</span>}
      </div>
      <div className="flex flex-col gap-1.5">
        {ORIGENS.map((o) => {
          const sel = !!u && o.chave.includes(origem);
          return (
            <div key={o.nome} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ fontSize: 13, background: sel ? "rgba(226,159,101,.12)" : "transparent", border: `1px solid ${sel ? C.laranja : C.borda}`, color: sel ? "#F2B98A" : C.mut }}>
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: sel ? C.laranja : C.mut }} />{o.nome}
            </div>
          );
        })}
      </div>
      <div className="mt-auto" style={{ fontSize: 14, color: C.mut }}><strong style={{ fontSize: 26, color: C.txt }}>{comFoto}</strong> com imagem · <strong style={{ fontSize: 26, color: C.txt }}>{e.eventos.length - comFoto}</strong> só texto</div>
    </Card>
  );
}

function CardPublicacao({ n, e }: { n: number; e: EstadoEtapa }) {
  const porCidade = new Map<string, number>();
  for (const x of e.eventos) {
    const cidade = CIDADES_MAPA.find((c) => c.nome === txt(x.d.cidade))?.nome ?? POLO_DA_REGIAO[txt(x.d.regiao)];
    if (cidade) porCidade.set(cidade, (porCidade.get(cidade) ?? 0) + 1);
  }
  const ultimaCidade = e.ultimo ? CIDADES_MAPA.find((c) => c.nome === txt(e.ultimo!.d.cidade))?.nome ?? POLO_DA_REGIAO[txt(e.ultimo.d.regiao)] : null;
  const ultimas = e.eventos.slice(-3).reverse();
  return (
    <Card n={n} e={e} id="publicacao">
      <svg width="100%" height="140" viewBox={PARANA_VIEWBOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa do Paraná com as cidades que receberam matéria neste ciclo">
        <path d={PARANA_D} fill="#14302A" stroke={C.borda2} strokeWidth=".5" />
        {CIDADES_MAPA.map((c) => {
          const k = porCidade.get(c.nome) ?? 0;
          const ultimo = c.nome === ultimaCidade && e.status === "rodando";
          return (
            <g key={c.nome}>
              {ultimo && <circle cx={c.x} cy={c.y} r="3.2" fill="none" stroke={C.verde} strokeWidth=".5" className="vz-blink" />}
              <circle cx={c.x} cy={c.y} r={k ? Math.min(2.6, 1.2 + k * 0.3) : 1} fill={k ? C.verde : C.espera} />
            </g>
          );
        })}
      </svg>
      <div className="flex flex-col gap-1">
        {ultimas.map((x) => (
          <div key={x.id} className="flex items-baseline gap-2" style={{ fontSize: 13 }}>
            <span className="flex-none vz-mono" style={{ fontSize: 11, color: C.verde }}>{fmtHm(x.t)}</span>
            <span className="flex-none font-semibold">{txt(x.d.cidade) || "Paraná"}</span>
            <span className="truncate" style={{ color: C.mut }}>{txt(x.d.titulo)}</span>
          </div>
        ))}
        {!ultimas.length && <Vazio>Nenhuma matéria publicada neste ciclo ainda.</Vazio>}
      </div>
      <div className="mt-auto" style={{ fontSize: 14, color: C.mut }}><strong style={{ fontSize: 26, color: C.txt }}>{e.eventos.length}</strong> no ar neste ciclo · {porCidade.size} cidades no mapa</div>
    </Card>
  );
}

const FUNDO_CARD: Record<string, [string, string]> = {
  tinta: ["#12201E", "TINTA"], verde: ["#1E5C4A", "VERDE"], papel: ["#F3EFE6", "PAPEL"], areia: ["#E2D3B5", "AREIA"],
};

function corDoPost(p: { tipo: string; fundo: string | null; formato: string | null }): [string, string] {
  if (p.tipo === "alerta" || p.formato === "alerta") return ["#B5473F", "ALERTA"];
  if (p.fundo && FUNDO_CARD[p.fundo]) return FUNDO_CARD[p.fundo];
  if (p.tipo === "foto" || p.formato === "foto") return ["#3A4E49", "FOTO"];
  if (p.tipo === "giro") return ["#24413A", "GIRO"];
  return ["#12201E", p.tipo.toUpperCase().slice(0, 6)];
}

function CardRedes({ n, e, painel, agora }: { n: number; e: EstadoEtapa; painel: Painel | null; agora: number }) {
  const grade = painel?.instagram.grade ?? [];
  const prox = painel?.instagram.proximo ? new Date(painel.instagram.proximo).getTime() : null;
  const reels = horaHoje(18, new Date(agora)).getTime();
  const publicados = e.eventos.filter((x) => x.d.acao === "publicado").length;
  return (
    <Card n={n} e={e} id="redes">
      <div className="grid grid-cols-4 gap-1.5">
        {grade.map((p, i) => {
          const [fundo, rotulo] = corDoPost(p);
          const claro = fundo === "#F3EFE6" || fundo === "#E2D3B5";
          return (
            <div key={i} className="relative overflow-hidden rounded-md" style={{ aspectRatio: "1 / 1", background: fundo, border: `1px solid ${i === 0 && publicados ? C.laranja : C.borda2}` }}>
              <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: C.laranja }} />
              <span className="absolute right-1 top-0.5" style={{ fontSize: 9, fontWeight: 700, color: claro ? "#12201E" : C.txt }}>{rotulo}</span>
              <span className="absolute bottom-1.5 left-1.5 right-1.5 h-1 rounded-sm" style={{ background: claro ? "rgba(18,32,30,.5)" : "rgba(233,241,238,.55)" }} />
              <span className="absolute bottom-3 left-1.5 right-4 h-1 rounded-sm" style={{ background: claro ? "rgba(18,32,30,.5)" : "rgba(233,241,238,.55)" }} />
            </div>
          );
        })}
        {!grade.length && <div className="col-span-4"><Vazio>Nenhum post publicado ainda.</Vazio></div>}
      </div>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2" style={{ background: C.fundo2, border: `1px solid ${C.borda}` }}>
        <span className="flex-none whitespace-nowrap" style={{ fontSize: 13, color: C.mut }}>Próximo post</span>
        <span className="vz-mono flex-none whitespace-nowrap" style={{ fontSize: 16, color: C.laranja }}>{prox ? (prox > agora ? dur(prox - agora) : "publicando…") : "fila vazia"}</span>
        <span className="ml-auto truncate" style={{ fontSize: 12, color: C.mut }}>{painel?.instagram.na_fila ?? 0} na fila</span>
      </div>
      <div className="mt-auto flex flex-col gap-1">
        <div className="flex justify-between" style={{ fontSize: 13 }}>
          <span>Reels “Resumo do dia” · 18h</span>
          <span className="vz-mono" style={{ color: C.mut }}>{reels > agora ? `em ${dur(reels - agora)}` : "saiu às 18h"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded" style={{ background: C.fundo2 }}>
          <div className="h-full" style={{ width: `${Math.max(4, Math.min(100, 100 - (reels - agora) / (12 * 3600_000) * 100))}%`, background: C.laranja }} />
        </div>
      </div>
    </Card>
  );
}

// ================================================================ vinheta e relatório

function Vinheta({ nome, desde, agora }: { nome: string; desde: number; agora: number }) {
  const s = Math.floor((agora - desde) / 1000);
  const numero = s < 3 ? 3 - s : null;
  return (
    <div className="fixed inset-0 z-[300] grid place-items-center" style={{ background: "rgba(5,10,9,.92)", animation: "vzVinheta 4.2s ease both" }} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="vz-cond uppercase" style={{ fontSize: 18, letterSpacing: ".3em", color: C.laranja }}>Começa agora</span>
        <span style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 64, fontWeight: 600, color: C.txt }}>{nome}</span>
        {numero != null ? (
          <span key={numero} className="vz-mono" style={{ fontSize: 160, lineHeight: 1, color: C.laranja, animation: "vzNumero 1s ease both" }}>{numero}</span>
        ) : (
          <span style={{ fontSize: 28, color: C.verde, fontWeight: 600 }}>coleta → crivo → apuração → redação → criticidade → imagem → publicação → redes</span>
        )}
      </div>
    </div>
  );
}

function ModalRelatorio({ r, onFechar }: { r: Relatorio; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-[250] grid place-items-center p-4" style={{ background: "rgba(5,10,9,.8)" }} role="dialog" aria-modal="true" aria-label="Relatório do ciclo">
      <div className="vz-entra flex max-h-full w-full max-w-4xl flex-col gap-5 overflow-auto rounded-3xl p-6 md:p-8" style={{ background: C.painel, border: `1px solid ${C.borda2}`, color: C.txt }}>
        <div className="flex items-start gap-4">
          <div className="flex flex-col">
            <span className="vz-cond uppercase" style={{ fontSize: 14, letterSpacing: ".2em", color: C.laranja }}>Relatório do ciclo</span>
            <span style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 36, fontWeight: 600 }}>{r.ciclo}</span>
            <span className="vz-mono" style={{ fontSize: 14, color: C.mut }}>{r.janela}</span>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar o relatório" className="ml-auto grid h-11 w-11 place-items-center rounded-xl" style={{ border: `1px solid ${C.borda}`, background: C.fundo2, color: C.txt }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Numero rotulo="matérias no ar" valor={r.publicadas.length ? r.etapas[6].n : 0} cor={C.verde} />
          <Numero rotulo="publicaram direto · ao editor" valor={`${r.automaticas} · ${r.editor}`} />
          <Numero rotulo="horas humanas poupadas" valor={`${Math.round(r.horas)} h`} cor={C.laranja} />
          <Numero rotulo="custo estimado de IA" valor={`R$ ${r.custoBrl.toFixed(2).replace(".", ",")}`} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {r.etapas.map((e, i) => (
            <div key={e.nome} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: C.fundo2, border: `1px solid ${C.borda}` }}>
              <span className="vz-mono" style={{ fontSize: 12, color: C.mut }}>{String(i + 1).padStart(2, "0")}</span>
              <span className="font-semibold" style={{ fontSize: 15 }}>{e.nome}</span>
              <span className="ml-auto vz-mono" style={{ fontSize: 14 }}>{e.n}</span>
              <span className="w-24 text-right vz-mono" style={{ fontSize: 12, color: C.mut }}>{e.duracao}</span>
            </div>
          ))}
        </div>
        {r.publicadas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="vz-cond uppercase" style={{ fontSize: 13, letterSpacing: ".16em", color: C.mut }}>Últimas publicadas</span>
            {r.publicadas.map((p, i) => (
              <div key={i} className="flex gap-2" style={{ fontSize: 14 }}>
                <span className="flex-none font-semibold" style={{ color: C.verde }}>{p.cidade ?? "Paraná"}</span>
                <span className="truncate">{p.titulo}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
