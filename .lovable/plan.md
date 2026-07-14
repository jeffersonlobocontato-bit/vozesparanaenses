## Troca dos slots AdSense por unidades dedicadas

Você criou 5 unidades multiplex, uma por página de listagem. Vou substituir os IDs reaproveitados (`9449330789` auto e `2880053002` multiplex) pelos novos, mantendo layout e comportamento (só renderiza quando há artigos).

### Mapeamento proposto

| ID novo | Página | Arquivo | Slot atual |
|---|---|---|---|
| `4261702843` | Home nacional (feed) | `src/routes/index.tsx` | `2880053002` (multiplex final) |
| `2384001620` | Home regional `/:region` | `src/routes/$region.index.tsx` | `9449330789` |
| `1955103709` | Cidade `/:region/cidade/:cidade` | `src/routes/$region.cidade.$cidade.tsx` | `9449330789` |
| `9322457839` | Editoria regional `/:region/editoria/:categoria` | `src/routes/$region.editoria.$categoria.tsx` | `9449330789` (topo) e `2880053002` (fim da grade) — vou aplicar o novo no principal (topo) |
| `7444756615` | Editoria global `/editoria/:categoria` | `src/routes/editoria.$categoria.tsx` | `9449330789` |

### Observações

- Como todas as novas unidades são **multiplex** (`autorelaxed`), vou passar `format="autorelaxed"` nos slots das listagens que hoje usam `format="auto"`. Multiplex é feed de conteúdo — combina bem com grades de matérias, então é upgrade, não regressão.
- Nas duas páginas de editoria (regional e global) que tinham dois blocos (topo `auto` + fim `multiplex`), vou consolidar em **um único** bloco multiplex dedicado no fim da grade, evitando dois multiplex na mesma página. O topo passa a não ter anúncio nessas rotas — mais limpo e dentro das boas práticas do AdSense.
- `home` (index): a home hoje tem um multiplex no fim; troco pelo `4261702843` dedicado.
- Nenhuma mudança em `ads.txt`, layout, CSS ou lógica de noindex.

### Confirmação

Se preferir manter os dois blocos por página (topo auto + fim multiplex) em vez de consolidar, me avise antes que eu aplico. Caso contrário sigo com o mapeamento acima.