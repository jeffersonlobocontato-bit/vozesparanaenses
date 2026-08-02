import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import horizontalDark from "@/assets/vozes-horizontal-dark.png.asset.json";
import verticalDark from "@/assets/vozes-vertical-dark.png.asset.json";
import iconMark from "@/assets/vozes-icon-dark.png.asset.json";

type NavItem = { label: string; to: string; params?: Record<string, string> };

// Tarja azul do topo: editorias temáticas.
const EDITORIAS_NAV: NavItem[] = [
  { label: "Política", to: "/editoria/$categoria", params: { categoria: "politica" } },
  { label: "Eleições 2026", to: "/editoria/$categoria", params: { categoria: "eleicoes-2026" } },
  { label: "Economia", to: "/editoria/$categoria", params: { categoria: "economia" } },
  { label: "Agronegócio", to: "/editoria/$categoria", params: { categoria: "agronegocio" } },
  { label: "Segurança", to: "/editoria/$categoria", params: { categoria: "seguranca" } },
  { label: "Esportes", to: "/editoria/$categoria", params: { categoria: "esportes" } },
  { label: "Educação", to: "/editoria/$categoria", params: { categoria: "educacao" } },
  { label: "Cultura", to: "/editoria/$categoria", params: { categoria: "cultura" } },
  { label: "Nacional", to: "/editoria/$categoria", params: { categoria: "nacional" } },
  { label: "Internacional", to: "/editoria/$categoria", params: { categoria: "internacional" } },
];

// Linha branca abaixo (ao lado da data): as 10 macrorregiões.
const REGIOES_NAV: NavItem[] = [
  { label: "Metropolitana", to: "/$region", params: { region: "metropolitana" } },
  { label: "Litoral", to: "/$region", params: { region: "litoral" } },
  { label: "Campos Gerais", to: "/$region", params: { region: "campos-gerais" } },
  { label: "Norte Pioneiro", to: "/$region", params: { region: "norte-pioneiro" } },
  { label: "Norte", to: "/$region", params: { region: "norte-central" } },
  { label: "Noroeste", to: "/$region", params: { region: "noroeste" } },
  { label: "Centro Oeste", to: "/$region", params: { region: "centro-ocidental" } },
  { label: "Oeste", to: "/$region", params: { region: "oeste" } },
  { label: "Sudoeste", to: "/$region", params: { region: "sudoeste" } },
  { label: "Centro-Sul", to: "/$region", params: { region: "centro-sul" } },
];

const SECONDARY_NAV: NavItem[] = [
  { label: "WhatsApp", to: "/whatsapp" },
  { label: "Anuncie", to: "/" },
];

const INSTITUCIONAL_NAV: NavItem[] = [
  { label: "Sobre o portal", to: "/sobre" },
  { label: "Política editorial", to: "/politica-editorial" },
  { label: "Correções", to: "/correcoes" },
  { label: "Contato", to: "/contato" },
];

