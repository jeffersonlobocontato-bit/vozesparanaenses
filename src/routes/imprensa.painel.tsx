import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { invokeImprensa } from "@/lib/imprensa-invoke";
import { Logo } from "@/components/Logo";

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

function ImprensaPainel() {
  const nav = useNavigate();
  const [checando, setChecando] = useState(true);
  const [nomeEmpresa, setNomeEmpresa] = useState("");

  const [textoBruto, setTextoBruto] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [submissaoId, setSubmissaoId] = useState<string | null>(null);
  const [categoriaDetectada, setCategoriaDetectada] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [regioes, setRegioes] = useState<Array<{ id: string; nome: string }>>([]);
  const [regiaoId, setRegiaoId] = useState("");

  const [termoAceito, setTermoAceito] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado] = useState<string | null>(null);

  // Confirma sessão + acesso de cliente antes de mostrar qualquer coisa.
  useEffect(() => {
    (async () => {
      const sb = await getExternalBrowser();
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) { nav({ to: "/imprensa/entrar", replace: true }); return; }
      const { data: cliente } = await sb
        .from("clientes_imprensa")
        .select("nome_empresa, ativo")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      if (!cliente || !cliente.ativo) {
        await sb.auth.signOut();
        nav({ to: "/imprensa/entrar", replace: true });
        return;
      }
      setNomeEmpresa(cliente.nome_empresa);
      const { data: rs } = await sb.from("regioes").select("id, nome").order("nome");
      setRegioes((rs ?? []) as Array<{ id: string; nome: string }>);
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
      const detail = (e as { context?: { body?: { detail?: string; error?: string } } })?.context?.body;
      setErro(detail?.detail ?? detail?.error ?? (e instanceof Error ? e.message : "Erro ao gerar rascunho."));
    } finally {
      setGerando(false);
    }
  }

  async function onUploadFoto(file: File) {
    setUploadBusy(true);
    try {
      const sb = await getExternalBrowser();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("imprensa-imagens").upload(path, file);
      if (error) throw error;
      const { data } = sb.storage.from("imprensa-imagens").getPublicUrl(path);
      setFotos((f) => [...f, { url: data.publicUrl }]);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar foto.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function publicar() {
    if (!submissaoId) return;
    if (!termoAceito) { setErro("Aceite o termo de responsabilidade antes de publicar."); return; }
    if (!regiaoId) { setErro("Selecione a região da matéria antes de publicar."); return; }
    setPublicando(true);
    setErro(null);
    try {
      const res = await invokeImprensa<{ detail: string }>("imprensa-publicar", {
        submissao_id: submissaoId, titulo, subtitulo, corpo, fotos, termo_aceito: true, regiao_id: regiaoId,
      });
      setPublicado(res.detail);
    } catch (e: unknown) {
      const detail = (e as { context?: { body?: { detail?: string; error?: string } } })?.context?.body;
      setErro(detail?.detail ?? detail?.error ?? (e instanceof Error ? e.message : "Erro ao publicar."));
    } finally {
      setPublicando(false);
    }
  }

  if (checando) return <p className="p-8 text-center text-sm text-muted-foreground">Carregando…</p>;

  if (publicado) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Logo size="sm" variant="blue" />
        <h1 className="mt-6 font-display text-2xl font-bold text-[#0A2540]">Enviado!</h1>
        <p className="mt-2 text-slate-600">{publicado}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Logo size="sm" variant="blue" />
        <span className="text-sm text-muted-foreground">{nomeEmpresa}</span>
      </div>

      <h1 className="font-display text-2xl font-bold text-[#0A2540]">Portal da Imprensa</h1>
      <p className="mt-1 text-sm text-slate-600">
        Cole seu release, ou escreva o que quer divulgar com o máximo de detalhe — a IA identifica a editoria e
        escreve o rascunho seguindo o padrão editorial do portal.
      </p>

      {erro && <p className="mt-4 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

      {!titulo && (
        <div className="mt-6 space-y-3">
          <textarea
            value={textoBruto}
            onChange={(e) => setTextoBruto(e.target.value)}
            rows={10}
            placeholder="Cole aqui o release, ou responda: do que se trata, quem é a fonte, qual o fato principal, tem algum dado ou citação importante?"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={gerarRascunho}
            disabled={gerando}
            className="rounded bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {gerando ? "Gerando rascunho…" : "Gerar rascunho"}
          </button>
        </div>
      )}

      {titulo && (
        <div className="mt-6 space-y-4">
          {categoriaDetectada && (
            <p className="text-xs font-semibold uppercase tracking-wide text-[#0066CC]">
              Editoria identificada: {categoriaDetectada}
            </p>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Subtítulo</span>
            <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Texto (revise à vontade antes de publicar)</span>
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={12} className="w-full rounded border px-3 py-2" />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Região da matéria</span>
            <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Selecione a região mais relevante para este conteúdo</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </label>

          <div className="text-sm">
            <span className="mb-1 block font-medium">Fotos</span>
            <div className="mb-2 flex flex-wrap gap-2">
              {fotos.map((f, i) => (
                <img key={i} src={f.url} alt="" className="h-20 w-20 rounded object-cover" />
              ))}
            </div>
            <input type="file" accept="image/*" disabled={uploadBusy}
              onChange={(e) => e.target.files?.[0] && onUploadFoto(e.target.files[0])} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="max-h-32 overflow-y-auto whitespace-pre-line text-xs text-slate-600">{TERMO_RESPONSABILIDADE}</p>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)} className="mt-1" />
              <span>Li e aceito os termos de responsabilidade acima.</span>
            </label>
          </div>

          <button
            onClick={publicar}
            disabled={!termoAceito || !regiaoId || publicando}
            className="w-full rounded bg-[#0066CC] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {publicando ? "Enviando…" : "Publicar"}
          </button>
        </div>
      )}
    </div>
  );
}
