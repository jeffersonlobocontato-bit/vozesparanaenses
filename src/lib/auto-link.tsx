import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * Auto-linking utilitário para o corpo da matéria.
 * - Cidades → /{regionSlug}/cidade/{citySlug}
 * - Regiões → /{regionSlug}
 * - Editorias → /{regionSlug}/editoria/{categorySlug}
 *
 * Regras SEO:
 *  - Cada termo é linkado no máximo 1 vez por matéria (dedupe via Set compartilhado).
 *  - Termos mais longos ganham prioridade ("Foz do Iguaçu" antes de "Foz").
 *  - Máx. 3 links por parágrafo (evita over-optimization).
 */

export type LinkTerm =
  | { type: "city"; term: string; regionSlug: string; citySlug: string }
  | { type: "region"; term: string; regionSlug: string }
  | { type: "category"; term: string; regionSlug: string; categorySlug: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converte um trecho de texto em nós, transformando:
 *  - Markdown links `[label](url)` em <a>
 *  - URLs "cruas" (http/https/www) em <a>
 * Retorna array de string | ReactNode.
 */
function parseInlineLinks(text: string, keyPrefix: string): ReactNode[] {
  const cls =
    "text-[#0A2540] underline decoration-[#0A2540]/30 underline-offset-2 hover:decoration-[#0A2540]";
  // Regex combinado: markdown [label](url) OU URL crua
  const combined =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<)\]]+|www\.[^\s<)\]]+)/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = combined.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] && m[2]) {
      out.push(
        <a
          key={`${keyPrefix}-ml-${i++}`}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {m[1]}
        </a>,
      );
    } else if (m[3]) {
      const raw = m[3];
      const href = raw.startsWith("http") ? raw : `https://${raw}`;
      out.push(
        <a
          key={`${keyPrefix}-ul-${i++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {raw}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

export function buildLinkTerms(opts: {
  regions: { slug: string; name: string }[];
  cities: { regionSlug: string; citySlug: string; name: string }[];
  categories: { slug: string; name: string }[];
  currentRegionSlug: string;
  currentCitySlug: string | null;
}): LinkTerm[] {
  const terms: LinkTerm[] = [];
  for (const c of opts.cities) {
    if (!c.name || c.name.length < 4) continue;
    // Não auto-linkar a própria cidade da matéria.
    if (c.regionSlug === opts.currentRegionSlug && c.citySlug === opts.currentCitySlug) continue;
    terms.push({ type: "city", term: c.name, regionSlug: c.regionSlug, citySlug: c.citySlug });
  }
  for (const r of opts.regions) {
    if (!r.name || r.name.length < 4) continue;
    if (r.slug === opts.currentRegionSlug) continue;
    terms.push({ type: "region", term: r.name, regionSlug: r.slug });
  }
  for (const cat of opts.categories) {
    if (!cat.name || cat.name.length < 4) continue;
    terms.push({
      type: "category",
      term: cat.name,
      regionSlug: opts.currentRegionSlug,
      categorySlug: cat.slug,
    });
  }
  // Termos mais longos primeiro para evitar match parcial ("Foz" vs "Foz do Iguaçu").
  return terms.sort((a, b) => b.term.length - a.term.length);
}

function renderTermLink(term: LinkTerm, label: string, key: string): ReactNode {
  const cls =
    "text-[#0A2540] underline decoration-[#0A2540]/30 underline-offset-2 hover:decoration-[#0A2540]";
  if (term.type === "city") {
    return (
      <Link
        key={key}
        to="/$region/cidade/$cidade"
        params={{ region: term.regionSlug, cidade: term.citySlug }}
        className={cls}
      >
        {label}
      </Link>
    );
  }
  if (term.type === "region") {
    return (
      <Link key={key} to="/$region" params={{ region: term.regionSlug }} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <Link
      key={key}
      to="/$region/editoria/$categoria"
      params={{ region: term.regionSlug, categoria: term.categorySlug }}
      className={cls}
    >
      {label}
    </Link>
  );
}

/**
 * Linkifica um parágrafo. Mutates `used` (Set de termos já linkados no artigo inteiro).
 * Retorna array de ReactNode (strings + <Link>).
 */
export function autoLinkParagraph(
  text: string,
  terms: LinkTerm[],
  used: Set<string>,
  paragraphIdx: number,
): ReactNode[] {
  if (!text) return [text];
  // Primeiro: converte markdown links e URLs cruas em <a>.
  let nodes: ReactNode[] = parseInlineLinks(text, `p${paragraphIdx}`);
  let linksInParagraph = 0;
  const MAX_PER_PARAGRAPH = 3;

  for (const term of terms) {
    if (linksInParagraph >= MAX_PER_PARAGRAPH) break;
    const key = term.term.toLowerCase();
    if (used.has(key)) continue;
    const re = new RegExp("\\b" + escapeRegex(term.term) + "\\b", "iu");
    const next: ReactNode[] = [];
    let matched = false;
    for (const n of nodes) {
      if (matched || typeof n !== "string") {
        next.push(n);
        continue;
      }
      const m = re.exec(n);
      if (!m || m.index === undefined) {
        next.push(n);
        continue;
      }
      const before = n.slice(0, m.index);
      const hit = n.slice(m.index, m.index + m[0].length);
      const after = n.slice(m.index + m[0].length);
      if (before) next.push(before);
      next.push(renderTermLink(term, hit, `p${paragraphIdx}-${key}`));
      if (after) next.push(after);
      matched = true;
    }
    if (matched) {
      used.add(key);
      nodes = next;
      linksInParagraph++;
    }
  }
  return nodes;
}

/**
 * Insere <br/> em quebras de linha simples (`\n`) dentro dos nós string.
 * Preserva quebras manuais feitas pelo editor (listas empilhadas, dados de
 * pesquisa, etc.) sem exigir linha em branco entre cada item.
 */
export function withLineBreaks(nodes: ReactNode[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let brIdx = 0;
  nodes.forEach((n, i) => {
    if (typeof n !== "string" || !n.includes("\n")) {
      out.push(n);
      return;
    }
    const parts = n.split("\n");
    parts.forEach((part, j) => {
      if (j > 0) out.push(<br key={`${keyPrefix}-br-${i}-${brIdx++}`} />);
      if (part) out.push(part);
    });
  });
  return out;
}

/**
 * Converte marcações Markdown inline (`**negrito**` e `*itálico*`) dentro dos
 * nós string em `<strong>` / `<em>`. Preserva ReactNodes (links já criados).
 */
export function withInlineMarkdown(nodes: ReactNode[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let idx = 0;
  // **bold** primeiro; depois *italic* (single asterisco não colado a espaço).
  const boldRe = /\*\*([^*\n]+?)\*\*/g;
  const italicRe = /(^|[^*])\*([^*\n]+?)\*(?!\*)/g;
  nodes.forEach((n) => {
    if (typeof n !== "string") {
      out.push(n);
      return;
    }
    // Passo 1: bold
    const pieces: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    boldRe.lastIndex = 0;
    while ((m = boldRe.exec(n)) !== null) {
      if (m.index > last) pieces.push(n.slice(last, m.index));
      pieces.push(<strong key={`${keyPrefix}-b-${idx++}`}>{m[1]}</strong>);
      last = m.index + m[0].length;
    }
    if (last < n.length) pieces.push(n.slice(last));
    // Passo 2: italic sobre os pedaços string restantes
    for (const p of pieces) {
      if (typeof p !== "string") {
        out.push(p);
        continue;
      }
      let last2 = 0;
      let m2: RegExpExecArray | null;
      italicRe.lastIndex = 0;
      let matchedAny = false;
      while ((m2 = italicRe.exec(p)) !== null) {
        matchedAny = true;
        const start = m2.index + m2[1].length;
        if (start > last2) out.push(p.slice(last2, start));
        out.push(<em key={`${keyPrefix}-i-${idx++}`}>{m2[2]}</em>);
        last2 = m2.index + m2[0].length;
      }
      if (!matchedAny) out.push(p);
      else if (last2 < p.length) out.push(p.slice(last2));
    }
  });
  return out;
}