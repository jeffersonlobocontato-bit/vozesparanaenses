import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, ExternalLink, Power, RefreshCw, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExternalBrowser } from "@/lib/external-supabase-browser";
import { headersEquipe } from "@/lib/invoke-equipe";
import {
  PageHeader,
  Section,
  Tabs,
  SaveBar,
  StatusPill,
  StatCard,
  ConfirmButton,
  EmptyState,
  Aviso,
  btn,
  campoClass,
  rotuloClass,
} from "@/components/admin/ui";

// Robô do Instagram (@vozesparanaenses) — migração 086, funções
// instagram-selecionar (escolhe, gera cards, agenda) e instagram-publicar
// (um post por vez pelo Zernio, conferindo a conta). Aqui a equipe vê a fila
// com as prévias, ajusta a legenda, veta, publica na hora e liga o robô.

export const Route = createFileRoute("/admin/instagram")({
  component: AdminInstagram,
});

type Post = {
  id: string;
  tipo: string;
  classe: string | null;
  status: string;
  score: number | null;
  motivo: string | null;
  legenda: string;
  imagens: string[];
  links: Array<{ titulo: string; url: string }>;
  agendado_para: string | null;
  publicado_em: string | null;
  erro: string | null;
};

type Config = {
  ativo: boolean;
  zernio_account_id: string | null;
  zernio_username: string;
  intervalo_min: number;
  intervalo_alerta_min: number;
  teto_dia: number;
  janela_inicio: number;
  janela_fim: number;
  giro_hora: number;
  giro_max: number;
  coluna_auto: boolean;
};

type Aba = "fila" | "publicados" | "config";

const ROTULO_TIPO: Record<string, string> = {
  foto: "Foto", tipografico: "Tipográfico", alerta: "Alerta", giro: "Giro pelo Paraná", coluna: "Coluna", reels: "Reels",
};
const ROTULO_CLASSE: Record<string, string> = {
  alerta: "Alerta", tragedia: "Tragédia", seguranca: "Segurança", nacional: "Nacional", internacional: "Internacional", regional: "Regional", coluna: "Coluna",
};
const hora = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";

function textoDoErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  const o = e as { message?: string; details?: string; code?: string } | null;
  if (o && (o.message || o.code)) return [o.message, o.details, o.code && `(código ${o.code})`].filter(Boolean).join(" — ");
  try { return JSON.stringify(e); } catch { return String(e); }
}

async function chamar(funcao: string, body: Record<string, unknown>): Promise<{ data: Record<string, unknown> | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke(funcao, { headers: await headersEquipe(), body });
  if (!error) return { data: data as Record<string, unknown>, erro: null };
  const ctx = (error as { context?: { status?: number; text?: () => Promise<string> } }).context;
  if (ctx?.status === 404) return { data: null, erro: `a função ${funcao} ainda não foi publicada no servidor (a Lovable precisa publicar as funções novas).` };
  let corpo = "";
  try { corpo = typeof ctx?.text === "function" ? await ctx.text() : ""; } catch { /* já lido */ }
  try { const j = JSON.parse(corpo); return { data: j, erro: j.parado || j.error || j.detail || corpo }; } catch { return { data: null, erro: corpo || error.message }; }
}

const MOTIVO_PARADO: Record<string, string> = {
  robo_desligado: "o robô está desligado (aba Configuração).",
  sem_ZERNIO_API_KEY: "falta o secret ZERNIO_API_KEY na Lovable.",
  sem_conta_zernio: "falta o código da conta do Zernio.",
  conta_nao_confere: "a conta do Zernio não confere com @vozesparanaenses — nada foi publicado.",
  intervalo: "ainda não passou o intervalo de segurança desde o último post.",
  teto_do_dia: "o teto de posts do dia foi atingido.",
  post_nao_esta_agendado: "esse post não está mais na fila.",
  ja_reservado: "outro processo já está publicando esse post.",
};

