import { calcularCustoIA, criarChamarIA, type RegistroIA } from "./ia-uso-core.ts";
import { comContextoIA, noContextoIA, chamarIA as chamarComContexto } from "./ia-uso.ts";
import { totalizarIA } from "../../../src/lib/ia-custos.ts";
function assert(ok: boolean, nome: string) { if (!ok) throw new Error(nome); console.log("OK", nome); }
function igual(a: unknown, b: unknown, nome: string) { assert(JSON.stringify(a) === JSON.stringify(b), `${nome}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
const preco = { usd_por_milhao_entrada: 0.30, usd_por_milhao_saida: 2.50, usd_por_imagem: 0.039 };
igual(calcularCustoIA(preco, { prompt_tokens: 1000, completion_tokens: 200 }, 0), 0.0008, "Preço concreto de Flash");
igual(calcularCustoIA(preco, null, 0), null, "Uso ausente não é zero");
igual(calcularCustoIA(null, { prompt_tokens: 1000, completion_tokens: 200 }, 0), null, "Modelo sem preço não é zero");
igual(calcularCustoIA(preco, { prompt_tokens: 100, completion_tokens: 1290 }, 1), 0.03903, "Imagem não é cobrada duas vezes");
igual(calcularCustoIA({ ...preco, usd_por_milhao_entrada: 0.02 }, { total_tokens: 1000 }, 0), 0.00002, "Embedding usa total_tokens");
const periodo = { inicio: "2026-11-10", fim: "2026-11-17", materias_publicadas: 2, etapas: [{ etapa: "redacao", chamadas: 3, tokens: 1200, custo_usd: 1, custo_brl: 5.5, chamadas_sem_custo: 1, falhas: 1 }] };
igual(totalizarIA(periodo).porMateria, 2.75, "Custo agregado dividido pelo total publicado");
igual(totalizarIA({ ...periodo, materias_publicadas: 0 }).porMateria, null, "Sem matéria publicada não divide por zero");
igual(totalizarIA({ ...periodo, etapas: [] }).custo, null, "Período sem medição não custa zero");
const rows: RegistroIA[] = [];
const body = JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: "TEXTO_PRIVADO" }], temperature: 0.15, max_tokens: 2600 });
const init = { method: "POST", body };
const payload = { usage: { prompt_tokens: 1000, completion_tokens: 200 }, choices: [{ message: { content: "RESPOSTA_PRIVADA" } }] };
const chamar = criarChamarIA({ contexto: () => ({ funcao: "generate-article", cluster_id: "cluster-1" }), preco: async () => preco, gravar: async r => { rows.push(r); }, fetch: async (_u, request) => { igual(request, init, "Mesmo prompt, modelo e parâmetros"); return Response.json(payload); } });
const res = await chamar("redacao", "https://gateway.invalid", init);
igual(await res.json(), payload, "Resposta original preservada");
igual(rows.length, 1, "Uma linha por chamada");
igual(rows[0].etapa, "redacao", "Etapa registrada");
igual(rows[0].funcao, "generate-article", "Nome da função registrado");
igual(rows[0].cluster_id, "cluster-1", "Agrupamento registrado");
igual(rows[0].custo_usd, 0.0008, "Custo persistido");
assert(!JSON.stringify(rows).includes("PRIVAD"), "Não persiste prompt nem resposta");
const failed = criarChamarIA({ contexto: () => ({ funcao: "crivo" }), preco: async () => preco, gravar: async r => { rows.push(r); }, fetch: async () => new Response("ERRO_PRIVADO", { status: 403 }) });
const denied = await failed("crivo", "https://gateway.invalid", init);
igual(denied.status, 403, "Status de permissão preservado");
igual(await denied.text(), "ERRO_PRIVADO", "Erro original preservado para o chamador");
igual(rows.length, 2, "Erro HTTP registrado uma vez");
igual(rows[1].sucesso, false, "Falha registrada");
igual(rows[1].erro, "http_403", "Só código seguro de erro");
igual(rows[1].custo_usd, null, "Falha sem uso é desconhecida");
const network = criarChamarIA({ contexto: () => ({ funcao: "chat" }), preco: async () => preco, gravar: async r => { rows.push(r); }, fetch: async () => { throw new TypeError("SEGREDO_PRIVADO"); } });
try { await network("chat", "https://gateway.invalid", init); } catch { /* expected original exception */ }
igual(rows[2].erro, "TypeError", "Erro de rede sem vazar mensagem");
const unavailable = criarChamarIA({ contexto: () => ({ funcao: "chat" }), preco: async () => { throw new Error("offline"); }, gravar: async () => {}, fetch: async () => Response.json(payload) });
igual(await (await unavailable("chat", "https://gateway.invalid", init)).json(), payload, "Medição indisponível não muda a publicação");
const comUsoNaFalha = criarChamarIA({ contexto: () => ({ funcao: "crivo" }), preco: async () => preco, gravar: async r => { rows.push(r); }, fetch: async () => Response.json(payload, { status: 500 }) });
await comUsoNaFalha("crivo", "https://gateway.invalid", init);
igual(rows[3].custo_usd, 0.0008, "Falha HTTP com tokens é contabilizada mesmo sem ler a resposta");

// Concurrent request context and real REST serialization, with network replaced locally.
const originalFetch = globalThis.fetch;
const originalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
const originalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
Deno.env.set("EXTERNAL_SUPABASE_URL", "https://content.invalid");
Deno.env.set("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY", "test-only");
const contextRows: RegistroIA[] = [];
globalThis.fetch = async (url, init) => {
  const path = String(url);
  if (path.includes("/ia_precos?")) return Response.json([preco]);
  if (path.endsWith("/ia_uso")) { contextRows.push(JSON.parse(String(init?.body))); return new Response(null, { status: 201 }); }
  await new Promise(resolve => setTimeout(resolve, 10));
  return Response.json(payload);
};
try {
  const handler = (nome: string, cluster: string) => comContextoIA(nome, async () => noContextoIA({ cluster_id: cluster }, async () => {
    const r = await chamarComContexto("crivo", "https://gateway.invalid", init); await r.json(); return Response.json({ ok: true });
  }));
  await Promise.all([handler("funcao-a", "cluster-a")(new Request("https://app.invalid")), handler("funcao-b", "cluster-b")(new Request("https://app.invalid"))]);
  igual(contextRows.length, 2, "Duas chamadas concorrentes registradas");
  assert(contextRows.some(r => r.funcao === "funcao-a" && r.cluster_id === "cluster-a"), "Contexto A isolado");
  assert(contextRows.some(r => r.funcao === "funcao-b" && r.cluster_id === "cluster-b"), "Contexto B isolado");
  assert(!JSON.stringify(contextRows).includes("PRIVAD"), "REST não recebe prompt ou resposta");
} finally {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) Deno.env.delete("EXTERNAL_SUPABASE_URL"); else Deno.env.set("EXTERNAL_SUPABASE_URL", originalUrl);
  if (originalKey === undefined) Deno.env.delete("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY"); else Deno.env.set("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY", originalKey);
}