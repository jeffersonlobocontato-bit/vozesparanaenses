import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

type Agente = {
  id: string;
  nome: string;
  ativo: boolean;
  categoria_id: string;
  categoria: { id: string; nome: string; slug: string } | null;
};

type Regiao = { id: string; nome: string; slug: string };

type Props = { onCreated: () => void };

export function ManualWriterBox({ onCreated }: Props) {
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
        setErr(e instanceof Error ? e.message : "Falha ao carregar agentes/regiões");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (modo === "url") {
      if (!/^https?:\/\//i.test(url.trim())) { setErr("URL inválida (precisa começar com http/https)."); return; }
    } else {
      if (!titulo.trim()) { setErr("Informe um título provisório para a matéria."); return; }
      if (texto.trim().length < 200) { setErr("Cole ao menos 200 caracteres de texto."); return; }
    }
    if (!agenteId) { setErr("Escolha um redator."); return; }
    if (!regiaoId) { setErr("Escolha uma região."); return; }
    const agente = agentes.find((a) => a.id === agenteId);
    if (!agente?.categoria) { setErr("Agente sem editoria vinculada."); return; }

    setBusy(true);
    setStep(modo === "url" ? `Lendo fonte…` : `Reorganizando texto colado…`);
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
      setOk(`Rascunho criado: "${payload.titulo ?? "sem título"}". Aparece abaixo na fila.`);
      setUrl(""); setObs(""); setTexto(""); setTitulo(""); setFonteUrl("");
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao gerar matéria manual");
    } finally {
      setBusy(false); setStep(null);
    }
  }

  return (
    <section className="rounded-lg border-2 border-[#0066CC] bg-blue-50/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#0A2540]">✍️ Redator manual (chat)</h2>
        <span className="text-[11px] text-[#0A2540]">Cole link ou texto pronto — a IA organiza SEO, GEO e ajustes finos</span>
      </div>
      <div className="mb-3 inline-flex overflow-hidden rounded border border-[#0066CC] text-[11px] font-semibold">
        <button
          type="button"
          onClick={() => setModo("url")}
          disabled={busy}
          className={`px-3 py-1 ${modo === "url" ? "bg-[#0066CC] text-white" : "bg-white text-[#0A2540]"}`}
        >
          🔗 URL da notícia
        </button>
        <button
          type="button"
          onClick={() => setModo("texto")}
          disabled={busy}
          className={`px-3 py-1 ${modo === "texto" ? "bg-[#0066CC] text-white" : "bg-white text-[#0A2540]"}`}
        >
          📝 Colar texto pronto
        </button>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs font-semibold text-[#0A2540]">
            Redator (editoria)
            <select value={agenteId} onChange={(e) => setAgenteId(e.target.value)} disabled={busy}
              className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm">
              <option value="">— selecione —</option>
              {agentes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome} · {a.categoria?.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#0A2540]">
            Região
            <select value={regiaoId} onChange={(e) => setRegiaoId(e.target.value)} disabled={busy}
              className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm">
              <option value="">— selecione —</option>
              {regioes.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </label>
        </div>
        {modo === "url" ? (
          <label className="block text-xs font-semibold text-[#0A2540]">
            URL da notícia-fonte
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
              placeholder="https://…" className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm" />
          </label>
        ) : (
          <>
            <label className="block text-xs font-semibold text-[#0A2540]">
              Título provisório
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={busy}
                placeholder="Ex.: Prefeitura anuncia obras no anel viário de Maringá"
                className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-[#0A2540]">
              Texto integral (a IA reescreve, organiza TL;DR, 5W1H, FAQ, SEO e GEO)
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={busy} rows={10}
                placeholder="Cole aqui a matéria pronta, release, transcrição de coletiva, etc. Mínimo 200 caracteres."
                className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm font-mono text-[12px] leading-relaxed" />
              <span className="mt-1 block text-[10px] text-[#0A2540]/70">
                {texto.trim().length} caracteres · {texto.trim().split(/\s+/).filter(Boolean).length} palavras
              </span>
            </label>
            <label className="block text-xs font-semibold text-[#0A2540]">
              URL de origem (opcional — para crédito/referência)
              <input type="url" value={fonteUrl} onChange={(e) => setFonteUrl(e.target.value)} disabled={busy}
                placeholder="https://… (opcional)" className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm" />
            </label>
          </>
        )}
        <label className="block text-xs font-semibold text-[#0A2540]">
          Observações para o redator (opcional)
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} disabled={busy} rows={2}
            placeholder="Ex.: focar no impacto em Maringá, destacar posição da prefeitura, evitar termo X…"
            className="mt-1 w-full rounded border bg-white px-2 py-1.5 text-sm" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy}
            className="rounded bg-[#0066CC] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
            {busy ? (step ?? "Gerando…") : "▶ Gerar rascunho"}
          </button>
          {step && busy && <span className="text-[11px] text-[#0A2540]">{step}</span>}
          {ok && <span className="text-[11px] font-semibold text-green-700">{ok}</span>}
          {err && <span className="text-[11px] font-semibold text-red-700">✗ {err}</span>}
        </div>
      </form>
    </section>
  );
}