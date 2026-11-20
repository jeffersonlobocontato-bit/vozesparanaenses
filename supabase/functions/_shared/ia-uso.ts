import { AsyncLocalStorage } from "node:async_hooks";
import { criarChamarIA, type ContextoIA, type PrecoIA, type RegistroIA } from "./ia-uso-core.ts";

const contexto = new AsyncLocalStorage<ContextoIA>();
const cache = new Map<string, { ate: number; preco: PrecoIA | null }>();
function credenciais() {
  return { url: Deno.env.get("EXTERNAL_SUPABASE_URL"), key: Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") };
}
async function preco(modelo: string): Promise<PrecoIA | null> {
  const anterior = cache.get(modelo);
  if (anterior && anterior.ate > Date.now()) return anterior.preco;
  const { url, key } = credenciais();
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/ia_precos?modelo=eq.${encodeURIComponent(modelo)}&select=*`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const rows = await res.json();
  const valor = rows[0] ?? null;
  cache.set(modelo, { ate: Date.now() + 60000, preco: valor });
  return valor;
}
async function gravar(linha: RegistroIA) {
  const { url, key } = credenciais();
  if (!url || !key) throw new Error("missing_external_config");
  const res = await fetch(`${url}/rest/v1/ia_uso`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(linha) });
  if (!res.ok) throw new Error("usage_write_failed");
}
// Pausa por limite de créditos: guardada no banco externo (vale para todas as funções e
// sobrevive a reinícios) e em memória. Expira em 30 min — a próxima rodada agendada faz
// uma única chamada de teste; se o limite continuar, pausa de novo.
const PAUSA_MS = 30 * 60 * 1000;
let pausaMemoria: { ate: number; motivo: string } | null = null;
let pausaLidaEm = 0;
async function pausado(): Promise<string | null> {
  if (pausaMemoria && pausaMemoria.ate > Date.now()) return pausaMemoria.motivo;
  if (Date.now() - pausaLidaEm < 15000) return null;
  pausaLidaEm = Date.now();
  const { url, key } = credenciais();
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/ia_pausa?id=eq.1&select=ate,motivo`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) { await res.body?.cancel(); return null; }
  const row = (await res.json())[0];
  if (row?.ate && Date.parse(row.ate) > Date.now()) { pausaMemoria = { ate: Date.parse(row.ate), motivo: row.motivo }; return row.motivo; }
  return null;
}
async function pausar(motivo: string) {
  const ate = Date.now() + PAUSA_MS;
  pausaMemoria = { ate, motivo };
  console.warn(`[ia] pausada até ${new Date(ate).toISOString()}: ${motivo}`);
  const { url, key } = credenciais();
  if (!url || !key) return;
  const res = await fetch(`${url}/rest/v1/ia_pausa?on_conflict=id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, ate: new Date(ate).toISOString(), motivo, desde: new Date().toISOString() }) });
  await res.body?.cancel();
}
export const chamarIA = criarChamarIA({ contexto: () => contexto.getStore() ?? { funcao: "outro" }, preco, gravar, pausado, pausar });
export function identificarIA(ids: Partial<ContextoIA>) { const atual = contexto.getStore(); if (atual) Object.assign(atual, ids); }
export function noContextoIA<T>(ids: Partial<ContextoIA>, tarefa: () => T): T {
  return contexto.run({ ...(contexto.getStore() ?? { funcao: "outro" }), ...ids }, tarefa);
}
export function comContextoIA(funcao: string, handler: (req: Request) => Response | Promise<Response>) {
  return (req: Request) => contexto.run({ funcao }, async () => {
    if (req.method === "POST" && req.headers.get("content-type")?.includes("application/json")) {
      try { const p = await req.clone().json(); identificarIA({ cluster_id: p.cluster_id ?? null, artigo_id: p.article_id ?? p.artigo_id ?? null }); } catch { /* original handler validates */ }
    }
    return handler(req);
  });
}