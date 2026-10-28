// Prévia/produção manual dos cards do Instagram com matérias reais (GitHub Actions):
// deno run -A scripts/previa-cards.ts → previas/*.png. Não publica nada.
import { renderizarCard, imagemComoDataUri } from "../supabase/functions/_shared/instagram-render.ts";
import { chapeuDe, type MateriaIG } from "../supabase/functions/_shared/instagram-selecao.ts";
import { ESCOPO, NOME_REGIAO, type Card } from "../supabase/functions/_shared/instagram-cards.ts";

const URL = "https://flcgtpzfnsrxawvyzzgh.supabase.co/rest/v1/generated_articles";
const KEY = "sb_publishable_fMVraOMiN5QsfLcdVmjLTA_VfukX2cx";
// id da matéria → título do card (curto, fiel ao texto)
const PEDIDO: Array<[string, string]> = [
  ["ffb426cc-8a9c-4760-9e44-35110bee4536", "Havan inaugura no sábado terceira megaloja de Londrina"],
  ["e80b1a50-0308-42f0-a452-7bbbb8975007", "Ônibus intermunicipais não circulam no feriado de Finados"],
  ["2589a526-f30f-4ba9-aff1-0354e0aaba3d", "35ª Münchenfest é adiada e ingressos serão devolvidos"],
];
const sel = "id,titulo,subtitulo,cidade_principal,imagem_capa_url,imagem_credito,foto_origem,publicado_em,regiao:regioes(slug,nome),categoria:editorial_categories(slug,nome)";
await Deno.mkdir("previas", { recursive: true });
let i = 0;
for (const [id, titulo] of PEDIDO) {
  const r = await fetch(`${URL}?select=${sel}&id=eq.${id}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  const l = ((await r.json()) as any[])[0];
  if (!l) { console.log("não achou", id); continue; }
  const m = { id: l.id, titulo: l.titulo, regiao_slug: l.regiao?.slug, categoria_slug: l.categoria?.slug, cidade_principal: l.cidade_principal, imagem_capa_url: l.imagem_capa_url, foto_origem: l.foto_origem, publicado_em: l.publicado_em } as MateriaIG;
  const ch = chapeuDe(m, l.categoria?.nome ?? null, NOME_REGIAO[l.regiao.slug] ?? l.regiao.nome);
  const foto = await imagemComoDataUri(l.imagem_capa_url);
  if (!foto) { console.log("sem foto", id); continue; }
  i++;
  const card: Card = { formato: "foto", chapeu: ch.texto, cor: ESCOPO[ch.escopo].claro, titulo, linhaFina: null, foto, credito: l.imagem_credito, tag: l.categoria?.nome ?? null, selo: null };
  await Deno.writeFile(`previas/post-${i}.png`, await renderizarCard(card));
  console.log(i, ch.texto, "|", titulo);
}
