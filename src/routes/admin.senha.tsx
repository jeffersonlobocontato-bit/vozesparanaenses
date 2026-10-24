import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, Section, Aviso, btn, campoClass, rotuloClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/senha")({
  component: AdminSenha,
});

function AdminSenha() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pwd.length < 8) { setMsg({ tipo: "erro", texto: "A senha precisa ter pelo menos 8 caracteres." }); return; }
    if (pwd !== pwd2) { setMsg({ tipo: "erro", texto: "As duas senhas não são iguais." }); return; }
    setBusy(true);
    try {
      const sb = await getExternalBrowser();
      const { error } = await sb.auth.updateUser({ password: pwd });
      if (error) throw error;
      setMsg({ tipo: "ok", texto: "Senha atualizada. Voltando ao painel…" });
      setPwd(""); setPwd2("");
      setTimeout(() => nav({ to: "/admin" }), 900);
    } catch (e: unknown) {
      setMsg({ tipo: "erro", texto: "Não foi possível trocar a senha: " + (e instanceof Error ? e.message : "erro desconhecido") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Conta" title="Alterar senha" subtitle="Use pelo menos 8 caracteres." />
      <Section title="Nova senha" className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <label className={rotuloClass}>
            Nova senha
            <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)}
              className={campoClass} autoComplete="new-password" />
          </label>
          <label className={rotuloClass}>
            Repita a nova senha
            <input type="password" required value={pwd2} onChange={(e) => setPwd2(e.target.value)}
              className={campoClass} autoComplete="new-password" />
          </label>
          <button type="submit" disabled={busy} className={`${btn("primary")} w-full`}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        </form>
      </Section>
    </div>
  );
}
