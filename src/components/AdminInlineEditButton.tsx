import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

// Botão inline "Editar esta matéria" exibido logo abaixo do título da
// matéria, visível SÓ para admins/editores logados. Complementa o
// AdminFloatingEditor (canto inferior), tornando a edição óbvia enquanto
// o editor lê a matéria publicada.
export function AdminInlineEditButton({ slug }: { slug: string }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sb = await getExternalBrowser();
        const { data: sess } = await sb.auth.getSession();
        if (!alive || !sess.session) return;
        const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
          sb.rpc("has_role", { _user_id: sess.session.user.id, _role: "admin" }),
          sb.rpc("has_role", { _user_id: sess.session.user.id, _role: "editor" }),
        ]);
        if (!alive) return;
        if (isAdmin || isEditor) setAllowed(true);
      } catch {
        /* silencioso — leitor anônimo */
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!allowed) return null;

  return (
    <div className="mt-4 print:hidden">
      <a
        href={`/admin?edit=${encodeURIComponent(slug)}`}
        className="inline-flex items-center gap-2 rounded-full bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-sm ring-1 ring-[#0066CC]/20 transition hover:bg-[#0055aa]"
        title="Abrir esta matéria no editor do painel"
      >
        ✎ Editar esta matéria
      </a>
    </div>
  );
}