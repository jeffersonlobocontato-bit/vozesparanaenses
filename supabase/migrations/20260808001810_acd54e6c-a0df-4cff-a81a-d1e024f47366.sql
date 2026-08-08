-- 1) Lock down SECURITY DEFINER functions: no anon/authenticated EXECUTE
REVOKE ALL ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_dispatch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_queue_wake() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.email_queue_dispatch() TO service_role;

-- 2) Pin search_path on functions missing it
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq, pg_temp;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq, pg_temp;

-- 3) Explicit service-role-only policies
GRANT ALL ON public.form_rate_limit TO service_role;
REVOKE ALL ON public.form_rate_limit FROM anon, authenticated;
DROP POLICY IF EXISTS "Service role manages rate limit" ON public.form_rate_limit;
CREATE POLICY "Service role manages rate limit"
  ON public.form_rate_limit FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.suppressed_emails TO service_role;
REVOKE ALL ON public.suppressed_emails FROM anon, authenticated;
DROP POLICY IF EXISTS "Service role can update suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can update suppressed emails"
  ON public.suppressed_emails FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can delete suppressed emails"
  ON public.suppressed_emails FOR DELETE
  USING (auth.role() = 'service_role');
