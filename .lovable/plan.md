## Problema

Ao salvar a matéria, as listas (ex.: "1º cenário estimulado" da pesquisa) que você quebra manualmente com Enter voltam a virar texto corrido no site publicado.

## Causa (verificada)

- O editor salva `corpo` exatamente como você digita — as quebras de linha (`\n`) continuam no banco.
- O problema é na renderização em `src/routes/$region.$slug.tsx`: o corpo é dividido em parágrafos por **linhas em branco** (`split(/\n\s*\n/)`) e cada parágrafo vira um único `<p>`. Quebras de linha simples (Enter uma vez) são colapsadas em espaço pelo HTML — por isso a lista aparece corrida.
- É comportamento padrão de Markdown (linha única = mesma frase). Precisamos respeitar quebras de linha explícitas.

## Solução

Renderizar quebras de linha simples dentro de cada parágrafo como `<br/>`, mantendo o agrupamento atual por linha em branco.

### Alterações

1. **`src/lib/auto-link.tsx`** — na função `autoLinkParagraph` (ou equivalente que monta os nós do parágrafo), quando o texto contiver `\n`, dividir por `\n` e intercalar `<br key=... />` entre os pedaços antes de aplicar linkificação/auto-link. Assim cada linha do bloco vira uma linha visual.

2. Nenhuma mudança no editor, no schema ou no pipeline — o conteúdo salvo já está correto; só a renderização precisa respeitar as quebras.

### Resultado esperado

- Um Enter simples → nova linha visual (linhas empilhadas como no seu print de referência).
- Dois Enters (linha em branco) → novo parágrafo com espaçamento maior (comportamento atual mantido).
- Matérias antigas se beneficiam automaticamente, sem migração.
