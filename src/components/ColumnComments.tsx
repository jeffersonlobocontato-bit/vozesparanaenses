import { useEffect, useState, useCallback } from "react";
import {
  listComentariosColuna,
  criarComentarioColuna,
  type ColunaComentario,
} from "@/lib/content.functions";

/** Caixa de comentários do leitor no rodapé de uma edição de coluna. */
export function ColumnComments({ edicaoId }: { edicaoId: string }) {
  const [itens, setItens] = useState<ColunaComentario[]>([]);
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const rows = await listComentariosColuna({ data: { edicaoId } });
      setItens(rows);
    } catch {
      /* silencioso */
    }
  }, [edicaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    try {
      const r = await criarComentarioColuna({ data: { edicaoId, nome, comentario: texto } });
      if (!r.ok) { setMsg(r.erro ?? "Não foi possível enviar."); return; }
      setTexto("");
      setMsg("Comentário publicado. Obrigado por participar!");
      await carregar();
    } catch {
      setMsg("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="mt-10 border-t-2 border-[#0A2540] pt-6">
      <h2 className="font-display text-xl font-black uppercase text-[#0A2540]">
        Comentários {itens.length > 0 && <span className="text-[#0066CC]">({itens.length})</span>}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Participe do debate. Comentários ofensivos ou com links são removidos.
      </p>

      <form onSubmit={enviar} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          maxLength={80}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Escreva seu comentário"
          maxLength={2000}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Comentar"}
          </button>
          {msg && <span className="text-xs font-medium text-slate-600">{msg}</span>}
        </div>
      </form>

      <ul className="mt-5 space-y-4">
        {itens.map((c) => (
          <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0066CC]/10 text-xs font-bold text-[#0066CC]">
                {c.nome.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0A2540]">{c.nome}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  {new Date(c.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{c.comentario}</p>
          </li>
        ))}
        {itens.length === 0 && (
          <li className="text-sm text-slate-500">Seja o primeiro a comentar esta edição.</li>
        )}
      </ul>
    </section>
  );
}
