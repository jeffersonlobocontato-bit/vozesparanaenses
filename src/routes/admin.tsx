import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Home, Inbox, NotebookPen, Columns3, Radio, Map as MapIcon, Bot, BookOpen, Megaphone, UserRound, Newspaper, BarChart3, Info, ExternalLink, KeyRound, LogOut, LayoutDashboard, Instagram, Activity, MessageSquareText, MapPinned, Users, Eye } from "lucide-react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Logo } from "@/components/Logo";
import { situacao, type Assinatura } from "@/lib/custos";
import { marcarNavegadorDaEquipe } from "@/lib/cookie-consent";
import { podeAbrir, type Papel } from "@/lib/papeis";

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
  const [papel, setPapel] = useState<Papel | null>(null);

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
      const uid = sess.session.user.id;
      const [{ data: isAdmin }, { data: isEditor }, { data: isViewer }] = await Promise.all([
        sb.rpc("has_role", { _user_id: uid, _role: "admin" }),
        sb.rpc("has_role", { _user_id: uid, _role: "editor" }),
        sb.rpc("has_role", { _user_id: uid, _role: "viewer" }),
      ]);
      if (!alive) return;
      const p: Papel | null = isAdmin ? "admin" : isEditor ? "editor" : isViewer ? "viewer" : null;
      if (!p) {
        setState("forbidden");
        return;
      }
      setPapel(p);
      setState("ok");
      // Consulta só abre as páginas de informação; Usuários só para admin.
      if (!podeAbrir(p, loc.pathname) && loc.pathname !== "/admin/login") {
        nav({ to: "/admin/painel", replace: true });
        return;
      }
      marcarNavegadorDaEquipe();
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
  if (state !== "ok" || !papel) return null;
  if (!podeAbrir(papel, loc.pathname)) return null;

  return (
    <div className="min-h-screen bg-[#F4F7FB] md:flex">
      <AdminSidebar email={email} papel={papel} onSair={async () => { const sb = await getExternalBrowser(); await sb.auth.signOut(); nav({ to: "/admin/login", replace: true }); }} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {papel === "viewer" && (
            <p className="mb-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              <Eye className="h-3.5 w-3.5" /> Acesso de consulta: você vê os painéis e números, mas não altera nada.
            </p>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}

type ItemNav = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; badge?: "materias" | "notas" | "custos" };

// Menu agrupado pelo trabalho do dia: primeiro o que pede decisão (revisão),
// depois a configuração do pipeline, os produtos pagos e o site.
const GRUPOS: { titulo: string; itens: ItemNav[] }[] = [
  {
    titulo: "Redação",
    itens: [
      { to: "/admin/painel", label: "Painel", icon: LayoutDashboard },
      { to: "/admin", label: "Matérias", icon: Inbox, exact: true, badge: "materias" },
      { to: "/admin/notas-cidades", label: "Notas das cidades", icon: NotebookPen, badge: "notas" },
      { to: "/admin/colunas", label: "Colunas", icon: Columns3 },
    ],
  },
  {
    titulo: "Pipeline",
    itens: [
      { to: "/admin/pipeline", label: "Pipeline ao vivo", icon: Activity },
      { to: "/admin/fontes", label: "Fontes", icon: Radio },
      { to: "/admin/regioes", label: "Regiões e cotas", icon: MapIcon },
      { to: "/admin/agentes", label: "Agentes IA", icon: Bot },
      { to: "/admin/memoria-editorial", label: "Memória editorial", icon: BookOpen },
    ],
  },
  {
    titulo: "Negócios",
    itens: [
      { to: "/admin/anuncios", label: "Anúncios", icon: Megaphone },
      { to: "/admin/vitrine-pessoal", label: "Vitrine Pessoal", icon: UserRound },
      { to: "/admin/cobertura", label: "Cobertura", icon: MapPinned },
      { to: "/admin/imprensa-clientes", label: "Portal Imprensa", icon: Newspaper },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { to: "/admin/instagram", label: "Instagram", icon: Instagram },
      { to: "/admin/resumo-regional", label: "Resumo por região", icon: MessageSquareText },
      { to: "/admin/custos", label: "Custos", icon: Wallet, badge: "custos" },
    ],
  },
  {
    titulo: "Site",
    itens: [
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/admin/sobre", label: "Página Sobre", icon: Info },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { to: "/admin/usuarios", label: "Usuários", icon: Users },
    ],
  },
];

function AdminSidebar({ email, papel, onSair }: { email: string | null; papel: Papel; onSair: () => void }) {
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((it) => podeAbrir(papel, it.to)) })).filter((g) => g.itens.length);
  const loc = useLocation();
  const [badges, setBadges] = useState<{ materias: number; notas: number; custos: number }>({ materias: 0, notas: 0, custos: 0 });

  // Contadores da revisão: atualiza ao trocar de página e a cada 2 min.
  useEffect(() => {
    let alive = true;
    const carregar = async () => {
      const sb = await getExternalBrowser();
      const [m, n, a] = await Promise.all([
        sb.from("generated_articles").select("*", { count: "exact", head: true }).eq("status", "rascunho"),
        sb.from("coluna_cidade_notas").select("*", { count: "exact", head: true }).eq("status", "revisao"),
        sb.from("assinaturas").select("*"),
      ]);
      // Custos: assinaturas vencidas, com saldo baixo ou vencendo em até 7 dias.
      const custos = a.error ? 0 : ((a.data ?? []) as Assinatura[]).filter((x) => situacao(x).nivel <= 2).length;
      if (alive) setBadges({ materias: m.count ?? 0, notas: n.count ?? 0, custos });
    };
    carregar();
    const t = setInterval(carregar, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  return (
    <aside className="sticky top-0 z-30 border-b border-slate-200/70 bg-white md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:py-5">
          <div className="rounded-lg bg-[#12201E] px-2 py-1.5">
            <Logo size="sm" variant="white" withLink={false} />
          </div>
          <a href="/" target="_blank" rel="noreferrer" title="Abrir o site (modo editor)"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-500 hover:text-[#12201E]">
            <Home className="h-3.5 w-3.5" /> Site <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <nav className="flex gap-4 overflow-x-auto px-3 pb-3 text-sm md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto md:pb-6">
          {grupos.map((g) => (
            <div key={g.titulo} className="flex shrink-0 gap-1 md:flex-col">
              <p className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 md:block">{g.titulo}</p>
              {g.itens.map((it) => {
                const n = it.badge ? badges[it.badge] : 0;
                const Icon = it.icon;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    activeOptions={it.exact ? { exact: true } : undefined}
                    className="flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-[#12201E] [&.active]:bg-[#12201E] [&.active]:font-semibold [&.active]:text-white"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{it.label}</span>
                    {n > 0 && (
                      <span className="rounded-full bg-[#E29F65] px-1.5 text-[10px] font-bold tabular-nums text-white">{n}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
          <button onClick={onSair} className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-slate-600 md:hidden">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </nav>

        <div className="hidden border-t border-slate-100 p-3 text-xs md:block">
          <div className="mb-2 flex items-center gap-2 px-1 text-slate-500">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">{email}</span>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/senha" className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-slate-700 hover:border-[#12201E]">
              <KeyRound className="h-3.5 w-3.5" /> Senha
            </Link>
            <button onClick={onSair} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#12201E] px-2 py-1.5 font-semibold text-white hover:bg-[#0d2f52]">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
