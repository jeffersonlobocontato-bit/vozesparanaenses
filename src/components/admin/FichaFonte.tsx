import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { X } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { btn, ErrorBanner, StatusPill } from "@/components/admin/ui";

/**
 * Ficha da fonte (painel admin → Fontes monitoradas): big numbers, série
 * de 30 dias, último ciclo, descartes e últimas matérias/notas/coletas.
 * Dados da função fonte_ficha() — 074_estatisticas_fontes.sql.
 */

type Ciclo = {
  em?: string;
  total?: number;
  inseridas?: number;
  duplicadas?: number;
  sem_data?: number;
  fora_do_dia?: number;
  erro?: string;
  orcamento_estourou?: boolean;
};

type Ficha = {
  fonte: {
    id: string;
    nome: string;
    url_base: string;
    tipo: string;
    ativo: boolean;
    regiao: string | null;
    cidade_slug: string | null;
    ultimo_scrape_em: string | null;
    ultimo_ciclo: Ciclo | null;
  } | null;
  numeros: {
    coletadas: number;
    coletadas_30d: number;
    pautas: number;
    pautas_descartadas: number;
    materias_publicadas: number;
    materias_rascunho: number;
    materias_rejeitadas: number;
    materias_com_foto: number;
    notas_publicadas: number;
    notas_revisao: number;
    ultima_publicacao_em: string | null;
  };
  serie_30d: Array<{ dia: string; coletadas: number; publicadas: number }>;
  descartes: Array<{ motivo: string; total: number }>;
  ultimas_materias: Array<{
    id: string;
    titulo: string;
    slug: string;
    status: string;
    regiao_slug: string | null;
    tem_foto: boolean;
    quando: string | null;
  }>;
  ultimas_notas: Array<{
    id: string;
    titulo: string;
    status: string;
    cidade_slug: string | null;
    regiao_slug: string | null;
    quando: string | null;
  }>;
  ultimas_coletas: Array<{
    titulo: string | null;
    url: string;
    coletado_em: string;
    data_publicacao_original: string | null;
    foto_status: string | null;
  }>;
};

const quando = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Status({ s }: { s: string }) {
  return <StatusPill status={s} />;
}

