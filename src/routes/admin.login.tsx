import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      nav({ to: "/admin", replace: true });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A2540] px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <div className="flex justify-center pb-2"><Logo size="sm" variant="blue" withLink={false} /></div>
        <h1 className="text-center text-lg font-semibold text-[#0A2540]">Painel Editorial</h1>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">E-mail</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm" autoComplete="email" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Senha</span>
          <input type="password" required value={pass} onChange={(e) => setPass(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm" autoComplete="current-password" />
        </label>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button disabled={busy} type="submit"
          className="w-full rounded bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}