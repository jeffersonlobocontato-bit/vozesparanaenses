import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/admin/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Vozes Paranaenses" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      // Supabase entrega o token no hash (#access_token=...&type=recovery).
      // O cliente detecta e cria sessão temporária de recuperação.
      await getExternalBrowser();
      setReady(true);
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (pass.length < 8) { setErr("A senha deve ter ao menos 8 caracteres."); return; }
    if (pass !== pass2) { setErr("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) throw error;
      setMsg("Senha redefinida. Redirecionando…");
      setTimeout(() => nav({ to: "/admin", replace: true }), 900);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A2540] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <div className="flex justify-center pb-2"><Logo size="sm" variant="blue" withLink={false} /></div>
        <h1 className="text-center text-lg font-semibold text-[#0A2540]">Redefinir senha</h1>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Nova senha</span>
          <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm" autoComplete="new-password" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Confirme a senha</span>
          <input type="password" required value={pass2} onChange={(e) => setPass2(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm" autoComplete="new-password" />
        </label>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {msg && <p className="text-xs text-green-700">{msg}</p>}
        <button disabled={busy || !ready} type="submit"
          className="w-full rounded bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}