function AdminInstagram() {
  const [aba, setAba] = useState<Aba>("fila");
  const [posts, setPosts] = useState<Post[]>([]);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semTabela, setSemTabela] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [plano, setPlano] = useState<Record<string, unknown> | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const sb = await getExternalBrowser();
    const [p, c] = await Promise.all([
      sb.from("instagram_posts").select("id, tipo, classe, status, score, motivo, legenda, imagens, links, agendado_para, publicado_em, erro")
        .gte("criado_em", new Date(Date.now() - 14 * 86_400_000).toISOString()).order("agendado_para", { ascending: true }).limit(200),
      sb.from("instagram_config").select("*").eq("id", 1).maybeSingle(),
    ]);
    if (p.error && /instagram_posts|PGRST205|42P01/.test(`${p.error.code} ${p.error.message}`)) setSemTabela(true);
    setPosts((p.data ?? []) as Post[]);
    setCfg((c.data ?? null) as Config | null);
    setCarregando(false);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const fila = posts.filter((p) => ["agendado", "publicando", "erro", "planejado"].includes(p.status));
  const publicados = posts.filter((p) => p.status === "publicado").sort((a, b) => (b.publicado_em ?? "").localeCompare(a.publicado_em ?? ""));
  const hojeSP = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const publicadosHoje = publicados.filter((p) => p.publicado_em && new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(p.publicado_em)) === hojeSP).length;

  async function atualizar(id: string, campos: Partial<Post>, ok: string) {
    setOcupado(id);
    const sb = await getExternalBrowser();
    const { error } = await sb.from("instagram_posts").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
    setOcupado(null);
    setAviso(error ? { tipo: "erro", texto: `Não foi possível salvar: ${textoDoErro(error)}` } : { tipo: "ok", texto: ok });
    if (!error) await carregar();
  }

  async function planejar(simular: boolean) {
    setOcupado(simular ? "simular" : "planejar");
    setAviso(null);
    const { data, erro } = await chamar("instagram-selecionar", { simular });
    setOcupado(null);
    if (erro) return setAviso({ tipo: "erro", texto: `Erro ao planejar: ${erro}` });
    if (simular) { setPlano((data?.plano ?? null) as Record<string, unknown> | null); return; }
    const n = Array.isArray(data?.resultado) ? (data!.resultado as Array<{ post?: string; giro?: string; coluna?: string }>).filter((r) => r.post || (r.giro && r.giro !== "erro") || (r.coluna && r.coluna !== "erro")).length : 0;
    setAviso({ tipo: "ok", texto: n ? `${n} post(s) novos na fila.` : "Nada novo para a fila agora (cotas, teto ou sem matéria forte)." });
    await carregar();
  }

  async function publicarAgora(id: string) {
    setOcupado(id);
    const { data, erro } = await chamar("instagram-publicar", { post_id: id });
    setOcupado(null);
    const parado = (data?.parado as string | undefined) ?? null;
    if (data?.publicado) setAviso({ tipo: "ok", texto: "Publicado no @vozesparanaenses." });
    else setAviso({ tipo: "erro", texto: `Não publicou: ${parado ? MOTIVO_PARADO[parado] ?? parado : erro ?? "sem resposta"}` });
    await carregar();
  }

  async function salvarConfig() {
    if (!cfg) return;
    setOcupado("config");
    const sb = await getExternalBrowser();
    const { error } = await sb.from("instagram_config").update({ ...cfg, atualizado_em: new Date().toISOString() }).eq("id", 1);
    setOcupado(null);
    setAviso(error ? { tipo: "erro", texto: `Não foi possível salvar: ${textoDoErro(error)}` } : { tipo: "ok", texto: "Configuração salva." });
  }

  async function ligarDesligar(ativo: boolean) {
    if (!cfg) return;
    const sb = await getExternalBrowser();
    const { error } = await sb.from("instagram_config").update({ ativo, atualizado_em: new Date().toISOString() }).eq("id", 1);
    if (error) return setAviso({ tipo: "erro", texto: textoDoErro(error) });
    setCfg({ ...cfg, ativo });
    setAviso({ tipo: "ok", texto: ativo ? "Robô ligado: a fila começa a ser publicada no próximo horário." : "Robô desligado: nada mais vai ao ar." });
  }

  if (semTabela) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Operação" title="Instagram" />
        <EmptyState title="Falta rodar a migração 086">Rode supabase-external/086_instagram_robo.sql no banco externo para criar a fila e o agendamento do robô.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Instagram"
        subtitle="O robô escolhe as matérias de cada ciclo, gera os cards e agenda com intervalo seguro. Publica só com o robô ligado e a conta @vozesparanaenses conferida."
        actions={
          <>
            <a href="/instagram" target="_blank" rel="noreferrer" className={btn("ghost")}><ExternalLink className="h-4 w-4" />Link da bio</a>
            <button type="button" className={btn("secondary")} onClick={() => planejar(true)} disabled={!!ocupado}><Sparkles className="h-4 w-4" />Simular escolha</button>
            <button type="button" className={btn("secondary")} onClick={() => planejar(false)} disabled={!!ocupado}><CalendarClock className="h-4 w-4" />{ocupado === "planejar" ? "Gerando…" : "Gerar fila agora"}</button>
            <button type="button" className={btn("ghost")} onClick={() => carregar()}><RefreshCw className="h-4 w-4" /></button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Robô" value={cfg?.ativo ? "Ligado" : "Desligado"} tom={cfg?.ativo ? "bom" : "alerta"} detalhe={cfg ? `@${cfg.zernio_username}` : undefined} />
        <StatCard label="Na fila" value={fila.filter((p) => p.status === "agendado").length} detalhe={fila.some((p) => p.status === "erro") ? `${fila.filter((p) => p.status === "erro").length} com erro` : undefined} />
        <StatCard label="Publicados hoje" value={publicadosHoje} detalhe={cfg ? `teto ${cfg.teto_dia} (alerta passa)` : undefined} />
        <StatCard label="Intervalo" value={cfg ? `${cfg.intervalo_min} min` : "—"} detalhe={cfg ? `alerta ${cfg.intervalo_alerta_min} min` : undefined} />
      </div>

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}

      {plano && (
        <Section title="Simulação" subtitle="O que o robô escolheria agora (nada foi gerado nem gravado)." aside={<button type="button" className={btn("ghost", "sm")} onClick={() => setPlano(null)}>Fechar</button>}>
          <Simulacao plano={plano} />
        </Section>
      )}

      <Tabs<Aba>
        value={aba}
        onChange={setAba}
        items={[
          { value: "fila", label: "Fila", count: fila.length },
          { value: "publicados", label: "Publicados", count: publicados.length },
          { value: "config", label: "Configuração" },
        ]}
      />

      {aba === "fila" && (
        carregando ? <p className="text-sm text-slate-500">Carregando…</p> :
        fila.length === 0 ? <EmptyState title="Fila vazia">O robô monta a fila a cada 30 minutos, depois dos ciclos de matéria. Use “Gerar fila agora” para não esperar.</EmptyState> :
        <div className="space-y-4">
          {fila.map((p) => (
            <CartaoPost key={p.id} post={p} ocupado={ocupado === p.id} roboLigado={!!cfg?.ativo}
              onSalvarLegenda={(legenda) => atualizar(p.id, { legenda }, "Legenda salva.")}
              onVetar={() => atualizar(p.id, { status: "vetado" }, "Post vetado: não vai ao ar.")}
              onReenfileirar={() => atualizar(p.id, { status: "agendado", erro: null, publicado_em: null, agendado_para: new Date(Date.now() + 10 * 60_000).toISOString() }, "De volta à fila, em 10 minutos.")}
              onPublicar={() => publicarAgora(p.id)}
            />
          ))}
        </div>
      )}

      {aba === "publicados" && (
        publicados.length === 0 ? <EmptyState title="Nada publicado ainda" /> :
        <div className="space-y-4">{publicados.map((p) => <CartaoPost key={p.id} post={p} ocupado={false} roboLigado={false} />)}</div>
      )}

      {aba === "config" && cfg && (
        <Section title="Configuração" subtitle="Valores seguros: no mínimo 30 minutos entre posts (15 para alerta). O Instagram aceita até 10 imagens por carrossel.">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-4">
              <Power className={`h-5 w-5 ${cfg.ativo ? "text-emerald-700" : "text-slate-400"}`} />
              <div className="mr-auto">
                <p className="font-semibold text-[#12201E]">{cfg.ativo ? "Robô ligado" : "Robô desligado"}</p>
                <p className="text-xs text-slate-500">Conta do Zernio {cfg.zernio_account_id ?? "não definida"} · usuário conferido antes de cada post: @{cfg.zernio_username}</p>
              </div>
              {cfg.ativo ? (
                <ConfirmButton onConfirm={() => ligarDesligar(false)} confirmLabel="Desligar agora">Desligar</ConfirmButton>
              ) : (
                <ConfirmButton variante="success" onConfirm={() => ligarDesligar(true)} confirmLabel="Ligar e publicar a fila">Ligar o robô</ConfirmButton>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Numero rotulo="Intervalo entre posts (min)" valor={cfg.intervalo_min} min={30} max={600} onChange={(v) => setCfg({ ...cfg, intervalo_min: v })} />
              <Numero rotulo="Intervalo para alerta (min)" valor={cfg.intervalo_alerta_min} min={15} max={600} onChange={(v) => setCfg({ ...cfg, intervalo_alerta_min: v })} />
              <Numero rotulo="Teto de posts por dia" valor={cfg.teto_dia} min={1} max={20} onChange={(v) => setCfg({ ...cfg, teto_dia: v })} />
              <Numero rotulo="Regiões no Giro (máx.)" valor={cfg.giro_max} min={3} max={10} onChange={(v) => setCfg({ ...cfg, giro_max: v })} />
              <Numero rotulo="Primeiro post (hora)" valor={cfg.janela_inicio} min={0} max={23} onChange={(v) => setCfg({ ...cfg, janela_inicio: v })} />
              <Numero rotulo="Último post até (hora)" valor={cfg.janela_fim} min={1} max={24} onChange={(v) => setCfg({ ...cfg, janela_fim: v })} />
              <Numero rotulo="Giro pelo Paraná a partir de (hora)" valor={cfg.giro_hora} min={0} max={23} onChange={(v) => setCfg({ ...cfg, giro_hora: v })} />
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
                <input type="checkbox" checked={cfg.coluna_auto} onChange={(e) => setCfg({ ...cfg, coluna_auto: e.target.checked })} />
                Post da coluna Vozes Políticas
              </label>
            </div>
            <p className="text-xs text-slate-500">Política e eleições nunca são publicadas sozinhas, nem matéria com criticidade alta. Tragédia sai em card tipográfico, sem foto.</p>
            <SaveBar>
              <button type="button" className={btn("primary")} onClick={salvarConfig} disabled={ocupado === "config"}>{ocupado === "config" ? "Salvando…" : "Salvar"}</button>
            </SaveBar>
          </div>
        </Section>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, min, max, onChange }: { rotulo: string; valor: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className={rotuloClass}>
      {rotulo}
      <input type="number" className={campoClass} value={valor} min={min} max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} />
    </label>
  );
}

function CartaoPost({ post, ocupado, roboLigado, onSalvarLegenda, onVetar, onReenfileirar, onPublicar }: {
  post: Post;
  ocupado: boolean;
  roboLigado: boolean;
  onSalvarLegenda?: (legenda: string) => void;
  onVetar?: () => void;
  onReenfileirar?: () => void;
  onPublicar?: () => void;
}) {
  const [legenda, setLegenda] = useState(post.legenda);
  const [indice, setIndice] = useState(0);
  const editavel = !!onSalvarLegenda && post.status === "agendado";
  const imagem = post.imagens[indice] ?? post.imagens[0];
  return (
    <Section padded={false}>
      <div className="flex flex-col gap-5 p-5 md:flex-row">
        <div className="w-full shrink-0 md:w-[240px]">
          {imagem ? <img src={imagem} alt="" className="aspect-[3/4] w-full rounded-lg border border-slate-200 object-cover" /> : <div className="aspect-[3/4] rounded-lg bg-slate-100" />}
          {post.imagens.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.imagens.map((_, i) => (
                <button key={i} type="button" onClick={() => setIndice(i)} aria-label={`Imagem ${i + 1}`}
                  className={`h-6 w-6 rounded text-[10px] font-bold ${i === indice ? "bg-[#12201E] text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={post.status} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{ROTULO_TIPO[post.tipo] ?? post.tipo}{post.classe ? ` · ${ROTULO_CLASSE[post.classe] ?? post.classe}` : ""}</span>
            <span className="ml-auto text-xs text-slate-500">
              {post.status === "publicado" ? `Publicado ${hora(post.publicado_em)}` : `Agendado ${hora(post.agendado_para)}`}
              {post.score != null ? ` · peso ${Math.round(Number(post.score))}` : ""}
            </span>
          </div>
          {post.erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{post.erro}</p>}
          {editavel ? (
            <textarea className={`${campoClass} min-h-[180px] w-full font-mono text-[13px]`} value={legenda} onChange={(e) => setLegenda(e.target.value)} maxLength={2200} />
          ) : (
            <p className="whitespace-pre-line text-sm text-slate-700">{post.legenda}</p>
          )}
          {post.links.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {post.links.map((l) => (
                <li key={l.url}><a href={l.url.replace(/^https:\/\/vozesparanaenses\.com\.br/, "")} target="_blank" rel="noreferrer" className="text-[#0B6E8F] hover:underline">{l.titulo}</a></li>
              ))}
            </ul>
          )}
          {(onVetar || onPublicar) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {editavel && legenda !== post.legenda && (
                <button type="button" className={btn("primary", "sm")} disabled={ocupado} onClick={() => onSalvarLegenda!(legenda)}>Salvar legenda</button>
              )}
              {post.status === "agendado" && onPublicar && (
                <ConfirmButton variante="primary" disabled={ocupado || !roboLigado} title={roboLigado ? undefined : "Ligue o robô para publicar"}
                  onConfirm={onPublicar} confirmLabel="Publicar no Instagram agora">
                  <Send className="h-3.5 w-3.5" />Publicar agora
                </ConfirmButton>
              )}
              {post.status === "erro" && onReenfileirar && (
                <button type="button" className={btn("secondary", "sm")} disabled={ocupado} onClick={onReenfileirar}>Tentar de novo</button>
              )}
              {["agendado", "erro"].includes(post.status) && onVetar && (
                <ConfirmButton onConfirm={onVetar} confirmLabel="Vetar este post"><Ban className="h-3.5 w-3.5" />Vetar</ConfirmButton>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Simulacao({ plano }: { plano: Record<string, unknown> }) {
  const avulsos = (plano.avulsos ?? []) as Array<{ id: string; titulo: string; classe: string; score: number }>;
  const giro = (plano.giro ?? []) as Array<{ id: string; regiao: string; titulo: string; score: number }>;
  return (
    <div className="grid gap-5 md:grid-cols-2 text-sm">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Posts avulsos</p>
        {avulsos.length === 0 ? <p className="text-slate-500">Nenhum agora.</p> : (
          <ol className="space-y-1.5">{avulsos.map((a) => <li key={a.id}><span className="font-semibold">{ROTULO_CLASSE[a.classe] ?? a.classe}</span> · {a.titulo} <span className="text-slate-400">({Math.round(a.score)})</span></li>)}</ol>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Giro pelo Paraná</p>
        {giro.length === 0 ? <p className="text-slate-500">Ainda não (sai a partir da hora do Giro, com 3+ regiões).</p> : (
          <ol className="space-y-1.5">{giro.map((g) => <li key={g.id}><span className="font-semibold">{g.regiao}</span> · {g.titulo}</li>)}</ol>
        )}
        {typeof plano.coluna === "string" && <p className="mt-3"><span className="font-semibold">Coluna:</span> {plano.coluna}</p>}
      </div>
    </div>
  );
}
