// Vozes Paranaenses — instagram-publicar
//
// Roda a cada 5 min (cron da 086). Publica no máximo UM post por chamada,
// pelo Zernio, na conta @vozesparanaenses — e só se:
//   - o robô estiver ligado (instagram_config.ativo) e houver ZERNIO_API_KEY;
//   - a conta do Zernio com o código salvo existir, for Instagram e o usuário
//     for o configurado (as duas contas da mesma Meta nunca se confundem);
//   - já tiver passado o intervalo mínimo desde o último post (alerta: o
//     intervalo de alerta) e o teto do dia não tiver sido atingido;
//   - estiver dentro da janela de horário.
// Post atrasado mais de 6h vira "descartado" (notícia velha não vai ao ar).
//
// Body opcional: { post_id?: string } — publica esse post agora (botão do
// painel), respeitando ainda conta, ligado e intervalo de segurança mínimo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { exigirInterno } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ZERNIO = "https://zernio.com/api/v1";
const ATRASO_MAX_MS = 6 * 3_600_000;
const INTERVALO_MINIMO_ABSOLUTO_MIN = 15;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
const horaSP = (d: Date) => Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(d));
const inicioDoDiaSP = (d: Date) => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d)}T00:00:00-03:00`);

type Post = { id: string; tipo: string; classe: string | null; legenda: string; imagens: string[]; agendado_para: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  {
    const negado = await exigirInterno(req);
    if (negado) return negado;
  }
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL");
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
  const zernioKey = Deno.env.get("ZERNIO_API_KEY");
  if (!url || !key) return json({ error: "missing_external_supabase_env" }, 500);
  let body: { post_id?: string } = {};
  try { body = await req.json(); } catch { body = {}; }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const agora = new Date();

  const { data: cfg } = await sb.from("instagram_config").select("*").eq("id", 1).maybeSingle();
  if (!cfg) return json({ ok: true, parado: "sem_config" });
  if (!cfg.ativo) return json({ ok: true, parado: "robo_desligado" });
  if (!zernioKey) return json({ ok: true, parado: "sem_ZERNIO_API_KEY" });
  if (!cfg.zernio_account_id) return json({ ok: true, parado: "sem_conta_zernio" });

  const manual = !!body.post_id;
  const hora = horaSP(agora);
  if (!manual && (hora < cfg.janela_inicio || hora >= cfg.janela_fim)) return json({ ok: true, parado: "fora_da_janela" });

  // Descarta o que ficou velho na fila.
  await sb.from("instagram_posts").update({ status: "descartado", motivo: "atrasou mais de 6h", atualizado_em: agora.toISOString() })
    .eq("status", "agendado").lt("agendado_para", new Date(agora.getTime() - ATRASO_MAX_MS).toISOString());

  // Post travado em "publicando" há mais de 20 min: volta para a fila uma vez.
  await sb.from("instagram_posts").update({ status: "erro", erro: "ficou em publicando sem resposta", atualizado_em: agora.toISOString() })
    .eq("status", "publicando").lt("atualizado_em", new Date(agora.getTime() - 20 * 60_000).toISOString());

  // Próximo post.
  let q = sb.from("instagram_posts").select("id, tipo, classe, legenda, imagens, agendado_para").eq("status", "agendado");
  q = manual ? q.eq("id", body.post_id!) : q.lte("agendado_para", agora.toISOString());
  const { data: fila } = await q.order("agendado_para", { ascending: true }).limit(5);
  const candidatos = (fila ?? []) as Post[];
  // Alerta vencido passa à frente.
  const post = candidatos.find((p) => p.classe === "alerta") ?? candidatos[0];
  if (!post) return json({ ok: true, parado: manual ? "post_nao_esta_agendado" : "nada_vencido" });
  if (!post.imagens?.length) {
    await sb.from("instagram_posts").update({ status: "erro", erro: "sem imagens", atualizado_em: agora.toISOString() }).eq("id", post.id);
    return json({ ok: false, erro: "sem_imagens", post: post.id });
  }

  // Intervalo e teto, contando o que já foi ao ar.
  const { data: ult } = await sb.from("instagram_posts").select("publicado_em").in("status", ["publicado", "publicando"])
    .not("publicado_em", "is", null).order("publicado_em", { ascending: false }).limit(1).maybeSingle();
  const alerta = post.classe === "alerta";
  if (ult?.publicado_em) {
    const passou = (agora.getTime() - new Date(ult.publicado_em).getTime()) / 60_000;
    const exigido = manual ? INTERVALO_MINIMO_ABSOLUTO_MIN : alerta ? cfg.intervalo_alerta_min : cfg.intervalo_min;
    if (passou < exigido) return json({ ok: true, parado: "intervalo", faltam_min: Math.ceil(exigido - passou) });
  }
  const { count: hoje } = await sb.from("instagram_posts").select("id", { count: "exact", head: true })
    .eq("status", "publicado").gte("publicado_em", inicioDoDiaSP(agora).toISOString());
  if (!alerta && (hoje ?? 0) >= cfg.teto_dia) return json({ ok: true, parado: "teto_do_dia", hoje });

  // Confere a conta antes de cada post.
  const auth = { Authorization: `Bearer ${zernioKey}` };
  const contas = await fetch(`${ZERNIO}/accounts`, { headers: auth }).then((r) => r.ok ? r.json() : null).catch(() => null);
  const lista = (contas?.accounts ?? []) as Array<{ _id: string; platform: string; username?: string; isActive?: boolean }>;
  const conta = lista.find((a) => a._id === cfg.zernio_account_id);
  const usuario = (conta?.username ?? "").replace(/^@/, "").toLowerCase();
  if (!conta || conta.platform !== "instagram" || usuario !== String(cfg.zernio_username).toLowerCase()) {
    return json({ ok: false, parado: "conta_nao_confere", esperado: cfg.zernio_username, achado: conta ? `${conta.platform}:${usuario}` : null }, 409);
  }

  // Reserva o post (evita duas chamadas publicarem o mesmo).
  const { data: reservado } = await sb.from("instagram_posts")
    .update({ status: "publicando", publicado_em: agora.toISOString(), atualizado_em: agora.toISOString() })
    .eq("id", post.id).eq("status", "agendado").select("id").maybeSingle();
  if (!reservado) return json({ ok: true, parado: "ja_reservado" });

  const res = await fetch(`${ZERNIO}/posts`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json", "Idempotency-Key": `vozes-ig-${post.id}` },
    body: JSON.stringify({
      content: post.legenda,
      mediaItems: post.imagens.slice(0, 10).map((u) => ({ url: u, type: "image" })),
      platforms: [{ platform: "instagram", accountId: cfg.zernio_account_id }],
      publishNow: true,
    }),
  }).catch((e) => e as Error);

  if (res instanceof Error || !res.ok) {
    const status = res instanceof Error ? 0 : res.status;
    const detalhe = res instanceof Error ? res.message : (await res.text()).slice(0, 500);
    if (status === 429) {
      // Limite de velocidade: volta para a fila 15 min depois.
      await sb.from("instagram_posts").update({
        status: "agendado", publicado_em: null, agendado_para: new Date(agora.getTime() + 15 * 60_000).toISOString(),
        erro: `429: ${detalhe}`, atualizado_em: new Date().toISOString(),
      }).eq("id", post.id);
      return json({ ok: false, reagendado: post.id, motivo: "429" });
    }
    await sb.from("instagram_posts").update({ status: "erro", publicado_em: null, erro: `${status}: ${detalhe}`, atualizado_em: new Date().toISOString() }).eq("id", post.id);
    return json({ ok: false, erro: status, post: post.id, detalhe }, 502);
  }

  const j = await res.json().catch(() => ({}));
  const zid = j?.post?._id ?? j?._id ?? j?.id ?? null;
  await sb.from("instagram_posts").update({ status: "publicado", zernio_post_id: zid, erro: null, atualizado_em: new Date().toISOString() }).eq("id", post.id);
  return json({ ok: true, publicado: post.id, zernio_post_id: zid, tipo: post.tipo });
});
