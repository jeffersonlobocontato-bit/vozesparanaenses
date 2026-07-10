/**
 * Autoria = campo livre `editor_responsavel` na tabela `generated_articles`.
 * Como não existe tabela de autores, derivamos o "slug" a partir do nome.
 */
export function slugifyAuthor(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function displayAuthor(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}