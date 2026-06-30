import { createServerFn } from "@tanstack/react-start";

interface Source {
  url: string;
  type: string;
  quality: string;
  provider?: { name: string };
  audioTracks?: { language: string; label: string }[];
}

interface CineProResponse {
  responseId: string;
  expiresAt: string;
  sources: Source[];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export const getStreams = createServerFn({ method: "GET" })
  .inputValidator((d: {
    id: string | number;
    mediaType: string;
    season?: string;
    episode?: string;
  }) => d)
  .handler(async ({ data }) => {
    const CINEPRO_BASE = process.env.VITE_CINEPRO_URL ?? "https://core-production-ef8a.up.railway.app";
    const url = data.mediaType === "tv"
      ? `${CINEPRO_BASE}/v1/tv/${data.id}/seasons/${data.season ?? "1"}/episodes/${data.episode ?? "1"}`
      : `${CINEPRO_BASE}/v1/movies/${data.id}`;

    try {
      const cache = caches.default as any;
      const cacheKey = new Request(url);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const json: CineProResponse = await cached.json();
        return json;
      }
    } catch {}

    let json: CineProResponse | null = null;

    const res = await fetchWithTimeout(url, 20000);
    if (res.ok) {
      try { json = await res.json(); } catch {}
    }

    if (!json?.sources?.length) {
      throw new Error("No sources returned from CinePro");
    }

    // Rewrite localhost proxy URLs to the actual CinePro base
    json.sources = json.sources.map((s) => ({
      ...s,
      url: s.url.replace(/http:\/\/localhost:\d+/, CINEPRO_BASE),
    }));

    try {
      const cache = caches.default as any;
      const cacheKey = new Request(url);
      const ttl = Math.max(120, Math.floor((new Date(json.expiresAt).getTime() - Date.now()) / 1000));
      const cachedRes = new Response(JSON.stringify(json), {
        headers: {
          "Cache-Control": `s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
          "Content-Type": "application/json",
        },
      });
      await cache.put(cacheKey, cachedRes);
    } catch {}

    return json;
  });
