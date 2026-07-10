-- Vozes Paranaenses — 006_answer_first.sql
-- Campos "answer-first" para GEO (Generative Engine Optimization):
-- TL;DR curto, 5W1H estruturado e FAQ opcional.
-- Idempotente.

alter table public.generated_articles
  add column if not exists tldr text,
  add column if not exists fatos_5w1h jsonb,
  add column if not exists faq jsonb;

comment on column public.generated_articles.tldr is
  'Resumo em 2-3 frases para AI Overviews / Speakable / TL;DR visual.';
comment on column public.generated_articles.fatos_5w1h is
  'Objeto {quem, o_que, quando, onde, por_que, como} exibido como <dl> estruturado.';
comment on column public.generated_articles.faq is
  'Array [{pergunta, resposta}] renderizado + emitido como FAQPage JSON-LD.';