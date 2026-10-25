import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ImagePlus, Link2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { headersEquipe } from "@/lib/invoke-equipe";
import { AGENTE_PADRAO, separarPautas } from "@/lib/coluna-politica";
import {
  PageHeader,
  Section,
  Tabs,
  SaveBar,
  StatusPill,
  ConfirmButton,
  EmptyState,
  Aviso,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

export const Route = createFileRoute("/admin/colunas")({
  component: AdminColunas,
});

const BUCKET = "coluna-imagens";
const COLUNA_SLUG = "vozes-politicas";

type Nota = {
  id?: string;
  ordem: number;
  titulo_gatilho: string;
  corpo: string;
  imagem_url: string | null;
  _uploading?: boolean;
  _fontes?: Array<{ url: string; titulo: string; erro: string | null }>;
  _fechamento?: boolean;
};

type Edicao = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  imagem_principal_url: string | null;
  pergunta_engajamento: string | null;
  status: "rascunho" | "publicado";
  publicado_em: string | null;
};

type RespostaEscrita = {
  ok?: boolean;
  error?: string;
  detail?: string;
  coluna?: {
    titulo: string;
    subtitulo: string;
    pergunta_engajamento: string | null;
    notas: Array<{ titulo_gatilho: string; corpo: string; pauta: number | null; fechamento: boolean }>;
  };
  pautas?: Array<{ ordem: number; texto: string; fontes: Array<{ url: string; titulo: string; erro: string | null }> }>;
};

/**
 * Motivo legível de um erro de supabase.functions.invoke. Em erro HTTP o
 * `context` costuma ser a Response (com o JSON da função), mas nem sempre —
 * por isso tudo é checado antes de usar.
 */
async function motivoDoErro(error: unknown): Promise<string> {
  const e = error as { message?: string; context?: unknown };
  const ctx = e?.context as { status?: number; json?: () => Promise<unknown>; text?: () => Promise<string> } | undefined;
  const status = typeof ctx?.status === "number" ? ctx.status : null;
  let corpo: { error?: string; detail?: string; code?: string; message?: string } | null = null;
  try {
    if (ctx && typeof ctx.text === "function") {
      const t = await ctx.text();
      try { corpo = JSON.parse(t); } catch { corpo = { message: t.slice(0, 200) }; }
    } else if (ctx && typeof ctx.json === "function") {
      corpo = (await ctx.json()) as typeof corpo;
    }
  } catch { /* corpo já lido ou indisponível */ }
  if (status === 404 || corpo?.code === "NOT_FOUND") {
    return "a função coluna-escrever ainda não foi publicada no servidor (a Lovable precisa publicar as funções novas). Tente de novo depois da publicação.";
  }
  if (!status && /failed to send|failed to fetch|network/i.test(e?.message ?? "")) {
    return "não foi possível falar com a função coluna-escrever — ela pode ainda não ter sido publicada pela Lovable, ou a conexão caiu.";
  }
  if (status === 401 || status === 403) return "sua sessão do painel expirou ou não tem permissão. Entre de novo no painel.";
  return corpo?.detail || corpo?.error || corpo?.message || e?.message || "falha desconhecida";
}

/** A coluna nova (085) ainda não existe no banco? */
function faltaColuna(e: { code?: string; message?: string } | null | undefined): boolean {
  // Leitura: 42703 "column ... does not exist". Gravação: PGRST204
  // "Could not find the 'pautas' column of 'coluna_edicoes' in the schema cache".
  return !!e && (
    e.code === "42703" || e.code === "PGRST204" ||
    /column .* does not exist|could not find the '.*' column/i.test(e.message ?? "")
  );
}

