import { createFileRoute } from "@tanstack/react-router";

/**
 * Serve o arquivo de verificação do IndexNow. O caminho é
 * `/api/public/indexnow/<KEY>` e o corpo é a própria chave, exatamente
 * como os motores (Bing, Yandex, Seznam, Naver) esperam.
 *
 * A chave real é o valor da env `INDEXNOW_KEY`; requisições com um
 * `$key` diferente respondem 404 pra não vazar existência.
 */
export const Route = createFileRoute("/api/public/indexnow/$key")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const expected = process.env.INDEXNOW_KEY;
        if (!expected || params.key !== expected) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(expected, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=86400",
          },
        });
      },
    },
  },
});