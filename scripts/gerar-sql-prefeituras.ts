// Gera supabase-external/069_fontes_prefeituras.sql a partir do JSON de
// `descobrir-prefeituras.ts`. Roda DEPOIS da 067 (precisa de cidade_slug e
// abrangencia em `fontes`).
//
//   node scripts/gerar-sql-prefeituras.ts prefeituras-descoberta.json
//
// - Prefeituras já cadastradas (18) ganham cidade_slug + abrangencia
//   municipal; o endereço delas não muda.
// - As descobertas com status "ok" (lista + data legível) entram ativas.
// - "sem_data" entram INATIVAS: a lista existe, mas a coleta descartaria
//   tudo por falta de data — precisam de ajuste antes de ligar.

import { readFileSync, writeFileSync } from "node:fs";

type R = { slug: string; nome: string; status: string; url_base: string | null; metodo: string | null; itens: number };

const entrada = process.argv[2] ?? "prefeituras-descoberta.json";
const rs = JSON.parse(readFileSync(entrada, "utf8")) as R[];
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const usaveis = rs.filter((r) => r.url_base && (r.status === "ok" || r.status === "sem_data"));
const linhas = usaveis.map((r) => `  (${q(r.slug)}, ${q(`Prefeitura de ${r.nome}`)}, ${q(r.url_base!)}, ${r.status === "ok"})`);
const cont = rs.reduce<Record<string, number>>((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {});

const sql = `-- =====================================================================
-- Vozes Paranaenses — 069_fontes_prefeituras.sql
-- Gerado por scripts/gerar-sql-prefeituras.ts em ${new Date().toISOString().slice(0, 10)}.
-- Fase 1 da automação: assessorias oficiais das 399 prefeituras.
-- Descoberta: ${JSON.stringify(cont)}
--   ok        → entra ATIVA (lista de notícias + data legível na matéria)
--   sem_data  → entra INATIVA (a coleta descartaria tudo por falta de data)
--   sem_lista / fora_do_ar → não cadastradas (ver relatório em docs/)
-- Roda no Supabase EXTERNO, depois da 067. Idempotente.
-- =====================================================================

-- 1. Prefeituras já cadastradas: amarra à cidade (pelo nome) e marca municipal.
update public.fontes f
set cidade_slug = c.slug, abrangencia = 'municipal', regiao_id = c.regiao_id
from public.cidades c
where f.tipo = 'prefeitura'
  and f.cidade_slug is null
  and lower(f.nome) = lower('Prefeitura de ' || c.nome);

-- 2. Prefeituras descobertas (sem duplicar cidade que já tem prefeitura).
with descobertas(cidade_slug, nome, url_base, ativo) as (values
${linhas.join(",\n")}
)
insert into public.fontes (nome, url_base, tipo, tipo_renderizacao, protecao_antibot, ativo, cidade_slug, abrangencia, regiao_id)
select d.nome, d.url_base, 'prefeitura', 'estatico', false, d.ativo, d.cidade_slug, 'municipal', c.regiao_id
from descobertas d
join public.cidades c on c.slug = d.cidade_slug
where not exists (
  select 1 from public.fontes f where f.tipo = 'prefeitura' and f.cidade_slug = d.cidade_slug
)
on conflict (url_base) do update
  set cidade_slug = excluded.cidade_slug, abrangencia = 'municipal', tipo = 'prefeitura';

-- Conferência
select ativo, count(*) from public.fontes where tipo = 'prefeitura' group by ativo;
`;
writeFileSync("supabase-external/069_fontes_prefeituras.sql", sql);

const relatorio = ["slug,cidade,status,metodo,itens,url_base"]
  .concat(rs.map((r) => [r.slug, `"${r.nome}"`, r.status, r.metodo ?? "", r.itens, r.url_base ?? ""].join(",")))
  .join("\n");
writeFileSync("docs/prefeituras-mapeamento.csv", relatorio + "\n");
console.log("ok:", cont, `${usaveis.length} linhas no SQL`);