function useTodayBR() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "America/Sao_Paulo",
      }),
    );
  }, []);
  return label;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const today = useTodayBR();
  return (
    <header className="sticky top-0 z-40 bg-[#0A2540] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Burger — abre todos os atalhos (mobile + desktop) */}
        <button
          type="button"
          aria-label="Abrir menu de editorias e regiões"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[3px]"
        >
          <span className="block h-[2px] w-5 bg-white" />
          <span className="block h-[2px] w-5 bg-white" />
          <span className="block h-[2px] w-5 bg-white" />
        </button>

        {/* Logo */}
        <Link
          to="/"
          aria-label="Vozes Paranaenses — Página inicial"
          className="flex shrink-0 items-center"
        >
          {/* Ícone VP em telas estreitas, marca horizontal a partir de sm */}
          <img
            src={iconMark.url}
            alt="Vozes Paranaenses"
            className="h-7 w-auto select-none sm:hidden"
            draggable={false}
          />
          <img
            src={horizontalDark.url}
            alt="Vozes Paranaenses — Portal de Notícias"
            className="hidden h-8 w-auto select-none sm:block md:h-9"
            draggable={false}
          />
        </Link>

        {/* Editorias temáticas — desktop */}
        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto md:flex">
          {EDITORIAS_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to as never}
              params={item.params as never}
              className="shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-white/90 transition-colors hover:text-white"
              activeProps={{ className: "shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-white" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Secundário + busca */}
        <div className="ml-auto flex shrink-0 items-center gap-4">
          {SECONDARY_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to as never}
              params={item.params as never}
              className="hidden text-[13px] font-bold uppercase tracking-[0.06em] text-white/80 transition-colors hover:text-white lg:inline"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            aria-label="Buscar"
            className="flex h-8 w-8 items-center justify-center text-white/80 transition-colors hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      {/* Linha inferior — data + 10 macrorregiões */}
      <div className="border-t border-white/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto px-4 py-2 whitespace-nowrap">
          <span
            suppressHydrationWarning
            className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 capitalize"
          >
            {today ?? "\u00A0"}
          </span>
          <span className="h-3 w-px shrink-0 bg-slate-300" />
          {REGIOES_NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to as never}
              params={item.params as never}
              className="shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-600 transition-colors hover:text-[#0A2540]"
              activeProps={{ className: "shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#0A2540]" }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Menu completo (burger) */}
      {open && (
        <div className="border-t border-white/10 bg-[#0A2540]">
          <nav className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-6 px-4 py-6 md:grid-cols-3">
            {[
              { titulo: "Editorias", itens: EDITORIAS_NAV },
              { titulo: "Macrorregiões", itens: REGIOES_NAV },
              { titulo: "Serviços", itens: [...SECONDARY_NAV, ...INSTITUCIONAL_NAV] },
            ].map((grupo) => (
              <div key={grupo.titulo}>
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {grupo.titulo}
                </h4>
                <ul className="flex flex-col">
                  {grupo.itens.map((item) => (
                    <li key={`${grupo.titulo}-${item.label}`}>
                      <Link
                        to={item.to as never}
                        params={item.params as never}
                        onClick={() => setOpen(false)}
                        className="block border-b border-white/5 py-2 text-[13px] font-bold uppercase tracking-[0.06em] text-white/85 hover:text-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[#0A2540] text-white/90">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <img
            src={verticalDark.url}
            alt="Vozes Paranaenses — Portal de Notícias"
            className="mb-4 h-24 w-auto select-none md:h-28"
            draggable={false}
          />
          <p className="max-w-md text-xs leading-relaxed text-white/60">
            Cobertura editorial das 10 macrorregiões do Paraná — jornalismo regional,
            um só endereço.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
            Regiões
          </h4>
          <ul className="space-y-1 text-sm">
            {REGIOES_NAV.map((r) => (
              <li key={r.label}>
                <Link
                  to={r.to as never}
                  params={r.params as never}
                  className="text-white/80 transition-colors hover:text-white"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">
            Institucional
          </h4>
          <ul className="space-y-1 text-sm">
            <li>
              <Link to="/sobre" className="text-white/80 hover:text-white">
                Sobre o portal
              </Link>
            </li>
            <li>
              <Link to="/politica-editorial" className="text-white/80 hover:text-white">
                Política editorial
              </Link>
            </li>
            <li>
              <Link to="/correcoes" className="text-white/80 hover:text-white">
                Correções
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="text-white/80 hover:text-white">
                Privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className="text-white/80 hover:text-white">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link to="/whatsapp" className="text-white/80 hover:text-white">
                Notícias no WhatsApp
              </Link>
            </li>
            <li>
              <Link to="/contato" className="text-white/80 hover:text-white">
                Contato
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
          © {new Date().getFullYear()} Vozes Paranaenses é uma publicação da Agência de Inteligência Vozes Ltda · CNPJ: 68.276.102/0001-78 · Paraná
        </div>
      </div>
    </footer>
  );
}