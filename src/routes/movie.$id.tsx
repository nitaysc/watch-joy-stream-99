import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMovie } from "@/lib/tmdb.functions";
import { Star, Clock, Calendar, Server, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useServerPing } from "@/hooks/use-servers";

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
  
  const servers = [
    { name: "VidLink", url: `https://vidlink.pro/movie/${id}?primaryColor=e85c5c&autoplay=1` },
    { name: "VidKing", url: `https://www.vidking.net/embed/movie/${id}?color=e85c5c&autoPlay=true` },
    { name: "EmbedSU", url: `https://embed.su/embed/movie/${id}` },
    { name: "VidSrc", url: `https://vidsrc.cc/v2/embed/movie/${id}` },
  ];
  
  const { pings, checking, bestIndex, setBestIndex } = useServerPing(servers);

  const src = servers[bestIndex].url;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <div className="overflow-hidden rounded-xl bg-black ring-1 ring-border shadow-glow relative">
        <div className="aspect-video w-full">
          {checking ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium animate-pulse">{t("Finding the best server...")}</p>
            </div>
          ) : null}
          <iframe
            src={src}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            referrerPolicy="no-referrer"
            allowFullScreen
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Server className="h-4 w-4" /> {t("Servers")}
        </span>
        <div className="flex flex-wrap gap-2">
          {servers.map((s, i) => {
            const ping = pings[s.name];
            return (
              <Button
                key={s.name}
                variant={bestIndex === i ? "default" : "outline"}
                size="sm"
                onClick={() => setBestIndex(i)}
                className="rounded-full flex items-center gap-2"
                disabled={checking}
              >
                {s.name}
                {!checking && ping !== undefined && (
                  <span className="flex items-center text-[10px] opacity-80">
                    {ping === null ? <XCircle className="h-3 w-3 text-destructive mr-1" /> : <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />}
                    {ping !== null ? `${ping}ms` : "Offline"}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

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
