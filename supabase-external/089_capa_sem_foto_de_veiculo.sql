-- 089 — Capa nunca aponta para foto de outro veículo ou agência comercial.
--
-- Regra da casa: foto só com crédito institucional (prefeitura, governo,
-- agência pública), cópia própria no storage, Commons ou ilustração do
-- tema. Em 24/10/2026 três matérias de curadoria saíram com a foto
-- hospedada no g1 (AFP), no Metrópoles (Getty) e na CNN (Reuters) — risco
-- de direito autoral. Este gatilho tranca isso no banco, qualquer que seja
-- o caminho (pipeline, painel, função): se a capa ou a og:image apontar para
-- um desses domínios, a imagem é descartada (a matéria sai só com texto).
--
-- Também limpa as matérias que já estão assim.

create or replace function public.capa_de_veiculo(u text)
returns boolean
language sql
immutable
as $$
  select coalesce(u, '') ~* '^https?://([a-z0-9-]+\.)*(glbimg\.com|globo\.com|metroimg\.com|metropoles\.com|cnnbrasil\.com\.br|uol\.com\.br|uol\.com|folha\.com\.br|estadao\.com\.br|estadao\.com|gazetadopovo\.com\.br|ricmais\.com\.br|bandab\.com\.br|tribunapr\.com\.br|band\.com\.br|r7\.com|terra\.com\.br|sbt\.com\.br|veja\.abril\.com\.br|abril\.com\.br|cbn\.globoradio|gettyimages\.[a-z.]+|reuters\.com|afp\.com|apnews\.com|bbci\.co\.uk|bbc\.com|cnn\.com|nytimes\.com)(/|:|$)'
$$;

create or replace function public.bloqueia_capa_de_veiculo()
returns trigger
language plpgsql
as $$
begin
  if public.capa_de_veiculo(new.imagem_capa_url) then
    new.imagem_capa_url := null;
    new.imagem_credito := null;
    new.imagem_legenda := null;
  end if;
  if public.capa_de_veiculo(new.og_image_url) then
    new.og_image_url := null;
  end if;
  if public.capa_de_veiculo(new.imagem_original_url) then
    new.imagem_original_url := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloqueia_capa_de_veiculo on public.generated_articles;
create trigger trg_bloqueia_capa_de_veiculo
  before insert or update of imagem_capa_url, og_image_url, imagem_original_url
  on public.generated_articles
  for each row execute function public.bloqueia_capa_de_veiculo();

-- Limpeza do que já saiu (o gatilho zera os campos).
update public.generated_articles
   set imagem_capa_url = imagem_capa_url
 where public.capa_de_veiculo(imagem_capa_url)
    or public.capa_de_veiculo(og_image_url)
    or public.capa_de_veiculo(imagem_original_url);
