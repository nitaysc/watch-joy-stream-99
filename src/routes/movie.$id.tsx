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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <MediaDetails id={id} mediaType="movie" poster={m.backdrop} title={m.title} />

      <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr]">
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
            {m.runtime && (
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{m.runtime} {t("min")}</span>
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
      </div>
    </main>
  );
}
