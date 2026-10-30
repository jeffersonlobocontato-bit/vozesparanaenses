import { createServerFn } from "@tanstack/react-start";
import { ABAS, corpoDoRelatorio, relatoriosDaAba, type Aba } from "./ga4-relatorios";
import type { LinhaGA } from "./ga4.server";

// Painel /admin/analytics: busca no GA4 os relatórios de uma aba.
// Só para a equipe (admin, editor ou consulta): o navegador manda o token da
// sessão do painel e o servidor confere o papel no banco externo antes de
// usar a credencial do GA4. Resultado em cache por 10 min (tempo real: 45 s)
// — a cota da API de Dados é por propriedade/hora.

export type RespostaAba = {
  configurado: boolean;
  aba: Aba;
  dias: number;
  geradoEm: string;
  relatorios: Record<string, LinhaGA[]>;
  erros: Record<string, string>;
  motivo?: string;
};

const cache = new Map<string, { ate: number; valor: Promise<RespostaAba> }>();

async function papelDaEquipe(token: string): Promise<string | null> {
  if (!token) return null;
  const { getExternalServiceRole } = await import("./external-supabase.server");
  const sb = getExternalServiceRole();
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u?.user) return null;
  const { data } = await sb.from("user_roles").select("role").eq("user_id", u.user.id).in("role", ["admin", "editor", "viewer"]).limit(1);
  return (data?.[0] as { role?: string } | undefined)?.role ?? null;
}

async function montar(aba: Aba, dias: number): Promise<RespostaAba> {
  const { ga4Configurado, ga4Relatorio, ga4TempoReal } = await import("./ga4.server");
  const base = { aba, dias, geradoEm: new Date().toISOString(), relatorios: {}, erros: {} };
  if (!ga4Configurado()) {
    return { ...base, configurado: false, motivo: "Falta o secret GA4_SERVICE_ACCOUNT_JSON (conta de serviço com acesso de leitor ao GA4)." };
  }
  const relatorios: Record<string, LinhaGA[]> = {};
  const erros: Record<string, string> = {};
  // Um relatório por chamada: se um falhar (dimensão nova ainda sem dado,
  // por exemplo), os outros da aba aparecem normalmente.
  await Promise.all(relatoriosDaAba(aba).map(async (r) => {
    try {
      const corpo = corpoDoRelatorio(r, dias);
      relatorios[r.nome] = r.tempoReal ? await ga4TempoReal(corpo) : await ga4Relatorio(corpo);
    } catch (e) {
      erros[r.nome] = e instanceof Error ? e.message : String(e);
      relatorios[r.nome] = [];
    }
  }));
  return { ...base, configurado: true, relatorios, erros };
}

export const relatorioAnalytics = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; aba: string; dias: number; atualizar?: boolean }) => {
    const aba = (ABAS.some((a) => a.id === d.aba) ? d.aba : "visao") as Aba;
    const dias = [1, 7, 28, 90].includes(Number(d.dias)) ? Number(d.dias) : 28;
    return { token: String(d.token ?? ""), aba, dias, atualizar: !!d.atualizar };
  })
  .handler(async ({ data }): Promise<RespostaAba> => {
    const papel = await papelDaEquipe(data.token);
    if (!papel) throw new Error("Acesso só para a equipe do painel.");
    const chave = `${data.aba}:${data.dias}`;
    const agora = Date.now();
    const hit = cache.get(chave);
    if (hit && hit.ate > agora && !data.atualizar) return hit.valor;
    const valor = montar(data.aba, data.dias).catch((e) => { cache.delete(chave); throw e; });
    cache.set(chave, { ate: agora + (data.aba === "tempo-real" ? 45_000 : 600_000), valor });
    return valor;
  });
