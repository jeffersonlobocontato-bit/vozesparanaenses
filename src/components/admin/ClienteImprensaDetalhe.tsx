import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { ErrorBanner, StatusPill } from "@/components/admin/ui";

// Ficha do cliente do Portal da Imprensa (/admin/imprensa-clientes): abre ao
// clicar no cliente. Dados do cadastro, aceites (LGPD e termo), aprovação,
// limite semanal e tudo o que o cliente criou no portal, com link para a
// matéria publicada. O IP do aceite do termo NÃO é mostrado (dado pessoal
// guardado só como prova).

type Ficha = {
  id: string;
  nome_empresa: string;
  nome_contato: string;
  email: string;
  slug: string;
  ativo: boolean;
  status: string;
  origem: string;
  cpf: string | null;
  funcao: string | null;
  criado_em: string;
  aprovado_em: string | null;
  recusa_motivo: string | null;
  lgpd_aceite_em: string | null;
  termo_cadastro_aceite_em: string | null;
  limite_semanal: number | null;
  cidade: { nome: string } | null;
  categoria: { nome: string } | null;
};

type Submissao = {
  id: string;
  modo: string | null;
  titulo_gerado: string | null;
  status: string;
  criado_em: string;
  publicado_em: string | null;
  materia: { slug: string; status: string; regiao: { slug: string } | null } | null;
};

const data = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
const cpf = (c: string | null) => (c ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "—");

export function ClienteImprensaDetalhe({ id }: { id: string }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [subs, setSubs] = useState<Submissao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const [c, s] = await Promise.all([
          sb
            .from("clientes_imprensa")
            .select("id, nome_empresa, nome_contato, email, slug, ativo, status, origem, cpf, funcao, criado_em, aprovado_em, recusa_motivo, lgpd_aceite_em, termo_cadastro_aceite_em, limite_semanal, cidade:cidades(nome), categoria:editorial_categories(nome)")
            .eq("id", id)
            .maybeSingle(),
          sb
            .from("imprensa_submissoes")
            .select("id, modo, titulo_gerado, status, criado_em, publicado_em, materia:generated_articles(slug, status, regiao:regioes(slug))")
            .eq("cliente_id", id)
            .order("criado_em", { ascending: false })
            .limit(200),
        ]);
        if (c.error) throw c.error;
        if (!vivo) return;
        setFicha(c.data as unknown as Ficha);
        setSubs((s.data ?? []) as unknown as Submissao[]);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Não foi possível abrir o cliente.");
      }
    })();
    return () => { vivo = false; };
  }, [id]);

  if (erro) return <ErrorBanner>{erro}</ErrorBanner>;
  if (!ficha) return <p className="py-3 text-sm text-slate-500">Abrindo…</p>;

  const publicados = subs.filter((s) => s.status === "publicado").length;
  const linha = (rotulo: string, valor: ReactNode) => (
    <>
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="min-w-0 break-words text-[#12201E]">{valor}</dd>
    </>
  );

  return (
    <div className="mt-3 grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#12201E]">Cadastro</h3>
        <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {linha("Empresa/órgão", ficha.nome_empresa)}
          {linha("Prefeitura", ficha.cidade?.nome ?? "—")}
          {linha("Contato", ficha.nome_contato)}
          {linha("Função", ficha.funcao ?? "—")}
          {linha("CPF", <span className="font-mono">{cpf(ficha.cpf)}</span>)}
          {linha("E-mail", <a className="underline" href={`mailto:${ficha.email}`}>{ficha.email}</a>)}
          {linha("Slug", <span className="font-mono">{ficha.slug}</span>)}
          {linha("Editoria padrão", ficha.categoria?.nome ?? "—")}
          {linha("Origem", ficha.origem === "autocadastro" ? "Autocadastro" : "Criado pela equipe")}
          {linha("Situação", <span className="inline-flex gap-1.5"><StatusPill status={ficha.status} />{ficha.status === "aprovado" && <StatusPill status={ficha.ativo ? "ativo" : "inativo"} />}</span>)}
          {ficha.recusa_motivo && linha("Motivo da recusa", ficha.recusa_motivo)}
          {linha("Limite", ficha.limite_semanal === null ? "—" : `${ficha.limite_semanal} matéria(s) por semana`)}
          {linha("Cadastrado em", data(ficha.criado_em))}
          {linha("Aprovado em", data(ficha.aprovado_em))}
          {linha("Aceite LGPD", data(ficha.lgpd_aceite_em))}
          {linha("Aceite do termo", data(ficha.termo_cadastro_aceite_em))}
        </dl>
      </div>
      <div className="min-w-0">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#12201E]">
          Conteúdos no portal ({subs.length} · {publicados} publicados)
        </h3>
        {subs.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum conteúdo criado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-200 text-sm">
            {subs.map((s) => {
              const url = s.materia?.regiao?.slug && s.materia.slug ? `/${s.materia.regiao.slug}/${s.materia.slug}` : null;
              return (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium text-[#12201E]">{s.titulo_gerado || "(sem título ainda)"}</p>
                    <p className="text-xs text-slate-500">
                      {data(s.criado_em)}
                      {s.modo ? ` · ${s.modo}` : ""}
                      {s.publicado_em ? ` · publicado ${data(s.publicado_em)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={s.status} />
                    {url && s.materia?.status === "publicado" && (
                      <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir matéria publicada" className="text-slate-500 hover:text-[#12201E]">
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
