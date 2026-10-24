import { useState, type ReactNode } from "react";

// Kit comum do painel admin. Toda página usa estas peças, para o painel ter
// um só jeito de mostrar cabeçalho, seção, botão, status e estado vazio.
// Cores: tinta #12201E (ink), laranja #E29F65 (marca), fios slate-200.

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B5651D]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-bold text-[#12201E]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bloco de conteúdo da página: cartão branco com título opcional. */
export function Section({
  title,
  subtitle,
  aside,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || aside) && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#12201E]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {aside}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

/** Compatibilidade: cartão simples. Prefira Section. */
export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

type Variante = "primary" | "secondary" | "danger" | "ghost" | "success";
const VARIANTES: Record<Variante, string> = {
  primary: "bg-[#12201E] text-white hover:bg-[#1e3531] border border-[#12201E]",
  secondary: "bg-white text-[#12201E] border border-slate-300 hover:border-[#12201E]",
  danger: "bg-white text-red-700 border border-red-300 hover:bg-red-50",
  ghost: "bg-transparent text-slate-600 border border-transparent hover:bg-slate-100 hover:text-[#12201E]",
  success: "bg-emerald-700 text-white border border-emerald-700 hover:bg-emerald-800",
};

/** Classe de botão (para <button>, <a> ou <Link>). */
export function btn(variante: Variante = "secondary", tamanho: "sm" | "md" = "md") {
  const t = tamanho === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm";
  return `inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B6E8F] ${t} ${VARIANTES[variante]}`;
}

/**
 * Botão de ação irreversível ou de impacto (publicar, rejeitar, apagar):
 * o primeiro clique pede confirmação no próprio botão, sem window.confirm.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirmar",
  variante = "danger",
  tamanho = "sm",
  disabled,
  title,
}: {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: string;
  variante?: Variante;
  tamanho?: "sm" | "md";
  disabled?: boolean;
  title?: string;
}) {
  const [armado, setArmado] = useState(false);
  if (!armado) {
    return (
      <button type="button" className={btn(variante, tamanho)} disabled={disabled} title={title} onClick={() => setArmado(true)}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={btn(variante === "danger" ? "danger" : "primary", tamanho)}
        disabled={disabled}
        onClick={async () => { setArmado(false); await onConfirm(); }}
      >
        {confirmLabel}
      </button>
      <button type="button" className={btn("ghost", tamanho)} onClick={() => setArmado(false)}>
        Cancelar
      </button>
    </span>
  );
}

const TOM_STATUS: Record<string, string> = {
  publicado: "bg-emerald-100 text-emerald-800",
  ativo: "bg-emerald-100 text-emerald-800",
  ativa: "bg-emerald-100 text-emerald-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  pago: "bg-emerald-100 text-emerald-800",
  rascunho: "bg-amber-100 text-amber-800",
  revisao: "bg-amber-100 text-amber-800",
  pendente: "bg-amber-100 text-amber-800",
  aguardando: "bg-amber-100 text-amber-800",
  rejeitado: "bg-rose-100 text-rose-800",
  recusado: "bg-rose-100 text-rose-800",
  inativo: "bg-slate-100 text-slate-600",
  inativa: "bg-slate-100 text-slate-600",
  pausada: "bg-slate-100 text-slate-600",
  expirado: "bg-slate-100 text-slate-600",
  encerrada: "bg-slate-100 text-slate-600",
};
const ROTULO_STATUS: Record<string, string> = { rascunho: "Em revisão", revisao: "Em revisão" };

/** Etiqueta de status padronizada (cor pelo significado, texto legível). */
export function StatusPill({ status, label }: { status: string; label?: string }) {
  const k = status.toLowerCase();
  const texto = label ?? ROTULO_STATUS[k] ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TOM_STATUS[k] ?? "bg-slate-100 text-slate-700"}`}>
      {texto}
    </span>
  );
}

/** Barra de filtros acima de listas. */
export function FilterBar({ children, resumo }: { children: ReactNode; resumo?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {children}
      {resumo && <span className="ml-auto self-center text-xs text-slate-500">{resumo}</span>}
    </div>
  );
}

export const campoClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#12201E] focus:outline-none";
export const rotuloClass = "flex flex-col gap-1 text-xs font-semibold text-slate-600";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-[#12201E]">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{children}</p>;
}

/** Mensagem de retorno de uma ação (salvo, erro). */
export function Aviso({ tipo = "ok", children }: { tipo?: "ok" | "erro"; children: ReactNode }) {
  return (
    <p role="status" className={`rounded-lg px-3 py-2 text-sm ${tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
      {children}
    </p>
  );
}

/** Abas dentro de uma página. */
export function Tabs<T extends string>({ value, onChange, items }: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className={tabPillsWrapClass()}>
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} type="button" onClick={() => onChange(it.value)} className={tabPillClass(value === it.value)}>
          {it.label}
          {typeof it.count === "number" && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-700">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Barra fixa no rodapé para salvar formulários longos. */
export function SaveBar({ children, aviso }: { children: ReactNode; aviso?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-[#F4F7FB]/95 px-1 py-3 backdrop-blur">
      {aviso && <div className="mr-auto">{aviso}</div>}
      {children}
    </div>
  );
}

export function refreshBtnClass() {
  return btn("secondary");
}

export function primaryBtnClass() {
  return btn("primary");
}

export function tabPillsWrapClass() {
  return "flex flex-wrap gap-1 rounded-full bg-slate-100/80 p-1 text-sm";
}

export function tabPillClass(active: boolean) {
  return active
    ? "rounded-full bg-white px-3.5 py-1.5 font-semibold text-[#12201E] shadow-sm"
    : "rounded-full px-3.5 py-1.5 text-slate-600 transition hover:text-[#12201E]";
}
