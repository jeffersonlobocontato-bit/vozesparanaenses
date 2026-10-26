// Roteiro visual do vídeo-pitch: cada cena começa na frase-âncora da locução
// (resolvida pelas legendas) e vai até a próxima. Capturas reais em public/telas/.
import type { PropsCartoes, PropsNumeros, PropsPipeline, PropsTela, PropsTitulo } from "./cenas";

export type Cena =
  | { ancora: string; tipo: "titulo"; p: PropsTitulo }
  | { ancora: string; tipo: "tela"; p: PropsTela }
  | { ancora: string; tipo: "cartoes"; p: PropsCartoes }
  | { ancora: string; tipo: "pipeline"; p: Omit<PropsPipeline, "quadros"> & { de: number; ate: number } }
  | { ancora: string; tipo: "numeros"; p: PropsNumeros }
  | { ancora: string; tipo: "reels"; p: { pill: string; titulo: string[]; video: string } }
  | { ancora: string; tipo: "pergunta"; p: { linhas: string[] } };

const T = (n: string) => `telas/${n}.jpg`;
// Cards do palco 1920×1080 do Pipeline ao vivo (x, y, largura, altura)
const CARD = {
  inteiro: [0, 0, 1920, 1080],
  coleta: [20, 205, 380, 400], crivo: [380, 205, 380, 400], apuracao: [740, 205, 380, 400], redacao: [1100, 205, 380, 400],
  criticidade: [20, 560, 380, 400], imagem: [380, 560, 380, 400], publicacao: [740, 560, 380, 400], redes: [1100, 560, 380, 400],
  ciclo: [0, 90, 1100, 620], alertas: [1440, 300, 480, 560], horas: [1440, 200, 480, 270],
} as const;
const R = (k: keyof typeof CARD) => [...CARD[k]] as [number, number, number, number];
const ajusta = (r: [number, number, number, number]): [number, number, number, number] => {
  // mantém 16:9 centrado no card
  const [x, y, w, h] = r; const alvoH = (w * 9) / 16;
  if (alvoH >= h) return [x, Math.max(0, y + h / 2 - alvoH / 2), w, alvoH];
  const alvoW = (h * 16) / 9; return [Math.max(0, x + w / 2 - alvoW / 2), y, alvoW, h];
};

