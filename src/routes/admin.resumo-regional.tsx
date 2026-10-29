import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { montarResumo, type Canal, type ItemResumo, type NotaResumo } from "@/lib/resumo-regional";
import { PageHeader, Section, EmptyState, ErrorBanner, Aviso, Tabs, btn, campoClass, rotuloClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/resumo-regional")({
  component: AdminResumoRegional,
});

type Regiao = { id: string; slug: string; nome: string };
type Linha = { regiao_id: string; titulo: string; slug: string; cidade_principal: string | null; publicado_em: string; imagem_capa_url: string | null; foto_origem: string | null };
type LinhaNota = { regiao_id: string; titulo: string; cidade_slug: string | null };

function hojeSp(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function AdminResumoRegional() {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [dia, setDia] = useState(hojeSp());
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [sel, setSel] = useState<string>("");
  const [itens, setItens] = useState<Linha[]>([]);
  const [notas, setNotas] = useState<LinhaNota[]>([]);
  const [nomeCidade, setNomeCidade] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const sb = await getExternalBrowser();
      const inicio = new Date(`${dia}T00:00:00-03:00`).toISOString();
      const fim = new Date(new Date(`${dia}T00:00:00-03:00`).getTime() + 86400_000).toISOString();
      const [{ data: rg, error: e1 }, { data: ga, error: e2 }, { data: nt }, { data: cid }] = await Promise.all([
        sb.from("regioes").select("id, slug, nome").order("nome"),
        sb.from("generated_articles")
          .select("regiao_id, titulo, slug, cidade_principal, publicado_em, imagem_capa_url, foto_origem")
          .eq("status", "publicado").gte("publicado_em", inicio).lt("publicado_em", fim).limit(1000),
        sb.from("coluna_cidade_notas").select("regiao_id, titulo, cidade_slug")
          .eq("status", "publicado").gte("publicado_em", inicio).lt("publicado_em", fim).limit(500),
        sb.from("cidades").select("slug, nome").limit(1000),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const lista = ((rg ?? []) as Regiao[]).filter((r) => r.slug !== "nacional" && r.slug !== "internacional");
      setRegioes(lista);
      setItens((ga ?? []) as Linha[]);
      setNotas((nt ?? []) as LinhaNota[]);
      setNomeCidade(Object.fromEntries(((cid ?? []) as { slug: string; nome: string }[]).map((c) => [c.slug, c.nome])));
      setSel((s) => s || lista[0]?.id || "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o dia.");
    } finally {
      setCarregando(false);
    }
  }, [dia]);

  useEffect(() => { void carregar(); }, [carregar]);

  const contagem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of itens) m[i.regiao_id] = (m[i.regiao_id] ?? 0) + 1;
    for (const n of notas) m[n.regiao_id] = (m[n.regiao_id] ?? 0) + 1;
    return m;
  }, [itens, notas]);

  const regiao = regioes.find((r) => r.id === sel) ?? null;
  const texto = useMemo(() => {
    if (!regiao) return "";
    const doDia: ItemResumo[] = itens.filter((i) => i.regiao_id === regiao.id).map((i) => ({
      titulo: i.titulo,
      slug: i.slug,
      regiaoSlug: regiao.slug,
      cidade: i.cidade_principal,
      publicadoEm: i.publicado_em,
      temFoto: !!i.imagem_capa_url && i.foto_origem !== "generica_institucional" && !/\/fotos-genericas\//.test(i.imagem_capa_url),
    }));
    const nts: NotaResumo[] = notas.filter((n) => n.regiao_id === regiao.id)
      .map((n) => ({ titulo: n.titulo, cidade: n.cidade_slug ? nomeCidade[n.cidade_slug] ?? null : null }));
    return montarResumo({ regiaoSlug: regiao.slug, regiaoNome: regiao.nome, diaIso: `${dia}T12:00:00-03:00`, itens: doDia, notas: nts, canal });
  }, [regiao, itens, notas, nomeCidade, canal, dia]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não deu para copiar automaticamente. Selecione o texto e copie à mão.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Resumo por região"
        subtitle="Texto pronto do dia para o canal ou grupo de WhatsApp “Vozes {Região}” e para a legenda do Instagram regional. Os links levam utm por canal e região, para o Analytics mostrar quem veio de onde."
      />

      {erro && <ErrorBanner>{erro}</ErrorBanner>}

      <Section>
        <div className="flex flex-wrap items-end gap-4">
          <label className={rotuloClass}>
            Dia
            <input type="date" value={dia} max={hojeSp()} onChange={(e) => setDia(e.target.value)} className={campoClass} />
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Canal
            <Tabs value={canal} onChange={setCanal} items={[{ value: "whatsapp", label: "WhatsApp" }, { value: "instagram", label: "Instagram" }]} />
          </div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Section title="Regiões" padded={false}>
          {carregando ? (
            <p className="p-5 text-sm text-slate-500">Carregando…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {regioes.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSel(r.id)}
                    className={`flex w-full items-center justify-between px-5 py-2.5 text-left text-sm ${sel === r.id ? "bg-[#12201E] text-white" : "text-[#12201E] hover:bg-slate-50"}`}
                  >
                    <span>{r.nome}</span>
                    <span className={`text-xs ${sel === r.id ? "text-white/80" : "text-slate-500"}`}>{contagem[r.id] ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={regiao ? `Vozes ${regiao.nome}` : "Resumo"}
          subtitle="Até 8 matérias (com foto primeiro) e 5 notas da coluna regional."
          aside={
            texto && (
              <button type="button" onClick={copiar} className={btn("primary", "sm")}>
                <Copy className="mr-1.5 inline h-3.5 w-3.5" />
                {copiado ? "Copiado" : "Copiar texto"}
              </button>
            )
          }
        >
          {!regiao ? (
            <EmptyState title="Escolha uma região." />
          ) : (
            <>
              {copiado && <div className="mb-3"><Aviso>Texto copiado. Cole no canal da região.</Aviso></div>}
              <textarea readOnly value={texto} rows={22} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[13px] leading-relaxed text-slate-800" />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
