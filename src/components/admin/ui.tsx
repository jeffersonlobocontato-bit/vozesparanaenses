import type { ReactNode } from "react";

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
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0066CC]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-bold text-[#0A2540]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function refreshBtnClass() {
  return "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#0066CC] hover:text-[#0066CC]";
}

export function primaryBtnClass() {
  return "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A2540] to-[#0d3a6e] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md disabled:opacity-60";
}

export function tabPillsWrapClass() {
  return "flex flex-wrap gap-1 rounded-full bg-slate-100/80 p-1 text-sm";
}

export function tabPillClass(active: boolean) {
  return active
    ? "rounded-full bg-white px-3.5 py-1.5 font-semibold text-[#0A2540] shadow-sm"
    : "rounded-full px-3.5 py-1.5 text-slate-600 transition hover:text-[#0A2540]";
}