export const BLOCOS = [
  { label: "Madrugada", ini: 0, fim: 6 },
  { label: "Manhã", ini: 6, fim: 12 },
  { label: "Tarde", ini: 12, fim: 18 },
  { label: "Noite", ini: 18, fim: 24 },
] as const;

export type Bloco = (typeof BLOCOS)[number];

export function horaSaoPaulo(iso: string): number {
  const s = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parseInt(s, 10);
}

export function blocoDoHorario(iso: string): Bloco {
  const h = horaSaoPaulo(iso);
  return BLOCOS.find((b) => h >= b.ini && h < b.fim) ?? BLOCOS[0];
}