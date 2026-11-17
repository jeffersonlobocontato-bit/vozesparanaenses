import { criarChamarIA } from "../../supabase/functions/_shared/ia-uso-core";
import { getExternalServiceRole } from "./external-supabase.server";

export function criarChamarIAServidor(funcao: string) {
  return criarChamarIA({
    contexto: () => ({ funcao }),
    preco: async (modelo) => {
      const { data, error } = await getExternalServiceRole().from("ia_precos").select("*").eq("modelo", modelo).maybeSingle();
      return error ? null : data;
    },
    gravar: async (linha) => {
      const { error } = await getExternalServiceRole().from("ia_uso").insert(linha);
      if (error) throw new Error("usage_write_failed");
    },
  });
}