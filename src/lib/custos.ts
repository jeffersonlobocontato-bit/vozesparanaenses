// Assinaturas do painel de custos (/admin/custos) e a situação de cada uma
// (vencida, saldo baixo, vence em breve…), usada na tabela e no menu lateral.

export type Assinatura = {
  id: string;
  nome: string;
  fornecedor: string | null;
  finalidade: string | null;
  valor: number;
  moeda: "USD" | "BRL";
  periodicidade: "mensal" | "anual" | "uso";
  inicio: string;
  vencimento: string | null;
  saldo: number | null;
  saldo_unidade: string | null;
  saldo_alerta: number | null;
  link: string | null;
  observacao: string | null;
  ativo: boolean;
};

/** Situação de cada assinatura, da mais grave para a mais tranquila. */
export function situacao(a: Assinatura): { nivel: number; status: string; rotulo: string } {
  if (!a.ativo) return { nivel: 9, status: "inativo", rotulo: "Inativa" };
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (a.vencimento) {
    const dias = Math.round((new Date(`${a.vencimento}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000);
    if (dias < 0) return { nivel: 0, status: "rejeitado", rotulo: `Vencida há ${-dias} dia${-dias === 1 ? "" : "s"}` };
    if (a.saldo != null && a.saldo_alerta != null && a.saldo <= a.saldo_alerta) return { nivel: 1, status: "rejeitado", rotulo: "Saldo baixo" };
    if (dias <= 7) return { nivel: 2, status: "pendente", rotulo: dias === 0 ? "Vence hoje" : `Vence em ${dias} dia${dias === 1 ? "" : "s"}` };
    if (dias <= 30) return { nivel: 4, status: "aguardando", rotulo: `Renova em ${dias} dias` };
  }
  if (a.saldo != null && a.saldo_alerta != null && a.saldo <= a.saldo_alerta) return { nivel: 1, status: "rejeitado", rotulo: "Saldo baixo" };
  if (a.periodicidade === "uso" && a.saldo == null) return { nivel: 3, status: "inativo", rotulo: "Informar saldo" };
  if (a.periodicidade !== "uso" && !a.vencimento) return { nivel: 3, status: "inativo", rotulo: "Informar vencimento" };
  return { nivel: 5, status: "ativo", rotulo: "Em dia" };
}

