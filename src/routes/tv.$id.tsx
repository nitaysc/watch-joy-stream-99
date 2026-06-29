import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTv, getSeason } from "@/lib/tmdb.functions";
import { Star, Calendar, ChevronDown, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import MediaDetails from "@/components/MediaDetails";

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

  return (
    <main>
      {/* Backdrop */}
      {m.backdrop && (
        <div className="fixed inset-0 -z-10">
          <img src={m.backdrop} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="animate-fade-in">
          <MediaDetails id={tvId} mediaType="tv" poster={m.backdrop} season={String(season)} episode={String(episode)} />
        </div>

        {/* Season & Episode Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-4 animate-fade-in" style={{ animationDelay: "0.15s" }}>
          <div className="relative">
            <select
              value={season}
              onChange={(e) => { setSeason(Number(e.target.value)); setEpisode(1); }}
              className="appearance-none rounded-xl bg-white/5 px-4 py-2.5 pr-10 text-sm ring-1 ring-white/10 backdrop-blur-sm transition-all duration-300 focus:outline-none focus:ring-primary/50 hover:bg-white/10"
            >
              {m.seasons.map((s) => (
                <option key={s.season_number} value={s.season_number} className="bg-background">{s.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
            {t("S")}{season} · {t("E")}{episode} {t("Now playing")}
          </span>
        </div>

        {/* Episodes Grid */}
        <section className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <h2 className="mb-4 text-lg font-semibold">{t("Episodes")}</h2>
          {epLoading && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <svg className="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t("Loading episodes...")}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {seasonData?.episodes.map((ep, i) => {
              const active = ep.episode_number === episode;
              return (
                <button
                  key={ep.episode_number}
                  onClick={() => setEpisode(ep.episode_number)}
                  className={`group relative overflow-hidden rounded-xl text-left ring-1 transition-all duration-300 ${
                    active
                      ? "ring-primary/50 bg-primary/5 shadow-lg shadow-primary/5"
                      : "ring-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:ring-white/20"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="relative aspect-video overflow-hidden bg-muted">
                    {ep.still ? (
                      <img
                        src={ep.still}
                        alt={ep.name}
                        className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-white/5 to-white/[0.02]">
                        <Play className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <div className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold backdrop-blur-md ring-1 ring-white/10">
                      {t("E")}{ep.episode_number}
                    </div>
                    {active && (
                      <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                        {t("Now")}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className={`line-clamp-1 text-sm font-medium transition-colors duration-300 ${active ? "text-primary" : "group-hover:text-primary"}`}>
                      {ep.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">{ep.overview}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Series Info */}
        <section className="mt-14 grid gap-10 md:grid-cols-[220px_1fr] animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          {m.poster && (
            <div className="hidden md:block">
              <img
                src={m.poster}
                alt={m.title}
                className="w-full rounded-xl ring-1 ring-white/10 shadow-card animate-fade-in-left"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          )}
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{m.title}</h1>
              {m.tagline && (
                <p className="mt-1 italic text-foreground/60">&ldquo;{m.tagline}&rdquo;</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              {m.rating > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-yellow-400 ring-1 ring-yellow-500/20">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  {m.rating.toFixed(1)}
                </span>
              )}
              {m.date && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />{m.date.slice(0, 4)}
                </span>
              )}
            </div>

            {m.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {m.genres.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-white/5 px-3 py-1 text-xs ring-1 ring-white/10 backdrop-blur-sm transition-colors hover:bg-primary/10 hover:ring-primary/30"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            <p className="leading-relaxed text-foreground/80 max-w-3xl">{m.overview}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
