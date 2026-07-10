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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-[#0A2540] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Logo size="sm" variant="white" withLink={false} />
            <nav className="flex gap-4 text-sm">
              <Link to="/admin/painel" className="hover:underline [&.active]:font-bold">Painel</Link>
              <Link to="/admin" activeOptions={{ exact: true }} className="hover:underline [&.active]:font-bold">Fila</Link>
              <Link to="/admin/clusters" className="hover:underline [&.active]:font-bold">Pautas</Link>
              <Link to="/admin/fontes" className="hover:underline [&.active]:font-bold">Fontes</Link>
              <Link to="/admin/regioes" className="hover:underline [&.active]:font-bold">Regiões</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="opacity-80">{email}</span>
            <Link to="/admin/senha" className="rounded border border-white/30 px-2 py-1 hover:bg-white/10">Senha</Link>
            <button
              onClick={async () => { const sb = await getExternalBrowser(); await sb.auth.signOut(); nav({ to: "/admin/login", replace: true }); }}
              className="rounded border border-white/30 px-2 py-1 hover:bg-white/10"
            >Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
    </div>
  );
}