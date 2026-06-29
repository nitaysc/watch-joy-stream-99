import { createServerFn } from "@tanstack/react-start";

const CONSUMET_BASE = process.env.VITE_CONSUMET_URL ?? "http://localhost:3001";

export interface AnimeSearchResult {
  id: string;
  title: string;
  image?: string;
  url?: string;
  releaseDate?: string;
  subOrDub?: "sub" | "dub";
}

export interface AnimeEpisode {
  id: string;
  number: number;
  title?: string;
  image?: string;
}

export interface AnimeInfo {
  id: string;
  title: string;
  url?: string;
  image?: string;
  cover?: string;
  description?: string;
  genres?: string[];
  episodes?: AnimeEpisode[];
  totalEpisodes?: number;
}

export interface AnimeSource {
  url: string;
  quality?: string;
}

export interface EpisodeSources {
  headers?: Record<string, string>;
  sources: AnimeSource[];
  subtitles?: { url: string; lang: string }[];
  download?: string;
}

export const searchAnime = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    const res = await fetch(`${CONSUMET_BASE}/anime/search?q=${encodeURIComponent(data.q)}`);
    if (!res.ok) throw new Error(`Consumet returned ${res.status}`);
    const json: { results: AnimeSearchResult[] } = await res.json();
    return json.results ?? [];
  });

export const getAnimeInfo = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    // Try Cloudflare cache
    const cacheKey = `https://cine-cache/anime/info/${data.id}`;
    try {
      const cache = (caches as any).default;
      const cached = await cache.match(cacheKey);
      if (cached) return await cached.json();
    } catch {}

    const res = await fetch(`${CONSUMET_BASE}/anime/info?id=${encodeURIComponent(data.id)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Consumet returned ${res.status}`);
    const json: AnimeInfo = await res.json();

    // Cache at edge
    try {
      const cache = (caches as any).default;
      await cache.put(cacheKey, new Response(JSON.stringify(json), {
        headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200", "Content-Type": "application/json" },
      }));
    } catch {}

    return json;
  });

export const getEpisodeSources = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const res = await fetch(`${CONSUMET_BASE}/anime/episode?id=${encodeURIComponent(data.id)}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Consumet returned ${res.status}`);
    return await res.json() as EpisodeSources;
  });

export const getRecentAnime = createServerFn({ method: "GET" })
  .handler(async () => {
    const res = await fetch(`${CONSUMET_BASE}/anime/recent`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json: { results: AnimeSearchResult[] } = await res.json();
    return json.results ?? [];
  });
