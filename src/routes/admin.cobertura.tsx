import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import {
  CALOR_CONC,
  CALOR_VOZES,
  degrau,
  DIAG_TESTADO_EM,
  motivo,
  MOTIVOS,
  ORDEM_SITUACAO,
  participacao,
  prioridade,
  situacao,
  SITUACAO,
  type Municipio,
  type Prioridade,
  type Situacao,
} from "@/lib/cobertura";
import {
  PageHeader,
  Section,
  EmptyState,
  ErrorBanner,
  Tabs,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/cobertura")({
  component: AdminCobertura,
});

// Malha dos 399 municípios (IBGE via geodata-br, simplificada e projetada
// para SVG em public/geo-pr-municipios.json): s = slug, d = caminho, c = centro.
type Geo = { w: number; h: number; m: { s: string; i: string; d: string; c: [number, number] }[] };
type Resposta = {
  dias: number;
  gerado_em: string;
  veiculos_monitorados: number;
  municipios: Municipio[];
};
type Aba = "mapa" | "comparativo" | "prospeccao";
type Modo = "lider" | "concorrencia" | "vozes";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const pct = (x: number) => `${Math.round(x * 100)}%`;
const parte = (n: number, total: number) => pct(total ? n / total : 0);
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
        geo
          ? Promise.resolve(geo)
          : fetch("/geo-pr-municipios.json").then((r) => r.json() as Promise<Geo>),
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

  useEffect(() => {
    void carregar();
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = dados?.municipios ?? [];
  const porSlug = useMemo(() => new Map(lista.map((m) => [m.slug, m])), [lista]);
  const regioes = useMemo(
    () =>
      [...new Map(lista.map((m) => [m.regiao, m.regiao_nome])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1], "pt"),
      ),
    [lista],
  );
  const contagem = useMemo(() => {
    const c = Object.fromEntries(ORDEM_SITUACAO.map((s) => [s, 0])) as Record<Situacao, number>;
    for (const m of lista) if (!regiao || m.regiao === regiao) c[situacao(m)]++;
    return c;
  }, [lista, regiao]);
  const doRecorte = lista.filter((m) => !regiao || m.regiao === regiao);
  const selecionada = sel ? (porSlug.get(sel) ?? null) : null;

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
              <select
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className={campoClass}
              >
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
              </select>
            </label>
            <label className={rotuloClass}>
              Região
              <select
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                className={campoClass}
              >
                <option value="">Paraná inteiro</option>
                {regioes.map(([s, n]) => (
                  <option key={s} value={s}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => void carregar()} className={btn("ghost", "sm")}>
              Atualizar
            </button>
          </div>
        }
      />

      {erro && <ErrorBanner>Não foi possível carregar a cobertura: {erro}</ErrorBanner>}

      {lista.length > 0 && (
        <Resumo
          lista={doRecorte}
          dias={dias}
          contagem={contagem}
          veiculos={dados?.veiculos_monitorados ?? 0}
        />
      )}

      <Tabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "mapa", label: "Mapa" },
          { value: "comparativo", label: "Comparativo por cidade" },
          { value: "prospeccao", label: "Prospecção do Portal da Imprensa" },
        ]}
      />

      {carregando && !dados ? (
        <Section>
          <p className="text-sm text-slate-500">Carregando…</p>
        </Section>
      ) : !lista.length ? (
        !erro && (
          <EmptyState title="Sem dados de cobertura.">
            Confira se a migração 094 foi aplicada.
          </EmptyState>
        )
      ) : aba === "mapa" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <Section
            title="Mapa do Paraná"
            subtitle={
              modo === "lider"
                ? "Cor pela situação de cada cidade: laranja onde lideramos, verde-tinta onde a concorrência lidera."
                : modo === "concorrencia"
                  ? "Calor = notícias dos veículos monitorados sobre a cidade. Círculos laranja = o que o Vozes publicou."
                  : "Calor = o que o Vozes publicou sobre a cidade."
            }
            aside={
              <Tabs
                value={modo}
                onChange={setModo}
                items={[
                  { value: "lider", label: "Quem lidera" },
                  { value: "concorrencia", label: "Concorrência × Vozes" },
                  { value: "vozes", label: "Só Vozes" },
                ]}
              />
            }
          >
            {geo && (
              <MapaPR
                geo={geo}
                porSlug={porSlug}
                modo={modo}
                regiao={regiao}
                filtroSit={filtroSit}
                sel={sel}
                onSel={setSel}
              />
            )}
            <Legenda
              modo={modo}
              contagem={contagem}
              filtroSit={filtroSit}
              onFiltro={(s) => setFiltroSit((f) => (f === s ? "" : s))}
              lista={doRecorte}
            />
          </Section>
          <div className="space-y-6">
            <Section
              title={selecionada ? selecionada.nome : "Cidade"}
              subtitle={selecionada ? selecionada.regiao_nome : "Clique numa cidade no mapa."}
            >
              {selecionada ? (
                <Detalhe m={selecionada} dias={dias} />
              ) : (
                <p className="text-sm text-slate-500">
                  O cartão mostra quantos veículos cobrem a cidade, quanto cada um publicou e quanto
                  o Vozes publicou.
                </p>
              )}
            </Section>
            <PorRegiao lista={lista} onRegiao={setRegiao} regiao={regiao} />
          </div>
        </div>
      ) : aba === "comparativo" ? (
        <Comparativo
          lista={doRecorte}
          filtroSit={filtroSit}
          setFiltroSit={setFiltroSit}
          onSel={(s) => {
            setSel(s);
            setAba("mapa");
          }}
        />
      ) : (
        <Prospeccao lista={doRecorte} dias={dias} />
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

function MapaPR({
  geo,
  porSlug,
  modo,
  regiao,
  filtroSit,
  sel,
  onSel,
}: {
  geo: Geo;
  porSlug: Map<string, Municipio>;
  modo: Modo;
  regiao: string;
  filtroSit: Situacao | "";
  sel: string | null;
  onSel: (s: string) => void;
}) {
  const maxC = Math.max(1, ...[...porSlug.values()].map((m) => m.conc_total));
  const maxV = Math.max(1, ...[...porSlug.values()].map(vozes));
  const apagada = (m?: Municipio) =>
    !!m && ((regiao && m.regiao !== regiao) || (filtroSit && situacao(m) !== filtroSit));
  return (
    <div className="overflow-hidden rounded-xl bg-[#F6F7F5]">
      <svg
        viewBox={`0 0 ${geo.w} ${geo.h}`}
        role="img"
        aria-label="Mapa de cobertura dos municípios do Paraná"
        className="h-auto w-full"
      >
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
              <title>
                {m
                  ? `${m.nome}: Vozes ${vozes(m)} · concorrência ${m.conc_total} (${m.conc_veiculos} veículos) · ${SITUACAO[situacao(m)].rotulo}`
                  : g.s}
              </title>
            </path>
          );
        })}
        {modo === "concorrencia" &&
          geo.m.map((g) => {
            const m = porSlug.get(g.s);
            const v = m ? vozes(m) : 0;
            if (!v || apagada(m)) return null;
            return (
              <circle
                key={`v-${g.s}`}
                cx={g.c[0]}
                cy={g.c[1]}
                r={2 + Math.sqrt(v) * 1.8}
                fill="#E29F65"
                fillOpacity={0.85}
                stroke="#9A5718"
                strokeWidth={0.8}
                pointerEvents="none"
              />
            );
          })}
      </svg>
    </div>
  );
}

