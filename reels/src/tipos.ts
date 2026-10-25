// Roteiro do Reels "Resumo do dia" — montado por scripts/montar.mjs a partir
// dos posts publicados no dia, com a narração já gerada (tempos em segundos).

export type Palavra = { t: number; fim: number; texto: string };

export type Transicao = "balao" | "chicote" | "glitch" | "iris" | "luz" | "corte";

export type CenaAbertura = {
  tipo: "abertura";
  dur: number;
  data: string; // "Domingo, 25 de outubro"
  chamadas: string[]; // 3 manchetes curtas para o teaser
};

export type CenaNoticia = {
  tipo: "noticia";
  dur: number;
  estilo: "foto" | "numero" | "alerta";
  chapeu: string;
  cor: string; // cor do escopo (chapéu e barra de progresso)
  titulo: string;
  linhaFina?: string | null;
  foto?: string | null; // caminho em public/ (fotos/1.jpg)
  credito?: string | null;
  numero?: { valor: string; rotulo: string } | null; // contador
  dados?: Array<{ valor: string; unidade?: string; rotulo: string }>; // alerta
  palavras: Palavra[]; // narração da cena (para o lettering sincronizado)
  transicao: Transicao; // como ESTA cena entra
};

export type CenaAssinatura = { tipo: "assinatura"; dur: number; transicao: Transicao };

export type Cena = CenaAbertura | CenaNoticia | CenaAssinatura;

export type Roteiro = {
  fps: number;
  audio: string | null; // mix final (voz + trilha + efeitos), em public/
  cenas: Cena[];
};

export const DURACAO_TRANSICAO = 0.5; // s — cada transição sobrepõe as cenas
