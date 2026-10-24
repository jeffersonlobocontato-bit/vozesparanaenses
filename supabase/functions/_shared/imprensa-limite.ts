// Limite de publicações do Portal da Imprensa: N matérias a cada 7 dias por
// cliente (clientes_imprensa.limite_semanal, padrão 1 — migração 081). Sem a
// coluna, vale o padrão.

export const LIMITE_PADRAO = 1;
const JANELA_MS = 7 * 86_400_000;

export type SituacaoLimite = {
  limite: number;
  usadas: number;
  restantes: number;
  /** Quando abre a próxima vaga (ISO), se o limite estiver esgotado. */
  liberaEm: string | null;
};

// deno-lint-ignore no-explicit-any
export async function situacaoLimite(sb: any, clienteId: string): Promise<SituacaoLimite> {
  let limite = LIMITE_PADRAO;
  const { data: c, error } = await sb.from("clientes_imprensa").select("limite_semanal").eq("id", clienteId).maybeSingle();
  if (!error && typeof c?.limite_semanal === "number") limite = c.limite_semanal;

  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  const { data: pubs } = await sb
    .from("generated_articles")
    .select("publicado_em")
    .eq("origem_imprensa_cliente_id", clienteId)
    .eq("status", "publicado")
    .gte("publicado_em", desde)
    .order("publicado_em", { ascending: true });
  const datas = ((pubs ?? []) as Array<{ publicado_em: string }>).map((p) => p.publicado_em);
  const usadas = datas.length;
  const restantes = Math.max(0, limite - usadas);
  // A vaga mais antiga dentro da janela é a próxima a "vencer".
  const liberaEm = restantes === 0 && datas.length > 0
    ? new Date(new Date(datas[Math.max(0, usadas - limite)]).getTime() + JANELA_MS).toISOString()
    : null;
  return { limite, usadas, restantes, liberaEm };
}

export function mensagemLimite(s: SituacaoLimite): string {
  const quando = s.liberaEm
    ? new Date(s.liberaEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  const usada = s.limite === 1
    ? "A matéria da semana da sua prefeitura já foi publicada."
    : `As ${s.limite} matérias da semana da sua prefeitura já foram publicadas.`;
  return usada +
    (quando ? ` A próxima fica liberada em ${quando}.` : "") +
    " As notícias do dia a dia continuam entrando pela nossa varredura do site da prefeitura." +
    " Para publicar mais, fale com a gente pelo WhatsApp.";
}
