import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { listNotasCidade, type NotaCidade, type PaginaNotasCidade } from "@/lib/content.functions";

/**
 * Coluna "Vozes {Cidade}" em formato blog: notas em ordem de publicação,
 * a mais nova no topo empurrando as anteriores para baixo. Mostra a
 * primeira página (vinda do loader) e um expansor "Ver mais notas" que
 * busca a próxima página pelo cursor de data — em vez de scroll infinito,
 * para o rodapé (e o anúncio) continuarem alcançáveis.
 */
export function ColunaCidadeFeed({
  citySlug,
  inicial,
  pagina = 10,
}: {
  citySlug: string;
  inicial: PaginaNotasCidade;
  pagina?: number;
}) {
  const [notas, setNotas] = useState<NotaCidade[]>(inicial.notas);
  const [temMais, setTemMais] = useState(inicial.temMais);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function verMais() {
    const ultima = notas[notas.length - 1];
    if (!ultima) return;
    setCarregando(true);
    setErro(null);
    try {
      const prox = await listNotasCidade({ data: { citySlug, limit: pagina, antesDe: ultima.publicado_em } });
      setNotas((atual) => [...atual, ...prox.notas.filter((n) => !atual.some((a) => a.id === n.id))]);
      setTemMais(prox.temMais);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  if (!notas.length) {
    return <p className="text-sm text-slate-500">Ainda não há notas de {inicial.cidadeNome} hoje.</p>;
  }

  return (
    <div>
      <ol className="relative border-l border-slate-200">
        {notas.map((n) => (
          <NotaItem key={n.id} nota={n} />
        ))}
      </ol>
      {erro && <p className="mt-4 text-sm text-red-700">Não foi possível carregar mais notas: {erro}</p>}
      {temMais && (
        <button
          type="button"
          onClick={verMais}
          disabled={carregando}
          className="mt-6 w-full rounded-full border border-[#12201E] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-[#12201E] transition-colors hover:bg-[#12201E] hover:text-white disabled:opacity-50"
        >
          {carregando ? "Carregando…" : "Ver mais notas"}
        </button>
      )}
    </div>
  );
}

function NotaItem({ nota }: { nota: NotaCidade }) {
  const quando = new Date(nota.publicado_em);
  const data = quando.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short" });
  const hora = quando.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return (
    <li id={`nota-${nota.id}`} className="mb-8 ml-5 scroll-mt-24">
      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[#12201E]" aria-hidden />
      <time dateTime={nota.publicado_em} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {data} · {hora}
      </time>
      <h3 className="mt-1 font-display text-xl font-bold leading-snug text-slate-900">{nota.titulo}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{nota.corpo}</p>
      {nota.fonte_nome && (
        <p className="mt-2 text-xs text-slate-500">
          Fonte:{" "}
          {nota.fonte_url ? (
            <a href={nota.fonte_url} target="_blank" rel="noopener nofollow" className="underline hover:text-[#12201E]">
              {nota.fonte_nome}
            </a>
          ) : (
            nota.fonte_nome
          )}
        </p>
      )}
    </li>
  );
}

/** Bloco compacto para a página da cidade: últimas notas + link para a coluna inteira. */
export function ColunaCidadeResumo({ citySlug, dados }: { citySlug: string; dados: PaginaNotasCidade }) {
  if (!dados.notas.length) return null;
  return (
    <section className="mt-14 border-t border-slate-200 pt-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#12201E]">Coluna</div>
          <h2 className="font-display text-3xl font-black text-[#12201E]">{dados.colunaNome}</h2>
        </div>
        <Link
          to="/vozes/$cidade"
          params={{ cidade: citySlug }}
          className="text-xs font-bold uppercase tracking-[0.18em] text-[#12201E] underline"
        >
          Ver a coluna completa
        </Link>
      </div>
      <ColunaCidadeFeed citySlug={citySlug} inicial={dados} pagina={10} />
    </section>
  );
}
