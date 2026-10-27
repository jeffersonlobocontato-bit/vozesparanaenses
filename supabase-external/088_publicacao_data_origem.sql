-- 088 — Matéria aprovada com atraso respeita a data de origem.
--
-- Quando o editor aprova na fila (ou publica uma nota da coluna) uma matéria
-- gerada num dia anterior, ela entra no site com a data em que foi gerada,
-- não com a data da aprovação: fica na ordem cronológica certa e não sobe
-- para o destaque como se fosse notícia de hoje. Aprovada no mesmo dia em
-- que foi gerada, nada muda (vale a hora da aprovação).
--
-- Vale para qualquer caminho de publicação (painel, editor, funções), porque
-- é um gatilho no banco. Uma data escolhida à mão pelo editor (diferente de
-- "agora") é respeitada.

create or replace function public.publicacao_respeita_origem()
returns trigger
language plpgsql
as $$
declare
  origem timestamptz;
  dia_origem date;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if new.status is distinct from 'publicado' or old.status = 'publicado' then
    return new;
  end if;
  -- Data escolhida à mão (mais de 10 min antes de agora): o editor manda.
  if new.publicado_em is not null and new.publicado_em < now() - interval '10 minutes' then
    return new;
  end if;

  if tg_table_name = 'generated_articles' then
    origem := new.gerado_em;
  else
    origem := coalesce(new.data_publicacao_original, new.criado_em);
  end if;
  if origem is null then
    return new;
  end if;

  dia_origem := (origem at time zone 'America/Sao_Paulo')::date;
  if dia_origem < hoje then
    new.publicado_em := origem;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_publicacao_respeita_origem on public.generated_articles;
create trigger trg_publicacao_respeita_origem
  before update of status, publicado_em on public.generated_articles
  for each row execute function public.publicacao_respeita_origem();

drop trigger if exists trg_publicacao_respeita_origem on public.coluna_cidade_notas;
create trigger trg_publicacao_respeita_origem
  before update of status, publicado_em on public.coluna_cidade_notas
  for each row execute function public.publicacao_respeita_origem();
