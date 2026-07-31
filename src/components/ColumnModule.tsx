import { Link } from "@tanstack/react-router";
import type { ColunaComEdicaoAtual } from "@/lib/content.functions";

export function ColumnModule({ coluna }: { coluna: ColunaComEdicaoAtual }) {
  const { edicao } = coluna;
  if (!edicao) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Cabeçalho da coluna — nome da série + colunista, como nas colunas dos
          grandes portais (Painel, Radar, etc.) */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-[#0A2540] px-5 py-3">
        {coluna.foto_colunista_url && (
          <img
            src={coluna.foto_colunista_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20"
          />
        )}
        <div>
          <p className="font-display text-lg font-bold uppercase tracking-wide text-white">{coluna.nome}</p>
          {coluna.descricao && <p className="text-xs text-white/70">{coluna.descricao}</p>}
        </div>
      </div>

      {/* Imagem principal da edição atual */}
      {edicao.imagem_principal_url && (
        <img src={edicao.imagem_principal_url} alt={edicao.titulo} className="h-56 w-full object-cover sm:h-72" />
      )}

      <div className="p-5 sm:p-7">
        <h2 className="font-display text-2xl font-black leading-tight text-[#0A2540] sm:text-3xl">
          {edicao.titulo}
        </h2>
        {edicao.subtitulo && (
          <p className="mt-2 text-base font-medium text-slate-600">{edicao.subtitulo}</p>
        )}

        <div className="mt-6 space-y-6">
          {edicao.notas.map((nota) => (
            <div key={nota.id} className="border-l-2 border-[#0066CC] pl-4">
              <h3 className="font-display text-lg font-bold text-[#0A2540]">{nota.titulo_gatilho}</h3>
              {nota.imagem_url && (
                <img
                  src={nota.imagem_url}
                  alt=""
                  className="my-3 w-full max-w-md rounded-lg object-cover sm:float-left sm:mr-4 sm:w-56"
                />
              )}
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{nota.corpo}</p>
              <div className="clear-both" />
            </div>
          ))}
        </div>

        {edicao.pergunta_engajamento && (
          <div className="mt-7 rounded-xl bg-[#0066CC]/5 p-4">
            <p className="text-sm font-semibold text-[#0A2540]">🗳️ {edicao.pergunta_engajamento}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          {edicao.publicado_em && (
            <span className="text-slate-400">
              {new Date(edicao.publicado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          )}
          <Link
            to="/coluna/$slug/arquivo"
            params={{ slug: coluna.slug }}
            className="font-semibold text-[#0066CC] hover:underline"
          >
            Ver edições anteriores →
          </Link>
        </div>
      </div>
    </section>
  );
}