function Legenda({
  modo,
  contagem,
  filtroSit,
  onFiltro,
  lista,
}: {
  modo: Modo;
  contagem: Record<Situacao, number>;
  filtroSit: Situacao | "";
  onFiltro: (s: Situacao) => void;
  lista: Municipio[];
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
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3.5 w-3.5 rounded-sm"
                style={{ background: SITUACAO[s].cor }}
              />
              {SITUACAO[s].rotulo}
            </span>
            <span className="tabular-nums text-[#12201E]">
              <span className="font-semibold">{contagem[s]}</span>{" "}
              <span className="text-xs text-slate-500">{parte(contagem[s], lista.length)}</span>
            </span>
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
        0{" "}
        {escala.map((c) => (
          <span key={c} className="inline-block h-3 w-6" style={{ background: c }} />
        ))}{" "}
        {fmt(max)} notícias
      </span>
      {modo === "concorrencia" && (
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-[#9A5718] bg-[#E29F65]" />{" "}
          Vozes (tamanho = publicações)
        </span>
      )}
    </div>
  );
}

function Detalhe({ m, dias }: { m: Municipio; dias: number }) {
  const s = situacao(m);
  const barras = [
    { nome: "Vozes Paranaenses", n: vozes(m), nosso: true },
    ...m.conc_lista.map((x) => ({ ...x, nosso: false })),
  ].sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...barras.map((b) => b.n));
  return (
    <div className="space-y-4 text-sm">
      <span
        className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ background: SITUACAO[s].cor, color: SITUACAO[s].texto }}
      >
        {SITUACAO[s].rotulo}
      </span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="text-slate-500">Vozes ({dias} dias)</dt>
        <dd className="text-right font-semibold tabular-nums">
          {m.vozes_materias} matérias · {m.vozes_notas} notas
        </dd>
        <dt className="text-slate-500">Concorrência</dt>
        <dd className="text-right font-semibold tabular-nums">{m.conc_total} notícias</dd>
        <dt className="text-slate-500">Veículos que cobrem</dt>
        <dd className="text-right font-semibold tabular-nums">{m.conc_veiculos}</dd>
        <dt className="text-slate-500">Nossa participação</dt>
        <dd className="text-right font-semibold tabular-nums">
          {pct(participacao(m))}{" "}
          <span className="font-normal text-slate-500">
            ({vozes(m)} de {vozes(m) + m.conc_total})
          </span>
        </dd>
        <dt className="text-slate-500">Maior concorrente</dt>
        <dd className="text-right tabular-nums">
          {m.conc_lider ? `${m.conc_lider} · ${m.conc_maior}` : "—"}
        </dd>
        <dt className="text-slate-500">Prefeitura no robô</dt>
        <dd className="text-right">
          {m.prefeitura === "monitorada"
            ? `sim · ${m.prefeitura_noticias} notícias`
            : m.prefeitura === "inativa"
              ? "inativa"
              : "não"}
        </dd>
        <dt className="text-slate-500">Portal da Imprensa</dt>
        <dd className="text-right">{m.cliente ?? "não é cliente"}</dd>
      </dl>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quem publica sobre a cidade
        </p>
        {barras.length === 1 && !barras[0].n ? (
          <p className="text-slate-500">Ninguém publicou na janela.</p>
        ) : (
          <ul className="space-y-1.5">
            {barras.map((b) => (
              <li key={b.nome}>
                <div className="flex justify-between gap-2 text-xs">
                  <span className={b.nosso ? "font-semibold text-[#B5651D]" : "text-slate-700"}>
                    {b.nome}
                  </span>
                  <span className="tabular-nums text-slate-600">{b.n}</span>
                </div>
                <div className="mt-0.5 h-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded"
                    style={{
                      width: `${(b.n / max) * 100}%`,
                      background: b.nosso ? "#E29F65" : "#5E827A",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PorRegiao({
  lista,
  onRegiao,
  regiao,
}: {
  lista: Municipio[];
  onRegiao: (r: string) => void;
  regiao: string;
}) {
  const g = new Map<
    string,
    {
      nome: string;
      n: number;
      nos: number;
      disputa: number;
      eles: number;
      sem: number;
      v: number;
      c: number;
    }
  >();
  for (const m of lista) {
    const r = g.get(m.regiao) ?? {
      nome: m.regiao_nome,
      n: 0,
      nos: 0,
      disputa: 0,
      eles: 0,
      sem: 0,
      v: 0,
      c: 0,
    };
    const s = situacao(m);
    r.n++;
    r.v += vozes(m);
    r.c += m.conc_total;
    if (s === "so_vozes" || s === "vozes_lidera") r.nos++;
    else if (s === "disputa") r.disputa++;
    else if (s === "sem") r.sem++;
    else r.eles++;
    g.set(m.regiao, r);
  }
  return (
    <Section title="Por região" subtitle="Clique para filtrar o mapa." padded={false}>
      <ul className="divide-y divide-slate-100">
        {[...g.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .map(([slug, r]) => {
            const w = (x: number) => `${(x / r.n) * 100}%`;
            return (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => onRegiao(regiao === slug ? "" : slug)}
                  className={`w-full px-5 py-2.5 text-left ${regiao === slug ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-[#12201E]">{r.nome}</span>
                    <span className="tabular-nums text-slate-500">
                      {pct(r.v + r.c ? r.v / (r.v + r.c) : 0)} nosso · {fmt(r.v)} × {fmt(r.c)}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 flex h-2 overflow-hidden rounded"
                    aria-label={`${r.nos} lideramos, ${r.disputa} disputa, ${r.eles} concorrência, ${r.sem} sem cobertura`}
                  >
                    <span style={{ width: w(r.nos), background: SITUACAO.vozes_lidera.cor }} />
                    <span style={{ width: w(r.disputa), background: SITUACAO.disputa.cor }} />
                    <span style={{ width: w(r.eles), background: SITUACAO.conc_lidera.cor }} />
                    <span style={{ width: w(r.sem), background: SITUACAO.sem.cor }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-slate-500">
                    <span>{r.n} cidades</span>
                    <span className="text-[#B5651D]">{r.nos} lideramos</span>
                    <span>{r.disputa} disputa</span>
                    <span>{r.eles} concorrência</span>
                    <span>{r.sem} sem</span>
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
  {
    rotulo: "Maior concorrente",
    valor: (m) => (m.conc_lider ? `${m.conc_lider} (${m.conc_maior})` : "—"),
  },
  { rotulo: "Participação", valor: (m) => Math.round(participacao(m) * 100), num: true },
  { rotulo: "Situação", valor: (m) => ORDEM_SITUACAO.indexOf(situacao(m)) },
];

function Comparativo({
  lista,
  filtroSit,
  setFiltroSit,
  onSel,
}: {
  lista: Municipio[];
  filtroSit: Situacao | "";
  setFiltroSit: (s: Situacao | "") => void;
  onSel: (s: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState({ col: 3, asc: false });
  const linhas = lista
    .filter(
      (m) =>
        (!filtroSit || situacao(m) === filtroSit) && (!busca || norm(m.nome).includes(norm(busca))),
    )
    .sort((a, b) => {
      const x = COLS[ordem.col].valor(a),
        y = COLS[ordem.col].valor(b);
      const r =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt");
      return (ordem.asc ? r : -r) || a.nome.localeCompare(b.nome, "pt");
    });
  return (
    <Section
      title={`Comparativo por cidade (${linhas.length})`}
      subtitle="Vozes = matérias + notas da coluna regional. Concorrência = notícias dos veículos monitorados com a cidade como local do fato. Clique numa linha para ver no mapa."
      aside={
        <div className="flex flex-wrap items-end gap-2">
          <label className={rotuloClass}>
            Situação
            <select
              value={filtroSit}
              onChange={(e) => setFiltroSit(e.target.value as Situacao | "")}
              className={campoClass}
            >
              <option value="">Todas</option>
              {ORDEM_SITUACAO.map((s) => (
                <option key={s} value={s}>
                  {SITUACAO[s].rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className={rotuloClass}>
            Cidade
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar"
              className={campoClass}
            />
          </label>
        </div>
      }
      padded={false}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
              {COLS.map((c, i) => (
                <th
                  key={c.rotulo}
                  className={`cursor-pointer px-4 py-2.5 font-semibold ${c.num ? "text-right" : ""}`}
                  onClick={() => setOrdem((o) => ({ col: i, asc: o.col === i ? !o.asc : !c.num }))}
                >
                  {c.rotulo}
                  {ordem.col === i ? (ordem.asc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((m) => {
              const s = situacao(m);
              return (
                <tr
                  key={m.slug}
                  onClick={() => onSel(m.slug)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-2 font-semibold text-[#12201E]">{m.nome}</td>
                  <td className="px-4 py-2 text-slate-600">{m.regiao_nome}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#B5651D]">{vozes(m)}</td>
                  <td className="px-4 py-2 text-right">{m.conc_total}</td>
                  <td className="px-4 py-2 text-right">{m.conc_veiculos}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {m.conc_lider ? `${m.conc_lider} (${m.conc_maior})` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {pct(participacao(m))}{" "}
                    <span className="text-xs text-slate-400">
                      {vozes(m)}/{vozes(m) + m.conc_total}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: SITUACAO[s].cor, color: SITUACAO[s].texto }}
                    >
                      {SITUACAO[s].rotulo}
                    </span>
                  </td>
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
// Card expansível: número + percentual no cartão; o detalhe abre embaixo,
// ocupando a linha inteira da grade. Um aberto por grupo.
function ExpCard({
  id,
  aberto,
  onToggle,
  label,
  value,
  parteTxt,
  detalhe,
  tom = "neutro",
  children,
}: {
  id: string;
  aberto: string | null;
  onToggle: (id: string) => void;
  label: string;
  value: ReactNode;
  parteTxt?: string;
  detalhe?: ReactNode;
  tom?: "neutro" | "bom" | "alerta" | "nosso";
  children: ReactNode;
}) {
  const ativo = aberto === id;
  const cor =
    tom === "bom"
      ? "text-emerald-700"
      : tom === "alerta"
        ? "text-amber-700"
        : tom === "nosso"
          ? "text-[#B5651D]"
          : "text-[#12201E]";
  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm ${ativo ? "col-span-full border-[#12201E] ring-1 ring-[#12201E]" : tom === "alerta" ? "border-amber-300" : "border-slate-200"}`}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={ativo}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          <span className={`mt-1 block text-3xl font-bold tabular-nums ${cor}`}>
            {value}
            {parteTxt && (
              <span className="ml-1.5 text-base font-semibold text-slate-400">{parteTxt}</span>
            )}
          </span>
          {detalhe && <span className="mt-0.5 block text-xs text-slate-500">{detalhe}</span>}
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${ativo ? "rotate-180" : ""}`}
        />
      </button>
      {ativo && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

function useAberto() {
  const [aberto, setAberto] = useState<string | null>(null);
  return { aberto, onToggle: (id: string) => setAberto((a) => (a === id ? null : id)) };
}

/** Tabela pequena de cidades (dentro dos cards). */
function TabelaCidades({
  lista,
  colunas,
}: {
  lista: Municipio[];
  colunas: { rotulo: string; valor: (m: Municipio) => ReactNode; num?: boolean }[];
}) {
  if (!lista.length) return <p className="text-sm text-slate-500">Nenhuma cidade.</p>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full min-w-[560px] text-sm tabular-nums">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            {colunas.map((c) => (
              <th key={c.rotulo} className={`px-3 py-2 font-semibold ${c.num ? "text-right" : ""}`}>
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lista.map((m) => (
            <tr key={m.slug}>
              {colunas.map((c) => (
                <td key={c.rotulo} className={`px-3 py-1.5 ${c.num ? "text-right" : ""}`}>
                  {c.valor(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Contagem por região: quantos e que parte de cada região. */
function PorRegiaoMini({
  lista,
  filtro,
  rotulo,
}: {
  lista: Municipio[];
  filtro: (m: Municipio) => boolean;
  rotulo: string;
}) {
  const g = new Map<string, { nome: string; n: number; k: number }>();
  for (const m of lista) {
    const r = g.get(m.regiao) ?? { nome: m.regiao_nome, n: 0, k: 0 };
    r.n++;
    if (filtro(m)) r.k++;
    g.set(m.regiao, r);
  }
  return (
    <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {[...g.values()]
        .sort((a, b) => b.k - a.k)
        .map((r) => (
          <li key={r.nome}>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[#12201E]">{r.nome}</span>
              <span className="tabular-nums">
                {r.k} de {r.n} <span className="text-xs text-slate-500">{parte(r.k, r.n)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-slate-100">
              <div
                className="h-1.5 rounded bg-[#E29F65]"
                style={{ width: `${(r.k / Math.max(1, r.n)) * 100}%` }}
              />
            </div>
          </li>
        ))}
      <li className="sm:col-span-2 lg:col-span-3 text-xs text-slate-500">{rotulo}</li>
    </ul>
  );
}

const nomeCidade = (m: Municipio) => (
  <span className="font-semibold text-[#12201E]">
    {m.nome}
    {m.maior ? (
      <span className="ml-1.5 text-[10px] font-semibold uppercase text-[#B5651D]">maior</span>
    ) : null}
  </span>
);
const C_CIDADE = { rotulo: "Cidade", valor: nomeCidade };
const C_REGIAO = {
  rotulo: "Região",
  valor: (m: Municipio) => <span className="text-slate-600">{m.regiao_nome}</span>,
};
const C_VOZES = {
  rotulo: "Vozes",
  valor: (m: Municipio) => (
    <span
      className="text-[#B5651D]"
      title={`${m.vozes_materias} matérias · ${m.vozes_notas} notas`}
    >
      {vozes(m)}
    </span>
  ),
  num: true,
};
const C_CONC = { rotulo: "Concorrência", valor: (m: Municipio) => m.conc_total, num: true };
const C_VEIC = { rotulo: "Veículos", valor: (m: Municipio) => m.conc_veiculos, num: true };
const C_PREF = {
  rotulo: "Notícias da prefeitura",
  valor: (m: Municipio) => m.prefeitura_noticias,
  num: true,
};
const C_MOTIVO = {
  rotulo: "Situação da prefeitura",
  valor: (m: Municipio) => <span className="text-slate-600">{MOTIVOS[motivo(m)].titulo}</span>,
};
const C_LIDER = {
  rotulo: "Maior concorrente",
  valor: (m: Municipio) => (
    <span className="text-slate-600">
      {m.conc_lider ? `${m.conc_lider} (${m.conc_maior})` : "—"}
    </span>
  ),
};
const ordemPadrao = (a: Municipio, b: Municipio) =>
  Number(b.maior) - Number(a.maior) ||
  b.prefeitura_noticias - a.prefeitura_noticias ||
  a.nome.localeCompare(b.nome, "pt");

/** Indicadores do topo da página, expansíveis. */
function Resumo({
  lista,
  dias,
  contagem,
  veiculos,
}: {
  lista: Municipio[];
  dias: number;
  contagem: Record<Situacao, number>;
  veiculos: number;
}) {
  const ab = useAberto();
  const n = lista.length;
  const comVozes = lista.filter((m) => vozes(m) > 0);
  const lideramos = lista.filter(
    (m) => situacao(m) === "so_vozes" || situacao(m) === "vozes_lidera",
  );
  const atras = lista.filter((m) => situacao(m) === "conc_lidera" || situacao(m) === "so_conc");
  const totV = lista.reduce((s, m) => s + vozes(m), 0),
    totMat = lista.reduce((s, m) => s + m.vozes_materias, 0),
    totC = lista.reduce((s, m) => s + m.conc_total, 0);
  const porV = (a: Municipio, b: Municipio) =>
    vozes(b) - vozes(a) || a.nome.localeCompare(b.nome, "pt");
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ExpCard
        id="pub"
        {...ab}
        label="Vozes publicou em"
        value={fmt(comVozes.length)}
        parteTxt={parte(comVozes.length, n)}
        detalhe={`de ${fmt(n)} municípios em ${dias} dias · ${fmt(totMat)} matérias e ${fmt(totV - totMat)} notas`}
        tom="nosso"
      >
        <PorRegiaoMini
          lista={lista}
          filtro={(m) => vozes(m) > 0}
          rotulo="Municípios com ao menos uma matéria ou nota do Vozes, por região."
        />
        <div className="mt-4">
          <TabelaCidades
            lista={comVozes.slice().sort(porV)}
            colunas={[
              C_CIDADE,
              C_REGIAO,
              { rotulo: "Matérias", valor: (m) => m.vozes_materias, num: true },
              { rotulo: "Notas", valor: (m) => m.vozes_notas, num: true },
              C_CONC,
            ]}
          />
        </div>
      </ExpCard>
      <ExpCard
        id="lid"
        {...ab}
        label="Lideramos"
        value={fmt(lideramos.length)}
        parteTxt={parte(lideramos.length, n)}
        detalhe={`${fmt(contagem.so_vozes)} só o Vozes · ${fmt(contagem.vozes_lidera)} à frente · ${fmt(contagem.disputa)} em disputa`}
        tom="bom"
      >
        <PorRegiaoMini
          lista={lista}
          filtro={(m) => situacao(m) === "so_vozes" || situacao(m) === "vozes_lidera"}
          rotulo="Cidades onde só o Vozes publicou ou onde publicamos mais que o maior concorrente."
        />
        <div className="mt-4">
          <TabelaCidades
            lista={lideramos.slice().sort(porV)}
            colunas={[C_CIDADE, C_REGIAO, C_VOZES, C_CONC, C_LIDER]}
          />
        </div>
      </ExpCard>
      <ExpCard
        id="atr"
        {...ab}
        label="Concorrência à frente"
        value={fmt(atras.length)}
        parteTxt={parte(atras.length, n)}
        detalhe={`${fmt(contagem.so_conc)} só concorrência · ${fmt(contagem.sem)} sem cobertura`}
        tom="alerta"
      >
        <PorRegiaoMini
          lista={lista}
          filtro={(m) => situacao(m) === "conc_lidera" || situacao(m) === "so_conc"}
          rotulo="Cidades onde o maior concorrente publicou mais que o dobro do Vozes (ou só ele publicou)."
        />
        <div className="mt-4">
          <TabelaCidades
            lista={atras.slice().sort((a, b) => b.conc_total - a.conc_total)}
            colunas={[C_CIDADE, C_REGIAO, C_VOZES, C_CONC, C_VEIC, C_LIDER]}
          />
        </div>
      </ExpCard>
      <ExpCard
        id="par"
        {...ab}
        label="Nossa participação"
        value={pct(totV + totC ? totV / (totV + totC) : 0)}
        detalhe={`${fmt(totV)} do Vozes × ${fmt(totC)} dos ${fmt(veiculos)} veículos`}
      >
        <ParticipacaoPorRegiao lista={lista} />
      </ExpCard>
    </div>
  );
}

function ParticipacaoPorRegiao({ lista }: { lista: Municipio[] }) {
  const g = new Map<string, { nome: string; v: number; c: number }>();
  for (const m of lista) {
    const r = g.get(m.regiao) ?? { nome: m.regiao_nome, v: 0, c: 0 };
    r.v += vozes(m);
    r.c += m.conc_total;
    g.set(m.regiao, r);
  }
  const veic = new Map<string, number>();
  for (const m of lista)
    for (const x of m.conc_lista) veic.set(x.nome, (veic.get(x.nome) ?? 0) + x.n);
  const totV = lista.reduce((s, m) => s + vozes(m), 0);
  const top = [
    { nome: "Vozes Paranaenses", n: totV, nosso: true },
    ...[...veic.entries()].map(([nome, n]) => ({ nome, n, nosso: false })),
  ]
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);
  const max = Math.max(1, ...top.map((t) => t.n));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Por região (Vozes × veículos)
        </p>
        <ul className="space-y-2">
          {[...g.values()]
            .sort((a, b) => b.v + b.c - (a.v + a.c))
            .map((r) => (
              <li key={r.nome}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[#12201E]">{r.nome}</span>
                  <span className="tabular-nums">
                    {fmt(r.v)} × {fmt(r.c)}{" "}
                    <span className="text-xs text-slate-500">{parte(r.v, r.v + r.c)} nosso</span>
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded bg-slate-100">
                  <span
                    style={{
                      width: `${(r.v / Math.max(1, r.v + r.c)) * 100}%`,
                      background: "#E29F65",
                    }}
                  />
                  <span
                    style={{
                      width: `${(r.c / Math.max(1, r.v + r.c)) * 100}%`,
                      background: "#5E827A",
                    }}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Quem mais publica no recorte (notícias com cidade do PR)
        </p>
        <ul className="space-y-1.5">
          {top.map((t, i) => (
            <li key={t.nome}>
              <div className="flex justify-between gap-2 text-xs">
                <span className={t.nosso ? "font-semibold text-[#B5651D]" : "text-slate-700"}>
                  {i + 1}. {t.nome}
                </span>
                <span className="tabular-nums text-slate-600">{fmt(t.n)}</span>
              </div>
              <div className="mt-0.5 h-2 rounded bg-slate-100">
                <div
                  className="h-2 rounded"
                  style={{
                    width: `${(t.n / max) * 100}%`,
                    background: t.nosso ? "#E29F65" : "#5E827A",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">
          Veículos somados a partir dos 5 maiores de cada cidade.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const FAIXAS: Record<Exclude<Prioridade, "cliente">, { rotulo: string; descricao: string }> = {
  A: {
    rotulo: "Prioridade A",
    descricao:
      "Nenhum veículo cobre e a prefeitura produz notícia: assessoria ativa e ninguém distribui.",
  },
  B: {
    rotulo: "Prioridade B",
    descricao: "Nenhum veículo cobre; prefeitura no robô, sem produção na janela.",
  },
  C: {
    rotulo: "Prioridade C",
    descricao:
      "Nenhum veículo cobre e a prefeitura está fora do robô: o Portal é a porta de entrada.",
  },
  D: {
    rotulo: "Já tem cobertura",
    descricao: "Pelo menos um veículo monitorado publicou sobre a cidade.",
  },
};

function Prospeccao({ lista, dias }: { lista: Municipio[]; dias: number }) {
  const ab = useAberto();
  const [copiado, setCopiado] = useState<string | null>(null);
  const total = lista.length;
  const noRobo = lista.filter((m) => m.prefeitura === "monitorada");
  const produziram = noRobo.filter((m) => m.prefeitura_noticias > 0);
  const semProd = noRobo.filter((m) => m.prefeitura_noticias === 0);
  const foraRobo = lista.filter((m) => m.prefeitura !== "monitorada");
  const clientes = lista.filter((m) => m.cliente);
  const semVeiculo = lista.filter((m) => m.conc_total === 0);
  const noticiasPref = lista.reduce((s, m) => s + m.prefeitura_noticias, 0);

  async function copiar(id: string, ms: Municipio[]) {
    const cab = [
      "Cidade",
      "Região",
      "Prioridade",
      "Vozes",
      "Concorrência",
      "Veículos",
      "Prefeitura no robô",
      "Notícias da prefeitura",
      "Situação do site",
    ];
    const txt = [
      cab.join("\t"),
      ...ms.map((m) =>
        [
          m.nome,
          m.regiao_nome,
          prioridade(m),
          vozes(m),
          m.conc_total,
          m.conc_veiculos,
          m.prefeitura,
          m.prefeitura_noticias,
          MOTIVOS[motivo(m)].titulo,
        ].join("\t"),
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* sem área de transferência */
    }
  }
  const BotaoCopiar = ({ id, ms }: { id: string; ms: Municipio[] }) => (
    <button type="button" onClick={() => void copiar(id, ms)} className={btn("ghost", "sm")}>
      {copiado === id ? "Copiado" : `Copiar lista (${ms.length})`}
    </button>
  );

  const Motivos = ({ ms }: { ms: Municipio[] }) => {
    const g = new Map<string, Municipio[]>();
    for (const m of ms) {
      const k = motivo(m);
      g.set(k, [...(g.get(k) ?? []), m]);
    }
    return (
      <ul className="grid gap-4 lg:grid-cols-2">
        {[...g.entries()]
          .sort((a, b) => b[1].length - a[1].length)
          .map(([k, x]) => (
            <li key={k} className="rounded-xl border border-slate-100 p-3">
              <div className="flex justify-between gap-2 text-sm">
                <span className="font-semibold text-[#12201E]">{MOTIVOS[k].titulo}</span>
                <span className="tabular-nums">
                  <span className="font-semibold">{x.length}</span>{" "}
                  <span className="text-xs text-slate-500">{parte(x.length, ms.length)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-slate-100">
                <div
                  className="h-1.5 rounded bg-[#5E827A]"
                  style={{ width: `${(x.length / Math.max(1, ms.length)) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-sm text-slate-600">{MOTIVOS[k].estrategia}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmt(x.filter((m) => m.conc_total === 0).length)} sem veículo regional ·{" "}
                {fmt(x.filter((m) => m.maior).length)} entre as maiores
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-slate-500">Ver cidades</summary>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {x.map((m) => m.nome).join(", ")}
                </p>
              </details>
            </li>
          ))}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <Section
        title="Monitoramento das prefeituras"
        subtitle={`Clique num card para abrir o detalhe. Janela de ${dias} dias; diagnóstico dos sites de ${DIAG_TESTADO_EM.split("-").reverse().join("/")}.`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ExpCard
            id="robo"
            {...ab}
            label="No robô"
            value={fmt(noRobo.length)}
            parteTxt={parte(noRobo.length, total)}
            detalhe={`de ${fmt(total)} prefeituras`}
          >
            <PorRegiaoMini
              lista={lista}
              filtro={(m) => m.prefeitura === "monitorada"}
              rotulo="Prefeituras com fonte ativa no pipeline, por região."
            />
          </ExpCard>
          <ExpCard
            id="prod"
            {...ab}
            label="Produziram"
            value={fmt(produziram.length)}
            parteTxt={parte(produziram.length, noRobo.length)}
            detalhe={`das ${fmt(noRobo.length)} no robô · ${fmt(noticiasPref)} notícias coletadas`}
            tom="bom"
          >
            <div className="mb-3 flex justify-end">
              <BotaoCopiar id="prod" ms={produziram} />
            </div>
            <TabelaCidades
              lista={produziram
                .slice()
                .sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias)}
              colunas={[
                C_CIDADE,
                C_REGIAO,
                {
                  rotulo: "Coletadas",
                  valor: (m) => (
                    <>
                      {m.prefeitura_noticias}{" "}
                      <span className="text-[11px] text-slate-400">
                        {parte(m.prefeitura_noticias, noticiasPref)}
                      </span>
                    </>
                  ),
                  num: true,
                },
                C_VOZES,
                C_CONC,
                C_VEIC,
              ]}
            />
          </ExpCard>
          <ExpCard
            id="semprod"
            {...ab}
            label="No robô, sem produção"
            value={fmt(semProd.length)}
            parteTxt={parte(semProd.length, noRobo.length)}
            detalhe="das prefeituras no robô"
          >
            <Motivos ms={semProd} />
          </ExpCard>
          <ExpCard
            id="fora"
            {...ab}
            label="Fora do robô"
            value={fmt(foraRobo.length)}
            parteTxt={parte(foraRobo.length, total)}
            detalhe={`${fmt(foraRobo.filter((m) => m.prefeitura === "inativa").length)} inativas · ${fmt(foraRobo.filter((m) => m.prefeitura === "nao_cadastrada").length)} não cadastradas`}
            tom="alerta"
          >
            <Motivos ms={foraRobo} />
          </ExpCard>
          <ExpCard
            id="semveic"
            {...ab}
            label="Sem veículo regional"
            value={fmt(semVeiculo.length)}
            parteTxt={parte(semVeiculo.length, total)}
            detalhe={`${fmt(semVeiculo.filter((m) => vozes(m) > 0).length)} delas com o Vozes publicando`}
            tom="nosso"
          >
            <PorRegiaoMini
              lista={lista}
              filtro={(m) => m.conc_total === 0}
              rotulo="Municípios sobre os quais nenhum veículo monitorado publicou na janela."
            />
            <div className="mt-4">
              <TabelaCidades
                lista={semVeiculo.slice().sort(ordemPadrao)}
                colunas={[C_CIDADE, C_REGIAO, C_VOZES, C_PREF, C_MOTIVO]}
              />
            </div>
          </ExpCard>
          <ExpCard
            id="clientes"
            {...ab}
            label="Clientes do Portal"
            value={fmt(clientes.length)}
            parteTxt={parte(clientes.length, total)}
            detalhe={`${fmt(clientes.filter((m) => m.cliente === "aprovado").length)} aprovados · ${fmt(clientes.filter((m) => m.cliente === "pendente").length)} pendentes`}
          >
            <TabelaCidades
              lista={clientes.slice().sort(ordemPadrao)}
              colunas={[
                C_CIDADE,
                C_REGIAO,
                { rotulo: "Status", valor: (m) => m.cliente ?? "—" },
                C_VOZES,
                C_PREF,
              ]}
            />
          </ExpCard>
          <ExpCard
            id="regioes"
            {...ab}
            label="Por região"
            value={fmt(new Set(lista.map((m) => m.regiao)).size)}
            detalhe="regiões · robô, produção, sem veículo e prioridade A"
          >
            <TabelaRegioes lista={lista} />
          </ExpCard>
          <ExpCard
            id="ranking"
            {...ab}
            label="Top 20 que mais produzem"
            value={fmt(
              produziram
                .slice()
                .sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias)
                .slice(0, 20)
                .reduce((s, m) => s + m.prefeitura_noticias, 0),
            )}
            parteTxt={parte(
              produziram
                .slice()
                .sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias)
                .slice(0, 20)
                .reduce((s, m) => s + m.prefeitura_noticias, 0),
              noticiasPref,
            )}
            detalhe="notícias coletadas das 20 prefeituras mais ativas"
          >
            <TabelaCidades
              lista={produziram
                .slice()
                .sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias)
                .slice(0, 20)}
              colunas={[
                {
                  rotulo: "#",
                  valor: (m) => (
                    <span className="text-slate-400">
                      {produziram
                        .slice()
                        .sort((a, b) => b.prefeitura_noticias - a.prefeitura_noticias)
                        .indexOf(m) + 1}
                    </span>
                  ),
                },
                C_CIDADE,
                C_REGIAO,
                { rotulo: "Coletadas", valor: (m) => m.prefeitura_noticias, num: true },
                C_VOZES,
                C_CONC,
              ]}
            />
          </ExpCard>
        </div>
      </Section>

      <Section
        title="Prospecção do Portal da Imprensa"
        subtitle="Prioridade pela falta de cobertura e pela produção da prefeitura. Abra uma faixa para ver as cidades e copiar a lista."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(FAIXAS) as (keyof typeof FAIXAS)[]).map((k) => {
            const ms = lista.filter((m) => prioridade(m) === k).sort(ordemPadrao);
            return (
              <ExpCard
                key={k}
                id={`faixa-${k}`}
                {...ab}
                label={FAIXAS[k].rotulo}
                value={fmt(ms.length)}
                parteTxt={parte(ms.length, total)}
                detalhe={FAIXAS[k].descricao}
                tom={k === "A" ? "bom" : "neutro"}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    {fmt(ms.filter((m) => m.maior).length)} entre as maiores cidades ·{" "}
                    {fmt(ms.reduce((s, m) => s + m.prefeitura_noticias, 0))} notícias das
                    prefeituras
                  </span>
                  <BotaoCopiar id={`faixa-${k}`} ms={ms} />
                </div>
                <TabelaCidades
                  lista={ms}
                  colunas={[C_CIDADE, C_REGIAO, C_VOZES, C_CONC, C_VEIC, C_PREF, C_MOTIVO]}
                />
              </ExpCard>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function TabelaRegioes({ lista }: { lista: Municipio[] }) {
  type R = {
    nome: string;
    n: number;
    robo: number;
    prod: number;
    fora: number;
    semVeic: number;
    a: number;
    cli: number;
    not: number;
    v: number;
    c: number;
  };
  const regs = new Map<string, R>();
  const soma = (r: R, m: Municipio) => {
    r.n++;
    if (m.prefeitura === "monitorada") r.robo++;
    else r.fora++;
    if (m.prefeitura === "monitorada" && m.prefeitura_noticias > 0) r.prod++;
    if (m.conc_total === 0) r.semVeic++;
    if (prioridade(m) === "A") r.a++;
    if (m.cliente) r.cli++;
    r.not += m.prefeitura_noticias;
    r.v += vozes(m);
    r.c += m.conc_total;
  };
  const vazio = (nome: string): R => ({
    nome,
    n: 0,
    robo: 0,
    prod: 0,
    fora: 0,
    semVeic: 0,
    a: 0,
    cli: 0,
    not: 0,
    v: 0,
    c: 0,
  });
  const tot = vazio("Paraná");
  for (const m of lista) {
    const r = regs.get(m.regiao) ?? vazio(m.regiao_nome);
    soma(r, m);
    soma(tot, m);
    regs.set(m.regiao, r);
  }
  const q = (k: number, n: number) => (
    <>
      {fmt(k)} <span className="text-xs font-normal text-slate-400">{parte(k, n)}</span>
    </>
  );
  const linha = (r: R, destaque = false) => (
    <tr key={r.nome} className={destaque ? "bg-slate-50 font-semibold" : ""}>
      <td className="px-3 py-2 font-semibold text-[#12201E]">{r.nome}</td>
      <td className="px-3 py-2 text-right">{fmt(r.n)}</td>
      <td className="px-3 py-2 text-right">{q(r.robo, r.n)}</td>
      <td className="px-3 py-2 text-right text-emerald-700">{q(r.prod, r.n)}</td>
      <td className="px-3 py-2 text-right">{q(r.fora, r.n)}</td>
      <td className="px-3 py-2 text-right">{q(r.semVeic, r.n)}</td>
      <td className="px-3 py-2 text-right text-[#B5651D]">{fmt(r.a)}</td>
      <td className="px-3 py-2 text-right">{fmt(r.cli)}</td>
      <td className="px-3 py-2 text-right">{fmt(r.not)}</td>
      <td className="px-3 py-2 text-right">
        {fmt(r.v)} × {fmt(r.c)}
      </td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2">Região</th>
            <th className="px-3 py-2 text-right">Municípios</th>
            <th className="px-3 py-2 text-right">No robô</th>
            <th className="px-3 py-2 text-right">Produziram</th>
            <th className="px-3 py-2 text-right">Fora do robô</th>
            <th className="px-3 py-2 text-right">Sem veículo</th>
            <th className="px-3 py-2 text-right">Prioridade A</th>
            <th className="px-3 py-2 text-right">Clientes</th>
            <th className="px-3 py-2 text-right">Notícias coletadas</th>
            <th className="px-3 py-2 text-right">Vozes × veículos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...regs.values()]
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
            .map((r) => linha(r))}
          {linha(tot, true)}
        </tbody>
      </table>
    </div>
  );
}
