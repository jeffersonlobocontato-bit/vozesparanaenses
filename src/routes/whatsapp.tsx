import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createWhatsappLead, listRegions } from "@/lib/content.functions";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Logo } from "@/components/Logo";

const regionsQO = queryOptions({
  queryKey: ["regions"],
  queryFn: () => listRegions(),
});

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "Receba no WhatsApp — Vozes Paranaenses" },
      {
        name: "description",
        content:
          "Cadastre-se para receber as principais notícias da sua região do Paraná direto no WhatsApp.",
      },
      { property: "og:title", content: "Receba no WhatsApp — Vozes Paranaenses" },
      {
        property: "og:description",
        content: "Notícias da sua região direto no WhatsApp, com consentimento LGPD.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(regionsQO),
  component: WhatsappPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-slate-600">
      Erro ao carregar. {error.message}
    </div>
  ),
});

function WhatsappPage() {
  const { data: regions } = useSuspenseQuery(regionsQO);
  const router = useRouter();
  const createLead = useServerFn(createWhatsappLead);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [regiaoSlug, setRegiaoSlug] = useState("");
  const [consent, setConsent] = useState(false);

  const mutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      router.navigate({ to: "/" });
    },
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b-4 border-primary bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <Logo size="md" />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-12">
        <h2 className="font-display text-4xl leading-tight text-primary">
          Notícias da sua região no WhatsApp
        </h2>
        <p className="mt-3 text-slate-600">
          Receba um resumo diário das principais matérias da sua macrorregião. Grátis, com opção
          de sair a qualquer momento.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!consent) return;
            mutation.mutate({ data: { nome, telefone, regiaoSlug, fonte: "landing_whatsapp" } });
          }}
        >
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Nome
            </label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              WhatsApp (com DDD)
            </label>
            <input
              required
              placeholder="41 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Sua região
            </label>
            <select
              required
              value={regiaoSlug}
              onChange={(e) => setRegiaoSlug(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Selecione...</option>
              {regions.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              Concordo em receber notícias no WhatsApp e autorizo o tratamento dos meus dados
              conforme a LGPD. Posso cancelar a qualquer momento.
            </span>
          </label>
          <button
            type="submit"
            disabled={!consent || mutation.isPending}
            className="w-full rounded bg-primary px-4 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {mutation.isPending ? "Enviando..." : "Quero receber"}
          </button>
          {mutation.isError && (
            <p className="text-sm text-red-600">
              Não foi possível cadastrar: {(mutation.error as Error).message}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}