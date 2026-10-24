import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getViewerLocation, setViewerLocation } from "@/lib/content.functions";
import { PARANA_MUNICIPIOS, findMunicipio, type Municipio } from "@/lib/parana-municipios";

const viewerLocQO = {
  queryKey: ["viewer-location"] as const,
  queryFn: () => getViewerLocation(),
};

export function LocationBar() {
  const { data: loc } = useQuery(viewerLocQO);
  const setLoc = useServerFn(setViewerLocation);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cidade, setCidade] = useState(loc?.cidade ?? "");
  const [erro, setErro] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const m = findMunicipio(cidade);
    if (!m) {
      setErro("Escolha uma cidade do Paraná da lista.");
      return;
    }
    setErro(null);
    await setLoc({ data: { cidade: m.name, regiaoSlug: m.region } });
    await qc.invalidateQueries({ queryKey: ["viewer-location"] });
    await qc.invalidateQueries({ queryKey: ["articles"] });
    setOpen(false);
  }

  return (
    <div className="border-b border-rule bg-[oklch(0.966_0.006_153.8)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[0.9375rem] font-medium text-ink">
        {loc?.cidade ? (
          <>
            <span>Você está em</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-background py-0.5 pl-2 pr-3 font-semibold shadow-[inset_0_-2px_0_var(--vp-accent)]">
              <span className="vp-chapeu__ponto" aria-hidden="true" />
              {loc.cidade}
            </span>
            <button type="button" onClick={() => setOpen((v) => !v)} className="font-semibold text-link hover:underline">
              Trocar cidade
            </button>
            {loc.source === "ip" && (
              <span className="text-[0.8125rem] text-ink-subtle">Detectada pela sua conexão. Não é aqui?</span>
            )}
          </>
        ) : (
          <>
            <span>Escolha sua cidade para ver as notícias dela primeiro</span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white hover:opacity-90"
            >
              Escolher cidade
            </button>
          </>
        )}
      </div>
      {open && (
        <form onSubmit={save} className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-end">
          <label className="flex-1" htmlFor="vp-cidade">
            <span className="mb-1 block text-xs font-semibold text-ink-muted">Sua cidade</span>
            <input
              id="vp-cidade"
              list="vp-municipios"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Digite e escolha: Palotina, Cascavel, Foz do Iguaçu…"
              autoComplete="off"
              className="w-full rounded border border-rule bg-background px-3 py-2 text-sm"
            />
            <datalist id="vp-municipios">
              {(PARANA_MUNICIPIOS as unknown as Municipio[]).map((m) => (
                <option key={m.slug} value={m.name} />
              ))}
            </datalist>
          </label>
          <button type="submit" className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Salvar
          </button>
          {erro && <p className="text-sm font-medium text-alerta sm:self-center">{erro}</p>}
        </form>
      )}
    </div>
  );
}

export function ProximityBadge({ proximidade }: { proximidade: "cidade" | "regiao" | "estado" }) {
  if (proximidade === "estado") return null;
  const label = proximidade === "cidade" ? "📍 Perto de você" : "🗺️ Sua região";
  return (
    <span className="inline-block bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-sm">
      {label}
    </span>
  );
}