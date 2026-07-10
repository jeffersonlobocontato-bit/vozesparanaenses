## Objetivo

Ampliar o "fixar matéria" para permitir escolher **onde** ela aparece fixada:

- **Estado inteiro** (comportamento atual)
- **Uma ou mais regiões** (ex.: só Oeste + Sudoeste)
- **Cidades específicas** (ex.: Cascavel, Toledo, Sta. Tereza do Oeste, Medianeira)

Quem estiver fora do escopo vê a home / região com a taxonomia normal (sem essa matéria fixada).

## Como o leitor "pertence" a uma cidade/região

Não usamos geolocalização do navegador. O escopo é definido pela **rota que ele está vendo**:

- `/` → home estadual → mostra pins de escopo **estado** (e pins de cidade/região viram fallback normal na lista)
- `/[regiao]` → mostra pins de escopo **estado** + pins que incluem essa região + pins cujas cidades pertencem a essa região
- `/[regiao]/cidade/[cidade]` → mostra pins **estado** + **região** correspondente + **cidade** exata

Regra de prioridade nos slots (Manchete=0, Lateral 1..4): pin mais específico ganha. Cidade > Região > Estado. Empate: mais recente.

## Base de 399 municípios do Paraná

Criar `src/lib/parana-municipios.ts` com o array completo dos 399 municípios do PR (slug, nome, região editorial a que pertencem — mapeada para os `regioes.slug` já existentes no banco). Esse arquivo alimenta:

- O autocomplete no editor
- O parser "digite separado por vírgula" (normaliza acento/caixa → slug)
- A resolução "cidade pertence a qual região"

Observação: `src/lib/geo-cities.ts` (coordenadas) fica como está — só cobre as cidades com coordenada conhecida para meta `geo.position`. O novo arquivo é a lista completa oficial.

## Mudanças no banco (migração `015_pins_geo.sql`, externa)

Adicionar em `generated_articles`:

```text
fixado_escopo    text     -- 'estado' | 'regiao' | 'cidades' | null
fixado_regioes   text[]   -- slugs de regiões, quando escopo='regiao'
fixado_cidades   text[]   -- slugs de cidades,  quando escopo='cidades'
```

Manter `fixado_posicao` como está (0=Manchete, 1..4=Lateral, null=não fixada).
Índices GIN em `fixado_regioes` e `fixado_cidades`. Compatibilidade: pins antigos passam a valer como escopo `estado`.

## Editor da matéria (`ArticleEditor.tsx`)

Novo bloco abaixo do seletor de posição:

- Radio: **Todo o estado** · **Regiões específicas** · **Cidades específicas**
- Se "Regiões": multi-select das regiões cadastradas em `regioes`
- Se "Cidades":
  - Campo de texto que aceita **múltiplas cidades separadas por vírgula** ("Cascavel, Toledo, Santa Tereza do Oeste, Medianeira")
  - Autocomplete puxando de `parana-municipios.ts` (sugere enquanto digita, aceita Enter/vírgula, remove com backspace)
  - Cada cidade vira um "chip" removível
  - Normaliza acento/caixa; cidades desconhecidas ficam com aviso "não encontrada"

Ao salvar: escreve `fixado_escopo`, `fixado_regioes`, `fixado_cidades`. Ao limpar posição (Não fixar) zera os três.

Exclusividade da posição continua valendo **dentro do mesmo escopo** — dois pins de "Manchete" para cidades diferentes convivem. Já pins conflitantes (mesma posição + escopos sobrepostos) recebem aviso mas não bloqueiam (o mais específico ganha na renderização).

## Layout / seleção (`pinned-layout.ts` e `content.functions.ts`)

- `listRankedArticles` e `listArticlesByRegion` passam a receber um `viewerScope` opcional: `{ region?: string; city?: string }`.
- `arrangePinnedSlots` ganha um filtro: um pin só é considerado se seu escopo casa com o viewer:
  - escopo `estado` → sempre
  - escopo `regiao` → viewer tem `region` e ela está em `fixado_regioes`
  - escopo `cidades` → viewer tem `city` e ela está em `fixado_cidades`, OU viewer tem `region` e a cidade pertence a essa região (usando o mapa de municípios) — mostra o pin ao vizinho da região; ajustável por config futura, mas por padrão só cidade exata para não "vazar".
- Se dois pins competem pela mesma posição, escolhe o mais específico (cidade > região > estado); empate → mais recente.
- Pins que não passam no filtro do viewer voltam para o pool normal (aparecem como matéria comum se estiverem no ranking, sem "fixação").

## Rotas atualizadas

- `src/routes/index.tsx`: viewerScope vazio (só pins estaduais).
- `src/routes/$region.index.tsx`: viewerScope = `{ region }`.
- `src/routes/$region.cidade.$cidade.tsx`: viewerScope = `{ region, city }`.

## Painel admin (`admin.index.tsx`)

Badge do pin passa a mostrar escopo:

- `📌 Manchete · Estado`
- `📌 Lateral 2 · Regiões: Oeste, Sudoeste`
- `📌 Manchete · Cidades: Cascavel, Toledo (+2)`

## Detalhes técnicos

- Parser de "cidades separadas por vírgula": split por `,` / `;` / newline, `trim`, remove acento, minúsculas, hyphen → slug. Comparação contra `parana-municipios.ts`.
- Todas as leituras filtram por escopo no cliente (arrays curtos ≤ dezenas de pins ativos); mais simples que RPC. Se crescer, migramos para uma view SQL.
- Fallback quando a migração `015` ainda não foi aplicada: o código detecta `column ... does not exist` (mesma técnica de `013`/`014`) e trata tudo como escopo `estado`.

## O que NÃO muda

- SEO / JSON-LD / RSS / sitemap: intocados.
- Lógica de anúncios: intocada.
- Ordem automática de matérias não-fixadas: intocada.
