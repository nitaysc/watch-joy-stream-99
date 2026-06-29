import { createServerFn } from "@tanstack/react-start";

const BASE = "https://api.themoviedb.org/3";

async function tmdb(path: string, params: Record<string, string | number> = {}) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not configured");
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return res.json();
}

export type MediaItem = {
  id: number;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  date: string | null;
  rating: number;
  type: "movie" | "tv";
};

function mapItem(raw: any, forceType?: "movie" | "tv"): MediaItem {
  const type = forceType ?? (raw.media_type === "tv" || raw.first_air_date ? "tv" : "movie");
  return {
    id: raw.id,
    title: raw.title ?? raw.name ?? "Untitled",
    overview: raw.overview ?? "",
    poster: raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null,
    backdrop: raw.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : null,
    date: raw.release_date ?? raw.first_air_date ?? null,
    rating: Math.round((raw.vote_average ?? 0) * 10) / 10,
    type,
  };
}

export const getHome = createServerFn({ method: "GET" }).handler(async () => {
  const [trending, popularMovies, popularTv, topMovies, topTv] = await Promise.all([
    tmdb("/trending/all/week"),
    tmdb("/movie/popular"),
    tmdb("/tv/popular"),
    tmdb("/movie/top_rated"),
    tmdb("/tv/top_rated"),
  ]);
  return {
    trending: (trending.results as any[]).filter((r) => r.media_type !== "person").map((r) => mapItem(r)),
    popularMovies: (popularMovies.results as any[]).map((r) => mapItem(r, "movie")),
    popularTv: (popularTv.results as any[]).map((r) => mapItem(r, "tv")),
    topMovies: (topMovies.results as any[]).map((r) => mapItem(r, "movie")),
    topTv: (topTv.results as any[]).map((r) => mapItem(r, "tv")),
  };
});

export const searchMedia = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ data }) => {
    if (!data.q.trim()) return { results: [] as MediaItem[] };
    const json = await tmdb("/search/multi", { query: data.q, include_adult: "false" });
    const results = (json.results as any[])
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => mapItem(r));
    return { results };
  });

export type MovieDetails = MediaItem & {
  runtime: number | null;
  genres: string[];
  tagline: string;
};

export const getMovie = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const m = await tmdb(`/movie/${data.id}`);
    return {
      ...mapItem(m, "movie"),
      runtime: m.runtime ?? null,
      genres: (m.genres ?? []).map((g: any) => g.name),
      tagline: m.tagline ?? "",
    } as MovieDetails;
  });

export type TvSeasonInfo = { season_number: number; name: string; episode_count: number };
export type TvDetails = MediaItem & {
  genres: string[];
  tagline: string;
  seasons: TvSeasonInfo[];
};
export type Episode = {
  episode_number: number;
  name: string;
  overview: string;
  still: string | null;
  air_date: string | null;
  runtime: number | null;
};

export const getTv = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const m = await tmdb(`/tv/${data.id}`);
    return {
      ...mapItem(m, "tv"),
      genres: (m.genres ?? []).map((g: any) => g.name),
      tagline: m.tagline ?? "",
      seasons: (m.seasons ?? [])
        .filter((s: any) => s.season_number >= 1)
        .map((s: any) => ({
          season_number: s.season_number,
          name: s.name,
          episode_count: s.episode_count,
        })),
    } as TvDetails;
  });

export const getSeason = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number; season: number }) => d)
  .handler(async ({ data }) => {
    const json = await tmdb(`/tv/${data.id}/season/${data.season}`);
    const episodes: Episode[] = (json.episodes ?? []).map((e: any) => ({
      episode_number: e.episode_number,
      name: e.name,
      overview: e.overview,
      still: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null,
      air_date: e.air_date,
      runtime: e.runtime ?? null,
    }));
    return { episodes };
  });
