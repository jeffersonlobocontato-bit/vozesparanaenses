import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Vozes Paranaenses" },
      {
        name: "description",
        content: "Fale com a redação do Vozes Paranaenses — pautas, assessoria, publicidade e imprensa.",
      },
      { property: "og:title", content: "Contato — Vozes Paranaenses" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "/contato" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contato — Vozes Paranaenses",
          url: "/contato",
          mainEntity: {
            "@type": "NewsMediaOrganization",
            name: "Vozes Paranaenses",
            contactPoint: [
              {
                "@type": "ContactPoint",
                contactType: "Redação",
                email: "contato@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
              {
                "@type": "ContactPoint",
                contactType: "Publicidade",
                email: "publicidade@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
              {
                "@type": "ContactPoint",
                contactType: "Privacidade / LGPD",
                email: "privacidade@vozesparanaenses.com.br",
                availableLanguage: ["Portuguese"],
              },
            ],
          },
        }),
      },
    ],
  }),
  component: Contato,
});

function Card({ title, email, desc }: { title: string; email: string; desc: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A2540]">{title}</div>
      <a
        href={`mailto:${email}`}
        className="mt-2 block font-display text-xl font-bold text-slate-900 hover:text-[#0A2540]"
      >
        {email}
      </a>
      <p className="mt-2 text-sm text-slate-600">{desc}</p>
    </div>
  );
}

function Contato() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    department: "redacao",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setForm({ name: "", email: "", subject: "", department: "redacao", message: "" });
      } else {
        setStatus("error");
        setErrorMessage(data.error || "Não foi possível enviar a mensagem.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Erro de conexão. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SiteHeader />
      <article className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl font-black leading-tight text-[#0A2540] md:text-5xl">
          Fale com a redação
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          Sugestões de pauta, denúncias, direito de resposta, publicidade regional e imprensa —
          escolha o canal e escreva. Respondemos em até dois dias úteis.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="Redação"
            email="contato@vozesparanaenses.com.br"
            desc="Pautas, sugestões, denúncias e direito de resposta."
          />
          <Card
            title="Publicidade"
            email="publicidade@vozesparanaenses.com.br"
            desc="Anúncios regionais, patrocínios e branded content."
          />
          <Card
            title="Privacidade / LGPD"
            email="privacidade@vozesparanaenses.com.br"
            desc="Solicitações de acesso, correção ou exclusão de dados pessoais."
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-10 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              minLength={2}
              maxLength={120}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              maxLength={120}
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
              minLength={3}
              maxLength={200}
              placeholder="Resumo do contato"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="department">Departamento</Label>
            <Select
              value={form.department}
              onValueChange={(value) => setForm((f) => ({ ...f, department: value }))}
            >
              <SelectTrigger id="department">
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="redacao">Redação</SelectItem>
                <SelectItem value="publicidade">Publicidade</SelectItem>
                <SelectItem value="privacidade">Privacidade / LGPD</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              placeholder="Escreva sua mensagem com detalhes..."
            />
          </div>

          <div className="md:col-span-2">
            {status === "success" ? (
              <p className="rounded-lg bg-green-50 p-4 text-green-700">
                Mensagem enviada com sucesso. Retornaremos em até dois dias úteis.
              </p>
            ) : (
              <>
                <Button
                  type="submit"
                  disabled={status === "submitting"}
                  className="bg-[#0A2540] text-white hover:bg-[#0A2540]/90"
                >
                  {status === "submitting" ? "Enviando..." : "Enviar mensagem"}
                </Button>
                {status === "error" && (
                  <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
                )}
              </>
            )}
          </div>
        </form>

        <div className="mt-10 rounded-lg border-l-4 border-[#0A2540] bg-slate-50 p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0A2540]">
            Encontrou erro em uma matéria?
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Use o formulário dedicado em <a href="/correcoes" className="font-semibold text-[#0A2540] underline">correções</a> para
            que o registro fique vinculado à matéria original.
          </p>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}