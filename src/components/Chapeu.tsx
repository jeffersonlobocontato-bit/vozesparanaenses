import { chapeuDe, COR_ESCOPO } from "@/lib/proximidade";

type Props = {
  artigo: Parameters<typeof chapeuDe>[0];
  cidadeLeitor?: string | null;
  className?: string;
};

/**
 * Chapéu do design system: proximidade (na cor do escopo) · assunto.
 * Notícia da cidade do leitor ganha o ponto laranja da marca.
 */
export function Chapeu({ artigo, cidadeLeitor, className = "" }: Props) {
  const c = chapeuDe(artigo, cidadeLeitor);
  return (
    <span className={`vp-chapeu ${COR_ESCOPO[c.escopo]} ${className}`}>
      {c.daCidadeDoLeitor && <span className="vp-chapeu__ponto" aria-hidden="true" />}
      {c.rotulo}
      {c.assunto && <span className="vp-chapeu__assunto">· {c.assunto}</span>}
      {c.daCidadeDoLeitor && <span className="sr-only">(sua cidade)</span>}
    </span>
  );
}
