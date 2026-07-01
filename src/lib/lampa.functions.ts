import { createServerFn } from "@tanstack/react-start";

// Map TMDB ID to IMDB/Kinopoisk ID
export const getExternalIds = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string | number; mediaType: string }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY is not configured");
    const url = `https://api.themoviedb.org/3/${data.mediaType === "tv" ? "tv" : "movie"}/${data.id}/external_ids?api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch external IDs");
    return res.json();
  });
