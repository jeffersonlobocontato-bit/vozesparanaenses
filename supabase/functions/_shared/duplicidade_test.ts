import { ehDuplicata } from "./duplicidade.ts";

function check(nome: string, cond: boolean) {
  if (!cond) throw new Error("FALHOU: " + nome);
  console.log("ok:", nome);
}

const env = "Prefeitura de Cascavel abre licitações de R$ 13,8 milhões para pavimentar 10 km de estradas rurais. Editais contemplam quatro trechos nos distritos de Diamante e São Salvador";
check("mesma pauta, outro título", ehDuplicata(env, "Cascavel lança licitação de R$ 13,8 milhões para asfaltar estradas rurais em Diamante e São Salvador"));
check("pauta diferente da mesma cidade", !ehDuplicata(env, "Cascavel vacina 12 mil crianças contra a gripe no fim de semana"));
check("mesmo tema genérico, fato diferente", !ehDuplicata(env, "Prefeitura de Cascavel conclui pavimentação da estrada Dora"));
