import type { getExternalBrowser } from "@/lib/external-supabase-browser";

// Tipos e utilitários compartilhados pelas abas de /admin/anuncios.
// Tudo aqui fala com o banco EXTERNO (getExternalBrowser).

export type Sb = Awaited<ReturnType<typeof getExternalBrowser>>;

export type Advertiser = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  regiao_slug: string | null;
  ativo: boolean;
};

export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "encerrada";

export type Campaign = {
  id: string;
  advertiser_id: string;
  nome: string;
  status: CampaignStatus;
  data_inicio: string;
  data_fim: string;
  editorias: string[];
  observacoes: string | null;
};

export type Creative = {
  id: string;
  campaign_id: string;
  imagem_url: string;
  imagem_storage_path: string | null;
  headline: string;
  cta_texto: string;
  destino_url: string;
  peso: number;
  aprovado: boolean;
  formato: string | null;
  slot: string | null;
  variante: string | null;
};

export type Target = {
  id: string;
  campaign_id: string;
  escopo: "cidade" | "regiao" | "estado";
  valor: string;
  regiao_slug: string | null;
  cap_impressoes_dia: number;
};

/** Mensagem de retorno das abas para o topo da página. */
export type Toast = (mensagem: string) => void;

export const ROTULO_STATUS_CAMPANHA: Record<CampaignStatus, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

/**
 * Slugs de editoria usados quando `editorial_categories` não pode ser lida.
 * Precisam bater com a tabela: o servidor de anúncios compara o slug da
 * página com `ad_campaigns.editorias`, e um slug errado (ex.: "esporte" em
 * vez de "esportes") faz o anúncio nunca aparecer.
 */
export const EDITORIAS_PADRAO: { slug: string; nome: string }[] = [
  { slug: "agro", nome: "Agronegócio" },
  { slug: "cidades", nome: "Cidades" },
  { slug: "cultura", nome: "Cultura" },
  { slug: "economia", nome: "Economia" },
  { slug: "educacao", nome: "Educação" },
  { slug: "eleicoes-2026", nome: "Eleições 2026" },
  { slug: "esportes", nome: "Esportes" },
  { slug: "internacional", nome: "Internacional" },
  { slug: "meio-ambiente", nome: "Meio Ambiente" },
  { slug: "nacional", nome: "Nacional" },
  { slug: "politica", nome: "Política" },
  { slug: "saude", nome: "Saúde" },
  { slug: "seguranca", nome: "Segurança" },
  { slug: "tecnologia", nome: "Tecnologia" },
];

export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function listaDeSlugs(texto: string): string[] {
  return texto.split(",").map((s) => s.trim()).filter(Boolean);
}

export function dataBR(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

// Tabelas das abas: mesmo visual em todas.
export const tabelaClass = "w-full text-sm";
export const theadClass = "border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500";
export const thClass = "px-4 py-2 font-semibold";
export const trClass = "border-t border-slate-100 align-top";
export const tdClass = "px-4 py-2";
