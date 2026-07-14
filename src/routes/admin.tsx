import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel Editorial — Vozes Paranaenses" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [state, setState] = useState<"loading" | "anon" | "ok" | "forbidden">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = await getExternalBrowser();
      const { data: sess } = await sb.auth.getSession();
      if (!alive) return;
      if (!sess.session) {
        setState("anon");
        if (loc.pathname !== "/admin/login" && loc.pathname !== "/admin/reset-password") {
          nav({ to: "/admin/login", replace: true });
        }
        return;
      }
      setEmail(sess.session.user.email ?? null);
      const { data: isAdmin } = await sb.rpc("has_role", {
        _user_id: sess.session.user.id,
        _role: "admin",
      });
      const { data: isEditor } = await sb.rpc("has_role", {
        _user_id: sess.session.user.id,
        _role: "editor",
      });
      if (!alive) return;
      if (!isAdmin && !isEditor) {
        setState("forbidden");
        return;
      }
      setState("ok");
      if (loc.pathname === "/admin/login") nav({ to: "/admin", replace: true });
    })();
    return () => { alive = false; };
  }, [loc.pathname, nav]);

  if (loc.pathname === "/admin/login" || loc.pathname === "/admin/reset-password") {
    return <Outlet />;
  }

  if (state === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando painel…</div>;
  }
  if (state === "forbidden") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="text-sm text-muted-foreground">Sua conta ({email}) não tem permissão editorial.</p>
        <button
          onClick={async () => { const sb = await getExternalBrowser(); await sb.auth.signOut(); nav({ to: "/admin/login", replace: true }); }}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >Sair</button>
      </div>
    );
  }
  if (state !== "ok") return null;

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[#0A2540] px-2 py-1.5">
                <Logo size="sm" variant="white" withLink={false} />
              </div>
            </div>
            <nav className="hidden items-center gap-1 rounded-full bg-slate-100/80 p-1 text-sm md:flex">
              {[
                { to: "/admin/painel", label: "Painel" },
                { to: "/admin", label: "Fila", exact: true },
                { to: "/admin/analytics", label: "Analytics" },
                { to: "/admin/fontes", label: "Fontes" },
                { to: "/admin/regioes", label: "Regiões" },
                { to: "/admin/anuncios", label: "Anúncios" },
                { to: "/admin/vitrine-pessoal", label: "Vitrine Pessoal" },
                { to: "/admin/pedidos-chat", label: "Pedidos (chat)" },
                { to: "/admin/agentes", label: "Agentes IA" },
                { to: "/admin/memoria-editorial", label: "Memória" },
              ].map((it) => (
                <Link
                  key={it.to}
                  to={it.to}
                  activeOptions={it.exact ? { exact: true } : undefined}
                  className="rounded-full px-3 py-1.5 text-slate-600 transition hover:text-[#0A2540] [&.active]:bg-white [&.active]:font-semibold [&.active]:text-[#0A2540] [&.active]:shadow-sm"
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-600 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="max-w-[180px] truncate">{email}</span>
            </div>
            <Link to="/admin/senha" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:border-[#0A2540] hover:text-[#0A2540]">Senha</Link>
            <button
              onClick={async () => { const sb = await getExternalBrowser(); await sb.auth.signOut(); nav({ to: "/admin/login", replace: true }); }}
              className="rounded-full bg-[#0A2540] px-3 py-1.5 font-semibold text-white transition hover:bg-[#0d2f52]"
            >Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8"><Outlet /></main>
    </div>
  );
}