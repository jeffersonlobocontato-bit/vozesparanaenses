import { useEffect, useState } from "react";
import { getCurrentWeather, type Weather } from "@/lib/weather.functions";

/**
 * Widget de tempo atual — busca depois da página já ter renderizado (não
 * atrasa o carregamento principal por causa de uma chamada externa). Usa a
 * cidade informada; se não vier nenhuma, cai em Curitiba como padrão.
 */
export function WeatherWidget({ citySlug, cidadeNome }: { citySlug?: string | null; cidadeNome?: string | null }) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loaded, setLoaded] = useState(false);

  const slug = citySlug || "curitiba";
  const nome = cidadeNome || "Curitiba";

  useEffect(() => {
    let cancelado = false;
    getCurrentWeather({ data: slug })
      .then((w) => {
        if (!cancelado) setWeather(w);
      })
      .catch(() => {
        /* silencioso — o widget só some se falhar */
      })
      .finally(() => {
        if (!cancelado) setLoaded(true);
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  if (loaded && !weather) return null; // falhou a consulta — não mostra caixa vazia

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
      {!weather ? (
        <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
      ) : (
        <>
          <span className="text-3xl" aria-hidden>{weather.emoji}</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{nome} agora</p>
            <p className="text-lg font-bold leading-tight text-slate-900">
              {weather.tempC}°C <span className="text-sm font-normal text-slate-600">{weather.descricao}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