function AdminColunas() {
  const [aba, setAba] = useState<"edicao" | "comentarios" | "identidade">("edicao");
  const [colunaId, setColunaId] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<Edicao[]>([]);
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);

  // Pautas → prévia
  const [pautas, setPautas] = useState("");
  const [escrevendo, setEscrevendo] = useState(false);

  // Edição em revisão na tela
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [imagemPrincipal, setImagemPrincipal] = useState<string | null>(null);
  const [perguntaEngajamento, setPerguntaEngajamento] = useState("");
  const [notas, setNotas] = useState<Nota[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadPrincipalBusy, setUploadPrincipalBusy] = useState(false);
  const [fotoColunista, setFotoColunista] = useState<string | null>(null);
  const [uploadAvatarBusy, setUploadAvatarBusy] = useState(false);
  const [comentarios, setComentarios] = useState<Array<{ id: string; nome: string; comentario: string; criado_em: string; aprovado: boolean }>>([]);

  // Agente da coluna (aba Identidade)
  const [agente, setAgente] = useState("");
  const [agenteDisponivel, setAgenteDisponivel] = useState(true);
  const [agenteMsg, setAgenteMsg] = useState<string | null>(null);

  const pautasSeparadas = useMemo(() => separarPautas(pautas), [pautas]);
  const temPrevia = notas.length > 0;

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const sb = await getExternalBrowser();
      let r = await sb.from("colunas").select("id, foto_colunista_url, agente_instrucoes").eq("slug", COLUNA_SLUG).maybeSingle();
      if (faltaColuna(r.error)) {
        setAgenteDisponivel(false);
        r = (await sb.from("colunas").select("id, foto_colunista_url").eq("slug", COLUNA_SLUG).maybeSingle()) as typeof r;
      }
      const coluna = r.data as { id: string; foto_colunista_url: string | null; agente_instrucoes?: string | null } | null;
      if (!coluna) { setCarregando(false); return; }
      setColunaId(coluna.id);
      setFotoColunista(coluna.foto_colunista_url ?? null);
      setAgente(coluna.agente_instrucoes?.trim() || AGENTE_PADRAO);
      const { data: eds } = await sb
        .from("coluna_edicoes")
        .select("id, titulo, subtitulo, imagem_principal_url, pergunta_engajamento, status, publicado_em")
        .eq("coluna_id", coluna.id)
        .order("criado_em", { ascending: false });
      setEdicoes((eds ?? []) as Edicao[]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function abrirEdicao(id: string) {
    const sb = await getExternalBrowser();
    let r = await sb.from("coluna_edicoes").select("id, titulo, subtitulo, imagem_principal_url, pergunta_engajamento, pautas").eq("id", id).maybeSingle();
    if (faltaColuna(r.error)) {
      r = (await sb.from("coluna_edicoes").select("id, titulo, subtitulo, imagem_principal_url, pergunta_engajamento").eq("id", id).maybeSingle()) as typeof r;
    }
    const ed = r.data as (Edicao & { pautas?: string | null }) | null;
    if (!ed) return;
    const { data: ns } = await sb
      .from("coluna_notas")
      .select("id, ordem, titulo_gatilho, corpo, imagem_url")
      .eq("edicao_id", id)
      .order("ordem", { ascending: true });
    setEdicaoAtivaId(id);
    setTitulo(ed.titulo);
    setSubtitulo(ed.subtitulo ?? "");
    setImagemPrincipal(ed.imagem_principal_url);
    setPerguntaEngajamento(ed.pergunta_engajamento ?? "");
    setNotas((ns ?? []) as Nota[]);
    setPautas(ed.pautas ?? "");
    setMsg(null);
    setAba("edicao");
    await carregarComentarios(id);
  }

  async function carregarComentarios(edicaoId: string) {
    const sb = await getExternalBrowser();
    const { data } = await sb
      .from("coluna_comentarios")
      .select("id, nome, comentario, criado_em, aprovado")
      .eq("edicao_id", edicaoId)
      .order("criado_em", { ascending: false });
    setComentarios((data ?? []) as typeof comentarios);
  }

  async function moderarComentario(id: string, acao: "ocultar" | "mostrar" | "excluir") {
    const sb = await getExternalBrowser();
    if (acao === "excluir") {
      await sb.from("coluna_comentarios").delete().eq("id", id);
    } else {
      await sb.from("coluna_comentarios").update({ aprovado: acao === "mostrar" }).eq("id", id);
    }
    if (edicaoAtivaId) await carregarComentarios(edicaoAtivaId);
  }

  async function onUploadAvatar(file: File) {
    if (!colunaId) { setMsg("Coluna não encontrada."); return; }
    setUploadAvatarBusy(true);
    const url = await uploadImagem(file);
    if (url) {
      const sb = await getExternalBrowser();
      const { error } = await sb.from("colunas").update({ foto_colunista_url: url }).eq("id", colunaId);
      if (error) setMsg("Erro ao salvar a foto: " + error.message);
      else { setFotoColunista(url); setMsg("Foto da coluna atualizada."); }
    }
    setUploadAvatarBusy(false);
  }

  async function removerAvatar() {
    if (!colunaId) return;
    const sb = await getExternalBrowser();
    await sb.from("colunas").update({ foto_colunista_url: null }).eq("id", colunaId);
    setFotoColunista(null);
  }

  async function salvarAgente(texto: string | null) {
    if (!colunaId) return;
    setAgenteMsg(null);
    const sb = await getExternalBrowser();
    const valor = texto && texto.trim() !== AGENTE_PADRAO.trim() ? texto.trim() : null;
    const { error } = await sb.from("colunas").update({ agente_instrucoes: valor }).eq("id", colunaId);
    if (error) { setAgenteMsg("Erro ao salvar o agente: " + error.message); return; }
    if (!valor) setAgente(AGENTE_PADRAO);
    setAgenteMsg(valor ? "Agente salvo. As próximas edições já usam estas instruções." : "Agente de volta ao padrão.");
  }

  function novaEdicaoEmBranco() {
    setEdicaoAtivaId(null);
    setComentarios([]);
    setTitulo("");
    setSubtitulo("");
    setImagemPrincipal(null);
    setPerguntaEngajamento("");
    setNotas([]);
    setPautas("");
    setMsg(null);
    setAba("edicao");
  }

  async function escreverColuna() {
    if (!pautasSeparadas.length) { setMsg("Erro: cole ao menos uma pauta (link ou texto)."); return; }
    setEscrevendo(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("coluna-escrever", {
        headers: await headersEquipe(),
        body: { pautas, coluna_slug: COLUNA_SLUG },
      });
      let resp = data as RespostaEscrita | null;
      if (error) throw new Error(await motivoDoErro(error));
      if (!resp?.coluna) throw new Error(resp?.detail || "A IA não devolveu a coluna.");
      const c = resp.coluna;
      const fontesDaPauta = (n: number | null) => resp?.pautas?.find((p) => p.ordem === n)?.fontes ?? [];
      // Reescrever não perde as fotos já escolhidas: ficam na mesma posição.
      setNotas((antigas) =>
        c.notas.map((n, i) => ({
          ordem: i + 1,
          titulo_gatilho: n.titulo_gatilho,
          corpo: n.corpo,
          imagem_url: antigas[i]?.imagem_url ?? null,
          _fontes: fontesDaPauta(n.pauta),
          _fechamento: n.fechamento,
        })),
      );
      setTitulo(c.titulo);
      setSubtitulo(c.subtitulo);
      setPerguntaEngajamento(c.pergunta_engajamento ?? "");
      const falhas = (resp.pautas ?? []).flatMap((p) => p.fontes.filter((f) => f.erro)).length;
      setMsg(
        falhas
          ? `Coluna escrita. ${falhas} link(s) não abriram — essas notas usaram só o texto da pauta; confira antes de publicar.`
          : "Coluna escrita. Revise a prévia, ponha as fotos que quiser e salve.",
      );
    } catch (e) {
      setMsg("Erro ao escrever a coluna: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setEscrevendo(false);
    }
  }

  async function uploadImagem(file: File): Promise<string | null> {
    const sb = await getExternalBrowser();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
    if (error) { setMsg("Erro ao enviar imagem: " + error.message); return null; }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function onUploadPrincipal(file: File) {
    setUploadPrincipalBusy(true);
    const url = await uploadImagem(file);
    if (url) setImagemPrincipal(url);
    setUploadPrincipalBusy(false);
  }

  async function onUploadNota(idx: number, file: File) {
    setNotas((ns) => ns.map((n, i) => (i === idx ? { ...n, _uploading: true } : n)));
    const url = await uploadImagem(file);
    setNotas((ns) => ns.map((n, i) => (i === idx ? { ...n, imagem_url: url ?? n.imagem_url, _uploading: false } : n)));
  }

  function alterarNota(idx: number, campo: "titulo_gatilho" | "corpo", valor: string) {
    setNotas((ns) => ns.map((n, i) => (i === idx ? { ...n, [campo]: valor } : n)));
  }

  function removeNota(idx: number) {
    setNotas((ns) => ns.filter((_, i) => i !== idx).map((n, i) => ({ ...n, ordem: i + 1 })));
  }

  function moverNota(idx: number, dir: -1 | 1) {
    setNotas((ns) => {
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= ns.length) return ns;
      const copia = [...ns];
      [copia[idx], copia[alvo]] = [copia[alvo], copia[idx]];
      return copia.map((n, i) => ({ ...n, ordem: i + 1 }));
    });
  }

  async function salvar(publicar: boolean) {
    if (!colunaId) { setMsg("Coluna não encontrada — rode a migration 051 antes."); return; }
    if (!titulo.trim()) { setMsg("Preencha o título da edição."); return; }
    if (!notas.length || notas.some((n) => !n.titulo_gatilho.trim() || !n.corpo.trim())) {
      setMsg("Toda nota precisa de título e texto preenchidos.");
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const base = {
        coluna_id: colunaId,
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim() || null,
        imagem_principal_url: imagemPrincipal,
        pergunta_engajamento: perguntaEngajamento.trim() || null,
        atualizado_em: new Date().toISOString(),
        ...(publicar ? { status: "publicado", publicado_em: new Date().toISOString() } : {}),
      };
      const comPautas = { ...base, pautas: pautas.trim() || null };

      let edId = edicaoAtivaId;
      if (edId) {
        let { error } = await sb.from("coluna_edicoes").update(comPautas).eq("id", edId);
        if (faltaColuna(error)) ({ error } = await sb.from("coluna_edicoes").update(base).eq("id", edId));
        if (error) throw error;
      } else {
        let r = await sb.from("coluna_edicoes").insert(comPautas).select("id").single();
        if (faltaColuna(r.error)) r = await sb.from("coluna_edicoes").insert(base).select("id").single();
        if (r.error) throw r.error;
        edId = r.data.id;
      }

      // Substitui as notas inteiras (mais simples que diff incremental)
      await sb.from("coluna_notas").delete().eq("edicao_id", edId);
      const { error: notasErr } = await sb.from("coluna_notas").insert(
        notas.map((n, i) => ({
          edicao_id: edId,
          ordem: i + 1,
          titulo_gatilho: n.titulo_gatilho.trim(),
          corpo: n.corpo.trim(),
          imagem_url: n.imagem_url,
        })),
      );
      if (notasErr) throw notasErr;

      setMsg(publicar ? "Publicado! Já está valendo como a edição atual na home." : "Rascunho salvo.");
      setEdicaoAtivaId(edId);
      await load();
    } catch (e: unknown) {
      setMsg("Erro ao salvar: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <p className="p-6 text-sm text-slate-500">Carregando…</p>;

  const msgErro = !!msg && /^(Erro|Preencha|Toda nota|Coluna não)/.test(msg);
  const edicaoAtiva = edicoes.find((e) => e.id === edicaoAtivaId) ?? null;
  const totalLinks = pautasSeparadas.reduce((n, p) => n + p.urls.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colunas"
        title="Vozes Políticas"
        subtitle="Cole as pautas na ordem das notas e a IA escreve a edição com o agente da coluna. Você revisa a prévia, põe as fotos que quiser e publica. A edição publicada mais recente aparece na home; as demais ficam no arquivo."
        actions={<button type="button" onClick={novaEdicaoEmBranco} className={btn("primary")}>Nova edição</button>}
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de edições */}
        <Section title="Edições" subtitle="Vozes Políticas" padded={false} className="self-start">
          <div className="space-y-2 p-3">
            {edicoes.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => abrirEdicao(e.id)}
                className={`block w-full rounded-lg border p-2.5 text-left text-xs transition ${edicaoAtivaId === e.id ? "border-[#E29F65] bg-[#E29F65]/10" : "border-slate-200 bg-white hover:border-[#12201E]"}`}
              >
                <StatusPill status={e.status} label={e.status === "publicado" ? "Publicada" : "Rascunho"} />
                <p className="mt-1 line-clamp-2 font-medium text-slate-700">{e.titulo}</p>
              </button>
            ))}
            {edicoes.length === 0 && <p className="p-2 text-xs text-slate-500">Nenhuma edição ainda.</p>}
          </div>
        </Section>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {edicaoAtiva ? <>Editando: <strong className="text-[#12201E]">{edicaoAtiva.titulo}</strong></> : "Nova edição (ainda não salva)"}
            </p>
            <Tabs
              value={aba}
              onChange={setAba}
              items={[
                { value: "edicao", label: "Edição" },
                { value: "comentarios", label: "Comentários", count: edicaoAtivaId ? comentarios.length : undefined },
                { value: "identidade", label: "Identidade" },
              ]}
            />
          </div>

          {aba === "edicao" && (
            <>
              {/* 1. Caixa única de pautas */}
              <Section
                title="Pautas da edição"
                subtitle="Um link ou um texto por pauta, na ordem em que as notas devem sair. Separe as pautas com uma linha em branco (ou uma por linha). Pode escrever o ângulo junto do link."
              >
                <div className="space-y-3">
                  <textarea
                    value={pautas}
                    onChange={(e) => setPautas(e.target.value)}
                    rows={8}
                    placeholder={"https://… notícia sobre a denúncia do helicóptero — tom: investigação ainda em curso\n\nTRE-PR mandou retirar publicações contra Moro: https://…\n\nFechamento amarrando as candidaturas ao Senado"}
                    className={`${campoClass} w-full font-mono text-[13px]`}
                  />
                  {pautasSeparadas.length > 0 && (
                    <ol className="space-y-1 text-xs text-slate-600">
                      {pautasSeparadas.map((p) => (
                        <li key={p.ordem} className="flex gap-2">
                          <span className="w-5 shrink-0 text-right font-bold text-[#12201E]">{p.ordem}.</span>
                          <span className="min-w-0 truncate">
                            {p.urls.length > 0 && <Link2 className="mr-1 inline h-3 w-3 text-[#B5651D]" aria-hidden />}
                            {p.texto}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {temPrevia ? (
                      <ConfirmButton
                        variante="secondary"
                        tamanho="md"
                        disabled={escrevendo || !pautasSeparadas.length}
                        confirmLabel="Reescrever (substitui o texto da prévia)"
                        onConfirm={escreverColuna}
                      >
                        <Sparkles className="h-4 w-4" aria-hidden />
                        {escrevendo ? "Escrevendo…" : "Reescrever a partir das pautas"}
                      </ConfirmButton>
                    ) : (
                      <button type="button" onClick={escreverColuna} disabled={escrevendo || !pautasSeparadas.length} className={btn("primary")}>
                        <Sparkles className="h-4 w-4" aria-hidden />
                        {escrevendo ? "Escrevendo a coluna…" : "Escrever coluna"}
                      </button>
                    )}
                    <span className="text-xs text-slate-500">
                      {escrevendo
                        ? `Lendo ${totalLinks} link(s) e escrevendo ${pautasSeparadas.length} nota(s) — leva de 30 s a 1 min.`
                        : pautasSeparadas.length
                          ? `${pautasSeparadas.length} pauta(s) → ${pautasSeparadas.length} nota(s), nesta ordem${totalLinks ? ` · ${totalLinks} link(s)` : ""}.`
                          : "Cole as pautas para começar."}
                    </span>
                  </div>
                </div>
              </Section>

              {msg && !temPrevia && <Aviso tipo={msgErro ? "erro" : "ok"}>{msg}</Aviso>}

              {/* 2. Prévia estruturada */}
              {temPrevia && (
                <>
                  <Section title="Prévia da coluna" subtitle="Tudo é editável. Fotos são opcionais — a nota sem foto sai só com texto.">
                    <div className="space-y-5">
                      <div className="space-y-3 border-b border-slate-100 pb-5">
                        <input
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                          aria-label="Título da edição"
                          className="w-full rounded-lg border border-transparent px-2 py-1 font-['Newsreader',serif] text-3xl font-semibold leading-tight text-[#12201E] hover:border-slate-200 focus:border-[#E29F65] focus:outline-none"
                        />
                        <textarea
                          value={subtitulo}
                          onChange={(e) => setSubtitulo(e.target.value)}
                          rows={2}
                          aria-label="Linha fina"
                          className="w-full rounded-lg border border-transparent px-2 py-1 text-base text-slate-600 hover:border-slate-200 focus:border-[#E29F65] focus:outline-none"
                        />
                        <FotoOpcional
                          url={imagemPrincipal}
                          ocupado={uploadPrincipalBusy}
                          rotulo="Imagem principal da edição"
                          onArquivo={onUploadPrincipal}
                          onRemover={() => setImagemPrincipal(null)}
                          grande
                        />
                      </div>

                      {notas.map((n, i) => (
                        <article key={i} className="rounded-xl border border-slate-200 p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#B5651D]">
                              {n._fechamento ? "Fechamento" : `Nota ${i + 1}`}
                            </span>
                            <div className="flex gap-1">
                              <button type="button" onClick={() => moverNota(i, -1)} disabled={i === 0} className={btn("ghost", "sm")} title="Subir nota" aria-label="Subir nota">
                                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <button type="button" onClick={() => moverNota(i, 1)} disabled={i === notas.length - 1} className={btn("ghost", "sm")} title="Descer nota" aria-label="Descer nota">
                                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              <ConfirmButton onConfirm={() => removeNota(i)} confirmLabel="Remover nota" title="Remover nota">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              </ConfirmButton>
                            </div>
                          </div>
                          <input
                            value={n.titulo_gatilho}
                            onChange={(e) => alterarNota(i, "titulo_gatilho", e.target.value)}
                            aria-label={`Título da nota ${i + 1}`}
                            className="mb-2 w-full rounded-lg border border-transparent px-2 py-1 font-['Newsreader',serif] text-xl font-semibold text-[#12201E] hover:border-slate-200 focus:border-[#E29F65] focus:outline-none"
                          />
                          <textarea
                            value={n.corpo}
                            onChange={(e) => alterarNota(i, "corpo", e.target.value)}
                            rows={Math.min(14, Math.max(4, n.corpo.split("\n").length + 1))}
                            aria-label={`Texto da nota ${i + 1}`}
                            className="mb-3 w-full rounded-lg border border-transparent px-2 py-1 text-[15px] leading-relaxed text-slate-700 hover:border-slate-200 focus:border-[#E29F65] focus:outline-none"
                          />
                          {!!n._fontes?.length && (
                            <div className="mb-3 flex flex-wrap gap-2 px-2">
                              {n._fontes.map((f) =>
                                f.erro ? (
                                  <span key={f.url} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800" title={f.url}>
                                    <AlertTriangle className="h-3 w-3" aria-hidden /> Link não abriu ({f.erro}) — nota escrita só com a pauta
                                  </span>
                                ) : (
                                  <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:text-[#12201E]">
                                    <Link2 className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{f.titulo || f.url}</span>
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                          <div className="px-2">
                            <FotoOpcional
                              url={n.imagem_url}
                              ocupado={!!n._uploading}
                              rotulo="Foto da nota"
                              onArquivo={(f) => onUploadNota(i, f)}
                              onRemover={() => setNotas((ns) => ns.map((x, j) => (j === i ? { ...x, imagem_url: null } : x)))}
                            />
                          </div>
                        </article>
                      ))}

                      <label className={rotuloClass}>
                        Pergunta ao leitor (opcional)
                        <input value={perguntaEngajamento} onChange={(e) => setPerguntaEngajamento(e.target.value)} className={campoClass} />
                      </label>
                    </div>
                  </Section>

                  <SaveBar aviso={msg ? <Aviso tipo={msgErro ? "erro" : "ok"}>{msg}</Aviso> : undefined}>
                    <button type="button" onClick={() => salvar(false)} disabled={salvando || escrevendo} className={btn("secondary")}>
                      {salvando ? "Salvando…" : "Salvar rascunho"}
                    </button>
                    <ConfirmButton
                      variante="primary"
                      tamanho="md"
                      disabled={salvando || escrevendo}
                      confirmLabel="Publicar na home"
                      onConfirm={() => salvar(true)}
                    >
                      {salvando ? "Publicando…" : "Publicar (vira a edição atual da home)"}
                    </ConfirmButton>
                  </SaveBar>
                </>
              )}
            </>
          )}

          {aba === "comentarios" && (
            <Section title={`Comentários dos leitores${edicaoAtivaId ? ` (${comentarios.length})` : ""}`}>
              {!edicaoAtivaId ? (
                <EmptyState title="Abra uma edição salva">Os comentários aparecem depois que a edição existe. Escolha uma na lista ao lado.</EmptyState>
              ) : comentarios.length === 0 ? (
                <EmptyState title="Nenhum comentário nesta edição." />
              ) : (
                <div className="space-y-2">
                  {comentarios.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                          {c.nome} · {new Date(c.criado_em).toLocaleString("pt-BR")}
                          {!c.aprovado && <StatusPill status="oculto" label="Oculto" />}
                        </span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => moderarComentario(c.id, c.aprovado ? "ocultar" : "mostrar")} className={btn("secondary", "sm")}>
                            {c.aprovado ? "Ocultar" : "Mostrar"}
                          </button>
                          <ConfirmButton onConfirm={() => moderarComentario(c.id, "excluir")} confirmLabel="Excluir de vez">
                            Excluir
                          </ConfirmButton>
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-slate-600">{c.comentario}</p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {aba === "identidade" && (
            <>
              <Section title="Foto da coluna" subtitle="Aparece no módulo de colunas da home, na lateral e no topo da coluna aberta.">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-200">
                    {fotoColunista && <img src={fotoColunista} alt="Foto da coluna Vozes Políticas" className="h-full w-full object-cover" />}
                  </span>
                  <div className="space-y-2 text-sm">
                    <input type="file" accept="image/*" disabled={uploadAvatarBusy}
                      onChange={(e) => e.target.files?.[0] && onUploadAvatar(e.target.files[0])} />
                    {uploadAvatarBusy && <p className="text-xs text-slate-500">Enviando foto…</p>}
                    {fotoColunista && (
                      <div>
                        <ConfirmButton onConfirm={removerAvatar} confirmLabel="Remover foto">Remover foto</ConfirmButton>
                      </div>
                    )}
                  </div>
                </div>
                {msg && aba === "identidade" && <div className="mt-4"><Aviso tipo={msgErro ? "erro" : "ok"}>{msg}</Aviso></div>}
              </Section>

              <Section
                title="Agente da coluna"
                subtitle="Voz, estrutura e cuidados que a IA segue ao escrever cada edição. As duas últimas edições publicadas entram como referência de estilo."
              >
                {!agenteDisponivel ? (
                  <Aviso tipo="erro">Para editar o agente, rode a migração 085 no banco Rede de Portais. Até lá, a coluna é escrita com o agente padrão.</Aviso>
                ) : (
                  <div className="space-y-3">
                    <textarea value={agente} onChange={(e) => setAgente(e.target.value)} rows={18} className={`${campoClass} w-full text-[13px] leading-relaxed`} />
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => salvarAgente(agente)} className={btn("primary")}>Salvar agente</button>
                      <ConfirmButton variante="secondary" tamanho="md" onConfirm={() => salvarAgente(null)} confirmLabel="Voltar ao padrão">
                        <RotateCcw className="h-4 w-4" aria-hidden /> Agente padrão
                      </ConfirmButton>
                    </div>
                    {agenteMsg && <Aviso tipo={/^Erro/.test(agenteMsg) ? "erro" : "ok"}>{agenteMsg}</Aviso>}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Upload opcional de foto: mostra a foto escolhida ou um botão para adicionar. */
function FotoOpcional({ url, ocupado, rotulo, onArquivo, onRemover, grande }: {
  url: string | null;
  ocupado: boolean;
  rotulo: string;
  onArquivo: (f: File) => void;
  onRemover: () => void;
  grande?: boolean;
}) {
  const id = useMemo(() => `foto-${Math.random().toString(36).slice(2)}`, []);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {url && <img src={url} alt="" className={`${grande ? "h-40 max-w-md" : "h-24 max-w-xs"} w-full rounded-lg object-cover`} />}
      <label htmlFor={id} className={`${btn("secondary", "sm")} cursor-pointer ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
        <ImagePlus className="h-3.5 w-3.5" aria-hidden />
        {ocupado ? "Enviando…" : url ? "Trocar foto" : `${rotulo} (opcional)`}
      </label>
      <input id={id} type="file" accept="image/*" className="sr-only" disabled={ocupado}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onArquivo(f); e.target.value = ""; }} />
      {url && !ocupado && (
        <button type="button" onClick={onRemover} className={btn("ghost", "sm")}>Remover foto</button>
      )}
    </div>
  );
}
