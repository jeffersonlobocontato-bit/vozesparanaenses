// Cópia, para a tela de cadastro, dos textos de
// supabase/functions/_shared/imprensa-termos.ts (a versão gravada no
// cadastro é a do servidor) — mantenha as duas iguais.

export const NOTA_LGPD =
  "Em cumprimento à Lei Geral de Proteção de Dados (Lei nº 13.709/2018), o Vozes Paranaenses coleta seu nome completo, CPF, função, e-mail e a prefeitura que você representa com a finalidade exclusiva de confirmar sua identidade e sua condição de responsável pela comunicação do órgão público, liberar seu acesso ao Portal da Imprensa e identificar a autoria das publicações (base legal: execução de contrato e cumprimento de obrigação legal, art. 7º, II e V). Seus dados não são vendidos nem compartilhados com terceiros, ficam acessíveis apenas à equipe que aprova os cadastros e são guardados enquanto seu acesso estiver ativo e pelo prazo exigido em lei. O CPF nunca é exibido publicamente. Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail contato@vozesparanaenses.com.br.";

export const TERMO_CADASTRO =
  "Declaro, sob as penas da lei, que as informações deste cadastro são verdadeiras e que sou responsável legal pela comunicação/assessoria de imprensa da prefeitura indicada, com autorização para divulgar conteúdo em nome dela. Assumo, de forma pessoal, integral responsabilidade civil e criminal pelo conteúdo que eu publicar pelo Portal da Imprensa — sua veracidade, exatidão e legalidade — nos termos dos arts. 186 e 927 do Código Civil e dos arts. 138 a 140 e 299 do Código Penal. Estou ciente de que o Vozes Paranaenses atua como provedor de aplicação (art. 19 da Lei nº 12.965/2014), de que meu acesso só é liberado após a aprovação do cadastro e de que conteúdo ilegal ou em desacordo com estes termos pode ser removido e o acesso, suspenso.";

export const FUNCOES = [
  "Secretário(a) de Comunicação",
  "Diretor(a) de Comunicação",
  "Coordenador(a) de Comunicação",
  "Supervisor(a) de Comunicação",
  "Assessor(a) de Imprensa",
] as const;

/** CPF válido (dígitos verificadores). Aceita com ou sem máscara. */
export function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const t of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(d[i]) * (t + 1 - i);
    const dv = ((soma * 10) % 11) % 10;
    if (dv !== Number(d[t])) return false;
  }
  return true;
}
