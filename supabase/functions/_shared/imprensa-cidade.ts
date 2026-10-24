// Cidade de uma matéria do Portal da Imprensa: a prefeitura do cadastro do
// cliente; sem ela (cliente criado à mão), a cidade citada no nome do
// cliente, no título ou no texto. Usada para região, fixação e duplicidade.

export type Cidade = { id: string; nome: string; slug: string; regiao_id: string | null };

export function normalizar(v: string): string {
  return ` ${v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

export async function resolverCidade(
  // deno-lint-ignore no-explicit-any
  sb: any,
  cliente: { cidade_id?: string | null; nome_empresa?: string | null },
  titulo: string,
  corpo: string,
): Promise<Cidade | null> {
  if (cliente.cidade_id) {
    const { data } = await sb.from("cidades").select("id, nome, slug, regiao_id").eq("id", cliente.cidade_id).maybeSingle();
    if (data) return data as Cidade;
  }
  const { data: cidades } = await sb.from("cidades").select("id, nome, slug, regiao_id");
  // Nome mais longo primeiro: "Santa Terezinha de Itaipu" antes de "Itaipu".
  const lista = ((cidades ?? []) as Cidade[])
    .map((c) => ({ c, n: normalizar(c.nome) }))
    .sort((a, b) => b.n.length - a.n.length);
  for (const texto of [cliente.nome_empresa ?? "", titulo, corpo]) {
    const t = normalizar(texto);
    let melhor: { c: Cidade; pos: number } | null = null;
    for (const { c, n } of lista) {
      const pos = t.indexOf(n);
      if (pos >= 0 && (!melhor || pos < melhor.pos)) melhor = { c, pos };
    }
    if (melhor) return melhor.c;
  }
  return null;
}
