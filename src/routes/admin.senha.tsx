import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";

export const Route = createFileRoute("/admin/senha")({
  component: AdminSenha,
});

function AdminSenha() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pwd.length < 8) { setMsg("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (pwd !== pwd2) { setMsg("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.auth.updateUser({ password: pwd });
      if (error) throw error;
      setMsg("Senha atualizada com sucesso.");
      setPwd(""); setPwd2("");
      setTimeout(() => nav({ to: "/admin" }), 900);
    } catch (e: unknown) {
      setMsg("Falha: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Alterar senha</h1>
      <form onSubmit={submit} className="space-y-3 rounded-lg border bg-card p-4">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Nova senha</span>
          <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)}
            className="w-full rounded border px-2 py-1.5" autoComplete="new-password" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Confirmar</span>
          <input type="password" required value={pwd2} onChange={(e) => setPwd2(e.target.value)}
            className="w-full rounded border px-2 py-1.5" autoComplete="new-password" />
        </label>
        <button disabled={busy} className="w-full rounded bg-[#0066CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0055aa] disabled:opacity-60">
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}
