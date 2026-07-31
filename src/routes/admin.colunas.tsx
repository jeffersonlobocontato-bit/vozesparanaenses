import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader } from "@/components/admin/ui";

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

function novaNota(ordem: number): Nota {
  return { ordem, titulo_gatilho: "", corpo: "", imagem_url: null };
}

function AdminColunas() {
  const [colunaId, setColunaId] = useState<string | null>(null);
  const [edicoes, setEdicoes] = useState<Edicao[]>([]);
  const [edicaoAtivaId, setEdicaoAtivaId] = useState<string | null>(null);

  // Rascunho em edição na tela
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [imagemPrincipal, setImagemPrincipal] = useState<string | null>(null);
  const [perguntaEngajamento, setPerguntaEngajamento] = useState("");
  const [notas, setNotas] = useState<Nota[]>([novaNota(1)]);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadPrincipalBusy, setUploadPrincipalBusy] = useState(false);
  const [fotoColunista, setFotoColunista] = useState<string | null>(null);
  const [uploadAvatarBusy, setUploadAvatarBusy] = useState(false);
  const [comentarios, setComentarios] = useState<Array<{ id: string; nome: string; comentario: string; criado_em: string; aprovado: boolean }>>([]);

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const sb = await getExternalBrowser();
      const { data: coluna } = await sb.from("colunas").select("id, foto_colunista_url").eq("slug", COLUNA_SLUG).maybeSingle();
      if (!coluna) { setCarregando(false); return; }
      setColunaId(coluna.id);
      setFotoColunista((coluna as { foto_colunista_url: string | null }).foto_colunista_url ?? null);
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
    const { data: ed } = await sb
      .from("coluna_edicoes")
      .select("id, titulo, subtitulo, imagem_principal_url, pergunta_engajamento")
      .eq("id", id)
      .maybeSingle();
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
    setNotas((ns?.length ? ns : [novaNota(1)]) as Nota[]);
    setMsg(null);
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

  function novaEdicaoEmBranco() {
    setEdicaoAtivaId(null);
    setTitulo("");
    setSubtitulo("");
    setImagemPrincipal(null);
    setPerguntaEngajamento("");
    setNotas([novaNota(1)]);
    setMsg(null);
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

  function addNota() {
    setNotas((ns) => [...ns, novaNota(ns.length + 1)]);
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
    if (notas.some((n) => !n.titulo_gatilho.trim() || !n.corpo.trim())) {
      setMsg("Toda nota precisa de título-gatilho e corpo preenchidos.");
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const payload = {
        coluna_id: colunaId,
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim() || null,
        imagem_principal_url: imagemPrincipal,
        pergunta_engajamento: perguntaEngajamento.trim() || null,
        atualizado_em: new Date().toISOString(),
        ...(publicar ? { status: "publicado", publicado_em: new Date().toISOString() } : {}),
      };

      let edId = edicaoAtivaId;
      if (edId) {
        const { error } = await sb.from("coluna_edicoes").update(payload).eq("id", edId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("coluna_edicoes").insert(payload).select("id").single();
        if (error) throw error;
        edId = data.id;
      }

      // Substitui as notas inteiras (mais simples que diff incremental)
      await sb.from("coluna_notas").delete().eq("edicao_id", edId);
      const { error: notasErr } = await sb.from("coluna_notas").insert(
        notas.map((n) => ({
          edicao_id: edId,
          ordem: n.ordem,
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

  if (carregando) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colunas"
        title="Vozes Políticas"
        subtitle="Cada publicação vira uma edição — a mais recente publicada aparece na home; as demais ficam no arquivo."
      />

      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}

      {/* Identidade da coluna */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <span className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200">
          {fotoColunista && <img src={fotoColunista} alt="" className="h-full w-full object-cover" />}
        </span>
        <div className="text-sm">
          <p className="font-semibold text-slate-800">Foto / avatar da coluna</p>
          <p className="mb-2 text-xs text-muted-foreground">Aparece no módulo de colunas da home, na lateral e no topo da coluna aberta.</p>
          <input type="file" accept="image/*" disabled={uploadAvatarBusy}
            onChange={(e) => e.target.files?.[0] && onUploadAvatar(e.target.files[0])} />
          {fotoColunista && (
            <button onClick={removerAvatar} className="ml-2 rounded border px-2 py-1 text-xs">Remover</button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Lista de edições */}
        <div className="space-y-2">
          <button
            onClick={novaEdicaoEmBranco}
            className="w-full rounded-lg bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white"
          >
            + Nova edição
          </button>
          {edicoes.map((e) => (
            <button
              key={e.id}
              onClick={() => abrirEdicao(e.id)}
              className={`block w-full rounded-lg border p-2 text-left text-xs ${edicaoAtivaId === e.id ? "border-[#0066CC] bg-[#0066CC]/5" : "border-slate-200 bg-white"}`}
            >
              <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${e.status === "publicado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {e.status}
              </span>
              <p className="line-clamp-2 font-medium text-slate-700">{e.titulo}</p>
            </button>
          ))}
          {edicoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma edição ainda.</p>}
        </div>

        {/* Editor */}
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Título da edição</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Subtítulo / linha fina</span>
            <textarea value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} rows={2} className="w-full rounded border px-3 py-2" />
          </label>
          <div className="text-sm">
            <span className="mb-1 block font-medium">Imagem principal</span>
            {imagemPrincipal && <img src={imagemPrincipal} alt="" className="mb-2 h-32 w-full max-w-sm rounded object-cover" />}
            <input type="file" accept="image/*" disabled={uploadPrincipalBusy}
              onChange={(e) => e.target.files?.[0] && onUploadPrincipal(e.target.files[0])} />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-semibold">Notas ({notas.length})</p>
            <div className="space-y-4">
              {notas.map((n, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground">Nota {i + 1}</span>
                    <div className="flex gap-1">
                      <button onClick={() => moverNota(i, -1)} className="rounded border px-2 text-xs">↑</button>
                      <button onClick={() => moverNota(i, 1)} className="rounded border px-2 text-xs">↓</button>
                      <button onClick={() => removeNota(i)} className="rounded border border-red-300 px-2 text-xs text-red-600">remover</button>
                    </div>
                  </div>
                  <input
                    value={n.titulo_gatilho}
                    onChange={(e) => setNotas((ns) => ns.map((x, j) => (j === i ? { ...x, titulo_gatilho: e.target.value } : x)))}
                    placeholder="Título-gatilho"
                    className="mb-2 w-full rounded border px-3 py-1.5 text-sm font-semibold"
                  />
                  <textarea
                    value={n.corpo}
                    onChange={(e) => setNotas((ns) => ns.map((x, j) => (j === i ? { ...x, corpo: e.target.value } : x)))}
                    rows={4}
                    placeholder="Corpo da nota"
                    className="mb-2 w-full rounded border px-3 py-2 text-sm"
                  />
                  {n.imagem_url && <img src={n.imagem_url} alt="" className="mb-2 h-24 w-full max-w-xs rounded object-cover" />}
                  <input type="file" accept="image/*" disabled={n._uploading}
                    onChange={(e) => e.target.files?.[0] && onUploadNota(i, e.target.files[0])} />
                </div>
              ))}
            </div>
            <button onClick={addNota} className="mt-3 rounded border px-3 py-1.5 text-sm">+ Adicionar nota</button>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pergunta de engajamento (opcional)</span>
            <input value={perguntaEngajamento} onChange={(e) => setPerguntaEngajamento(e.target.value)} className="w-full rounded border px-3 py-2" />
          </label>

          <div className="flex gap-2 border-t pt-4">
            <button onClick={() => salvar(false)} disabled={salvando} className="rounded border px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button onClick={() => salvar(true)} disabled={salvando} className="rounded bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {salvando ? "Publicando…" : "Publicar (vira a edição atual da home)"}
            </button>
          </div>

          {edicaoAtivaId && (
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-semibold">Comentários dos leitores ({comentarios.length})</p>
              <div className="space-y-2">
                {comentarios.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">
                        {c.nome} · {new Date(c.criado_em).toLocaleString("pt-BR")}
                        {!c.aprovado && <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-amber-800">oculto</span>}
                      </span>
                      <span className="flex gap-1">
                        <button onClick={() => moderarComentario(c.id, c.aprovado ? "ocultar" : "mostrar")} className="rounded border px-2 py-0.5">
                          {c.aprovado ? "Ocultar" : "Mostrar"}
                        </button>
                        <button onClick={() => moderarComentario(c.id, "excluir")} className="rounded border border-red-200 px-2 py-0.5 text-red-600">
                          Excluir
                        </button>
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-slate-600">{c.comentario}</p>
                  </div>
                ))}
                {comentarios.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário nesta edição.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
