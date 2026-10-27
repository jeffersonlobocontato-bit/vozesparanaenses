// Prévia dos cards do Instagram com matérias reais (roda no GitHub Actions):
// deno run -A scripts/previa-cards.ts → previas/*.png. Não publica nada.
import { renderizarCard, imagemComoDataUri } from "../supabase/functions/_shared/instagram-render.ts";
import { chapeuDe, fotoReal, type MateriaIG } from "../supabase/functions/_shared/instagram-selecao.ts";
import { ESCOPO, NOME_REGIAO, type Card } from "../supabase/functions/_shared/instagram-cards.ts";

const URL = "https://flcgtpzfnsrxawvyzzgh.supabase.co/rest/v1/generated_articles";
const KEY = "sb_publishable_fMVraOMiN5QsfLcdVmjLTA_VfukX2cx";
const sel = "id,titulo,subtitulo,cidade_principal,imagem_capa_url,imagem_credito,foto_origem,publicado_em,prioridade_crivo,regiao:regioes(slug,nome),categoria:editorial_categories(slug,nome)";
const r = await fetch(`${URL}?select=${sel}&status=eq.publicado&imagem_capa_url=not.is.null&order=publicado_em.desc&limit=80`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const linhas = await r.json() as any[];
const escolhidas = linhas.filter((l) => l.regiao && !["nacional", "internacional"].includes(l.regiao.slug))
  .map((l) => ({ l, m: { id: l.id, titulo: l.titulo, regiao_slug: l.regiao?.slug, categoria_slug: l.categoria?.slug, cidade_principal: l.cidade_principal, imagem_capa_url: l.imagem_capa_url, foto_origem: l.foto_origem, publicado_em: l.publicado_em } as MateriaIG }))
  .filter((x) => fotoReal(x.m)).slice(0, 5);
await Deno.mkdir("previas", { recursive: true });
let i = 0;
for (const { l, m } of escolhidas) {
  const ch = chapeuDe(m, l.categoria?.nome ?? null, NOME_REGIAO[l.regiao.slug] ?? l.regiao.nome);
  const foto = await imagemComoDataUri(l.imagem_capa_url);
  if (!foto) continue;
  i++;
  const card: Card = { formato: "foto", chapeu: ch.texto, cor: ESCOPO[ch.escopo].claro, titulo: l.titulo, linhaFina: l.subtitulo, foto, credito: l.imagem_credito, tag: l.categoria?.nome ?? null, selo: i === 1 ? "ALERTA" : null };
  await Deno.writeFile(`previas/${String(i).padStart(2, "0")}${i === 1 ? "-alerta" : ""}.png`, await renderizarCard(card));
  console.log(i, l.titulo);
}