function BigNumber({
  rotulo,
  valor,
  detalhe,
}: {
  rotulo: string;
  valor: string | number;
  detalhe?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {rotulo}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-[#12201E]">{valor}</div>
      {detalhe && <div className="mt-0.5 text-[11px] text-slate-500">{detalhe}</div>}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#12201E]">{titulo}</h3>
      {children}
    </section>
  );
}

export function FichaFonte({ fonteId, onClose }: { fonteId: string; onClose: () => void }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setFicha(null);
    setErro(null);
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const { data, error } = await sb.rpc("fonte_ficha", { p_fonte_id: fonteId });
        if (error) throw error;
        if (vivo) setFicha(data as Ficha);
      } catch (e) {
        const m =
          e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
        if (vivo)
          setErro(
            /fonte_ficha|function/i.test(m)
              ? "A ficha precisa da migration 074_estatisticas_fontes.sql no banco."
              : m,
          );
      }
    })();
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", esc);
    return () => {
      vivo = false;
      window.removeEventListener("keydown", esc);
    };
  }, [fonteId, onClose]);

  const n = ficha?.numeros;
  const geradas = (n?.materias_publicadas ?? 0) + (n?.notas_publicadas ?? 0);
  const aproveitamento = n && n.coletadas ? Math.round((geradas / n.coletadas) * 100) : 0;
  const ciclo = ficha?.fonte?.ultimo_ciclo;
  const serie = (ficha?.serie_30d ?? []).map((d) => ({
    ...d,
    rotulo: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha da fonte"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
      />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B5651D]">
              Ficha da fonte
            </p>
            <h2 className="mt-0.5 truncate text-xl font-bold text-[#12201E]">
              {ficha?.fonte?.nome ?? "Carregando…"}
            </h2>
            {ficha?.fonte && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <StatusPill
                  status={ficha.fonte.tipo}
                  label={ficha.fonte.tipo === "prefeitura" ? "Prefeitura" : "Veículo"}
                />
                <StatusPill status={ficha.fonte.ativo ? "ativa" : "inativa"} />
                {ficha.fonte.regiao && <span>{ficha.fonte.regiao}</span>}
                <a
                  href={ficha.fonte.url_base}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate underline hover:text-[#12201E]"
                >
                  {ficha.fonte.url_base}
                </a>
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className={btn("secondary", "sm")}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Fechar
          </button>
        </header>

        <div className="space-y-6 p-5">
          {erro && <ErrorBanner>{erro}</ErrorBanner>}
          {!ficha && !erro && <p className="text-sm text-slate-500">Carregando…</p>}

          {ficha && n && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <BigNumber
                  rotulo="Notícias geradas"
                  valor={geradas}
                  detalhe={`${n.materias_publicadas} matérias · ${n.notas_publicadas} notas`}
                />
                <BigNumber
                  rotulo="Coletadas"
                  valor={n.coletadas}
                  detalhe={`${n.coletadas_30d} nos últimos 30 dias`}
                />
                <BigNumber
                  rotulo="Aproveitamento"
                  valor={`${aproveitamento}%`}
                  detalhe="notícias geradas ÷ coletadas"
                />
                <BigNumber
                  rotulo="Matérias com foto"
                  valor={n.materias_com_foto}
                  detalhe={`de ${n.materias_publicadas} publicadas`}
                />
                <BigNumber
                  rotulo="Em revisão"
                  valor={n.materias_rascunho + n.notas_revisao}
                  detalhe={`${n.materias_rascunho} matérias · ${n.notas_revisao} notas`}
                />
                <BigNumber
                  rotulo="Pautas descartadas"
                  valor={n.pautas_descartadas}
                  detalhe={`de ${n.pautas} pautas · última publicação ${quando(n.ultima_publicacao_em)}`}
                />
              </div>

              <Secao titulo="Últimos 30 dias">
                <div className="h-56 rounded-xl border border-slate-200 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} interval={2} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="coletadas"
                        name="Coletadas"
                        fill="#94a3b8"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="publicadas"
                        name="Publicadas"
                        fill="#12201E"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Secao>

              <Secao titulo="Último ciclo de coleta">
                {ciclo ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="text-xs text-slate-500">
                      {quando(ciclo.em ?? ficha.fonte?.ultimo_scrape_em)}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center md:grid-cols-5">
                      {(
                        [
                          ["Lidas", ciclo.total],
                          ["Novas do dia", ciclo.inseridas],
                          ["Repetidas", ciclo.duplicadas],
                          ["Sem data", ciclo.sem_data],
                          ["Fora do dia", ciclo.fora_do_dia],
                        ] as Array<[string, number | undefined]>
                      ).map(([r, v]) => (
                        <div key={r}>
                          <div className="text-lg font-bold tabular-nums text-[#12201E]">
                            {v ?? 0}
                          </div>
                          <div className="text-[11px] text-slate-500">{r}</div>
                        </div>
                      ))}
                    </div>
                    {ciclo.erro && (
                      <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                        Erro: {ciclo.erro}
                      </p>
                    )}
                    {(ciclo.total ?? 0) === 0 && !ciclo.erro && (
                      <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        O robô não encontrou nenhuma notícia na página — confira o endereço ou se o
                        site monta a lista com JavaScript.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Ainda não rodou nenhum ciclo.</p>
                )}
              </Secao>

              {ficha.descartes.length > 0 && (
                <Secao titulo="Por que pautas foram descartadas">
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                    {ficha.descartes.map((d) => (
                      <li key={d.motivo} className="flex justify-between gap-3 px-3 py-2">
                        <span className="text-slate-700">{d.motivo}</span>
                        <span className="font-semibold tabular-nums">{d.total}</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}

              <Secao titulo="Últimas matérias">
                {ficha.ultimas_materias.length ? (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                    {ficha.ultimas_materias.map((m) => (
                      <li key={m.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          {m.status === "publicado" && m.regiao_slug ? (
                            <Link
                              to="/$region/$slug"
                              params={{ region: m.regiao_slug, slug: m.slug }}
                              target="_blank"
                              className="font-medium text-[#12201E] hover:underline"
                            >
                              {m.titulo}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-800">{m.titulo}</span>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {quando(m.quando)}
                            {m.tem_foto ? " · com foto" : " · sem foto"}
                          </div>
                        </div>
                        <Status s={m.status} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    Nenhuma matéria gerada desta fonte ainda.
                  </p>
                )}
              </Secao>

              {ficha.ultimas_notas.length > 0 && (
                <Secao titulo="Últimas notas nas colunas">
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                    {ficha.ultimas_notas.map((nt) => (
                      <li key={nt.id} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          {nt.status === "publicado" && nt.regiao_slug ? (
                            <Link
                              to="/vozes/$cidade"
                              params={{ cidade: nt.regiao_slug }}
                              hash={`nota-${nt.id}`}
                              target="_blank"
                              className="font-medium text-[#12201E] hover:underline"
                            >
                              {nt.titulo}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-800">{nt.titulo}</span>
                          )}
                          <div className="text-[11px] text-slate-500">
                            {quando(nt.quando)}
                            {nt.cidade_slug ? ` · ${nt.cidade_slug.replace(/-/g, " ")}` : ""}
                          </div>
                        </div>
                        <Status s={nt.status} />
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}

              <Secao titulo="Últimas coletas">
                {ficha.ultimas_coletas.length ? (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
                    {ficha.ultimas_coletas.map((c, i) => (
                      <li key={`${c.url}-${i}`} className="px-3 py-2">
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-800 hover:underline"
                        >
                          {c.titulo || c.url}
                        </a>
                        <div className="text-[11px] text-slate-500">
                          coletada {quando(c.coletado_em)} · publicada na fonte{" "}
                          {quando(c.data_publicacao_original)}
                          {c.foto_status ? ` · foto: ${c.foto_status.replace("_", " ")}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Nada coletado ainda.</p>
                )}
              </Secao>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
