import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTv, getSeason } from "@/lib/tmdb.functions";
import { Star, Calendar, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

const tvQuery = (id: number, language: string) =>
  queryOptions({ queryKey: ["tv", id, language], queryFn: () => getTv({ data: { id, language } }) });

const seasonQuery = (id: number, season: number, language: string) =>
  queryOptions({
    queryKey: ["tv", id, "season", season, language],
    queryFn: () => getSeason({ data: { id, season, language } }),
  });

export const Route = createFileRoute("/tv/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(tvQuery(Number(params.id), i18n.language)),
  component: TvPage,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Series"} — Cinely` },
      { name: "description", content: loaderData?.overview?.slice(0, 160) ?? "Watch on Cinely" },
      { property: "og:image", content: loaderData?.backdrop ?? "" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function TvPage() {
  const { id } = Route.useParams();
  const tvId = Number(id);
  const { t, i18n } = useTranslation();
  const { data: m } = useSuspenseQuery(tvQuery(tvId, i18n.language));
  const firstSeason = m.seasons[0]?.season_number ?? 1;
  const [season, setSeason] = useState<number>(firstSeason);
  const [episode, setEpisode] = useState<number>(1);

  const { data: seasonData, isLoading: epLoading } = useQuery(seasonQuery(tvId, season, i18n.language));

  const src = `https://www.vidking.net/embed/tv/${tvId}/${season}/${episode}?color=e85c5c&autoPlay=true&nextEpisode=true&episodeSelector=true`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="overflow-hidden rounded-xl bg-black ring-1 ring-border shadow-glow">
        <div className="aspect-video w-full">
          <iframe
            key={src}
            src={src}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={season}
            onChange={(e) => { setSeason(Number(e.target.value)); setEpisode(1); }}
            className="appearance-none rounded-full bg-card px-4 py-2 pr-9 text-sm ring-1 ring-border focus:outline-none focus:ring-primary"
          >
            {m.seasons.map((s) => (
              <option key={s.season_number} value={s.season_number}>{s.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">{t("Now playing")}: {t("S")}{season} · {t("E")}{episode}</span>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">{t("Episodes")}</h2>
        {epLoading && <p className="text-sm text-muted-foreground">{t("Loading episodes...")}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {seasonData?.episodes.map((ep) => {
            const active = ep.episode_number === episode;
            return (
              <button
                key={ep.episode_number}
                onClick={() => setEpisode(ep.episode_number)}
                className={`text-left rounded-lg ring-1 transition card-hover overflow-hidden ${
                  active ? "ring-primary bg-primary/10" : "ring-border bg-card"
                }`}
              >
                <div className="relative aspect-video bg-muted">
                  {ep.still && <img src={ep.still} alt={ep.name} className="h-full w-full object-cover" />}
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold backdrop-blur">
                    {t("E")}{ep.episode_number}
                  </span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-1 text-sm font-medium">{ep.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{ep.overview}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid gap-8 md:grid-cols-[200px_1fr]">
        {m.poster && (
          <img src={m.poster} alt={m.title} className="hidden w-full rounded-lg ring-1 ring-border md:block" />
        )}
        <div className="space-y-4">
          <h1 className="text-3xl font-bold sm:text-4xl">{m.title}</h1>
          {m.tagline && <p className="italic text-muted-foreground">{m.tagline}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {m.rating > 0 && (
              <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-primary text-primary" />{m.rating.toFixed(1)}</span>
            )}
            {m.date && (
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{m.date.slice(0, 4)}</span>
            )}
          </div>
          {m.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {m.genres.map((g) => (
                <span key={g} className="rounded-full bg-card px-3 py-1 text-xs ring-1 ring-border">{g}</span>
              ))}
            </div>
          )}
          <p className="leading-relaxed text-foreground/90">{m.overview}</p>
        </div>
      </section>
    </main>
  );
}
