import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  CALOR_CONC, CALOR_VOZES, degrau, DIAG_TESTADO_EM, motivo, MOTIVOS, ORDEM_SITUACAO, participacao, prioridade,
  situacao, SITUACAO, type Municipio, type Prioridade, type Situacao,
} from "@/lib/cobertura";
import { PageHeader, Section, StatCard, EmptyState, ErrorBanner, Tabs, btn, campoClass, rotuloClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/cobertura")({
  component: AdminCobertura,
});

// Malha dos 399 municípios (IBGE via geodata-br, simplificada e projetada
// para SVG em public/geo-pr-municipios.json): s = slug, d = caminho, c = centro.
type Geo = { w: number; h: number; m: { s: string; i: string; d: string; c: [number, number] }[] };
type Resposta = { dias: number; gerado_em: string; veiculos_monitorados: number; municipios: Municipio[] };
type Aba = "mapa" | "comparativo" | "prospeccao";
type Modo = "lider" | "concorrencia" | "vozes";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const vozes = (m: Municipio) => m.vozes_materias + m.vozes_notas;

function AdminCobertura() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("mapa");
  const [modo, setModo] = useState<Modo>("lider");
  const [regiao, setRegiao] = useState("");
  const [filtroSit, setFiltroSit] = useState<Situacao | "">("");
  const [sel, setSel] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const sb = await getExternalBrowser();
      const [{ data, error }, g] = await Promise.all([
        sb.rpc("cobertura_municipios", { p_dias: dias }),
        geo ? Promise.resolve(geo) : fetch("/geo-pr-municipios.json").then((r) => r.json() as Promise<Geo>),
      ]);
      if (error) throw error;
      setDados(data as Resposta);
      setGeo(g);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar a cobertura.");
    } finally {
      setCarregando(false);
    }
  }, [dias, geo]);

  useEffect(() => { void carregar(); }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = dados?.municipios ?? [];
  const porSlug = useMemo(() => new Map(lista.map((m) => [m.slug, m])), [lista]);
  const regioes = useMemo(() => [...new Map(lista.map((m) => [m.regiao, m.regiao_nome])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt")), [lista]);
  const contagem = useMemo(() => {
    const c = Object.fromEntries(ORDEM_SITUACAO.map((s) => [s, 0])) as Record<Situacao, number>;
    for (const m of lista) if (!regiao || m.regiao === regiao) c[situacao(m)]++;
    return c;
  }, [lista, regiao]);
  const doRecorte = lista.filter((m) => !regiao || m.regiao === regiao);
  const comVozes = doRecorte.filter((m) => vozes(m) > 0).length;
  const comConc = doRecorte.filter((m) => m.conc_total > 0).length;
  const lideramos = contagem.so_vozes + contagem.vozes_lidera;
  const partMedia = (() => {
    const v = doRecorte.reduce((s, m) => s + vozes(m), 0), c = doRecorte.reduce((s, m) => s + m.conc_total, 0);
    return v + c ? v / (v + c) : 0;
  })();
  const selecionada = sel ? porSlug.get(sel) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mercado"
        title="Cobertura"
        subtitle="Onde o Vozes cobre cada um dos 399 municípios, comparado com os veículos regionais que o robô acompanha. Serve para ver onde lideramos, onde a concorrência lidera e onde ninguém cobre."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className={rotuloClass}>
              Janela
              <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={campoClass}>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
              </select>
            </label>
            <label className={rotuloClass}>
              Região
              <select value={regiao} onChange={(e) => setRegiao(e.target.value)} className={campoClass}>
                <option value="">Paraná inteiro</option>
                {regioes.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void carregar()} className={btn("ghost", "sm")}>Atualizar</button>
          </div>
        }
      />

      {erro && <ErrorBanner>Não foi possível carregar a cobertura: {erro}</ErrorBanner>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vozes publicou em" value={`${fmt(comVozes)}`} detalhe={`de ${fmt(doRecorte.length)} municípios em ${dias} dias`} />
        <StatCard label="Lideramos" value={fmt(lideramos)} detalhe="só o Vozes ou mais que o maior concorrente" tom="bom" />
        <StatCard label="Concorrência à frente" value={fmt(contagem.conc_lidera + contagem.so_conc)} detalhe={`${fmt(comConc)} cidades com algum veículo`} tom="alerta" />
        <StatCard label="Nossa participação" value={pct(partMedia)} detalhe={`do que se publicou · ${fmt(dados?.veiculos_monitorados ?? 0)} veículos monitorados`} />
      </div>

      <Tabs value={aba} onChange={setAba} items={[{ value: "mapa", label: "Mapa" }, { value: "comparativo", label: "Comparativo por cidade" }, { value: "prospeccao", label: "Prospecção do Portal da Imprensa" }]} />

      {carregando && !dados ? (
        <Section><p className="text-sm text-slate-500">Carregando…</p></Section>
      ) : !lista.length ? (
        !erro && <EmptyState title="Sem dados de cobertura.">Confira se a migração 094 foi aplicada.</EmptyState>
      ) : aba === "mapa" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <Section
            title="Mapa do Paraná"
            subtitle={modo === "lider" ? "Cor pela situação de cada cidade: laranja onde lideramos, verde-tinta onde a concorrência lidera." : modo === "concorrencia" ? "Calor = notícias dos veículos monitorados sobre a cidade. Círculos laranja = o que o Vozes publicou." : "Calor = o que o Vozes publicou sobre a cidade."}
            aside={<Tabs value={modo} onChange={setModo} items={[{ value: "lider", label: "Quem lidera" }, { value: "concorrencia", label: "Concorrência × Vozes" }, { value: "vozes", label: "Só Vozes" }]} />}
          >
            {geo && <MapaPR geo={geo} porSlug={porSlug} modo={modo} regiao={regiao} filtroSit={filtroSit} sel={sel} onSel={setSel} />}
            <Legenda modo={modo} contagem={contagem} filtroSit={filtroSit} onFiltro={(s) => setFiltroSit((f) => (f === s ? "" : s))} lista={doRecorte} />
          </Section>
          <div className="space-y-6">
            <Section title={selecionada ? selecionada.nome : "Cidade"} subtitle={selecionada ? selecionada.regiao_nome : "Clique numa cidade no mapa."}>
              {selecionada ? <Detalhe m={selecionada} dias={dias} /> : <p className="text-sm text-slate-500">O cartão mostra quantos veículos cobrem a cidade, quanto cada um publicou e quanto o Vozes publicou.</p>}
            </Section>
            <PorRegiao lista={lista} onRegiao={setRegiao} regiao={regiao} />
          </div>
        </div>
      ) : aba === "comparativo" ? (
        <Comparativo lista={doRecorte} filtroSit={filtroSit} setFiltroSit={setFiltroSit} onSel={(s) => { setSel(s); setAba("mapa"); }} />
      ) : (
        <Prospeccao lista={doRecorte} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function corDoModo(m: Municipio | undefined, modo: Modo, maxC: number, maxV: number): string {
  if (!m) return "#E4E7E5";
  if (modo === "lider") return SITUACAO[situacao(m)].cor;
  if (modo === "concorrencia") return CALOR_CONC[degrau(m.conc_total, maxC)];
  return CALOR_VOZES[degrau(vozes(m), maxV)];
}

function MapaPR({ geo, porSlug, modo, regiao, filtroSit, sel, onSel }: {
  geo: Geo; porSlug: Map<string, Municipio>; modo: Modo; regiao: string; filtroSit: Situacao | ""; sel: string | null; onSel: (s: string) => void;
}) {
  const maxC = Math.max(1, ...[...porSlug.values()].map((m) => m.conc_total));
  const maxV = Math.max(1, ...[...porSlug.values()].map(vozes));
  const apagada = (m?: Municipio) => !!m && ((regiao && m.regiao !== regiao) || (filtroSit && situacao(m) !== filtroSit));
  return (
    <div className="overflow-hidden rounded-xl bg-[#F6F7F5]">
      <svg viewBox={`0 0 ${geo.w} ${geo.h}`} role="img" aria-label="Mapa de cobertura dos municípios do Paraná" className="h-auto w-full">
        {geo.m.map((g) => {
          const m = porSlug.get(g.s);
          return (
            <path
              key={g.s}
              d={g.d}
              fill={corDoModo(m, modo, maxC, maxV)}
              opacity={apagada(m) ? 0.22 : 1}
              stroke={sel === g.s ? "#12201E" : "#ffffff"}
              strokeWidth={sel === g.s ? 2 : 0.5}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => onSel(g.s)}
            >
              <title>{m ? `${m.nome}: Vozes ${vozes(m)} · concorrência ${m.conc_total} (${m.conc_veiculos} veículos) · ${SITUACAO[situacao(m)].rotulo}` : g.s}</title>
            </path>
          );
        })}
        {modo === "concorrencia" && geo.m.map((g) => {
          const m = porSlug.get(g.s);
          const v = m ? vozes(m) : 0;
          if (!v || apagada(m)) return null;
          return <circle key={`v-${g.s}`} cx={g.c[0]} cy={g.c[1]} r={2 + Math.sqrt(v) * 1.8} fill="#E29F65" fillOpacity={0.85} stroke="#9A5718" strokeWidth={0.8} pointerEvents="none" />;
        })}
      </svg>
    </div>
  );
}

function Legenda({ modo, contagem, filtroSit, onFiltro, lista }: {
  modo: Modo; contagem: Record<Situacao, number>; filtroSit: Situacao | ""; onFiltro: (s: Situacao) => void; lista: Municipio[];
}) {
  if (modo === "lider") {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ORDEM_SITUACAO.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onFiltro(s)}
            aria-pressed={filtroSit === s}
            title={SITUACAO[s].descricao}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${filtroSit === s ? "border-[#12201E] ring-1 ring-[#12201E]" : "border-slate-200"}`}
          >
            <span className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ background: SITUACAO[s].cor }} />{SITUACAO[s].rotulo}</span>
            <span className="font-semibold tabular-nums text-[#12201E]">{contagem[s]}</span>
          </button>
        ))}
      </div>
    );
  }
  const escala = modo === "concorrencia" ? CALOR_CONC : CALOR_VOZES;
  const max = Math.max(1, ...lista.map((m) => (modo === "concorrencia" ? m.conc_total : vozes(m))));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
      <span className="flex items-center gap-1">
        0 {escala.map((c) => <span key={c} className="inline-block h-3 w-6" style={{ background: c }} />)} {fmt(max)} notícias
      </span>
      {modo === "concorrencia" && <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full border border-[#9A5718] bg-[#E29F65]" /> Vozes (tamanho = publicações)</span>}
    </div>
  );
}

function Detalhe({ m, dias }: { m: Municipio; dias: number }) {
  const s = situacao(m);
  const barras = [{ nome: "Vozes Paranaenses", n: vozes(m), nosso: true }, ...m.conc_lista.map((x) => ({ ...x, nosso: false }))].sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...barras.map((b) => b.n));
  return (
    <div className="space-y-4 text-sm">
      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: SITUACAO[s].cor, color: SITUACAO[s].texto }}>{SITUACAO[s].rotulo}</span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-slate-500">Vozes ({dias} dias)</dt><dd className="text-right font-semibold tabular-nums">{m.vozes_materias} matérias · {m.vozes_notas} notas</dd>
        <dt className="text-slate-500">Concorrência</dt><dd className="text-right font-semibold tabular-nums">{m.conc_total} notícias</dd>
        <dt className="text-slate-500">Veículos que cobrem</dt><dd className="text-right font-semibold tabular-nums">{m.conc_veiculos}</dd>
        <dt className="text-slate-500">Nossa participação</dt><dd className="text-right font-semibold tabular-nums">{pct(participacao(m))}</dd>
        <dt className="text-slate-500">Prefeitura no robô</dt><dd className="text-right">{m.prefeitura === "monitorada" ? `sim · ${m.prefeitura_noticias} notícias` : m.prefeitura === "inativa" ? "inativa" : "não"}</dd>
        <dt className="text-slate-500">Portal da Imprensa</dt><dd className="text-right">{m.cliente ?? "não é cliente"}</dd>
      </dl>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Quem publica sobre a cidade</p>
        {barras.length === 1 && !barras[0].n ? (
          <p className="text-slate-500">Ninguém publicou na janela.</p>
        ) : (
          <ul className="space-y-1.5">
            {barras.map((b) => (
              <li key={b.nome}>
                <div className="flex justify-between gap-2 text-xs"><span className={b.nosso ? "font-semibold text-[#B5651D]" : "text-slate-700"}>{b.nome}</span><span className="tabular-nums text-slate-600">{b.n}</span></div>
                <div className="mt-0.5 h-2 rounded bg-slate-100"><div className="h-2 rounded" style={{ width: `${(b.n / max) * 100}%`, background: b.nosso ? "#E29F65" : "#5E827A" }} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PorRegiao({ lista, onRegiao, regiao }: { lista: Municipio[]; onRegiao: (r: string) => void; regiao: string }) {
  const g = new Map<string, { nome: string; n: number; nos: number; disputa: number; eles: number; sem: number; v: number; c: number }>();
  for (const m of lista) {
    const r = g.get(m.regiao) ?? { nome: m.regiao_nome, n: 0, nos: 0, disputa: 0, eles: 0, sem: 0, v: 0, c: 0 };
    const s = situacao(m);
    r.n++; r.v += vozes(m); r.c += m.conc_total;
    if (s === "so_vozes" || s === "vozes_lidera") r.nos++;
    else if (s === "disputa") r.disputa++;
    else if (s === "sem") r.sem++;
    else r.eles++;
    g.set(m.regiao, r);
  }
  return (
    <Section title="Por região" subtitle="Clique para filtrar o mapa." padded={false}>
      <ul className="divide-y divide-slate-100">
        {[...g.entries()].sort((a, b) => b[1].n - a[1].n).map(([slug, r]) => {
          const w = (x: number) => `${(x / r.n) * 100}%`;
          return (
            <li key={slug}>
              <button type="button" onClick={() => onRegiao(regiao === slug ? "" : slug)} className={`w-full px-5 py-2.5 text-left ${regiao === slug ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                <div className="flex justify-between text-sm"><span className="font-semibold text-[#12201E]">{r.nome}</span><span className="tabular-nums text-slate-500">{pct(r.v + r.c ? r.v / (r.v + r.c) : 0)} nosso</span></div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded" aria-label={`${r.nos} lideramos, ${r.disputa} disputa, ${r.eles} concorrência, ${r.sem} sem cobertura`}>
                  <span style={{ width: w(r.nos), background: SITUACAO.vozes_lidera.cor }} />
                  <span style={{ width: w(r.disputa), background: SITUACAO.disputa.cor }} />
                  <span style={{ width: w(r.eles), background: SITUACAO.conc_lidera.cor }} />
                  <span style={{ width: w(r.sem), background: SITUACAO.sem.cor }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

// ---------------------------------------------------------------------------
type Col = { rotulo: string; valor: (m: Municipio) => number | string; num?: boolean };
const COLS: Col[] = [
  { rotulo: "Cidade", valor: (m) => m.nome },
  { rotulo: "Região", valor: (m) => m.regiao_nome },
  { rotulo: "Vozes", valor: (m) => vozes(m), num: true },
  { rotulo: "Concorrência", valor: (m) => m.conc_total, num: true },
  { rotulo: "Veículos", valor: (m) => m.conc_veiculos, num: true },
  { rotulo: "Maior concorrente", valor: (m) => m.conc_lider ? `${m.conc_lider} (${m.conc_maior})` : "—" },
  { rotulo: "Participação", valor: (m) => Math.round(participacao(m) * 100), num: true },
  { rotulo: "Situação", valor: (m) => ORDEM_SITUACAO.indexOf(situacao(m)) },
];

function Comparativo({ lista, filtroSit, setFiltroSit, onSel }: { lista: Municipio[]; filtroSit: Situacao | ""; setFiltroSit: (s: Situacao | "") => void; onSel: (s: string) => void }) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ col: 3, asc: false });
  const linhas = lista
    .filter((m) => (!filtroSit || situacao(m) === filtroSit) && (!busca || norm(m.nome).includes(norm(busca))))
    .sort((a, b) => {
      const x = COLS[ordem.col].valor(a), y = COLS[ordem.col].valor(b);
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt");
      return (ordem.asc ? r : -r) || a.nome.localeCompare(b.nome, "pt");
    });
  return (
    <Section
      title={`Comparativo por cidade (${linhas.length})`}
      subtitle="Vozes = matérias + notas da coluna regional. Concorrência = notícias dos veículos monitorados com a cidade como local do fato. Clique numa linha para ver no mapa."
      aside={
        <div className="flex flex-wrap items-end gap-2">
          <label className={rotuloClass}>Situação
            <select value={filtroSit} onChange={(e) => setFiltroSit(e.target.value as Situacao | "")} className={campoClass}>
              <option value="">Todas</option>
              {ORDEM_SITUACAO.map((s) => <option key={s} value={s}>{SITUACAO[s].rotulo}</option>)}
            </select>
          </label>
          <label className={rotuloClass}>Cidade<input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" className={campoClass} /></label>
        </div>
      }
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              {COLS.map((c, i) => (
                <th key={c.rotulo} className={`cursor-pointer px-4 py-2.5 font-semibold ${c.num ? "text-right" : ""}`} onClick={() => setOrdem((o) => ({ col: i, asc: o.col === i ? !o.asc : !c.num }))}>
                  {c.rotulo}{ordem.col === i ? (ordem.asc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((m) => {
              const s = situacao(m);
              return (
                <tr key={m.slug} onClick={() => onSel(m.slug)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2 font-semibold text-[#12201E]">{m.nome}</td>
                  <td className="px-4 py-2 text-slate-600">{m.regiao_nome}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#B5651D]">{vozes(m)}</td>
                  <td className="px-4 py-2 text-right">{m.conc_total}</td>
                  <td className="px-4 py-2 text-right">{m.conc_veiculos}</td>
                  <td className="px-4 py-2 text-slate-600">{m.conc_lider ? `${m.conc_lider} (${m.conc_maior})` : "—"}</td>
                  <td className="px-4 py-2 text-right">{pct(participacao(m))}</td>
                  <td className="px-4 py-2"><span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: SITUACAO[s].cor, color: SITUACAO[s].texto }}>{SITUACAO[s].rotulo}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
const FAIXAS: Record<Exclude<Prioridade, "cliente">, { rotulo: string; descricao: string }> = {
  A: { rotulo: "Prioridade A", descricao: "Nenhum veículo cobre e a prefeitura produz notícia. Já tem assessoria ativa e ninguém distribui." },
  B: { rotulo: "Prioridade B", descricao: "Nenhum veículo cobre; a prefeitura está no robô, mas não produziu na janela." },
  C: { rotulo: "Prioridade C", descricao: "Nenhum veículo cobre e a prefeitura está fora do robô: o Portal da Imprensa é a porta de entrada." },
  D: { rotulo: "Já tem cobertura", descricao: "Pelo menos um veículo monitorado publicou sobre a cidade." },
};

function Prospeccao({ lista }: { lista: Municipio[] }) {
  const [faixa, setFaixa] = useState<Prioridade | "">("A");
  const [copiado, setCopiado] = useState(false);
  const linhas = lista.filter((m) => !faixa || prioridade(m) === faixa).sort((a, b) => Number(b.maior) - Number(a.maior) || b.prefeitura_noticias - a.prefeitura_noticias || a.nome.localeCompare(b.nome, "pt"));
  const porMotivo = new Map<string, Municipio[]>();
  for (const m of lista) {
    const k = motivo(m);
    if (k === "produzindo") continue;
    porMotivo.set(k, [...(porMotivo.get(k) ?? []), m]);
  }
  const ranking = lista.filter((m) => m.prefeitura_noticias > 0).sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias).slice(0, 15);
  async function copiar() {
    const cab = ["Cidade", "Região", "Prioridade", "Vozes", "Concorrência", "Prefeitura no robô", "Notícias da prefeitura", "Situação do site"];
    const txt = [cab.join("\t"), ...linhas.map((m) => [m.nome, m.regiao_nome, prioridade(m), vozes(m), m.conc_total, m.prefeitura, m.prefeitura_noticias, MOTIVOS[motivo(m)].titulo].join("\t"))].join("\n");
    try { await navigator.clipboard.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem área de transferência */ }
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(FAIXAS) as (keyof typeof FAIXAS)[]).map((k) => (
          <StatCard key={k} label={FAIXAS[k].rotulo} value={lista.filter((m) => prioridade(m) === k).length} detalhe={FAIXAS[k].descricao} onClick={() => setFaixa((f) => (f === k ? "" : k))} ativo={faixa === k} tom={k === "A" ? "bom" : "neutro"} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Section
          title={`Lista de prospecção (${linhas.length})`}
          subtitle="Maiores cidades primeiro, depois as prefeituras que mais produzem."
          aside={<button type="button" onClick={copiar} className={btn("primary", "sm")}>{copiado ? "Copiado" : "Copiar lista"}</button>}
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Cidade</th><th className="px-4 py-2.5">Região</th><th className="px-4 py-2.5 text-right">Vozes</th><th className="px-4 py-2.5 text-right">Concorrência</th><th className="px-4 py-2.5 text-right">Notícias da prefeitura</th><th className="px-4 py-2.5">Situação da prefeitura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((m) => (
                  <tr key={m.slug}>
                    <td className="px-4 py-2 font-semibold text-[#12201E]">{m.nome}{m.maior ? <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#B5651D]">maior</span> : null}</td>
                    <td className="px-4 py-2 text-slate-600">{m.regiao_nome}</td>
                    <td className="px-4 py-2 text-right">{vozes(m)}</td>
                    <td className="px-4 py-2 text-right">{m.conc_total}</td>
                    <td className="px-4 py-2 text-right">{m.prefeitura_noticias}</td>
                    <td className="px-4 py-2 text-slate-600">{MOTIVOS[motivo(m)].titulo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Prefeituras que mais produzem" subtitle="Notícias coletadas do site da prefeitura na janela." padded={false}>
            <ol className="divide-y divide-slate-100 text-sm">
              {ranking.map((m, i) => (
                <li key={m.slug} className="flex items-center justify-between px-5 py-2"><span><span className="mr-2 tabular-nums text-slate-400">{i + 1}</span><span className="font-semibold text-[#12201E]">{m.nome}</span></span><span className="tabular-nums text-slate-600">{m.prefeitura_noticias}</span></li>
              ))}
            </ol>
          </Section>
          <Section title="Fora do robô ou sem produção" subtitle={`Motivo pelo teste dos sites (${DIAG_TESTADO_EM.split("-").reverse().join("/")}) e estratégia de inclusão.`}>
            <ul className="space-y-4 text-sm">
              {[...porMotivo.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, ms]) => (
                <li key={k}>
                  <div className="flex justify-between gap-2"><span className="font-semibold text-[#12201E]">{MOTIVOS[k].titulo}</span><span className="font-semibold tabular-nums">{ms.length}</span></div>
                  <p className="mt-0.5 text-slate-600">{MOTIVOS[k].estrategia}</p>
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-slate-500">Ver cidades</summary><p className="mt-1 text-xs leading-relaxed text-slate-600">{ms.map((m) => m.nome).join(", ")}</p></details>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
