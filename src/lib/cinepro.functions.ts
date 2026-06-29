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

function buildUrl(base: string, mediaType: string, id: string | number, season?: string, episode?: string): string {
  return mediaType === "tv"
    ? `${base}/v1/tv/${id}/seasons/${season ?? "1"}/episodes/${episode ?? "1"}`
    : `${base}/v1/movies/${id}`;
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
    const url = buildUrl(CINEPRO_BASE, data.mediaType, data.id, data.season, data.episode);

    // Cloudflare Cache API — instant return if cached
    try {
      const cache = caches.default as any;
      const cacheKey = new Request(url);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const json: CineProResponse = await cached.json();
        return json;
      }
    } catch { /* dev mode */ }

    // Try the main endpoint with a fast timeout, retry once in parallel
    let json: CineProResponse | null = null;
    const attempts = [fetchWithTimeout(url, 12000)];

    // Second parallel attempt hits the same URL (some providers return faster on retry)
    if (process.env.NODE_ENV !== "development") {
      attempts.push(fetchWithTimeout(url, 14000));
    }

    const results = await Promise.allSettled(attempts);
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        try {
          json = await result.value.json();
          if (json?.sources?.length) break;
        } catch { /* try next */ }
      }
    }

    if (!json || !json.sources?.length) {
      // Final single attempt with full timeout
      const res = await fetchWithTimeout(url, 20000);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CinePro returned ${res.status}${text ? `: ${text.slice(0, 100)}` : ""}`);
      }
      json = await res.json();
    }

    // Fix proxy URLs
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
