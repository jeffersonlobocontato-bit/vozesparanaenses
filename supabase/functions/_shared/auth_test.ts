import { exigirEquipe, exigirInterno, exigirServicoOuEquipe } from "./auth.ts";
function check(nome: string, cond: boolean) { if (!cond) throw new Error("FALHOU: " + nome); console.log("ok:", nome); }
const req = (h: Record<string, string> = {}) => new Request("https://x/f", { method: "POST", headers: h });

Deno.env.delete("CRON_SECRET");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "chave-servico-lovable");
check("equipe: sem token → 401", (await exigirEquipe(req()))?.status === 401);
check("interno sem CRON_SECRET (transição): passa", (await exigirInterno(req())) === null);
check("serviço: service role passa", (await exigirServicoOuEquipe(req({ authorization: "Bearer chave-servico-lovable" }))) === null);
check("serviço: sem token → 401", (await exigirServicoOuEquipe(req()))?.status === 401);

Deno.env.set("CRON_SECRET", "segredo-de-teste-com-mais-de-24-chars");
check("interno: segredo certo passa", (await exigirInterno(req({ "x-cron-secret": "segredo-de-teste-com-mais-de-24-chars" }))) === null);
check("interno: segredo errado → 401", (await exigirInterno(req({ "x-cron-secret": "errado" })))?.status === 401);
check("interno: sem nada → 401", (await exigirInterno(req()))?.status === 401);
check("interno: service role passa", (await exigirInterno(req({ authorization: "Bearer chave-servico-lovable" }))) === null);
