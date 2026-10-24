import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Play } from "lucide-react";
import {
  FRENTES, type Frente, type JobCron, fmtHora, horaBrtAgora, janelasBrt, rotuloJanelas, situacao,
} from "@/lib/pipeline-agenda";

type Props = {
  jobs: JobCron[];
  // true = jobs vieram do cron (078); false = grade de referência do 076.
  aoVivo: boolean;
  coletadoHoje: Record<string, number>;
  fontesAtivas: Record<string, number>;
  onDisparado: () => void;
};

const HORA_INICIO = 6;
const HORA_FIM = 24;
const pct = (h: number) => `${((Math.min(Math.max(h, HORA_INICIO), HORA_FIM) - HORA_INICIO) / (HORA_FIM - HORA_INICIO)) * 100}%`;

/**
 * Grade do dia (Brasília): uma linha por frente do pipeline, com as janelas
 * em que o cron roda, a situação de agora e o disparo manual.
 */
export function CicloConteudo({ jobs, aoVivo, coletadoHoje, fontesAtivas, onDisparado }: Props) {
  const [agora, setAgora] = useState(() => horaBrtAgora());
  useEffect(() => {
    const t = setInterval(() => setAgora(horaBrtAgora()), 60_000);
    return () => clearInterval(t);
  }, []);

  const conhecidos = useMemo(() => new Set(FRENTES.flatMap((f) => f.jobs)), []);
  const extras = jobs.filter((j) => !conhecidos.has(j.jobname));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Régua de horas */}
      <div className="hidden border-b border-slate-100 bg-slate-50/70 px-4 py-2 md:grid md:grid-cols-[260px_1fr_150px] md:gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Frente</span>
        <div className="relative h-4">
          {Array.from({ length: (HORA_FIM - HORA_INICIO) / 2 + 1 }, (_, i) => HORA_INICIO + i * 2).map((h) => (
            <span key={h} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-slate-400" style={{ left: pct(h) }}>
              {h}h
            </span>
          ))}
        </div>
        <span className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Agora</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {FRENTES.map((f) => (
          <LinhaFrente
            key={f.id}
            frente={f}
            jobs={jobs.filter((j) => f.jobs.includes(j.jobname))}
            agora={agora}
            aoVivo={aoVivo}
            coletado={coletadoHoje[f.id]}
            fontes={fontesAtivas[f.id]}
            onDisparado={onDisparado}
          />
        ))}
        {extras.map((j) => (
          <li key={j.jobname} className="px-4 py-2 text-xs text-slate-500">
            Outro job no cron: <code className="text-slate-700">{j.jobname}</code> ({j.schedule} UTC)
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded-sm bg-slate-400" /> janela de coleta/processamento</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-0.5 bg-[#E29F65]" /> agora ({fmtHora(agora)})</span>
        <span>Horário de Brasília.</span>
        {!aoVivo && (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <AlertTriangle className="h-3 w-3" /> Grade de referência (076). Aplique a migration 078 para ler o cron ao vivo.
          </span>
        )}
      </div>
    </div>
  );
}

function LinhaFrente({ frente, jobs, agora, aoVivo, coletado, fontes, onDisparado }: {
  frente: Frente; jobs: JobCron[]; agora: number; aoVivo: boolean;
  coletado?: number; fontes?: number; onDisparado: () => void;
}) {
  const [disparando, setDisparando] = useState(false);
  const [retorno, setRetorno] = useState<string | null>(null);

  const principal = jobs.find((j) => j.jobname === frente.jobs[0]) ?? jobs[0];
  const grade = principal ? janelasBrt(principal.schedule) : { janelas: [], marcos: [], cadencia: "" };
  // Marcos dos jobs secundários (ex.: publicação de tecnologia às 14h45).
  const marcosExtras = jobs.filter((j) => j !== principal).flatMap((j) => janelasBrt(j.schedule).marcos);
  const sit = situacao(grade.janelas, grade.marcos, agora);
  const desligado = !!principal && !principal.active;
  const falhas = jobs.reduce((n, j) => n + (j.falhas_24h ?? 0), 0);
  const ultima = jobs.map((j) => j.ultima_execucao).filter(Boolean).sort().pop() ?? null;

  async function disparar() {
    if (!frente.acao) return;
    setDisparando(true);
    setRetorno(null);
    try {
      for (const p of frente.acao.passos) {
        const { error } = await supabase.functions.invoke(p.funcao, { body: p.body });
        if (error) throw new Error(`${p.funcao}: ${error.message ?? "falha"}`);
      }
      setRetorno("Disparado no servidor. O processamento automático escreve o que for coletado.");
      onDisparado();
    } catch (e) {
      setRetorno(e instanceof Error ? e.message : "Falha ao disparar");
    } finally {
      setDisparando(false);
    }
  }

  return (
    <li className="grid gap-3 px-4 py-3 md:grid-cols-[260px_1fr_150px] md:items-center md:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${frente.cor}`} />
          <span className="truncate font-semibold text-[#12201E]">{frente.nome}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{frente.descricao}</p>
        <p className="mt-1 text-xs font-medium tabular-nums text-slate-700">
          {principal ? rotuloJanelas(grade.janelas, grade.marcos) : "Sem agendamento"}
          {grade.cadencia && <span className="font-normal text-slate-400"> · {grade.cadencia}</span>}
        </p>
        {(coletado !== undefined || fontes !== undefined) && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {coletado ?? 0} coletada{coletado === 1 ? "" : "s"} hoje{fontes !== undefined && ` · ${fontes} fontes ativas`}
          </p>
        )}
      </div>

      {/* Faixa do dia */}
      <div className="relative h-7 rounded-md bg-slate-100">
        {grade.janelas.map((j) => (
          <div
            key={`${j.inicio}-${j.fim}`}
            className={`absolute inset-y-1 rounded ${frente.cor} ${desligado ? "opacity-30" : "opacity-90"}`}
            style={{ left: pct(j.inicio), width: `calc(${pct(j.fim)} - ${pct(j.inicio)})` }}
            title={`${fmtHora(j.inicio)}–${fmtHora(j.fim)}`}
          />
        ))}
        {[...grade.marcos, ...marcosExtras].map((m) => (
          <div
            key={`${m.hora}:${m.minuto}`}
            className={`absolute inset-y-0.5 w-1 -translate-x-1/2 rounded-full ${frente.cor}`}
            style={{ left: pct(m.hora + m.minuto / 60) }}
            title={fmtHora(m.hora + m.minuto / 60)}
          />
        ))}
        {agora >= HORA_INICIO && (
          <div className="absolute inset-y-0 w-0.5 bg-[#E29F65]" style={{ left: pct(agora) }} />
        )}
      </div>

      <div className="flex flex-row items-center justify-between gap-2 md:flex-col md:items-end">
        <div className="text-right text-xs">
          {desligado ? (
            <span className="font-semibold text-slate-400">Desligado</span>
          ) : sit.rodando ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <Activity className="h-3 w-3 animate-pulse" /> Rodando
            </span>
          ) : sit.proxima !== null ? (
            <span className="inline-flex items-center gap-1 text-slate-600">
              <Clock3 className="h-3 w-3" /> {sit.proxima > agora ? "Próxima" : "Amanhã"} {fmtHora(sit.proxima)}
            </span>
          ) : null}
          {aoVivo && (
            <div className={`mt-0.5 inline-flex items-center gap-1 ${falhas ? "text-rose-700" : "text-slate-400"}`}>
              {falhas ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {falhas ? `${falhas} falha${falhas === 1 ? "" : "s"} em 24h` : ultima ? `ok · ${new Date(ultima).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "sem execução"}
            </div>
          )}
        </div>
        {frente.acao && (
          <button
            onClick={disparar}
            disabled={disparando}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-[#12201E] hover:text-[#12201E] disabled:opacity-60"
          >
            <Play className="h-3 w-3" /> {disparando ? "Disparando…" : frente.acao.rotulo}
          </button>
        )}
      </div>
      {retorno && <p className="text-[11px] text-slate-500 md:col-span-3">{retorno}</p>}
    </li>
  );
}
