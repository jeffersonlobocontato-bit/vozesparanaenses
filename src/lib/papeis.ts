// Papéis do painel (/admin). A trava de verdade é o banco (RLS + RPCs da
// migração 097): o papel Consulta só tem políticas de LEITURA. Aqui fica o
// rótulo, a descrição e quais páginas cada papel vê no menu.

export type Papel = "admin" | "editor" | "viewer";

export const PAPEIS: Record<Papel, { rotulo: string; descricao: string }> = {
  admin: { rotulo: "Administrador", descricao: "Tudo: redação, pipeline, negócios, configurações e cadastro de usuários." },
  editor: { rotulo: "Editor", descricao: "Redação e pipeline: revisa, publica e configura. Não cadastra usuários." },
  viewer: { rotulo: "Consulta", descricao: "Só informações: painel, pipeline ao vivo, cobertura, analytics e custos. Não altera nada." },
};

/** Páginas que o papel Consulta abre (o resto redireciona para o Painel). */
export const PAGINAS_CONSULTA = ["/admin/painel", "/admin/pipeline", "/admin/cobertura", "/admin/analytics", "/admin/custos", "/admin/senha"];

export function podeAbrir(papel: Papel, caminho: string): boolean {
  const c = caminho.replace(/\/+$/, "") || "/admin";
  if (c === "/admin/usuarios") return papel === "admin";
  if (papel !== "viewer") return true;
  return PAGINAS_CONSULTA.some((p) => c === p || c.startsWith(`${p}/`));
}
