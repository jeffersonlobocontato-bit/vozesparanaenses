// Prévia leve para WhatsApp/Facebook/Telegram (og:image).
//
// O WhatsApp ignora a imagem de prévia quando ela passa de ~300 KB e mostra
// o ícone do site no lugar (caso de 30/10/2026: capa PNG de 3 MB em Ponta
// Grossa saía com o "VP"). A capa original continua em alta no site; aqui
// sai uma cópia JPEG de até 1200 px de largura e ~150 KB em
// article-covers/{id}/previa.jpg, que vira o og_image_url da matéria.

export const LIMITE_PREVIA = 280 * 1024;

// deno-lint-ignore no-explicit-any
type Sb = any;

/** Já é a prévia leve? */
export const ehPreviaLeve = (url: string | null | undefined) => /\/previa\.jpg(\?|$)/.test(url ?? "");

/**
 * Garante que o og_image_url da matéria seja leve. Baixa a imagem; se for
 * JPEG até o limite, deixa como está. Senão reduz, grava a prévia e
 * atualiza o og_image_url. Nunca lança erro (prévia não trava publicação).
 */
export async function garantirPreviaLeve(sb: Sb, articleId: string, url: string | null | undefined): Promise<string | null> {
  if (!url || ehPreviaLeve(url)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "VozesParanaensesBot/1.0" } });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength <= LIMITE_PREVIA && /jpe?g/i.test(tipo)) return null;
    const { decode, Image } = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");
    const img = await decode(buf);
    if (!(img instanceof Image)) return null;
    if (img.width > 1200) img.resize(1200, Image.RESIZE_AUTO);
    let out = await img.encodeJPEG(78);
    if (out.byteLength > LIMITE_PREVIA) out = await img.encodeJPEG(62);
    const caminho = `${articleId}/previa.jpg`;
    const { error } = await sb.storage.from("article-covers").upload(caminho, out, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) return null;
    const pub = sb.storage.from("article-covers").getPublicUrl(caminho).data.publicUrl as string;
    await sb.from("generated_articles").update({ og_image_url: pub }).eq("id", articleId);
    return pub;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
