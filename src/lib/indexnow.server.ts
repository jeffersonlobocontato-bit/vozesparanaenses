/**
 * Cliente IndexNow — envia URLs para reindexação instantânea em
 * Bing, Yandex, Seznam e Naver. Um único endpoint (api.indexnow.org)
 * distribui pra rede.
 *
 * Docs: https://www.indexnow.org/documentation
 */

export type IndexNowResult = {
  ok: boolean;
  status: number;
  urls: number;
  error?: string;
};

export async function pingIndexNow({
  origin,
  urls,
}: {
  origin: string;
  urls: string[];
}): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { ok: false, status: 0, urls: 0, error: "INDEXNOW_KEY not set" };
  if (urls.length === 0) return { ok: true, status: 204, urls: 0 };

  const host = new URL(origin).host;
  const keyLocation = `${origin}/api/public/indexnow/${key}`;

  const payload = {
    host,
    key,
    keyLocation,
    urlList: urls.slice(0, 10000), // cap defensivo (IndexNow permite até 10k por request)
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, urls: payload.urlList.length };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      urls: payload.urlList.length,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}