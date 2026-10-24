import { useEffect, useState } from "react";
import { Link2, FileText, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Tabs, btn, campoClass, rotuloClass, Aviso } from "@/components/admin/ui";

type Agente = {
  id: string;
  nome: string;
  ativo: boolean;
  categoria_id: string;
  categoria: { id: string; nome: string; slug: string } | null;
};
type Categoria = { id: string; nome: string; slug: string };
type Regiao = { id: string; nome: string; slug: string };

type Modo = "ia" | "publicar";

/**
 * Nova matéria — um só lugar para criar matéria fora do pipeline automático.
 * - "IA redige": a IA escreve a partir de um link ou de um texto-fonte e cria
 *   um rascunho (edge function `manual-article`).
 * - "Publicar meu texto": o texto vai ao ar exatamente como foi escrito; a IA
 *   só preenche SEO, TL;DR, 5W1H e FAQ (edge function `publish-article`).
 */
export function NovaMateria({ onCreated }: { onCreated?: () => void }) {
  const [modo, setModo] = useState<Modo>("ia");
  return (
    <div className="space-y-4">
      <Tabs<Modo>
        value={modo}
        onChange={setModo}
        items={[
          { value: "ia", label: "IA redige a partir de link ou texto" },
          { value: "publicar", label: "Publicar meu texto" },
        ]}
      />
      {modo === "ia" ? <IaRedige onCreated={onCreated} /> : <PublicarTexto onCreated={onCreated} />}
    </div>
  );
}

const campo = `${campoClass} w-full font-normal`;

function contagem(texto: string) {
  return `${texto.trim().length} caracteres · ${texto.trim().split(/\s+/).filter(Boolean).length} palavras`;
}

