import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, Tabs, Aviso, ErrorBanner, btn } from "@/components/admin/ui";
import type { Advertiser, Campaign, Creative, Target } from "@/components/admin/anuncios/tipos";
import { Campanhas } from "@/components/admin/anuncios/Campanhas";
import { Anunciantes } from "@/components/admin/anuncios/Anunciantes";
import { Criativos } from "@/components/admin/anuncios/Criativos";
import { Publieditorial } from "@/components/admin/anuncios/Publieditorial";
import { Segmentacao } from "@/components/admin/anuncios/Segmentacao";
import { Relatorio } from "@/components/admin/anuncios/Relatorio";

export const Route = createFileRoute("/admin/anuncios")({
  component: AdminAnuncios,
});

type Aba = "campanhas" | "anunciantes" | "criativos" | "publieditorial" | "segmentacao" | "relatorio";

function AdminAnuncios() {
  const [aba, setAba] = useState<Aba>("campanhas");
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tudo vem do banco EXTERNO. As métricas do relatório são contadas na
  // própria aba Relatório, só quando ela é aberta.
  const load = useCallback(async () => {
    try {
      setErr(null);
      const sb = await getExternalBrowser();
      const [a, c, cr, t] = await Promise.all([
        sb.from("advertisers").select("*").order("nome"),
        sb.from("ad_campaigns").select("*").order("criado_em", { ascending: false }),
        sb.from("ad_creatives").select("*").order("criado_em", { ascending: false }),
        sb.from("ad_targets").select("*"),
      ]);
      if (a.error) throw a.error;
      if (c.error) throw c.error;
      if (cr.error) throw cr.error;
      if (t.error) throw t.error;
      setAdvertisers((a.data ?? []) as Advertiser[]);
      setCampaigns((c.data ?? []) as Campaign[]);
      setCreatives((cr.data ?? []) as Creative[]);
      setTargets((t.data ?? []) as Target[]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar os anúncios.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toast = useCallback((m: string) => {
    setMsg(m);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 4000);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monetização"
        title="Anúncios"
        subtitle="Campanhas, anunciantes, criativos, segmentação por local e desempenho."
        actions={<button type="button" onClick={load} className={btn("secondary")}>Atualizar</button>}
      />

      <Tabs<Aba>
        value={aba}
        onChange={setAba}
        items={[
          { value: "campanhas", label: "Campanhas", count: campaigns.length },
          { value: "anunciantes", label: "Anunciantes", count: advertisers.length },
          { value: "criativos", label: "Criativos", count: creatives.length },
          { value: "publieditorial", label: "Publieditorial" },
          { value: "segmentacao", label: "Segmentação", count: targets.length },
          { value: "relatorio", label: "Relatório" },
        ]}
      />

      {msg && <Aviso tipo={msg.startsWith("Erro") ? "erro" : "ok"}>{msg}</Aviso>}
      {err && <ErrorBanner>{err}</ErrorBanner>}

      {aba === "campanhas" && <Campanhas campaigns={campaigns} advertisers={advertisers} reload={load} onToast={toast} />}
      {aba === "anunciantes" && <Anunciantes advertisers={advertisers} reload={load} onToast={toast} />}
      {aba === "criativos" && <Criativos creatives={creatives} campaigns={campaigns} reload={load} onToast={toast} />}
      {aba === "publieditorial" && <Publieditorial campaigns={campaigns} onToast={toast} />}
      {aba === "segmentacao" && <Segmentacao targets={targets} campaigns={campaigns} reload={load} onToast={toast} />}
      {aba === "relatorio" && <Relatorio creatives={creatives} campaigns={campaigns} />}
    </div>
  );
}
