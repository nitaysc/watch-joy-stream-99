import { createServerFn } from "@tanstack/react-start";
import { getMovie, getTv } from "./tmdb.functions";
import { searchHDRezka, getHDRezkaNativeStream } from "./hdrezka.functions";

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
  .validator((d: {
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

    let json: CineProResponse = {
        responseId: "tmp",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sources: []
    };

    try {
      const cache = (caches as any).default;
      const cacheKey = new Request(url);
      const cached = await cache.match(cacheKey);
      if (cached) {
        json = await cached.json();
      }
    } catch {}

    if (!json.sources.length) {
        const res = await fetchWithTimeout(url, 20000);
        if (res.ok) {
          try { json = await res.json(); } catch {}
        }
    }

    // Rewrite localhost proxy URLs to the actual CinePro base
    if (json?.sources) {
        json.sources = json.sources.map((s) => ({
          ...s,
          url: s.url.replace(/http:\/\/localhost:\d+/, CINEPRO_BASE),
        }));
    } else {
        json = { responseId: "tmp", expiresAt: new Date(Date.now() + 3600000).toISOString(), sources: [] };
    }

    // ADD HDREZKA NATIVE STREAMS
    try {
        let titleQuery = "";
        if (data.mediaType === "tv") {
            const tvInfo = await getTv({ data: { id: String(data.id) } });
            titleQuery = tvInfo.title || tvInfo.original_title || "";
        } else {
            const movieInfo = await getMovie({ data: { id: String(data.id) } });
            titleQuery = movieInfo.title || movieInfo.original_title || "";
        }

        if (titleQuery) {
            const searchResults = await searchHDRezka({ data: { query: titleQuery } });
            if (searchResults && searchResults.length > 0) {
                // Assuming first result is the best match
                const hdrezkaUrl = searchResults[0].url;
                
                const season = data.mediaType === "tv" ? Number(data.season || 1) : undefined;
                const episode = data.mediaType === "tv" ? Number(data.episode || 1) : undefined;

                const videos = await getHDRezkaNativeStream({ data: { url: hdrezkaUrl, season, episode } });
                
                if (videos) {
                    const qualities = Object.keys(videos);
                    for (const quality of qualities) {
                        const videoUrls = videos[quality];
                        if (videoUrls && videoUrls.length > 0) {
                            json.sources.push({
                                url: videoUrls[0],
                                type: "mp4",
                                quality: quality,
                                provider: { name: "HDRezka (Russian Dub)" },
                            });
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Failed to fetch HDRezka streams inside CinePro:", error);
    }

    if (!json?.sources?.length) {
      throw new Error("No sources returned from CinePro or HDRezka");
    }

    try {
      const cache = (caches as any).default;
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
