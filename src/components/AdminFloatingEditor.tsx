import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

// Barra flutuante no canto inferior direito que aparece SÓ quando um admin/
// editor está logado no painel e navega o site público. Serve como atalho
// entre a home (ou qualquer página pública) e o editor da matéria no painel
// — o editor humano vê como a matéria ficou publicada, clica em "Editar" e
// já cai no ArticleEditor com todos os campos preenchidos.
export function AdminFloatingEditor() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [role, setRole] = useState<"admin" | "editor" | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const { data: sess } = await sb.auth.getSession();
        if (!alive || !sess.session) { setRole(null); return; }
        const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
          sb.rpc("has_role", { _user_id: sess.session.user.id, _role: "admin" }),
          sb.rpc("has_role", { _user_id: sess.session.user.id, _role: "editor" }),
        ]);
        if (!alive) return;
        if (isAdmin) setRole("admin");
        else if (isEditor) setRole("editor");
        else setRole(null);
      } catch {
        if (alive) setRole(null);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Não mostra no painel admin nem enquanto verifica sessão.
  if (!role) return null;
  if (pathname.startsWith("/admin")) return null;

  // Detecta rota de matéria publicada: /$region/$slug — dois segmentos onde
  // o primeiro NÃO é uma rota reservada (editoria, autor, contato, etc.).
  const segs = pathname.split("/").filter(Boolean);
  const RESERVED = new Set([
    "editoria", "autor", "contato", "sobre", "termos", "privacidade",
    "correcoes", "politica-editorial", "whatsapp", "unsubscribe",
    "publieditorial", "vitrine-pessoal", "vitrine", "email", "r",
    "lovable", "api",
  ]);
  const isArticle = segs.length === 2 && !RESERVED.has(segs[0]);
  const articleSlug = isArticle ? segs[1] : null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 print:hidden">
      {articleSlug && (
        <a
          href={`/admin?edit=${encodeURIComponent(articleSlug)}`}
          className="rounded-full bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-lg ring-2 ring-white transition hover:bg-[#0055aa]"
          title="Abrir o editor desta matéria no painel"
        >
          ✎ Editar esta matéria
        </a>
      )}
      <a
        href="/admin"
        className="rounded-full bg-[#0A2540] px-4 py-2 text-[11px] font-semibold text-white shadow-lg ring-2 ring-white transition hover:bg-[#0d2f52]"
        title="Voltar ao painel editorial"
      >
        🔧 Painel editorial ({role})
      </a>
    </div>
  );
}