// ── IA redige (antigo ManualWriterBox) ───────────────────────────────────────
function IaRedige({ onCreated }: { onCreated?: () => void }) {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [agenteId, setAgenteId] = useState<string>("");
  const [regiaoId, setRegiaoId] = useState<string>("");
  const [modo, setModo] = useState<"url" | "texto">("url");
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [fonteUrl, setFonteUrl] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const [ag, rg] = await Promise.all([
          sb.from("agentes_redatores")
            .select("id, nome, ativo, categoria_id, categoria:editorial_categories(id, nome, slug)")
            .order("nome"),
          sb.from("regioes").select("id, nome, slug").order("nome"),
        ]);
        const agentesData = ((ag.data ?? []) as unknown as Agente[]).filter((a) => a.ativo && a.categoria);
        setAgentes(agentesData);
        setRegioes((rg.data ?? []) as Regiao[]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha ao carregar redatores e regiões");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (modo === "url") {
      if (!/^https?:\/\//i.test(url.trim())) { setErr("Link inválido: precisa começar com http:// ou https://."); return; }
    } else {
      if (!titulo.trim()) { setErr("Informe um título provisório para a matéria."); return; }
      if (texto.trim().length < 200) { setErr("Cole ao menos 200 caracteres de texto."); return; }
    }
    if (!agenteId) { setErr("Escolha um redator."); return; }
    if (!regiaoId) { setErr("Escolha uma região."); return; }
    const agente = agentes.find((a) => a.id === agenteId);
    if (!agente?.categoria) { setErr("Este redator não tem editoria vinculada."); return; }

    setBusy(true);
    setStep(modo === "url" ? `Lendo a fonte…` : `Reorganizando o texto colado…`);
    try {
      const progressTimer = setTimeout(() => setStep(`Extraindo fatos e redigindo com ${agente.nome}…`), 3500);
      const body = modo === "url"
        ? {
            url: url.trim(),
            regiao_id: regiaoId,
            categoria_id: agente.categoria.id,
            observacoes: obs.trim() || undefined,
          }
        : {
            texto: texto.trim(),
            titulo: titulo.trim(),
            fonte_url: fonteUrl.trim() || undefined,
            regiao_id: regiaoId,
            categoria_id: agente.categoria.id,
            observacoes: obs.trim() || undefined,
          };
      const { data, error } = await supabase.functions.invoke("manual-article", { body });
      clearTimeout(progressTimer);
      if (error) {
        let detail = "";
        try {
          const errWithCtx = error as { context?: { response?: Response } };
          const resp = errWithCtx.context?.response;
          if (resp) detail = await resp.clone().text();
        } catch { /* ignore */ }
        throw new Error(detail || error.message);
      }
      const payload = data as { ok?: boolean; error?: string; hint?: string; titulo?: string };
      if (!payload?.ok) throw new Error(payload?.hint ?? payload?.error ?? "Falha desconhecida");
      setOk(`Rascunho criado: "${payload.titulo ?? "sem título"}". Está em Matérias › Em revisão.`);
      setUrl(""); setObs(""); setTexto(""); setTitulo(""); setFonteUrl("");
      onCreated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar a matéria");
    } finally {
      setBusy(false); setStep(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-500">
        A IA lê o link ou o texto colado, reescreve no estilo do redator escolhido e monta SEO, TL;DR, 5W1H e FAQ.
        O resultado entra como rascunho em «Em revisão».
      </p>
      <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setModo("url")}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${modo === "url" ? "bg-[#12201E] text-white" : "bg-white text-[#12201E] hover:bg-slate-50"}`}
        >
          <Link2 className="h-3.5 w-3.5" /> Link da notícia
        </button>
        <button
          type="button"
          onClick={() => setModo("texto")}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 border-l border-slate-300 px-3 py-1.5 ${modo === "texto" ? "bg-[#12201E] text-white" : "bg-white text-[#12201E] hover:bg-slate-50"}`}
        >
          <FileText className="h-3.5 w-3.5" /> Colar texto
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={rotuloClass}>
          Redator (editoria)
          <select value={agenteId} onChange={(e) => setAgenteId(e.target.value)} disabled={busy} className={campo}>
            <option value="">Selecione</option>
            {agentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} · {a.categoria?.nome}
              </option>
            ))}
          </select>
        </label>
        <label className={rotuloClass}>
          Região
          <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} disabled={busy} className={campo}>
            <option value="">Selecione</option>
            {regioes.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
        </label>
      </div>
      {modo === "url" ? (
        <label className={rotuloClass}>
          Link da notícia-fonte
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
            placeholder="https://…" className={campo} />
        </label>
      ) : (
        <>
          <label className={rotuloClass}>
            Título provisório
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={busy}
              placeholder="Ex.: Prefeitura anuncia obras no anel viário de Maringá" className={campo} />
          </label>
          <label className={rotuloClass}>
            Texto-fonte (a IA reescreve a partir dele)
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={busy} rows={10}
              placeholder="Cole aqui release, transcrição de coletiva, matéria de parceiro etc. Mínimo de 200 caracteres."
              className={`${campo} font-mono text-[12px] leading-relaxed`} />
            <span className="font-normal text-slate-500">{contagem(texto)}</span>
          </label>
          <label className={rotuloClass}>
            Link de origem (opcional, para crédito)
            <input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} disabled={busy}
              placeholder="https://…" className={campo} />
          </label>
        </>
      )}
      <label className={rotuloClass}>
        Observações para o redator (opcional)
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} disabled={busy} rows={2}
          placeholder="Ex.: focar no impacto em Maringá, destacar a posição da prefeitura, evitar o termo X…"
          className={campo} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={btn("primary")}>
          <Sparkles className="h-4 w-4" />
          {busy ? (step ?? "Gerando…") : "Gerar rascunho"}
        </button>
      </div>
      {ok && <Aviso>{ok}</Aviso>}
      {err && <Aviso tipo="erro">{err}</Aviso>}
    </form>
  );
}

