// Utilitários para transformar URL de vídeo em embed iframe (YouTube/Vimeo)
// ou detectar arquivo direto (MP4/WebM/OGG) para renderizar com <video>.

export type VideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "vimeo"; embedUrl: string }
  | { kind: "file"; src: string; mime: string }
  | null;

export function parseVideoEmbed(url: string | null | undefined): VideoEmbed {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  // YouTube: youtube.com/watch?v=, youtu.be/, /shorts/, /embed/
  const ytMatch = u.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  if (ytMatch) {
    return { kind: "youtube", embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }

  // Vimeo: vimeo.com/{id}
  const vmMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vmMatch) {
    return { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vmMatch[1]}` };
  }

  // Arquivo direto
  const lower = u.split("?")[0].toLowerCase();
  if (lower.endsWith(".mp4")) return { kind: "file", src: u, mime: "video/mp4" };
  if (lower.endsWith(".webm")) return { kind: "file", src: u, mime: "video/webm" };
  if (lower.endsWith(".ogg") || lower.endsWith(".ogv"))
    return { kind: "file", src: u, mime: "video/ogg" };
  if (lower.endsWith(".mov")) return { kind: "file", src: u, mime: "video/quicktime" };

  return null;
}