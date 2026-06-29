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

function extractDirectInfo(proxyUrl: string): { directUrl: string; headers: Record<string, string> } | null {
  try {
    const match = proxyUrl.match(/data=([^&]+)/);
    if (!match) return null;
    const decoded = JSON.parse(decodeURIComponent(match[1]));
    return {
      directUrl: decoded.url,
      headers: decoded.headers ?? {},
    };
  } catch {
    return null;
  }
}

// Override source URL to always use CinePro proxy (relative paths in HLS playlists require it)
function ensureProxyUrl(sourceUrl: string, cineproBase: string): string {
  const direct = extractDirectInfo(sourceUrl);
  // If it already looks like a proxy URL, rewrite localhost to the CinePro base
  if (sourceUrl.includes("/v1/proxy")) {
    return sourceUrl.replace(/http:\/\/localhost:\d+/, cineproBase);
  }
  // If it's a direct URL (extracted), re-wrap it through the proxy
  if (direct) {
    const encoded = encodeURIComponent(JSON.stringify({ url: direct.directUrl, headers: direct.headers }));
    return `${cineproBase}/v1/proxy?data=${encoded}`;
  }
  return sourceUrl;
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
    const attempts = [fetchWithTimeout(url, 12000)];

    if (process.env.NODE_ENV !== "development") {
      attempts.push(fetchWithTimeout(url, 14000));
    }

    const results = await Promise.allSettled(attempts);
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) {
        try {
          json = await result.value.json();
          if (json?.sources?.length) break;
        } catch {}
      }
    }

    if (!json || !json.sources?.length) {
      const res = await fetchWithTimeout(url, 20000);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CinePro returned ${res.status}${text ? `: ${text.slice(0, 100)}` : ""}`);
      }
      json = await res.json();
    }

    // Ensure all source URLs go through CinePro proxy (HLS playlists contain relative paths)
    if (json.sources) {
      json.sources = json.sources.map((s) => ({
        ...s,
        url: ensureProxyUrl(s.url, CINEPRO_BASE),
      }));
    }

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
