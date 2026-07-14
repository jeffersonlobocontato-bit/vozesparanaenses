import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ShareButtons } from "@/components/ShareButtons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/vitrine/$token")({
  head: () => ({
    meta: [
      { title: "Sua Vitrine Pessoal — Vozes Paranaenses" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VitrinePessoalEditor,
});

type Status = "gerando" | "aguardando_edicao" | "enviado_para_aprovacao" | "aprovado" | "pago" | "publicado" | "recusado";

type ArtigoRef = {
  id: string; slug: string; titulo: string; subtitulo: string | null; resumo: string | null; corpo: string;
  regiao: { slug: string } | { slug: string }[] | null;
};

type Pedido = {
  id: string; status: Status; nome_cliente: string; profissao: string; valor: number;
  motivo_recusa: string | null;
  imagens: Foto[] | null;
  generated_article: ArtigoRef | ArtigoRef[] | null;
};

type Foto = { url: string; name: string; path: string };

type Pix = { chave: string; titular: string } | null;

const EDITAVEL: Status[] = ["aguardando_edicao", "enviado_para_aprovacao"];

function VitrinePessoalEditor() {
  const { token } = Route.useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [pix, setPix] = useState<Pix>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState({ titulo: "", subtitulo: "", resumo: "", corpo: "" });
  const [salvando, setSalvando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [linkPublicado, setLinkPublicado] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-obter", { body: { token } });
      if (error) throw error;
      const p = (data as { pedido?: Pedido })?.pedido;
      if (!p) throw new Error("Link inválido ou pedido não encontrado.");
      setPedido(p);
      setPix((data as { pix?: Pix })?.pix ?? null);
      setFotos(Array.isArray(p.imagens) ? p.imagens : []);
      const art = Array.isArray(p.generated_article) ? p.generated_article[0] : p.generated_article;
      if (art) {
        setCampos({ titulo: art.titulo, subtitulo: art.subtitulo ?? "", resumo: art.resumo ?? "", corpo: art.corpo });
      }
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar seu pedido.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, [token]);

  async function salvar(finalizar: boolean) {
    setSalvando(true);
    setMsg(null);
    try {
      const { error } = await supabase.functions.invoke("vitrine-pessoal-salvar", { body: { token, ...campos, finalizar } });
      if (error) throw error;
      setMsg(finalizar ? "Enviado para aprovação! Avisamos você assim que revisarmos." : "Rascunho salvo.");
      carregar();
    } catch (e: unknown) {
      setMsg("Erro ao salvar: " + (e instanceof Error ? e.message : "tente novamente"));
    } finally {
      setSalvando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    try {
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-publicar", { body: { token } });
      if (error) throw error;
      setLinkPublicado((data as { link?: string })?.link ?? null);
    } catch (e: unknown) {
      setMsg("Erro ao publicar: " + (e instanceof Error ? e.message : "tente novamente"));
    } finally {
      setPublicando(false);
    }
  }

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }

  async function adicionarFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setEnviandoFoto(true);
    setMsg(null);
    try {
      const add = await Promise.all(Array.from(files).slice(0, 6).map(async (f) => ({
        name: f.name, contentType: f.type || "image/jpeg", base64: await fileToBase64(f),
      })));
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-upload", { body: { token, add } });
      if (error) throw error;
      const list = (data as { imagens?: Foto[] })?.imagens ?? [];
      setFotos(list);
    } catch (e: unknown) {
      setMsg("Erro ao enviar foto: " + (e instanceof Error ? e.message : "tente novamente"));
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function removerFoto(path: string) {
    setEnviandoFoto(true);
    try {
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-upload", { body: { token, remove: [path] } });
      if (error) throw error;
      setFotos((data as { imagens?: Foto[] })?.imagens ?? []);
    } catch (e: unknown) {
      setMsg("Erro ao remover foto: " + (e instanceof Error ? e.message : "tente novamente"));
    } finally {
      setEnviandoFoto(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500">Carregando seu pedido…</main>
        <SiteFooter />
      </div>
    );
  }

  if (erro || !pedido) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro ?? "Pedido não encontrado."}</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (pedido.status === "publicado" || linkPublicado) {
    const art = Array.isArray(pedido.generated_article) ? pedido.generated_article[0] : pedido.generated_article;
    const regiaoSlug = art ? (Array.isArray(art.regiao) ? art.regiao[0]?.slug : art.regiao?.slug) : null;
    const link = linkPublicado ?? (art && regiaoSlug ? `https://vozesparanaenses.com.br/${regiaoSlug}/${art.slug}` : null);
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
            <p className="text-4xl">🎉</p>
            <h1 className="font-display mt-3 text-2xl font-black text-emerald-900">Parabéns, sua matéria está no ar!</h1>
            <p className="mt-2 text-sm text-emerald-800">
              Compartilhe o link com seus clientes, sua rede e seus grupos — é a sua credibilidade circulando.
            </p>
            {link && (
              <>
                <div className="mt-4 rounded-lg border border-emerald-300 bg-white p-3 text-xs text-slate-700 break-all">{link}</div>
                <div className="mt-4 flex justify-center">
                  <ShareButtons url={link} title={art?.titulo ?? "Minha matéria no Vozes Paranaenses"} />
                </div>
              </>
            )}
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const editavel = EDITAVEL.includes(pedido.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-black text-[#0A2540]">Sua Vitrine Pessoal</h1>
          <StatusBadge status={pedido.status} />
        </div>

        {pedido.status === "recusado" && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Precisamos ajustar alguma coisa antes de seguir:</p>
            <p className="mt-1">{pedido.motivo_recusa ?? "Entraremos em contato com mais detalhes."}</p>
          </div>
        )}

        {pedido.status === "aprovado" && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="font-semibold">Texto aprovado! Falta só o pagamento pra publicar.</p>
            <p className="mt-1">Valor: <strong>R$ {pedido.valor.toFixed(2).replace(".", ",")}</strong></p>
            {pix && (
              <>
                <p className="mt-2">Pague via Pix pra chave:</p>
                <p className="mt-1 rounded bg-white px-2 py-1 font-mono text-xs break-all">{pix.chave}</p>
                <p className="mt-1 text-xs">Titular: {pix.titular}</p>
              </>
            )}
            <p className="mt-2 text-xs">
              Depois de pagar, envie o comprovante pro nosso contato comercial informando este link. Assim
              que confirmarmos, o botão de publicar libera automaticamente aqui nesta mesma página.
            </p>
          </div>
        )}

        {pedido.status === "pago" && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Pagamento confirmado! Pode publicar quando quiser.</p>
            <button onClick={publicar} disabled={publicando}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
              {publicando ? "Publicando…" : "Publicar minha matéria"}
            </button>
          </div>
        )}

        {pedido.status === "enviado_para_aprovacao" && (
          <p className="mb-4 rounded border bg-muted p-3 text-xs text-muted-foreground">
            Enviado para aprovação — você ainda pode ajustar o texto enquanto revisamos.
          </p>
        )}

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Título</span>
            <input disabled={!editavel} value={campos.titulo} onChange={(e) => setCampos({ ...campos, titulo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Subtítulo</span>
            <input disabled={!editavel} value={campos.subtitulo} onChange={(e) => setCampos({ ...campos, subtitulo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Resumo</span>
            <textarea disabled={!editavel} rows={2} value={campos.resumo} onChange={(e) => setCampos({ ...campos, resumo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Texto completo</span>
            <textarea disabled={!editavel} rows={14} value={campos.corpo} onChange={(e) => setCampos({ ...campos, corpo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100" />
          </label>

          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

          {editavel && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => salvar(false)} disabled={salvando}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
                {salvando ? "Salvando…" : "Salvar rascunho"}
              </button>
              <button onClick={() => salvar(true)} disabled={salvando}
                className="flex-1 rounded-lg bg-[#0066CC] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {salvando ? "Enviando…" : "Enviar versão final para aprovação"}
              </button>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; cls: string }> = {
    gerando: { label: "Gerando…", cls: "bg-slate-100 text-slate-600" },
    aguardando_edicao: { label: "Editável", cls: "bg-blue-100 text-blue-800" },
    enviado_para_aprovacao: { label: "Em aprovação", cls: "bg-amber-100 text-amber-800" },
    aprovado: { label: "Aprovado — aguardando pagamento", cls: "bg-blue-100 text-blue-800" },
    pago: { label: "Pago — pronto pra publicar", cls: "bg-emerald-100 text-emerald-800" },
    publicado: { label: "Publicado", cls: "bg-emerald-100 text-emerald-800" },
    recusado: { label: "Precisa de ajuste", cls: "bg-red-100 text-red-800" },
  };
  const m = map[status];
  return <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${m.cls}`}>{m.label}</span>;
}
