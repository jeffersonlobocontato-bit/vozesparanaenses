-- 096 — Foto de frota nunca ilustra matéria (regra do editor, 29/10/2026).
--
-- As fotos de arquivo antigas (frota de viaturas enfileirada no Palácio
-- Iguaçu, fachada de delegacia, entrega de frota) e as três do banco novo que
-- ainda mostravam várias viaturas em fila (pm-1, pm-4, pcpr-2) saem de cena:
--   1. gatilho: qualquer gravação de matéria com uma dessas fotos fica SEM
--      capa (só texto) — vale mesmo enquanto o generate-article antigo ainda
--      estiver no ar;
--   2. limpa agora as matérias que já usam essas fotos.
-- foto_origem continua 'generica_institucional' para a 095 recolocar uma foto
-- neutra do banco novo depois que o site for publicado com os arquivos.

create or replace function public.foto_de_frota(u text)
returns boolean
language sql
immutable
as $$
  select coalesce(u, '') ~ '/fotos-genericas/(pm-viatura-[0-9]+|civil-[0-9]+|bombeiros-1|penal-1|cientifica-1|pm-1|pm-4|pcpr-2)\.jpg'
$$;

create or replace function public.bloqueia_foto_de_frota()
returns trigger
language plpgsql
as $$
begin
  if public.foto_de_frota(new.imagem_capa_url) or public.foto_de_frota(new.og_image_url) then
    new.imagem_capa_url := null;
    new.og_image_url := null;
    new.imagem_credito := null;
    new.imagem_legenda := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloqueia_foto_de_frota on public.generated_articles;
create trigger trg_bloqueia_foto_de_frota
  before insert or update of imagem_capa_url, og_image_url on public.generated_articles
  for each row execute function public.bloqueia_foto_de_frota();

update public.generated_articles
set imagem_capa_url = null, og_image_url = null, imagem_credito = null, imagem_legenda = null
where public.foto_de_frota(imagem_capa_url) or public.foto_de_frota(og_image_url);
