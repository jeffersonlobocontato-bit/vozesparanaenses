import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { PARANA_MUNICIPIOS, findMunicipio } from "@/lib/parana-municipios";
import { invokeImprensaPublico } from "@/lib/imprensa-invoke";
import { cpfValido, FUNCOES, NOTA_LGPD, TERMO_CADASTRO } from "@/lib/imprensa-termos";

export const Route = createFileRoute("/imprensa/cadastro")({
  head: () => ({
    meta: [
      { title: "Portal da Imprensa — Cadastro de assessoria | Vozes Paranaenses" },
      { name: "description", content: "Cadastro do responsável pela comunicação de prefeituras do Paraná no Portal da Imprensa do Vozes Paranaenses." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ImprensaCadastro,
});

const OUTRA = "Outra função";

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

const campo = "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[#12201E] focus:outline-none";

function ImprensaCadastro() {
  const [prefeitura, setPrefeitura] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [funcao, setFuncao] = useState("");
  const [funcaoOutra, setFuncaoOutra] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [termo, setTermo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const muni = findMunicipio(prefeitura);
    if (!muni) return setErro("Escolha a prefeitura na lista.");
    if (nome.trim().split(/\s+/).length < 2) return setErro("Informe o seu nome completo.");
    if (!cpfValido(cpf)) return setErro("CPF inválido. Confira os números.");
    const funcaoFinal = funcao === OUTRA ? funcaoOutra.trim() : funcao;
    if (!funcaoFinal) return setErro("Informe a sua função.");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== senha2) return setErro("As senhas não conferem.");
    if (!lgpd || !termo) return setErro("Aceite a nota de privacidade e o termo de responsabilidade.");
    setEnviando(true);
    try {
      await invokeImprensaPublico("imprensa-cadastro", {
        cidade_slug: muni.slug,
        nome_completo: nome.trim(),
        cpf,
        funcao: funcaoFinal,
        email: email.trim(),
        senha,
        lgpd_aceito: true,
        termo_aceito: true,
      });
      setFeito(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir o cadastro.");
    } finally {
      setEnviando(false);
    }
  }

  if (feito) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#12201E] px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
          <div className="flex justify-center"><Logo size="sm" variant="blue" withLink={false} /></div>
          <h1 className="mt-4 font-display text-xl font-bold text-[#12201E]">Cadastro recebido</h1>
          <p className="mt-2 text-sm text-slate-600">
            Vamos conferir os seus dados. Assim que o cadastro for aprovado, você entra com o seu e-mail e a senha
            que acabou de criar e já pode publicar.
          </p>
          <Link to="/imprensa/entrar" className="mt-5 inline-block rounded bg-[#E29F65] px-4 py-2 text-sm font-semibold text-white">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#12201E] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Link to="/cidadesdoparana" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-white/75 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      <form onSubmit={enviar} className="w-full space-y-4 rounded-lg bg-white p-6 shadow-xl">
        <div className="flex justify-center pb-1"><Logo size="sm" variant="blue" withLink={false} /></div>
        <h1 className="text-center text-lg font-semibold text-[#12201E]">Cadastro no Portal da Imprensa</h1>
        <p className="text-center text-xs text-slate-500">
          Para o responsável pela comunicação de prefeituras do Paraná. O acesso é liberado após a aprovação do cadastro.
        </p>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Prefeitura</span>
          <input list="lista-prefeituras" required value={prefeitura} onChange={(e) => setPrefeitura(e.target.value)}
            placeholder="Digite o nome da cidade" className={campo} autoComplete="off" />
          <datalist id="lista-prefeituras">
            {PARANA_MUNICIPIOS.map((m) => <option key={m.slug} value={m.name} />)}
          </datalist>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nome completo</span>
          <input required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} autoComplete="name" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">CPF</span>
          <input required inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))}
            placeholder="000.000.000-00" className={campo} />
          <span className="mt-1 block text-xs text-slate-500">Usado só para confirmar que você é o responsável. Nunca aparece no site.</span>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Sua função</span>
          <select required value={funcao} onChange={(e) => setFuncao(e.target.value)} className={campo}>
            <option value="">Selecione</option>
            {FUNCOES.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value={OUTRA}>{OUTRA}</option>
          </select>
        </label>
        {funcao === OUTRA && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Qual função?</span>
            <input required maxLength={80} value={funcaoOutra} onChange={(e) => setFuncaoOutra(e.target.value)} className={campo} />
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">E-mail (será o seu login)</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} autoComplete="email" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Crie uma senha</span>
            <input type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)}
              className={campo} autoComplete="new-password" />
            <span className="mt-1 block text-xs text-slate-500">Mínimo de 8 caracteres.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Repita a senha</span>
            <input type="password" required minLength={8} value={senha2} onChange={(e) => setSenha2(e.target.value)}
              className={campo} autoComplete="new-password" />
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Privacidade (LGPD)</p>
          <p className="mt-1 max-h-28 overflow-y-auto text-xs text-slate-600">{NOTA_LGPD}</p>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={lgpd} onChange={(e) => setLgpd(e.target.checked)} className="mt-1" />
            <span>Li e concordo com o tratamento dos meus dados.</span>
          </label>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Responsabilidade pelas publicações</p>
          <p className="mt-1 max-h-28 overflow-y-auto text-xs text-slate-600">{TERMO_CADASTRO}</p>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={termo} onChange={(e) => setTermo(e.target.checked)} className="mt-1" />
            <span>Declaro que sou o responsável e aceito o termo de responsabilidade.</span>
          </label>
        </div>

        {erro && <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{erro}</p>}

        <button type="submit" disabled={enviando || !lgpd || !termo}
          className="w-full rounded bg-[#E29F65] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? "Enviando cadastro…" : "Enviar cadastro"}
        </button>
        <p className="text-center text-xs text-slate-500">
          Já tem cadastro? <Link to="/imprensa/entrar" className="font-semibold text-[#12201E] underline">Entrar</Link>
        </p>
      </form>
      </div>
    </div>
  );
}
