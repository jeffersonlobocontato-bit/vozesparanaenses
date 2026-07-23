import { createServerFn } from "@tanstack/react-start";

export type SobreConfig = {
  hero_title: string;
  intro: string;
  quem_somos: string;
  missao: string;
  metodo_editorial: string;
  transparencia_ia: string;
  correcoes: string;
  email_redacao: string;
  email_comercial: string;
  founder_name: string;
};

export const DEFAULT_SOBRE: SobreConfig = {
  hero_title: "Sobre o Vozes Paranaenses",
  intro:
    "Somos um portal regional que cobre as 10 macrorregiões do Paraná (recorte IPARDES) com foco no impacto local. Cada matéria é organizada por região e por cidade principal, de forma que o leitor encontre primeiro o que acontece perto de casa.",
  quem_somos:
    "O Vozes Paranaenses foi fundado por **Jefferson Lobo**, responsável editorial pelo projeto. A formalização da empresa (razão social e CNPJ) está em andamento — atualizaremos esta seção assim que estiver concluída.",
  missao:
    "Ampliar as vozes das regiões paranaenses e garantir que informação de qualidade sobre política, economia, cultura, esporte, segurança e cotidiano chegue a quem mora nas cidades cobertas.",
  metodo_editorial:
    "Trabalhamos com o Método **DEL — Denso, Editorial, Local**. A partir da coleta de fontes públicas (portais oficiais, RSS, veículos regionais), aplicamos reescrita editorial com verificação factual pelo padrão jornalístico **5W1H** (o quê, quem, quando, onde, por quê e como). Nenhuma matéria vai ao ar sem passar por editoria humana.",
  transparencia_ia:
    "Usamos assistência de inteligência artificial para consolidar informações de múltiplas fontes públicas, extrair 5W1H e sugerir estruturas de matéria. A decisão editorial, titulação e publicação são sempre humanas.",
  correcoes:
    "Erros acontecem — e devem ser corrigidos rapidamente. Se você identificou um erro em alguma matéria, envie o link e o que deve ser corrigido para o email da redação. Toda correção material é sinalizada no próprio texto com data.",
  email_redacao: "redacao@vozesparanaenses.com.br",
  email_comercial: "comercial@vozesparanaenses.com.br",
  founder_name: "Jefferson Lobo",
};

export const getSobreConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SobreConfig> => {
    try {
      const { getExternalSupabase } = await import("./external-supabase.server");
      const sb = getExternalSupabase();
      const { data, error } = await sb
        .from("sobre_config")
        .select(
          "hero_title, intro, quem_somos, missao, metodo_editorial, transparencia_ia, correcoes, email_redacao, email_comercial, founder_name",
        )
        .eq("singleton", true)
        .maybeSingle();
      if (error || !data) return DEFAULT_SOBRE;
      return {
        hero_title: data.hero_title || DEFAULT_SOBRE.hero_title,
        intro: data.intro || DEFAULT_SOBRE.intro,
        quem_somos: data.quem_somos || DEFAULT_SOBRE.quem_somos,
        missao: data.missao || DEFAULT_SOBRE.missao,
        metodo_editorial: data.metodo_editorial || DEFAULT_SOBRE.metodo_editorial,
        transparencia_ia: data.transparencia_ia || DEFAULT_SOBRE.transparencia_ia,
        correcoes: data.correcoes || DEFAULT_SOBRE.correcoes,
        email_redacao: data.email_redacao || DEFAULT_SOBRE.email_redacao,
        email_comercial: data.email_comercial || DEFAULT_SOBRE.email_comercial,
        founder_name: data.founder_name || DEFAULT_SOBRE.founder_name,
      };
    } catch {
      return DEFAULT_SOBRE;
    }
  },
);

/** Renderiza texto simples com suporte a **negrito**, quebras `\n` (novas linhas)
 *  e parágrafos separados por linha em branco. Retorna array de nós React. */
export function renderRichText(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((para, pi) => {
    const lines = para.split(/\n/);
    return (
      <p key={pi} className="mt-3 text-base leading-relaxed text-slate-700">
        {lines.map((line, li) => (
          <span key={li}>
            {li > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>
    );
  });
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={key++}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}