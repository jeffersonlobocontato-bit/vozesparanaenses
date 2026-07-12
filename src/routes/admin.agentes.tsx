import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

export const Route = createFileRoute("/admin/agentes")({
  component: AdminAgentes,
});

type Categoria = { id: string; slug: string; nome: string };
type Agente = {
  id?: string;
  categoria_id: string;
  nome: string;
  instrucoes_base: string;
  exemplo_texto: string | null;
  ativo: boolean;
  atualizado_em?: string;
};

function AdminAgentes() {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [agentes, setAgentes] = useState<Record<string, Agente>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const sb = await getExternalBrowser();
      const [rc, ra] = await Promise.all([
        sb.from("editorial_categories").select("id, slug, nome").order("nome"),
        sb.from("agentes_redatores").select("id, categoria_id, nome, instrucoes_base, exemplo_texto, ativo, atualizado_em"),
      ]);
      if (rc.error) throw rc.error;
      if (ra.error) throw ra.error;
      setCats((rc.data ?? []) as Categoria[]);
      const map: Record<string, Agente> = {};
      for (const a of (ra.data ?? []) as Agente[]) map[a.categoria_id] = a;
      setAgentes(map);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(cat: Categoria, patch: Partial<Agente>) {
    setMsg(null);
    try {
      const sb = await getExternalBrowser();
      const existing = agentes[cat.id];
      const payload = {
        categoria_id: cat.id,
        nome: patch.nome ?? existing?.nome ?? `Redator de ${cat.nome}`,
        instrucoes_base: patch.instrucoes_base ?? existing?.instrucoes_base ?? "",
        exemplo_texto: patch.exemplo_texto ?? existing?.exemplo_texto ?? null,
        ativo: patch.ativo ?? existing?.ativo ?? true,
        atualizado_em: new Date().toISOString(),
      };
      if (existing?.id) {
        const { error } = await sb.from("agentes_redatores").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("agentes_redatores").insert(payload);
        if (error) throw error;
      }
      setMsg(`Agente de ${cat.nome} salvo.`);
      load();
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes redatores por editoria</h1>
          <p className="text-sm text-muted-foreground">Cada editoria tem um redator de IA especializado. O prompt-base é aplicado quando a matéria é gerada automaticamente.</p>
        </div>
        <button onClick={load} className="rounded border px-3 py-1 text-xs hover:bg-accent">Atualizar</button>
      </div>
      {msg && <p className="rounded border bg-muted p-2 text-xs">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <ul className="space-y-2">
        {cats.map((c) => {
          const a = agentes[c.id];
          const open = openId === c.id;
          return (
            <li key={c.id} className="rounded-lg border bg-card">
              <button onClick={() => setOpenId(open ? null : c.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${a?.ativo ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-semibold">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {a ? `${a.nome} · ${(a.instrucoes_base ?? "").length} chars` : "sem agente configurado"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{open ? "fechar" : "editar"}</span>
              </button>
              {open && <AgenteEditor cat={c} agente={a} onSave={save} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgenteEditor({ cat, agente, onSave }: {
  cat: Categoria;
  agente?: Agente;
  onSave: (cat: Categoria, patch: Partial<Agente>) => void;
}) {
  const [nome, setNome] = useState(agente?.nome ?? `Redator de ${cat.nome}`);
  const [prompt, setPrompt] = useState(agente?.instrucoes_base ?? "");
  const [exemplo, setExemplo] = useState(agente?.exemplo_texto ?? "");
  const [ativo, setAtivo] = useState(agente?.ativo ?? true);

  return (
    <div className="space-y-3 border-t px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex-1 text-xs">
          <span className="mb-1 block font-semibold">Nome do agente</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo (aplicar ao gerar matéria)
        </label>
      </div>

      <label className="block text-xs">
        <span className="mb-1 block font-semibold">Instruções-base (prompt)</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
          rows={16}
          className="w-full rounded border px-2 py-2 font-mono text-xs leading-relaxed"
          placeholder="Ex.: Você é o redator de Política do Vozes Paranaenses. Aplique o Método DEL + lide 5W1H..." />
        <span className="mt-1 block text-[10px] text-muted-foreground">
          Este texto é injetado antes do system prompt padrão. Use o Método DEL (Denso, Editorial, Local) + lide 5W1H (O quê / Quem / Quando / Onde / Como / Por quê) na primeira frase.
        </span>
      </label>

      <label className="block text-xs">
        <span className="mb-1 block font-semibold">Exemplo de lide (opcional)</span>
        <textarea value={exemplo} onChange={(e) => setExemplo(e.target.value)}
          rows={4}
          className="w-full rounded border px-2 py-2 text-xs leading-relaxed"
          placeholder="Ex.: A Câmara de Curitiba aprovou, nesta terça (12), por 24 votos a 9, o projeto que..." />
      </label>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[10px] text-muted-foreground">
          {agente?.atualizado_em ? `Atualizado em ${new Date(agente.atualizado_em).toLocaleString("pt-BR")}` : "Nunca salvo"}
        </p>
        <button
          onClick={() => onSave(cat, { nome, instrucoes_base: prompt, exemplo_texto: exemplo || null, ativo })}
          className="rounded bg-[#0066CC] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0055aa]"
        >Salvar agente</button>
      </div>
    </div>
  );
}