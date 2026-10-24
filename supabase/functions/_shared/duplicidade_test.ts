import { ehDuplicata } from "./duplicidade.ts";

function check(nome: string, cond: boolean) {
  if (!cond) throw new Error("FALHOU: " + nome);
  console.log("ok:", nome);
}

const env = "Prefeitura de Cascavel abre licitações de R$ 13,8 milhões para pavimentar 10 km de estradas rurais. Editais contemplam quatro trechos nos distritos de Diamante e São Salvador";
check("mesma pauta, outro título", ehDuplicata(env, "Cascavel lança licitação de R$ 13,8 milhões para asfaltar estradas rurais em Diamante e São Salvador"));
check("pauta diferente da mesma cidade", !ehDuplicata(env, "Cascavel vacina 12 mil crianças contra a gripe no fim de semana"));
check("mesmo tema genérico, fato diferente", !ehDuplicata(env, "Prefeitura de Cascavel conclui pavimentação da estrada Dora"));

// Caso real (24/10): mesma apreensão em Sertaneja vinda de Bonde e Folha de Londrina.
check("Sertaneja: mesma apreensão, fontes diferentes", ehDuplicata(
  "Receita Federal apreende R$ 1 milhão em eletrônicos contrabandeados em Sertaneja",
  "Receita Federal e BPFron apreendem R$ 1 millh&#227;o em produtos em Sertaneja",
));
check("Sertaneja: outra notícia da cidade", !ehDuplicata(
  "Receita Federal apreende R$ 1 milhão em eletrônicos contrabandeados em Sertaneja",
  "Sertaneja abre inscrições para curso gratuito de informática",
));
check("Mesma cidade, duas apreensões diferentes", !ehDuplicata(
  "PM apreende 200 kg de maconha em caminhão na BR-369 em Cornélio Procópio",
  "Receita Federal apreende cigarros contrabandeados em ônibus em Cornélio Procópio",
));
check("Série B: jogos diferentes da mesma rodada", !ehDuplicata(
  "Atlético-GO e Novorizontino jogam pela 35ª rodada da Série B em Goiânia",
  "Avaí e Botafogo-SP jogam em Florianópolis pela Série B",
));
check("Série B: o mesmo jogo", ehDuplicata(
  "Avaí e Botafogo-SP jogam em Florianópolis pela Série B. Partida na Ressacada às 16h",
  "Avaí e Botafogo-SP se enfrentam na Ressacada pela 35ª rodada da Série B em Florianópolis",
));