// ── Publicar meu texto (antigo PublishArticleBox) ────────────────────────────
function PublicarTexto({ onCreated }: { onCreated?: () => void }) {
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [regiaoId, setRegiaoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [fonteUrl, setFonteUrl] = useState("");
  const [imagem, setImagem] = useState("");
  const [legenda, setLegenda] = useState("");
  const [credito, setCredito] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [publicarDireto, setPublicarDireto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const [rg, ct] = await Promise.all([
          sb.from("regioes").select("id, nome, slug").order("nome"),
          sb.from("editorial_categories").select("id, nome, slug").order("nome"),
        ]);
        setRegioes((rg.data ?? []) as Regiao[]);
        setCategorias((ct.data ?? []) as Categoria[]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Falha ao carregar regiões e editorias");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!titulo.trim()) { setErr("Informe o título da matéria."); return; }
    if (texto.trim().length < 120) { setErr("O texto precisa ter ao menos 120 caracteres."); return; }
    if (!regiaoId) { setErr("Escolha a região."); return; }
    if (!categoriaId) { setErr("Escolha a editoria."); return; }

    setBusy(true);
    setStep("Montando SEO e GEO (o texto não será alterado)…");
    try {
      const { data, error } = await supabase.functions.invoke("publish-article", {
        body: {
          titulo: titulo.trim(),
          texto: texto.trim(),
          subtitulo: subtitulo.trim() || undefined,
          fonte_url: fonteUrl.trim() || undefined,
          regiao_id: regiaoId,
          categoria_id: categoriaId,
          imagem_capa_url: imagem.trim() || undefined,
          imagem_legenda: legenda.trim() || undefined,
          imagem_credito: credito.trim() || undefined,
          publicar: publicarDireto,
        },
      });
      if (error) {
        let detail = "";
        try {
          const resp = (error as { context?: { response?: Response } }).context?.response;
          if (resp) detail = await resp.clone().text();
        } catch { /* ignore */ }
        throw new Error(detail || error.message);
      }
      const payload = data as { ok?: boolean; error?: string; hint?: string; titulo?: string; publicado?: boolean };
      if (!payload?.ok) throw new Error(payload?.hint ?? payload?.error ?? "Falha desconhecida");
      setOk(payload.publicado
        ? `Publicada: "${payload.titulo ?? titulo}". Já está no ar.`
        : `Rascunho criado: "${payload.titulo ?? titulo}". Revise em Matérias › Em revisão.`);
      setTitulo(""); setTexto(""); setSubtitulo(""); setFonteUrl(""); setImagem(""); setLegenda(""); setCredito("");
      onCreated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao publicar a matéria");
    } finally {
      setBusy(false); setStep(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-500">
        O texto é publicado <strong className="text-[#12201E]">exatamente como você escreveu</strong>. A IA não reescreve
        nem resume o corpo: só monta SEO, GEO, TL;DR, 5W1H e FAQ.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={rotuloClass}>
          Região
          <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} disabled={busy} className={campo}>
            <option value="">Selecione</option>
            {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <label className={rotuloClass}>
          Editoria
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={busy} className={campo}>
            <option value="">Selecione</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      <label className={rotuloClass}>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={busy}
          placeholder="Ex.: Prefeitura anuncia obras no anel viário de Maringá" className={campo} />
      </label>

      <label className={rotuloClass}>
        Subtítulo (opcional)
        <input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} disabled={busy}
          placeholder="Linha de apoio, até 160 caracteres" className={campo} />
      </label>

      <label className={rotuloClass}>
        Texto final da matéria (publicado sem alteração)
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={busy} rows={10}
          placeholder="Cole aqui o texto pronto. Ele vai ao ar palavra por palavra."
          className={`${campo} font-mono text-[12px] leading-relaxed`} />
        <span className="font-normal text-slate-500">{contagem(texto)}</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={rotuloClass}>
          Foto de capa (link, opcional)
          <input type="url" value={imagem} onChange={(e) => setImagem(e.target.value)} disabled={busy}
            placeholder="https://…" className={campo} />
        </label>
        <label className={rotuloClass}>
          Legenda da foto
          <input value={legenda} onChange={(e) => setLegenda(e.target.value)} disabled={busy} className={campo} />
        </label>
        <label className={rotuloClass}>
          Crédito da foto
          <input value={credito} onChange={(e) => setCredito(e.target.value)} disabled={busy}
            placeholder="Foto: Divulgação" className={campo} />
        </label>
      </div>

      <label className={rotuloClass}>
        Fonte ou referência (opcional)
        <input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} disabled={busy}
          placeholder="https://…" className={campo} />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" checked={publicarDireto} onChange={(e) => setPublicarDireto(e.target.checked)} disabled={busy} />
          Publicar agora (desmarque para mandar para «Em revisão»)
        </label>
        <button type="submit" disabled={busy} className={btn("primary")}>
          <Send className="h-4 w-4" />
          {busy ? (step ?? "Processando…") : publicarDireto ? "Publicar matéria" : "Enviar para revisão"}
        </button>
      </div>
      {ok && <Aviso>{ok}</Aviso>}
      {err && <Aviso tipo="erro">{err}</Aviso>}
    </form>
  );
}
