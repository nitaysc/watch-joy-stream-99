import { createServerFn } from "@tanstack/react-start";

interface Source {
  url: string;
  type: string;
  quality: string;
  provider?: { name: string };
  audioTracks?: { language: string; label: string }[];
}

// Map TMDB ID to IMDB/Kinopoisk ID
async function getExternalIds(tmdbId: string | number, mediaType: string) {
  const apiKey = process.env.VITE_TMDB_API_KEY || "8d6d91941230817f7807d643736e8a49";
  const url = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}/external_ids?api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch external IDs");
  return res.json();
}

// Fetch Kinobox API
async function getKinoboxPlayers(imdbId: string) {
  let url = `https://kinobox.tv/api/players?imdb=${imdbId}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Kinobox API failed: ${res.statusText}`);
  }
  return res.json();
}

export const getLampaStreams = createServerFn({ method: "GET" })
  .inputValidator((d: {
    id: string | number;
    mediaType: string;
    season?: string;
    episode?: string;
  }) => d)
  .handler(async ({ data }) => {
    try {
      const extIds = await getExternalIds(data.id, data.mediaType);
      const imdbId = extIds.imdb_id;
      
      if (!imdbId) {
        throw new Error("No IMDB ID found for this media");
      }

      // 1. Get players from Kinobox
      const players = await getKinoboxPlayers(imdbId);
      if (!players || !Array.isArray(players) || players.length === 0) {
        throw new Error("No players found from Kinobox");
      }

      // 2. Return the players directly so the client can use an iframe!
      // Since fetching HTML via proxy and regex parsing is brittle, 
      // providing the iframeUrl directly allows the browser to play it natively!
      
      const sources: Source[] = [];
      for (const p of players) {
        if (p.iframeUrl) {
          // Determine if we need to append season/episode for TV
          let finalUrl = p.iframeUrl.startsWith('//') ? 'https:' + p.iframeUrl : p.iframeUrl;
          
          if (data.mediaType === 'tv') {
            finalUrl += `&s=${data.season}&e=${data.episode}`;
          }

          sources.push({
            url: finalUrl,
            type: "iframe",
            quality: "auto",
            provider: { name: `Lampa (${p.source})` }
          });
        }
      }
      
      return {
        responseId: "lampa-" + Date.now(),
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        sources: sources,
      };

    } catch (error: any) {
      console.error("Lampa Error:", error);
      throw new Error(`Failed to fetch Lampa streams: ${error.message}`);
    }
  });
