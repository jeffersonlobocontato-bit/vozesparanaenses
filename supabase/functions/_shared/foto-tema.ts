// Foto REAL de licença livre para o tema da matéria (Wikimedia Commons —
// inclui muito acervo da Agência Brasil), escolhida pela analista de imagens:
// planeja a busca (lugar/instituição ou cena genérica do tema), olha as
// candidatas e só aceita risco "baixo". Usada antes de recorrer à imagem de IA.

import { avaliarFotos, escolherFotoBaixoRisco, planejarImagem } from "./analista-imagem.ts";
import { buscarCommonsTema, copiarImagemParaStorage, type FotoCandidata } from "./imagem.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export type FotoTema = { url: string; credito: string; legenda: string; arquivo: string; licenca: string; autor: string };

export async function fotoLivrePorTema(p: {
  sb: Sb;
  aiKey: string;
  articleId: string;
  titulo: string;
  resumo: string | null;
  escopo: string;
}): Promise<FotoTema | { sensivel: true; motivo: string } | null> {
  const plano = await planejarImagem(p.aiKey, { titulo: p.titulo, resumo: p.resumo, escopo: p.escopo });
  if (plano.tema_sensivel) return { sensivel: true, motivo: plano.motivo };

  const candidatas: FotoCandidata[] = [];
  for (const busca of plano.buscas) {
    for (const f of await buscarCommonsTema(busca, 3)) {
      if (!candidatas.some((c) => c.url === f.url)) candidatas.push(f);
    }
  }
  const fotos = candidatas.slice(0, 4);
  if (!fotos.length) return null;
  const i = escolherFotoBaixoRisco(await avaliarFotos(p.aiKey, { titulo: p.titulo, resumo: p.resumo }, fotos));
  if (i === null) return null;
  const foto = fotos[i];
  const url = await copiarImagemParaStorage(p.sb, foto.url, `${p.articleId}/commons.jpg`);
  if (!url) return null;
  return {
    url,
    credito: foto.credito,
    legenda: `Imagem ilustrativa: ${foto.titulo.replace(/\.[a-z]+$/i, "").replace(/_/g, " ")}`,
    arquivo: foto.titulo,
    licenca: foto.licenca,
    autor: foto.autor,
  };
}
