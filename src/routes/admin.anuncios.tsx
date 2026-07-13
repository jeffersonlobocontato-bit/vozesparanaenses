import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { PageHeader, refreshBtnClass, tabPillsWrapClass, tabPillClass } from "@/components/admin/ui";

export const Route = createFileRoute("/admin/anuncios")({
  component: AdminAnuncios,
});

type Advertiser = {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  regiao_slug: string | null;
  ativo: boolean;
};

type Campaign = {
  id: string;
  advertiser_id: string;
  nome: string;
  status: "rascunho" | "ativa" | "pausada" | "encerrada";
  data_inicio: string;
  data_fim: string;
  editorias: string[];
  observacoes: string | null;
};

type Creative = {
  id: string;
  campaign_id: string;
  imagem_url: string;
  imagem_storage_path: string | null;
  headline: string;
  cta_texto: string;
  destino_url: string;
  peso: number;
  aprovado: boolean;
};

type Target = {
  id: string;
  campaign_id: string;
  escopo: "cidade" | "regiao" | "estado";
  valor: string;
  regiao_slug: string | null;
  cap_impressoes_dia: number;
};

type Metric = { creative_id: string; impressoes: number; cliques: number };

type Tab = "anunciantes" | "campanhas" | "criativos" | "targeting" | "relatorio";

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function AdminAnuncios() {
  const [tab, setTab] = useState<Tab>("campanhas");
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
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

      const [imps, cls] = await Promise.all([
        sb.from("ad_impressions").select("creative_id"),
        sb.from("ad_clicks").select("creative_id"),
      ]);
      const impMap = new Map<string, number>();
      const clkMap = new Map<string, number>();
      for (const r of imps.data ?? []) impMap.set(r.creative_id, (impMap.get(r.creative_id) ?? 0) + 1);
      for (const r of cls.data ?? []) clkMap.set(r.creative_id, (clkMap.get(r.creative_id) ?? 0) + 1);
      const ids = new Set([...impMap.keys(), ...clkMap.keys()]);
      setMetrics(Array.from(ids).map((id) => ({
        creative_id: id, impressoes: impMap.get(id) ?? 0, cliques: clkMap.get(id) ?? 0,
      })));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Monetização"
        title="Anúncios"
        subtitle="Anunciantes, campanhas, criativos, targeting e performance."
        actions={<button onClick={load} className={refreshBtnClass()}>Atualizar</button>}
      />

      <div className={tabPillsWrapClass() + " w-fit"}>
        {(["campanhas","anunciantes","criativos","targeting","relatorio"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`capitalize ${tabPillClass(tab===t)}`}>
            {t}
          </button>
        ))}
      </div>

      {msg && <p className="rounded border bg-emerald-50 p-2 text-xs text-emerald-800">{msg}</p>}
      {err && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</p>}

      {tab === "anunciantes" && (
        <AdvertisersTab advertisers={advertisers} reload={load} onToast={toast} />
      )}
      {tab === "campanhas" && (
        <CampaignsTab campaigns={campaigns} advertisers={advertisers} reload={load} onToast={toast} />
      )}
      {tab === "criativos" && (
        <CreativesTab creatives={creatives} campaigns={campaigns} reload={load} onToast={toast} />
      )}
      {tab === "targeting" && (
        <TargetingTab targets={targets} campaigns={campaigns} reload={load} onToast={toast} />
      )}
      {tab === "relatorio" && (
        <ReportTab metrics={metrics} creatives={creatives} campaigns={campaigns} />
      )}
    </div>
  );
}

