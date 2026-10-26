// Mensagens do Supabase Auth (em inglês) traduzidas para a equipe.
export function erroAuth(e: unknown, padrao = "Algo deu errado. Tente de novo."): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!m) return padrao;
  const seg = m.match(/after (\d+) seconds?/i);
  if (seg) return `Por segurança, espere ${seg[1]} segundos antes de pedir outro link.`;
  if (/invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(m)) return "Confirme o e-mail antes de entrar (veja a caixa de entrada).";
  if (/should be different from the old password/i.test(m)) return "A nova senha precisa ser diferente da atual.";
  if (/password should be at least/i.test(m)) return "A senha precisa ter mais caracteres.";
  if (/auth session missing|session.*expired|invalid.*(token|link)|otp.*expired|code verifier/i.test(m)) return "Link expirado ou aberto em outro navegador. Peça um novo em \"Esqueci minha senha\" e abra no mesmo navegador.";
  if (/rate limit/i.test(m)) return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  return m;
}
