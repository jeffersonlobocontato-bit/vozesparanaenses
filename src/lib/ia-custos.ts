export type CustoEtapaIA = { etapa: string; chamadas: number; tokens: number | null; custo_usd: number | null; custo_brl: number | null; chamadas_sem_custo: number; falhas: number };
export type PeriodoIA = { inicio: string; fim: string; materias_publicadas: number; etapas: CustoEtapaIA[] };
export type ResumoIA = { ontem: PeriodoIA; sete_dias: PeriodoIA };
export function totalizarIA(p: PeriodoIA) {
  const medidas = p.etapas.filter(e => e.custo_brl != null);
  const custo = medidas.length ? medidas.reduce((s, e) => s + Number(e.custo_brl), 0) : null;
  return { custo, porMateria: custo != null && p.materias_publicadas > 0 ? custo / p.materias_publicadas : null, semCusto: p.etapas.reduce((s, e) => s + Number(e.chamadas_sem_custo), 0), chamadas: p.etapas.reduce((s, e) => s + Number(e.chamadas), 0) };
}