/* ------------------------- Anunciantes ------------------------- */
function AdvertisersTab({ advertisers, reload, onToast }: {
  advertisers: Advertiser[]; reload: () => void; onToast: (s: string) => void;
}) {
  const [form, setForm] = useState({ nome: "", cnpj: "", email: "", telefone: "", cidade: "", regiao_slug: "" });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = await getExternalBrowser();
    const { error } = await sb.from("advertisers").insert({
      nome: form.nome,
      cnpj: form.cnpj || null,
      email: form.email || null,
      telefone: form.telefone || null,
      cidade: form.cidade || null,
      regiao_slug: form.regiao_slug || null,
    });
    if (error) { onToast("Erro: " + error.message); return; }
    setForm({ nome: "", cnpj: "", email: "", telefone: "", cidade: "", regiao_slug: "" });
    onToast("Anunciante criado."); reload();
  }
  async function toggle(a: Advertiser) {
    const sb = await getExternalBrowser();
    await sb.from("advertisers").update({ ativo: !a.ativo }).eq("id", a.id);
    reload();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:grid-cols-6">
        <input required placeholder="Nome*" value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})} className="col-span-2 rounded border px-2 py-1 text-sm" />
        <input placeholder="CNPJ" value={form.cnpj} onChange={(e)=>setForm({...form,cnpj:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input placeholder="E-mail" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Telefone" value={form.telefone} onChange={(e)=>setForm({...form,telefone:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Cidade" value={form.cidade} onChange={(e)=>setForm({...form,cidade:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Região (slug)" value={form.regiao_slug} onChange={(e)=>setForm({...form,regiao_slug:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <button className="col-span-2 rounded bg-[#0066CC] px-3 py-1.5 text-sm font-semibold text-white md:col-span-1">Criar</button>
      </form>
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Nome</th><th className="px-2 py-1 text-left">Cidade</th><th className="px-2 py-1 text-left">Contato</th><th className="px-2 py-1">Ativo</th></tr>
        </thead>
        <tbody>
          {advertisers.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-2 py-1">{a.nome}</td>
              <td className="px-2 py-1 text-muted-foreground">{a.cidade ?? "—"} {a.regiao_slug && <span className="text-xs">/{a.regiao_slug}</span>}</td>
              <td className="px-2 py-1 text-xs text-muted-foreground">{a.email ?? "—"} · {a.telefone ?? "—"}</td>
              <td className="px-2 py-1 text-center"><button onClick={()=>toggle(a)} className={`rounded px-2 py-0.5 text-xs ${a.ativo?"bg-emerald-100 text-emerald-800":"bg-slate-100 text-slate-500"}`}>{a.ativo?"sim":"não"}</button></td>
            </tr>
          ))}
          {!advertisers.length && <tr><td colSpan={4} className="px-2 py-4 text-center text-muted-foreground">Nenhum anunciante.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Campanhas -------------------------- */
function CampaignsTab({ campaigns, advertisers, reload, onToast }: {
  campaigns: Campaign[]; advertisers: Advertiser[]; reload: () => void; onToast: (s: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    advertiser_id: "", nome: "", data_inicio: today, data_fim: in30, editorias: "", observacoes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    advertiser_id: string; nome: string; data_inicio: string; data_fim: string;
    editorias: string; observacoes: string;
  }>({ advertiser_id: "", nome: "", data_inicio: "", data_fim: "", editorias: "", observacoes: "" });

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    setEdit({
      advertiser_id: c.advertiser_id,
      nome: c.nome,
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      editorias: (c.editorias ?? []).join(", "),
      observacoes: c.observacoes ?? "",
    });
  }
  async function saveEdit(c: Campaign) {
    if (!edit.nome.trim() || !edit.advertiser_id) return onToast("Preencha anunciante e nome.");
    const sb = await getExternalBrowser();
    const { error } = await sb.from("ad_campaigns").update({
      advertiser_id: edit.advertiser_id,
      nome: edit.nome.trim(),
      data_inicio: edit.data_inicio,
      data_fim: edit.data_fim,
      editorias: edit.editorias.split(",").map((s) => s.trim()).filter(Boolean),
      observacoes: edit.observacoes || null,
    }).eq("id", c.id);
    if (error) return onToast("Erro: " + error.message);
    setEditingId(null);
    onToast("Campanha atualizada.");
    reload();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.advertiser_id) return onToast("Selecione um anunciante.");
    const sb = await getExternalBrowser();
    const { error } = await sb.from("ad_campaigns").insert({
      advertiser_id: form.advertiser_id,
      nome: form.nome,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      editorias: form.editorias.split(",").map((s)=>s.trim()).filter(Boolean),
      observacoes: form.observacoes || null,
    });
    if (error) return onToast("Erro: " + error.message);
    onToast("Campanha criada."); reload();
    setForm({ ...form, nome: "", editorias: "", observacoes: "" });
  }
  async function updateStatus(c: Campaign, status: Campaign["status"]) {
    const sb = await getExternalBrowser();
    await sb.from("ad_campaigns").update({ status }).eq("id", c.id);
    reload();
  }
  async function remove(c: Campaign) {
    if (!confirm(`Remover campanha "${c.nome}"? Isso apaga criativos e targets.`)) return;
    const sb = await getExternalBrowser();
    await sb.from("ad_campaigns").delete().eq("id", c.id);
    reload();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:grid-cols-6">
        <select required value={form.advertiser_id} onChange={(e)=>setForm({...form,advertiser_id:e.target.value})} className="col-span-2 rounded border px-2 py-1 text-sm">
          <option value="">Anunciante*</option>
          {advertisers.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
        <input required placeholder="Nome campanha*" value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})} className="col-span-2 rounded border px-2 py-1 text-sm" />
        <input type="date" value={form.data_inicio} onChange={(e)=>setForm({...form,data_inicio:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input type="date" value={form.data_fim} onChange={(e)=>setForm({...form,data_fim:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input placeholder="Editorias (slugs, vírgula)" value={form.editorias} onChange={(e)=>setForm({...form,editorias:e.target.value})} className="col-span-4 rounded border px-2 py-1 text-sm" />
        <input placeholder="Observações" value={form.observacoes} onChange={(e)=>setForm({...form,observacoes:e.target.value})} className="col-span-4 rounded border px-2 py-1 text-sm" />
        <button className="col-span-2 rounded bg-[#0066CC] px-3 py-1.5 text-sm font-semibold text-white">Criar campanha</button>
      </form>
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Campanha</th><th className="px-2 py-1 text-left">Anunciante</th><th className="px-2 py-1">Janela</th><th className="px-2 py-1">Editorias</th><th className="px-2 py-1">Status</th><th></th></tr>
        </thead>
        <tbody>
          {campaigns.map((c) => {
            const adv = advertisers.find((a) => a.id === c.advertiser_id);
            if (editingId === c.id) {
              return (
                <tr key={c.id} className="border-t bg-slate-50">
                  <td className="px-2 py-1">
                    <input value={edit.nome} onChange={(e)=>setEdit({...edit,nome:e.target.value})} className="w-full rounded border px-2 py-1 text-sm" />
                  </td>
                  <td className="px-2 py-1">
                    <select value={edit.advertiser_id} onChange={(e)=>setEdit({...edit,advertiser_id:e.target.value})} className="w-full rounded border px-1 py-0.5 text-xs">
                      {advertisers.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex flex-col gap-1">
                      <input type="date" value={edit.data_inicio} onChange={(e)=>setEdit({...edit,data_inicio:e.target.value})} className="rounded border px-1 py-0.5 text-xs" />
                      <input type="date" value={edit.data_fim} onChange={(e)=>setEdit({...edit,data_fim:e.target.value})} className="rounded border px-1 py-0.5 text-xs" />
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <input value={edit.editorias} onChange={(e)=>setEdit({...edit,editorias:e.target.value})} placeholder="slugs, vírgula" className="w-full rounded border px-1 py-0.5 text-xs" />
                    <input value={edit.observacoes} onChange={(e)=>setEdit({...edit,observacoes:e.target.value})} placeholder="observações" className="mt-1 w-full rounded border px-1 py-0.5 text-xs" />
                  </td>
                  <td className="px-2 py-1 text-xs text-muted-foreground">{c.status}</td>
                  <td className="px-2 py-1 text-right">
                    <button onClick={()=>saveEdit(c)} className="mr-2 text-xs font-semibold text-emerald-700 hover:underline">salvar</button>
                    <button onClick={()=>setEditingId(null)} className="text-xs text-slate-500 hover:underline">cancelar</button>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={c.id} className="border-t">
                <td className="px-2 py-1">{c.nome}</td>
                <td className="px-2 py-1 text-muted-foreground">{adv?.nome ?? "—"}</td>
                <td className="px-2 py-1 text-xs text-muted-foreground">{c.data_inicio} → {c.data_fim}</td>
                <td className="px-2 py-1 text-xs">{c.editorias.length ? c.editorias.join(", ") : <span className="text-muted-foreground">todas</span>}</td>
                <td className="px-2 py-1">
                  <select value={c.status} onChange={(e)=>updateStatus(c, e.target.value as Campaign["status"])} className="rounded border px-1 py-0.5 text-xs">
                    <option value="rascunho">rascunho</option><option value="ativa">ativa</option>
                    <option value="pausada">pausada</option><option value="encerrada">encerrada</option>
                  </select>
                </td>
                <td className="px-2 py-1 text-right">
                  <button onClick={()=>startEdit(c)} className="mr-2 text-xs text-[#0066CC] hover:underline">editar</button>
                  <button onClick={()=>remove(c)} className="text-xs text-red-600 hover:underline">excluir</button>
                </td>
              </tr>
            );
          })}
          {!campaigns.length && <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">Nenhuma campanha.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Criativos -------------------------- */
function CreativesTab({ creatives, campaigns, reload, onToast }: {
  creatives: Creative[]; campaigns: Campaign[]; reload: () => void; onToast: (s: string) => void;
}) {
  const [form, setForm] = useState({
    campaign_id: "", headline: "", cta_texto: "Saiba mais", destino_url: "", peso: 1,
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.campaign_id || !file) return onToast("Selecione campanha e imagem.");
    setUploading(true);
    try {
      const sb = await getExternalBrowser();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${form.campaign_id}/${crypto.randomUUID()}.${ext}`;
      const up = await sb.storage.from("ad-creatives").upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const { data: pub } = sb.storage.from("ad-creatives").getPublicUrl(path);
      const { error } = await sb.from("ad_creatives").insert({
        campaign_id: form.campaign_id,
        imagem_url: pub.publicUrl,
        imagem_storage_path: path,
        headline: form.headline,
        cta_texto: form.cta_texto,
        destino_url: form.destino_url,
        peso: form.peso,
      });
      if (error) throw error;
      onToast("Criativo enviado. Aguarda aprovação.");
      setForm({ campaign_id: "", headline: "", cta_texto: "Saiba mais", destino_url: "", peso: 1 });
      setFile(null); reload();
    } catch (e: unknown) {
      onToast("Erro: " + (e instanceof Error ? e.message : "upload falhou"));
    } finally { setUploading(false); }
  }

  async function approve(cr: Creative, approved: boolean) {
    const sb = await getExternalBrowser();
    const { data: sess } = await sb.auth.getSession();
    await sb.from("ad_creatives").update({
      aprovado: approved,
      aprovado_por: approved ? sess.session?.user.id : null,
      aprovado_em: approved ? new Date().toISOString() : null,
    }).eq("id", cr.id);
    reload();
  }

  async function remove(cr: Creative) {
    if (!confirm("Remover este criativo?")) return;
    const sb = await getExternalBrowser();
    if (cr.imagem_storage_path) {
      await sb.storage.from("ad-creatives").remove([cr.imagem_storage_path]);
    }
    await sb.from("ad_creatives").delete().eq("id", cr.id);
    reload();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:grid-cols-6">
        <select required value={form.campaign_id} onChange={(e)=>setForm({...form,campaign_id:e.target.value})} className="col-span-2 rounded border px-2 py-1 text-sm">
          <option value="">Campanha*</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input required placeholder="Headline*" value={form.headline} onChange={(e)=>setForm({...form,headline:e.target.value})} className="col-span-4 rounded border px-2 py-1 text-sm" />
        <input placeholder="CTA" value={form.cta_texto} onChange={(e)=>setForm({...form,cta_texto:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input required type="url" placeholder="URL destino*" value={form.destino_url} onChange={(e)=>setForm({...form,destino_url:e.target.value})} className="col-span-3 rounded border px-2 py-1 text-sm" />
        <input type="number" min={1} max={10} placeholder="Peso" value={form.peso} onChange={(e)=>setForm({...form,peso:Number(e.target.value)})} className="rounded border px-2 py-1 text-sm" />
        <input required type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} className="col-span-4 rounded border px-2 py-1 text-sm" />
        <button disabled={uploading} className="col-span-2 rounded bg-[#0066CC] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">{uploading?"Enviando…":"Enviar criativo"}</button>
      </form>

      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {creatives.map((cr) => {
          const camp = campaigns.find((c) => c.id === cr.campaign_id);
          return (
            <li key={cr.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[16/9] bg-slate-100">
                <img src={cr.imagem_url} alt={cr.headline} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-1 p-3 text-sm">
                <p className="text-xs text-muted-foreground">{camp?.nome ?? "—"} · peso {cr.peso}</p>
                <p className="font-semibold leading-tight">{cr.headline}</p>
                <p className="truncate text-xs text-muted-foreground">{cr.destino_url}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cr.aprovado?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{cr.aprovado?"aprovado":"pendente"}</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={()=>approve(cr, !cr.aprovado)} className="text-[#0066CC] hover:underline">{cr.aprovado?"reprovar":"aprovar"}</button>
                    <button onClick={()=>remove(cr)} className="text-red-600 hover:underline">excluir</button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {!creatives.length && <li className="col-span-full py-6 text-center text-sm text-muted-foreground">Nenhum criativo.</li>}
      </ul>
    </div>
  );
}

/* --------------------------- Targeting -------------------------- */
function TargetingTab({ targets, campaigns, reload, onToast }: {
  targets: Target[]; campaigns: Campaign[]; reload: () => void; onToast: (s: string) => void;
}) {
  const [form, setForm] = useState({
    campaign_id: "", escopo: "cidade" as Target["escopo"], valor: "", regiao_slug: "", cap: 500,
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.campaign_id) return onToast("Selecione uma campanha.");
    if (form.escopo !== "estado" && !form.valor) return onToast("Preencha o valor (cidade ou região).");
    const sb = await getExternalBrowser();
    const valor = form.escopo === "cidade" ? slugify(form.valor)
      : form.escopo === "estado" ? "pr" : slugify(form.valor);
    const { error } = await sb.from("ad_targets").insert({
      campaign_id: form.campaign_id,
      escopo: form.escopo,
      valor,
      regiao_slug: form.regiao_slug || null,
      cap_impressoes_dia: form.cap,
    });
    if (error) return onToast("Erro: " + error.message);
    onToast("Target adicionado.");
    setForm({ ...form, valor: "", regiao_slug: "" });
    reload();
  }
  async function remove(t: Target) {
    const sb = await getExternalBrowser();
    await sb.from("ad_targets").delete().eq("id", t.id);
    reload();
  }
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:grid-cols-6">
        <select required value={form.campaign_id} onChange={(e)=>setForm({...form,campaign_id:e.target.value})} className="col-span-2 rounded border px-2 py-1 text-sm">
          <option value="">Campanha*</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={form.escopo} onChange={(e)=>setForm({...form,escopo:e.target.value as Target["escopo"]})} className="rounded border px-2 py-1 text-sm">
          <option value="cidade">cidade</option><option value="regiao">região</option><option value="estado">estado (PR)</option>
        </select>
        <input disabled={form.escopo==="estado"} placeholder={form.escopo==="estado"?"pr":"valor (nome/slug)"} value={form.escopo==="estado"?"pr":form.valor} onChange={(e)=>setForm({...form,valor:e.target.value})} className="rounded border px-2 py-1 text-sm disabled:bg-slate-100" />
        <input placeholder="Região (slug, opc.)" value={form.regiao_slug} onChange={(e)=>setForm({...form,regiao_slug:e.target.value})} className="rounded border px-2 py-1 text-sm" />
        <input type="number" min={1} value={form.cap} onChange={(e)=>setForm({...form,cap:Number(e.target.value)})} className="rounded border px-2 py-1 text-sm" title="Cap/dia" />
        <button className="col-span-2 rounded bg-[#0066CC] px-3 py-1.5 text-sm font-semibold text-white">Adicionar target</button>
      </form>

      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Campanha</th><th className="px-2 py-1">Escopo</th><th className="px-2 py-1">Valor</th><th className="px-2 py-1">Região</th><th className="px-2 py-1">Cap/dia</th><th></th></tr>
        </thead>
        <tbody>
          {targets.map((t) => {
            const camp = campaigns.find((c) => c.id === t.campaign_id);
            return (
              <tr key={t.id} className="border-t">
                <td className="px-2 py-1">{camp?.nome ?? "—"}</td>
                <td className="px-2 py-1 text-center text-xs">{t.escopo}</td>
                <td className="px-2 py-1 text-center">{t.valor}</td>
                <td className="px-2 py-1 text-center text-xs text-muted-foreground">{t.regiao_slug ?? "—"}</td>
                <td className="px-2 py-1 text-center">{t.cap_impressoes_dia}</td>
                <td className="px-2 py-1 text-right"><button onClick={()=>remove(t)} className="text-xs text-red-600 hover:underline">remover</button></td>
              </tr>
            );
          })}
          {!targets.length && <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">Nenhum target configurado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Relatório -------------------------- */
function ReportTab({ metrics, creatives, campaigns }: {
  metrics: Metric[]; creatives: Creative[]; campaigns: Campaign[];
}) {
  const rows = metrics
    .map((m) => {
      const cr = creatives.find((c) => c.id === m.creative_id);
      const camp = cr ? campaigns.find((c) => c.id === cr.campaign_id) : undefined;
      const ctr = m.impressoes ? (m.cliques / m.impressoes) * 100 : 0;
      return { ...m, cr, camp, ctr };
    })
    .sort((a, b) => b.impressoes - a.impressoes);
  const totalImp = rows.reduce((s, r) => s + r.impressoes, 0);
  const totalClk = rows.reduce((s, r) => s + r.cliques, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3"><p className="text-xs uppercase text-muted-foreground">Impressões</p><p className="text-2xl font-bold">{totalImp}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3"><p className="text-xs uppercase text-muted-foreground">Cliques</p><p className="text-2xl font-bold">{totalClk}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3"><p className="text-xs uppercase text-muted-foreground">CTR</p><p className="text-2xl font-bold">{totalImp?((totalClk/totalImp)*100).toFixed(2):"0.00"}%</p></div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr><th className="px-2 py-1 text-left">Criativo</th><th className="px-2 py-1 text-left">Campanha</th><th className="px-2 py-1">Impr.</th><th className="px-2 py-1">Cliques</th><th className="px-2 py-1">CTR</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.creative_id} className="border-t">
              <td className="px-2 py-1 max-w-md truncate">{r.cr?.headline ?? r.creative_id}</td>
              <td className="px-2 py-1 text-muted-foreground">{r.camp?.nome ?? "—"}</td>
              <td className="px-2 py-1 text-center">{r.impressoes}</td>
              <td className="px-2 py-1 text-center">{r.cliques}</td>
              <td className="px-2 py-1 text-center">{r.ctr.toFixed(2)}%</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">Sem métricas ainda.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}