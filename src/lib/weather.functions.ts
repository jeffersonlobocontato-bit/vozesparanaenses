import { createServerFn } from "@tanstack/react-start";
import { getCityCoords } from "./geo-cities";

export type Weather = {
  cidade: string;
  tempC: number;
  descricao: string;
  emoji: string;
};

// Códigos WMO (retornados pela Open-Meteo) mapeados pra descrição curta em
// pt-BR + um emoji — sem precisar de biblioteca de ícones pra isso.
const WMO_MAP: Record<number, { descricao: string; emoji: string }> = {
  0: { descricao: "Céu limpo", emoji: "☀️" },
  1: { descricao: "Poucas nuvens", emoji: "🌤️" },
  2: { descricao: "Parcialmente nublado", emoji: "⛅" },
  3: { descricao: "Nublado", emoji: "☁️" },
  45: { descricao: "Neblina", emoji: "🌫️" },
  48: { descricao: "Neblina densa", emoji: "🌫️" },
  51: { descricao: "Garoa fraca", emoji: "🌦️" },
  53: { descricao: "Garoa", emoji: "🌦️" },
  55: { descricao: "Garoa forte", emoji: "🌧️" },
  61: { descricao: "Chuva fraca", emoji: "🌧️" },
  63: { descricao: "Chuva", emoji: "🌧️" },
  65: { descricao: "Chuva forte", emoji: "🌧️" },
  71: { descricao: "Neve fraca", emoji: "🌨️" },
  73: { descricao: "Neve", emoji: "🌨️" },
  75: { descricao: "Neve forte", emoji: "🌨️" },
  80: { descricao: "Pancadas de chuva", emoji: "🌦️" },
  81: { descricao: "Pancadas de chuva", emoji: "🌧️" },
  82: { descricao: "Pancadas fortes", emoji: "⛈️" },
  95: { descricao: "Trovoada", emoji: "⛈️" },
  96: { descricao: "Trovoada com granizo", emoji: "⛈️" },
  99: { descricao: "Trovoada forte com granizo", emoji: "⛈️" },
};

function descreverCodigo(code: number): { descricao: string; emoji: string } {
  return WMO_MAP[code] ?? { descricao: "Tempo instável", emoji: "🌡️" };
}

/**
 * Previsão do tempo atual pra uma cidade (usando as coordenadas que já
 * temos em geo-cities.ts). Usa a Open-Meteo — gratuita, sem chave de API,
 * dado meteorológico oficial (mistura modelos como o do ECMWF).
 */
export const getCurrentWeather = createServerFn({ method: "GET" })
  .inputValidator((citySlug: string) => citySlug)
  .handler(async ({ data: citySlug }): Promise<Weather | null> => {
    const coords = getCityCoords(citySlug);
    if (!coords) return null;

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}` +
          `&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo`,
        { signal: ctrl.signal },
      );
      clearTimeout(t);
      if (!res.ok) return null;
      const json = await res.json();
      const tempC = json?.current?.temperature_2m;
      const code = json?.current?.weather_code;
      if (typeof tempC !== "number" || typeof code !== "number") return null;
      const { descricao, emoji } = descreverCodigo(code);
      return {
        cidade: citySlug,
        tempC: Math.round(tempC),
        descricao,
        emoji,
      };
    } catch {
      // Falha na consulta de tempo nunca deve quebrar a página — só não
      // mostra o widget.
      return null;
    }
  });
