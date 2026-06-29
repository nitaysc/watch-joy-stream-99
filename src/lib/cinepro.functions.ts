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

function fixSourceUrl(url: string, base: string): string {
  if (url.startsWith("http://localhost:3000")) {
    return url.replace("http://localhost:3000", base);
  }
  return url;
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

    // Cloudflare Cache API
    try {
      const cache = caches.default as any;
      const cacheKey = new Request(url);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const json: CineProResponse = await cached.json();
        return json;
      }
    } catch { /* cache not available (dev) */ }

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`CinePro returned ${res.status}${text ? `: ${text.slice(0, 100)}` : ""}`);
    }

    const json: CineProResponse = await res.json();

    // Fix proxy URLs server-side
    if (json.sources) {
      json.sources = json.sources.map((s) => ({
        ...s,
        url: fixSourceUrl(s.url, CINEPRO_BASE),
      }));
    }

    // Cache at the edge
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
    } catch { /* cache not available */ }

    return json;
  });