export const ROTEIRO: Cena[] = [
  // ---- 0 · o problema e a promessa
  { ancora: "Todo dia, o Paraná produz", tipo: "titulo", p: { pill: "O portal das 399 cidades", linhas: [{ t: "Centenas de notícias." }, { t: "399 cidades." }, { t: "Todo dia.", apagada: true }] } },
  { ancora: "Nenhuma redação tradicional", tipo: "tela", p: { img: T("pub-home"), url: "vozesparanaenses.com.br", imgAltura: 6000, de: 0, ate: 2600, cheia: true } },
  { ancora: "O Vozes Paranaenses dá", tipo: "titulo", p: { numero: { valor: "2 h", rotulo: "de atenção humana por dia" }, linhas: [{ t: "O Vozes Paranaenses dá conta.", apagada: true }], tamanho: 72 } },
  // ---- 1 · o ciclo automático
  { ancora: "Funciona assim", tipo: "tela", p: { img: T("adm-fontes"), url: "…/admin/fontes", imgAltura: 3626, de: 0, ate: 1400, pill: "Coleta", titulo: ["236 fontes hoje.", "Quantas a empresa quiser."] } },
  { ancora: "Elas são lidas em horários", tipo: "tela", p: { img: T("adm-painel"), url: "…/admin/painel", imgAltura: 1912, de: 250, ate: 420, zoom: [1, 1.15], foco: [0.5, 0.3], pill: "Horários por frente", titulo: ["Cada frente", "no ritmo de", "quem publica."] } },
  { ancora: "A plataforma junta o mesmo fato", tipo: "pipeline", p: { de: 0.35, ate: 0.45, zooms: [{ aos: 0, rect: ajusta(R("crivo")), rotulo: "Deduplicação e crivo" }] } },
  { ancora: "aplica cotas por região", tipo: "tela", p: { img: T("adm-regioes-cotas"), url: "…/admin/regioes", imgAltura: 1080, de: 0, ate: 0, zoom: [1, 1.1], pill: "Cotas", titulo: ["Cota por região", "e editoria."] } },
  { ancora: "e apura o quê", tipo: "pipeline", p: { de: 0.45, ate: 0.55, zooms: [{ aos: 0, rect: ajusta(R("apuracao")), rotulo: "Apuração 5W1H" }] } },
  { ancora: "Só pauta completa vira matéria", tipo: "tela", p: { img: T("pub-materia"), url: "vozesparanaenses.com.br/oeste/…", imgAltura: 5352, de: 0, ate: 3000, cheia: true } },
  // ---- 2 · modelo editorial, DEL e risco
  { ancora: "Quem escreve são agentes", tipo: "tela", p: { img: T("adm-agentes"), url: "…/admin/agentes", imgAltura: 1152, de: 0, ate: 72, pill: "Método DEL", titulo: ["Um redator", "por editoria."] } },
  { ancora: "Antes de publicar, um agente de criticidade", tipo: "pipeline", p: { de: 0.55, ate: 0.65, zooms: [{ aos: 0, rect: ajusta(R("criticidade")), rotulo: "Criticidade" }] } },
  { ancora: "Dois terços saem direto", tipo: "tela", p: { img: T("adm-materias"), url: "…/admin", imgAltura: 4000, de: 0, ate: 600, pill: "Fila do editor", titulo: ["Dois terços", "publicam direto."] } },
  // ---- 3 · customização
  { ancora: "E nada disso é fixo", tipo: "titulo", p: { pill: "Customização", linhas: [{ t: "Nada disso é fixo." }, { t: "Cada empresa, suas regras.", apagada: true }] } },
  { ancora: "Fontes, cotas, horários", tipo: "tela", p: { img: T("adm-memoria"), url: "…/admin/memoria-editorial", imgAltura: 1080, de: 0, ate: 0, zoom: [1, 1.08], pill: "Políticas e guardrails", titulo: ["Tom de voz,", "limites de risco,", "compliance."] } },
  { ancora: "Software virou commodity", tipo: "titulo", p: { linhas: [{ t: "Software virou commodity." }, { t: "O valor está na customização.", apagada: true }], tamanho: 96 } },
  // ---- 4 · Portal da Imprensa
  { ancora: "Para as prefeituras, criamos", tipo: "tela", p: { img: T("pub-cidadesdoparana"), url: "vozesparanaenses.com.br/cidadesdoparana", imgAltura: 3500, de: 0, ate: 900, pill: "Portal da Imprensa", titulo: ["Autonomia para", "as assessorias."] } },
  { ancora: "A assessoria se cadastra", tipo: "cartoes", p: { pill: "Cadastro e aprovação", titulo: ["Cadastra,", "é aprovada,", "envia o release."], imagens: [{ img: "p-cadastro.jpg", largura: 620 }, { img: "p-envio.jpg", largura: 700 }] } },
  { ancora: "A matéria entra fixada", tipo: "cartoes", p: { pill: "Fixada na cidade", titulo: ["Destaque para", "os leitores", "daquela cidade."], imagens: [{ img: "p-publicada.jpg", largura: 760 }, { img: "materia-mobile.jpg", largura: 340 }] } },
  { ancora: "É a comunicação de cada cidade", tipo: "titulo", p: { pill: "Mensageria da cidade", linhas: [{ t: "A comunicação de cada cidade" }, { t: "trabalhando a favor da audiência.", apagada: true }], tamanho: 84 } },
  // ---- 5 · audiência e distribuição
  { ancora: "O leitor vê primeiro", tipo: "tela", p: { img: T("pub-oeste"), url: "vozesparanaenses.com.br/oeste", imgAltura: 3000, de: 0, ate: 500, pill: "Proximidade", titulo: ["A notícia da", "cidade do leitor", "vem primeiro."] } },
  { ancora: "No Instagram, um robô", tipo: "tela", p: { img: T("adm-instagram"), url: "…/admin/instagram", imgAltura: 1080, de: 0, ate: 0, zoom: [1, 1.1], pill: "Robô do Instagram", titulo: ["Escolhe, desenha", "e publica."] } },
  { ancora: "e às seis da tarde monta o Reels", tipo: "reels", p: { pill: "Reels diário · 18h", titulo: ["Resumo do dia,", "narrado e editado."], video: "reels.mp4" } },
  { ancora: "E todo conteúdo já nasce estruturado", tipo: "tela", p: { img: T("pub-llms"), url: "vozesparanaenses.com.br/llms.txt", imgAltura: 1080, de: 0, ate: 0, zoom: [1, 1.12], foco: [0, 0], pill: "Busca por IA", titulo: ["Feito para ser", "citado pelos", "buscadores de IA."] } },
  // ---- 55 · Pipeline ao vivo
  { ancora: "E tudo isso pode ser acompanhado ao vivo", tipo: "pipeline", p: { de: 0, ate: 1, zooms: [
    { aos: 0, rect: R("inteiro") },
    { aos: 0.2, rect: ajusta(R("coleta")), rotulo: "Coleta" },
    { aos: 0.32, rect: ajusta(R("redacao")), rotulo: "Redação" },
    { aos: 0.44, rect: ajusta(R("criticidade")), rotulo: "Criticidade" },
    { aos: 0.55, rect: ajusta(R("redes")), rotulo: "Redes sociais" },
    { aos: 0.66, rect: ajusta(R("ciclo")), rotulo: "Próximo ciclo" },
    { aos: 0.78, rect: ajusta(R("alertas")), rotulo: "Alertas e orientação" },
    { aos: 0.9, rect: R("inteiro"), rotulo: "Relatório do ciclo" },
  ] } },
  // ---- 6 · números
  { ancora: "Os números de hoje", tipo: "numeros", p: { pill: "Por dia", itens: [
    { valor: 450, rotulo: "notícias coletadas" }, { valor: 108, rotulo: "matérias redigidas" },
    { valor: 86, rotulo: "publicadas", cor: "#2ED3B7" }, { valor: 23, sufixo: " min", rotulo: "da fonte ao ar" },
  ] } },
  { ancora: "Feito à mão, seriam", tipo: "numeros", p: { pill: "Trabalho humano", itens: [
    { valor: 140, sufixo: " h", rotulo: "de trabalho por dia, feito à mão" }, { valor: 25, rotulo: "pessoas em escala" },
    { valor: 3, sufixo: " h", rotulo: "de um editor, aqui", cor: "#2ED3B7" },
  ] } },
  { ancora: "E o custo de sustentação", tipo: "numeros", p: { pill: "Licenças e tokens · sem o desenvolvimento", itens: [
    { valor: 900, prefixo: "R$ ", rotulo: "por mês", cor: "#2ED3B7" }, { valor: 30, prefixo: "R$ ", rotulo: "por dia", cor: "#2ED3B7" },
    { valor: 200, prefixo: "R$ ", sufixo: " mil+", rotulo: "uma equipe equivalente" },
  ], rodape: "Estimativa: volume real de outubro/2026; tempos e salários de referência de mercado." } },
  // ---- 7 · escala e receita
  { ancora: "Esse custo cresce de forma previsível", tipo: "titulo", p: { pill: "Escala", linhas: [{ t: "Mais cidades, mais tokens." }, { t: "Não mais folha.", apagada: true }] } },
  { ancora: "A receita vem de anúncios", tipo: "tela", p: { img: T("adm-anuncios"), url: "…/admin/anuncios", imgAltura: 1080, de: 0, ate: 0, zoom: [1, 1.08], pill: "Receita", titulo: ["Anúncios,", "patrocinado,", "marca pessoal,", "imprensa."] } },
  { ancora: "A máquina de produção está pronta", tipo: "pipeline", p: { de: 0.7, ate: 0.8, zooms: [{ aos: 0, rect: R("inteiro"), rotulo: "Rodando agora" }] } },
  { ancora: "O próximo passo é escalar", tipo: "titulo", p: { pill: "Próximo passo", linhas: [{ t: "Escalar a audiência." }, { t: "Levar o modelo às redes", apagada: true }, { t: "que já têm marca e público.", apagada: true }], tamanho: 88 } },
  // ---- 8 · a pergunta
  { ancora: "A inteligência artificial autônoma", tipo: "pergunta", p: { linhas: ["A IA autônoma já redesenhou", "o escopo das profissões.", "A sua empresa já virou essa página?"] } },
];
