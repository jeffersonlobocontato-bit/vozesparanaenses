-- 083 — Cron do pipeline passa a enviar o segredo x-cron-secret.
--
-- Antes, os jobs chamavam as funções com a chave pública (anon), a mesma que
-- vai no navegador — qualquer pessoa podia disparar coleta, redação e
-- publicação. As funções agora aceitam o pipeline só com o header
-- x-cron-secret = CRON_SECRET (ou chamada interna / login da equipe).
--
-- ORDEM PARA LIGAR (senão o pipeline para):
--   1. Gere um segredo longo (ex.: openssl rand -hex 32).
--   2. No Lovable, crie o secret CRON_SECRET com esse valor (Edge Functions
--      e app) e faça o deploy das funções.
--   3. Troque {CRON_SECRET} abaixo pelo mesmo valor e rode este arquivo no
--      SQL editor do projeto EXTERNO. Recusa rodar com o marcador.
--
-- Só altera o cabeçalho dos jobs existentes (mesmos horários). Idempotente.

do $$
declare
  v_segredo text := '{CRON_SECRET}';
  j record;
begin
  if v_segredo like '%{%' or length(v_segredo) < 24 then
    raise exception 'Preencha v_segredo com o mesmo CRON_SECRET configurado no Lovable (mín. 24 caracteres).';
  end if;
  for j in
    select jobid, command from cron.job
    where (command like '%/functions/v1/%' or command like '%publicar-tecnologia-periodico%')
  loop
    perform cron.alter_job(
      j.jobid,
      command := replace(
        regexp_replace(j.command, '''x-cron-secret'',\s*''[^'']*'',\s*', '', 'g'),
        'jsonb_build_object(''Content-Type''',
        format('jsonb_build_object(''x-cron-secret'', %L, ''Content-Type''', v_segredo)
      )
    );
  end loop;
end $$;

-- Conferir: todos os jobs do pipeline devem mostrar x-cron-secret.
select jobname, command like '%x-cron-secret%' as com_segredo
from cron.job
where command like '%/functions/v1/%' or command like '%publicar-tecnologia-periodico%'
order by jobname;
