import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getViewerLocation, setViewerLocation, listRegions } from "@/lib/content.functions";

const viewerLocQO = {
  queryKey: ["viewer-location"] as const,
  queryFn: () => getViewerLocation(),
};

const regionsQO = {
  queryKey: ["regions"] as const,
  queryFn: () => listRegions(),
};

export function LocationBar() {
  const { data: loc } = useQuery(viewerLocQO);
  const { data: regions } = useQuery(regionsQO);
  const setLoc = useServerFn(setViewerLocation);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cidade, setCidade] = useState(loc?.cidade ?? "");
  const [regiaoSlug, setRegiaoSlug] = useState(loc?.regiaoSlug ?? "");

  const label = loc?.cidade
    ? loc.cidade
    : loc?.regiaoSlug
      ? (regions?.find((r) => r.slug === loc.regiaoSlug)?.name ?? "Definir região")
      : "Definir minha região";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await setLoc({ data: { cidade: cidade || null, regiaoSlug: regiaoSlug || null } });
    await qc.invalidateQueries({ queryKey: ["viewer-location"] });
    await qc.invalidateQueries({ queryKey: ["articles"] });
    setOpen(false);
  }

  return (
    <div className="bg-primary/5 border-b border-primary/10">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-3 text-xs">
        <span className="text-slate-500 uppercase tracking-wider font-bold">📍 Sua região:</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-black text-primary hover:underline"
        >
          {label}
        </button>
        {loc?.source === "ip" && (
          <span className="text-[10px] uppercase text-slate-400">(detectado)</span>
        )}
        <span className="text-slate-400 hidden md:inline">
          — priorizamos notícias da sua cidade e do entorno
        </span>
      </div>
      {open && (
        <form
          onSubmit={save}
          className="mx-auto max-w-7xl px-4 pb-3 flex flex-col md:flex-row gap-2 items-stretch md:items-end"
        >
          <label className="flex-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Cidade
            </span>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex.: Assis Chateaubriand"
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1">
            <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Macrorregião
            </span>
            <select
              value={regiaoSlug}
              onChange={(e) => setRegiaoSlug(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="">— Nenhuma —</option>
              {(regions ?? []).map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase rounded"
          >
            Salvar
          </button>
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