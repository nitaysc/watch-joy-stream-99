import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMovie } from "@/lib/tmdb.functions";
import { Star, Clock, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import MediaDetails from "@/components/MediaDetails";

const movieQuery = (id: number, language: string) =>
  queryOptions({ queryKey: ["movie", id, language], queryFn: () => getMovie({ data: { id, language } }) });

export const Route = createFileRoute("/movie/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(movieQuery(Number(params.id), i18n.language)),
  component: MoviePage,
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Movie"} — Cinely` },
      { name: "description", content: loaderData?.overview?.slice(0, 160) ?? "Watch on Cinely" },
      { property: "og:image", content: loaderData?.backdrop ?? "" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
});

function MoviePage() {
  const { id } = Route.useParams();
  const { t, i18n } = useTranslation();
  const { data: m } = useSuspenseQuery(movieQuery(Number(id), i18n.language));

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
          <MediaDetails id={id} mediaType="movie" poster={m.backdrop ?? undefined} title={m.title} />
        </div>

        <div className="mt-10 grid gap-10 md:grid-cols-[220px_1fr]" style={{ animationDelay: "0.2s" }}>
          {m.poster && (
            <div className="hidden md:block animate-fade-in-left" style={{ animationDelay: "0.3s" }}>
              <img
                src={m.poster}
                alt={m.title}
                className="w-full rounded-xl ring-1 ring-white/10 shadow-card"
              />
            </div>
          )}
          <div className="space-y-5 animate-fade-in" style={{ animationDelay: "0.3s" }}>
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
              {m.runtime && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />{m.runtime} {t("min")}
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
        </div>
      </div>
    </main>
  );
}
