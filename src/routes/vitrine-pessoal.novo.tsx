import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { listRegions, listCategorias } from "@/lib/content.functions";

export const Route = createFileRoute("/vitrine-pessoal/novo")({
  head: () => ({
    meta: [
      { title: "Vitrine Pessoal — Sua matéria no Vozes Paranaenses" },
      { name: "description", content: "Tenha uma matéria sobre o seu trabalho publicada com a credibilidade de um portal estadual, por R$ 199." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: VitrinePessoalForm,
});

type Regiao = { id: string; nome: string };
type Categoria = { id: string; nome: string };

function VitrinePessoalForm() {
  const navigate = useNavigate();
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState({
    nome_cliente: "", contato: "", profissao: "",
    sobre_pessoa_ou_empresa: "" as "" | "pessoa" | "empresa",
    regiao_id: "", categoria_id: "", briefing_texto: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoEmpresa, setAvisoEmpresa] = useState(false);

  useEffect(() => {
    listRegions().then((r) => setRegioes(r.map((x) => ({ id: x.id, nome: x.name })))).catch(() => {});
    listCategorias().then((c) => setCategorias(c.map((x) => ({ id: x.id, nome: x.name })))).catch(() => {});
  }, []);

  function escolherTipo(v: "pessoa" | "empresa") {
    setForm({ ...form, sobre_pessoa_ou_empresa: v });
    setAvisoEmpresa(v === "empresa");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (form.sobre_pessoa_ou_empresa !== "pessoa") {
      setAvisoEmpresa(true);
      return;
    }
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("vitrine-pessoal-criar", {
        body: {
          nome_cliente: form.nome_cliente,
          contato: form.contato,
          profissao: form.profissao,
          sobre_pessoa_ou_empresa: form.sobre_pessoa_ou_empresa,
          regiao_id: form.regiao_id,
          categoria_id: form.categoria_id || null,
          briefing_texto: form.briefing_texto,
        },
      });
      if (error) throw error;
      const token = (data as { token?: string })?.token;
      if (!token) throw new Error("Não recebemos o link de edição. Tente novamente.");
      navigate({ to: "/vitrine/$token", params: { token } });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar seu rascunho agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <span className="rounded-full bg-[#0066CC]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#0066CC]">
            Vitrine Pessoal — R$ 199
          </span>
          <h1 className="font-display mt-3 text-3xl font-black text-[#0A2540] md:text-4xl">
            Sua trajetória, contada com a credibilidade de um portal estadual
          </h1>
          <p className="mt-3 text-slate-600">
            Preencha o briefing abaixo, nossa IA já redige um rascunho, e você mesmo edita antes de enviar
            para aprovação. Link próprio pra você compartilhar assim que publicar.
          </p>
        </div>

        <form onSubmit={enviar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Essa matéria é sobre você (seu trabalho, sua trajetória) ou sobre uma empresa/marca?
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => escolherTipo("pessoa")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold ${form.sobre_pessoa_ou_empresa === "pessoa" ? "border-[#0066CC] bg-[#0066CC]/10 text-[#0066CC]" : "border-slate-300 text-slate-600"}`}>
                Sobre mim (profissional liberal)
              </button>
              <button type="button" onClick={() => escolherTipo("empresa")}
                className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold ${form.sobre_pessoa_ou_empresa === "empresa" ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-600"}`}>
                Sobre uma empresa/marca
              </button>
            </div>
          </div>

          {avisoEmpresa && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              A Vitrine Pessoal é específica para profissional liberal falando sobre o próprio trabalho.
              Para empresa, temos pacotes de publieditorial e combos de anúncio — fale com nosso time comercial
              pelo chat no canto da tela pra ver as opções certas pro seu negócio.
            </div>
          )}

          {form.sobre_pessoa_ou_empresa === "pessoa" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Seu nome*</span>
                  <input required value={form.nome_cliente} onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Telefone ou e-mail*</span>
                  <input required value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Sua profissão/área de atuação*</span>
                <input required value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })}
                  placeholder="Ex: advogado, personal trainer, arquiteta, consultor financeiro…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Região*</span>
                  <select required value={form.regiao_id} onChange={(e) => setForm({ ...form, regiao_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">Selecione</option>
                    {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Área (opcional)</span>
                  <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2">
                    <option value="">Não sei / tanto faz</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Conte sobre seu trabalho* — o que você faz, sua trajetória, diferenciais, algo marcante que
                  queira destacar. Quanto mais detalhe, melhor o rascunho.
                </span>
                <textarea required rows={6} value={form.briefing_texto} onChange={(e) => setForm({ ...form, briefing_texto: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              {erro && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

              <button disabled={enviando} className="w-full rounded-lg bg-[#0066CC] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                {enviando ? "Gerando seu rascunho…" : "Gerar meu rascunho com IA"}
              </button>
              <p className="text-center text-xs text-slate-500">
                Sem cobrança agora — você revisa e edita antes de qualquer pagamento.
              </p>
            </>
          )}
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
