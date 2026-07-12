import { Link } from "@tanstack/react-router";
import { useState } from "react";
import logoWhite from "@/assets/vp-logo-horizontal-negative.svg.asset.json";

// Nav principal — regiões prioritárias + acessos rápidos.
// Estilo CGN: barra escura densa, uppercase, tracking largo, sem ornamentos.
const PRIMARY_NAV: { label: string; to: string; params?: Record<string, string> }[] = [
  { label: "Últimas", to: "/" },
  { label: "Metropolitana", to: "/$region", params: { region: "metropolitana" } },
  { label: "Oeste", to: "/$region", params: { region: "oeste" } },
  { label: "Norte", to: "/$region", params: { region: "norte-central" } },
  { label: "Campos Gerais", to: "/$region", params: { region: "campos-gerais" } },
  { label: "Litoral", to: "/$region", params: { region: "litoral" } },
  { label: "Sudoeste", to: "/$region", params: { region: "sudoeste" } },
  { label: "Nacional", to: "/editoria/$categoria", params: { categoria: "nacional" } },
  { label: "Internacional", to: "/editoria/$categoria", params: { categoria: "internacional" } },
];

const SECONDARY_NAV: { label: string; to: string; params?: Record<string, string> }[] = [
  { label: "WhatsApp", to: "/whatsapp" },
  { label: "Anuncie", to: "/" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-[#0A2540] text-white shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        {/* Burger — mobile only */}
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 shrink-0 flex-col items-center justify-center gap-[3px] md:hidden"
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
          <img
            src={logoWhite.url}
            alt="Vozes Paranaenses"
            className="h-9 w-auto select-none md:h-12"
            draggable={false}
          />
        </Link>

        {/* Nav principal — desktop */}
        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto md:flex">
          {PRIMARY_NAV.map((item) => (
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

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-[#0A2540] md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => (
              <Link
                key={item.label}
                to={item.to as never}
                params={item.params as never}
                onClick={() => setOpen(false)}
                className="border-b border-white/5 py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-white/90"
              >
                {item.label}
              </Link>
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
            src={logoWhite.url}
            alt="Vozes Paranaenses"
            className="mb-3 h-12 w-auto select-none"
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
            {PRIMARY_NAV.slice(1).map((r) => (
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
          © {new Date().getFullYear()} Vozes Paranaenses · Paraná
        </div>
      </div>
    </footer>
  );
}