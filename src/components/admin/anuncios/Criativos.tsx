import { useState, type FormEvent } from "react";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { AD_SLOTS, AD_SLOT_LIST, needsMobileVariant, type AdSlotName } from "@/lib/ad-slots";
import { Section, btn, ConfirmButton, StatusPill, campoClass, rotuloClass, EmptyState } from "@/components/admin/ui";
import { CreativeFitPreview } from "./CreativeFitPreview";
import type { Campaign, Creative, Sb, Toast } from "./tipos";

const FORM_VAZIO = { campaign_id: "", slot: "" as "" | AdSlotName, headline: "", cta_texto: "Saiba mais", destino_url: "", peso: 1 };

export function Criativos({ creatives, campaigns, reload, onToast }: {
  creatives: Creative[]; campaigns: Campaign[]; reload: () => void; onToast: Toast;
}) {
  // Formulário unificado: o operador escolhe UM espaço do portal e sobe
  // uma peça pra desktop e (se o espaço exigir formato diferente) outra
  // pra mobile. As duas viram registros distintos em ad_creatives, cada
  // um com (slot, variante) próprios — o pickAd escolhe pela viewport.
  const [form, setForm] = useState(FORM_VAZIO);
  const [fileDesktop, setFileDesktop] = useState<File | null>(null);
  const [fileMobile, setFileMobile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  // Muda a key dos inputs de arquivo para limpá-los depois do envio.
  const [formKey, setFormKey] = useState(0);

  const slotDef = form.slot ? AD_SLOTS[form.slot] : null;
  const requiresMobile = form.slot ? needsMobileVariant(form.slot) : false;

  async function uploadOne(sb: Sb, file: File, variante: "desktop" | "mobile", slot: AdSlotName, formato: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${form.campaign_id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage
      .from("ad-creatives")
      .upload(path, file, { upsert: false, contentType: file.type });
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
      formato,
      slot,
      variante,
    });
    if (error) throw error;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.campaign_id || !form.slot) return onToast("Selecione campanha e espaço.");
    if (!fileDesktop) return onToast("Envie a arte desktop.");
    if (requiresMobile && !fileMobile) {
      return onToast(`Este espaço exige também a arte mobile (${slotDef!.mobile}).`);
    }
    setUploading(true);
    try {
      const sb = await getExternalBrowser();
      const slot = form.slot as AdSlotName;
      await uploadOne(sb, fileDesktop, "desktop", slot, AD_SLOTS[slot].desktop);
      if (requiresMobile && fileMobile) {
        await uploadOne(sb, fileMobile, "mobile", slot, AD_SLOTS[slot].mobile);
      } else if (!requiresMobile) {
        // Espaços com formato único (ex.: 300x250) atendem desktop e mobile
        // com a mesma peça — subimos um segundo registro com variante 'mobile'
        // apontando pra mesma imagem, pra pickAd casar em qualquer viewport.
        await uploadOne(sb, fileDesktop, "mobile", slot, AD_SLOTS[slot].mobile);
      }
      onToast("Criativo enviado. Aguarda aprovação.");
      setForm(FORM_VAZIO);
      setFileDesktop(null);
      setFileMobile(null);
      setFormKey((k) => k + 1);
      reload();
    } catch (e: unknown) {
      onToast("Erro: " + (e instanceof Error ? e.message : "o envio falhou"));
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
    const sb = await getExternalBrowser();
    if (cr.imagem_storage_path) {
      await sb.storage.from("ad-creatives").remove([cr.imagem_storage_path]);
    }
    await sb.from("ad_creatives").delete().eq("id", cr.id);
    reload();
  }

  const caixaArquivo = "rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-xs";

  return (
    <div className="space-y-4">
      <Section title="Novo criativo" subtitle="Escolha o espaço no portal e envie a arte no formato pedido.">
        <form key={formKey} onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className={rotuloClass}>
              Campanha
              <select required value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} className={campoClass}>
                <option value="">Selecione…</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label className={rotuloClass}>
              Espaço no portal
              <select
                required
                value={form.slot}
                onChange={(e) => { setForm({ ...form, slot: e.target.value as AdSlotName | "" }); setFileMobile(null); }}
                className={campoClass}
              >
                <option value="">Selecione o espaço…</option>
                {AD_SLOT_LIST.map((s) => (
                  <option key={s.slot} value={s.slot}>
                    {s.label} — {s.desktop}{s.desktop !== s.mobile ? ` / ${s.mobile}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {slotDef && (
            <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <strong className="text-[#12201E]">{slotDef.label}.</strong> {slotDef.descricao}{" "}
              {requiresMobile
                ? <>Este espaço usa formatos diferentes no computador (<strong>{slotDef.desktop}</strong>) e no celular (<strong>{slotDef.mobile}</strong>): envie as duas artes.</>
                : <>Formato único: <strong>{slotDef.desktop}</strong>. Uma arte atende computador e celular.</>}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className={rotuloClass}>
              Título do anúncio
              <input required value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} className={campoClass} />
            </label>
            <label className={rotuloClass}>
              Texto do botão
              <input value={form.cta_texto} onChange={(e) => setForm({ ...form, cta_texto: e.target.value })} className={campoClass} />
            </label>
            <label className={`${rotuloClass} md:col-span-2`}>
              Link de destino
              <input required type="url" placeholder="https://" value={form.destino_url} onChange={(e) => setForm({ ...form, destino_url: e.target.value })} className={campoClass} />
            </label>
            <label className={rotuloClass}>
              Peso no sorteio (1 a 10)
              <input type="number" min={1} max={10} value={form.peso} onChange={(e) => setForm({ ...form, peso: Number(e.target.value) })} className={campoClass} />
            </label>
          </div>

          <div className={`grid grid-cols-1 gap-3 ${requiresMobile ? "md:grid-cols-2" : ""}`}>
            <label className={caixaArquivo}>
              <div className="mb-1 font-semibold text-slate-600">
                Arte para computador {slotDef ? `(${slotDef.desktop})` : ""}
              </div>
              <input required type="file" accept="image/*" onChange={(e) => setFileDesktop(e.target.files?.[0] ?? null)} className="w-full text-sm" />
              {slotDef && <CreativeFitPreview file={fileDesktop} formato={slotDef.desktop} />}
            </label>
            {requiresMobile && (
              <label className={caixaArquivo}>
                <div className="mb-1 font-semibold text-slate-600">
                  Arte para celular {slotDef ? `(${slotDef.mobile})` : ""}
                </div>
                <input required type="file" accept="image/*" onChange={(e) => setFileMobile(e.target.files?.[0] ?? null)} className="w-full text-sm" />
                {slotDef && <CreativeFitPreview file={fileMobile} formato={slotDef.mobile} />}
              </label>
            )}
          </div>

          <button type="submit" disabled={uploading || !form.slot} className={btn("primary")}>
            {uploading ? "Enviando…" : requiresMobile ? "Enviar as duas artes" : "Enviar criativo"}
          </button>
        </form>
      </Section>

      {creatives.length === 0 ? (
        <EmptyState title="Nenhum criativo enviado">Envie a primeira arte no formulário acima.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {creatives.map((cr) => {
            const camp = campaigns.find((c) => c.id === cr.campaign_id);
            const slotLabel = cr.slot && (cr.slot in AD_SLOTS)
              ? AD_SLOTS[cr.slot as AdSlotName].label
              : (cr.slot ?? "Sem espaço");
            const variante = cr.variante === "desktop" ? "Computador" : cr.variante === "mobile" ? "Celular" : "—";
            return (
              <li key={cr.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[16/9] bg-slate-100">
                  <img src={cr.imagem_url} alt={cr.headline} className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-tight text-[#12201E]">{cr.headline}</p>
                    <StatusPill status={cr.aprovado ? "aprovado" : "pendente"} label={cr.aprovado ? "Aprovado" : "Aguardando aprovação"} />
                  </div>
                  <p className="text-xs text-slate-500">{camp?.nome ?? "—"} · peso {cr.peso}</p>
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">{slotLabel}</span> · {variante} · {cr.formato ?? "—"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{cr.destino_url}</p>
                  <div className="mt-auto flex flex-wrap justify-end gap-1 pt-3">
                    {cr.aprovado ? (
                      <ConfirmButton onConfirm={() => approve(cr, false)} variante="secondary" confirmLabel="Tirar do ar">
                        Revogar aprovação
                      </ConfirmButton>
                    ) : (
                      <ConfirmButton onConfirm={() => approve(cr, true)} variante="success" confirmLabel="Aprovar e veicular">
                        Aprovar
                      </ConfirmButton>
                    )}
                    <ConfirmButton onConfirm={() => remove(cr)} confirmLabel="Excluir arte">
                      Excluir
                    </ConfirmButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
