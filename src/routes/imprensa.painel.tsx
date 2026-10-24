import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { invokeImprensa } from "@/lib/imprensa-invoke";
import { Logo } from "@/components/Logo";
import { ShareButtons } from "@/components/ShareButtons";

export const Route = createFileRoute("/imprensa/painel")({
  head: () => ({
    meta: [
      { title: "Portal da Imprensa — Painel do cliente | Vozes Paranaenses" },
      { name: "description", content: "Painel do cliente do Portal da Imprensa: gere, revise e envie seus conteúdos para publicação no Vozes Paranaenses." },
      { property: "og:title", content: "Portal da Imprensa — Painel do cliente" },
      { property: "og:description", content: "Gere, revise e envie conteúdos para publicação no Vozes Paranaenses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ImprensaPainel,
});

const TERMO_RESPONSABILIDADE = `Ao clicar em "Publicar", você declara que é o autor ou representante legal autorizado da fonte deste conteúdo e assume, de forma pessoal e exclusiva, integral responsabilidade civil e criminal pela veracidade, exatidão e legalidade das informações aqui apresentadas — nos termos dos artigos 186 e 927 do Código Civil e dos artigos 138 a 140 do Código Penal (crimes contra a honra).

O Vozes Paranaenses atua como provedor de aplicação de internet, nos termos do art. 19 da Lei nº 12.965/2014 (Marco Civil da Internet), disponibilizando a ferramenta de publicação sem verificação editorial prévia do conteúdo fornecido pelo cliente. A reescrita realizada por inteligência artificial adapta apenas forma e estilo ao padrão editorial do portal — não constitui apuração, checagem factual ou endosso do conteúdo por parte da redação.

Conteúdo identificado como ilegal, difamatório, ou em desacordo com estes termos poderá ser removido a qualquer momento, sem aviso prévio, sem prejuízo de eventual responsabilização do autor.`;

type Foto = { url: string; legenda?: string };

// A IA leva ~15–40 s. A barra avança sozinha até 90% e completa quando o
// texto chega — é indicação de andamento, não medida exata.
function BarraRedacao() {
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const t = setInterval(() => setPct((p) => (p < 90 ? p + Math.max(0.6, (90 - p) / 18) : p)), 400);
    return () => clearInterval(t);
  }, []);
  const etapa = pct < 30 ? "Lendo o seu material…" : pct < 60 ? "Identificando a editoria…" : "Escrevendo no padrão do portal…";
  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="status" aria-live="polite">
      <p className="font-display text-xl font-bold uppercase tracking-wide text-[#12201E]">Sua matéria está sendo redigida</p>
      <div className="mx-auto mt-5 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="h-full rounded-full bg-[#E29F65] transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-slate-500">{etapa}</p>
    </div>
  );
}

function ImprensaPainel() {
  const nav = useNavigate();
  const [checando, setChecando] = useState(true);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [statusCadastro, setStatusCadastro] = useState<"pendente" | "aprovado" | "recusado">("aprovado");

  const [textoBruto, setTextoBruto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [submissaoId, setSubmissaoId] = useState<string | null>(null);
  const [categoriaDetectada, setCategoriaDetectada] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [principal, setPrincipal] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const [termoAceito, setTermoAceito] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState<{ url: string; titulo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Confirma sessão + acesso de cliente antes de mostrar qualquer coisa.
  useEffect(() => {
    (async () => {
      const sb = await getExternalBrowser();
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) { nav({ to: "/imprensa/entrar", replace: true }); return; }
      const { data: cliente } = await sb
        .from("clientes_imprensa")
        .select("nome_empresa, ativo, status")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      if (!cliente || !cliente.ativo) {
        await sb.auth.signOut();
        nav({ to: "/imprensa/entrar", replace: true });
        return;
      }
      setNomeEmpresa(cliente.nome_empresa);
      setStatusCadastro((cliente.status ?? "aprovado") as "pendente" | "aprovado" | "recusado");
      setChecando(false);
    })();
  }, [nav]);

  async function gerarRascunho() {
    if (textoBruto.trim().length < 40) {
      setErro("Cole o release completo ou escreva com mais detalhe (mínimo ~40 caracteres).");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await invokeImprensa<{
        submissao_id: string; categoria_detectada: { nome: string };
        titulo: string; subtitulo: string; corpo: string;
      }>("imprensa-gerar-rascunho", { texto_bruto: textoBruto, submissao_id: submissaoId ?? undefined });
      setSubmissaoId(res.submissao_id);
      setCategoriaDetectada(res.categoria_detectada.nome);
      setTitulo(res.titulo);
      setSubtitulo(res.subtitulo);
      setCorpo(res.corpo);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar rascunho.");
    } finally {
      setGerando(false);
    }
  }

  async function onUploadFotos(files: File[]) {
    setUploadBusy(true);
    setErroFoto(null);
    try {
      const sb = await getExternalBrowser();
      const novas: Foto[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 10 * 1024 * 1024) { setErroFoto(`"${file.name}" passa de 10 MB e não foi enviada.`); continue; }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await sb.storage.from("imprensa-imagens").upload(path, file, { contentType: file.type || "image/jpeg" });
        if (error) throw new Error(`Não foi possível enviar "${file.name}": ${error.message}`);
        novas.push({ url: sb.storage.from("imprensa-imagens").getPublicUrl(path).data.publicUrl });
      }
      setFotos((f) => [...f, ...novas]);
    } catch (e: unknown) {
      console.error("upload de foto", e);
      setErroFoto(e instanceof Error ? e.message : "Erro ao enviar foto.");
    } finally {
      setUploadBusy(false);
    }
  }

  function removerFoto(i: number) {
    setFotos((f) => f.filter((_, j) => j !== i));
    setPrincipal((p) => (i === p ? 0 : i < p ? p - 1 : p));
  }

  async function publicar() {
    if (!submissaoId) return;
    if (!termoAceito) { setErro("Aceite o termo de responsabilidade antes de publicar."); return; }
    setPublicando(true);
    setErro(null);
    // A foto principal vai na frente: é a capa da matéria.
    const ordenadas = fotos.length ? [fotos[principal], ...fotos.filter((_, i) => i !== principal)] : [];
    try {
      const res = await invokeImprensa<{ slug: string; regiao_slug: string | null }>("imprensa-publicar", {
        submissao_id: submissaoId, titulo, subtitulo, corpo, fotos: ordenadas, termo_aceito: true,
      });
      if (!res.slug || !res.regiao_slug) throw new Error("A matéria foi recebida, mas o link não foi gerado. Avise a equipe do Vozes Paranaenses.");
      const url = `${window.location.origin}/${res.regiao_slug}/${res.slug}`;
      setPublicado({ url, titulo });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally {
      setPublicando(false);
    }
  }

  async function copiarLink() {
    if (!publicado) return;
    try {
      await navigator.clipboard.writeText(publicado.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard indisponível */ }
  }

  async function sair() {
    const sb = await getExternalBrowser();
    await sb.auth.signOut();
    nav({ to: "/imprensa/entrar", replace: true });
  }

  function novaMateria() {
    setPublicado(null); setSubmissaoId(null); setCategoriaDetectada(null);
    setTextoBruto(""); setTitulo(""); setSubtitulo(""); setCorpo("");
    setFotos([]); setPrincipal(0); setTermoAceito(false);
  }

  if (checando) return <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  const cabecalho = (
    <div className="mb-6 flex items-center justify-between">
      <Logo size="sm" variant="blue" />
      <span className="text-sm text-muted-foreground">{nomeEmpresa}</span>
    </div>
  );

  if (statusCadastro !== "aprovado") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {cabecalho}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold text-[#12201E]">
            {statusCadastro === "pendente" ? "Cadastro em análise" : "Cadastro não aprovado"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {statusCadastro === "pendente"
              ? "Estamos conferindo os seus dados. Assim que o cadastro for aprovado, esta página libera o envio e a publicação de matérias — é só voltar e entrar de novo."
              : "Não foi possível confirmar o seu cadastro. Fale com a equipe pelo e-mail contato@vozesparanaenses.com.br."}
          </p>
          <button onClick={sair} className="mt-5 text-sm font-semibold text-[#B5651D] underline">Sair</button>
        </div>
      </div>
    );
  }

  if (publicado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        {cabecalho}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold text-[#12201E]">Matéria publicada!</h1>
          <p className="mt-1 text-sm text-slate-600">{publicado.titulo}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={publicado.url} onFocus={(e) => e.target.select()}
              className="min-w-0 flex-1 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-sm" aria-label="Link da matéria" />
            <button onClick={copiarLink} className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-[#12201E] hover:bg-slate-50">
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            <a href={publicado.url} target="_blank" rel="noopener noreferrer"
              className="rounded bg-[#12201E] px-4 py-2 text-sm font-semibold text-white">Ver matéria</a>
          </div>
          <div className="mt-5 flex justify-center">
            <ShareButtons url={publicado.url} title={publicado.titulo} />
          </div>
        </div>
        <button onClick={novaMateria} className="mt-6 text-sm font-semibold text-[#B5651D] underline">Enviar outra matéria</button>
      </div>
    );
  }

  const blocoFotos = (
    <div className="text-sm">
      <span className="mb-1 block font-medium">Fotos</span>
      <p className="mb-2 text-xs text-slate-500">
        Envie uma ou mais fotos e escolha a <strong>principal</strong> (vira a capa da matéria). Só use fotos que você tem direito de publicar.
      </p>
      {fotos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <div key={f.url} className={`relative overflow-hidden rounded-lg border-2 ${i === principal ? "border-[#E29F65]" : "border-transparent"}`}>
              <img src={f.url} alt="" className="aspect-square w-full object-cover" />
              {i === principal ? (
                <span className="absolute left-1 top-1 rounded bg-[#E29F65] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Principal</span>
              ) : (
                <button type="button" onClick={() => setPrincipal(i)}
                  className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#12201E] hover:bg-white">
                  Tornar principal
                </button>
              )}
              <button type="button" onClick={() => removerFoto(i)} aria-label="Remover foto"
                className="absolute right-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-white">
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      {erroFoto && <p role="alert" className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{erroFoto}</p>}
      <label className={`inline-flex cursor-pointer items-center rounded border border-dashed border-slate-400 px-4 py-2 text-sm font-semibold text-[#12201E] hover:bg-slate-50 ${uploadBusy ? "opacity-50" : ""}`}>
        {uploadBusy ? "Enviando fotos…" : fotos.length ? "Adicionar mais fotos" : "Escolher fotos"}
        <input type="file" accept="image/*" multiple disabled={uploadBusy} className="sr-only"
          onChange={(e) => { const lista = Array.from(e.target.files ?? []); e.target.value = ""; if (lista.length) void onUploadFotos(lista); }} />
      </label>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {cabecalho}

      <h1 className="font-display text-2xl font-bold text-[#12201E]">Portal da Imprensa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Cole seu release, ou escreva o que quer divulgar com o máximo de detalhe — a IA identifica a editoria e
        escreve o rascunho seguindo o padrão editorial do portal.
      </p>

      {erro && <p className="mt-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

      {gerando && <BarraRedacao />}

      {!titulo && !gerando && (
        <div className="mt-6 space-y-5">
          <textarea
            value={textoBruto}
            onChange={(e) => setTextoBruto(e.target.value)}
            rows={10}
            placeholder="Cole aqui o release, ou responda: do que se trata, quem é a fonte, qual o fato principal, tem algum dado ou citação importante?"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          {blocoFotos}
          <button
            onClick={gerarRascunho}
            disabled={uploadBusy}
            className="rounded bg-[#E29F65] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Enviar e redigir matéria
          </button>
        </div>
      )}

      {titulo && !gerando && (
        <div className="mt-6 space-y-4">
          {categoriaDetectada && (
            <p className="text-xs font-semibold uppercase tracking-wide text-[#E29F65]">
              Editoria identificada: {categoriaDetectada}
            </p>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Revise as informações:</strong> corrija nomes, datas, números, cargos e locais. O texto já segue o
            padrão editorial do portal — evite mudar o estilo, incluir opinião, adjetivos promocionais ou chamadas publicitárias.
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Título</span>
            <input value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Subtítulo</span>
            <input value={subtitulo} maxLength={220} onChange={(e) => setSubtitulo(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Texto</span>
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={14} className="w-full rounded border px-3 py-2 leading-relaxed" />
          </label>


          {blocoFotos}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="max-h-32 overflow-y-auto whitespace-pre-line text-xs text-slate-600">{TERMO_RESPONSABILIDADE}</p>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)} className="mt-1" />
              <span>Li e aceito os termos de responsabilidade acima.</span>
            </label>
          </div>

          {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
          <button
            onClick={publicar}
            disabled={!termoAceito || publicando || uploadBusy || !titulo.trim() || !corpo.trim()}
            className="w-full rounded bg-[#E29F65] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {publicando ? "Publicando…" : "Publicar"}
          </button>
        </div>
      )}
    </div>
  );
}
