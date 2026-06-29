import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getHome } from "@/lib/tmdb.functions";
import { Row } from "@/components/Row";
import { Play, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import i18n from "@/lib/i18n";

const homeQuery = (language: string) => queryOptions({
  queryKey: ["home", language],
  queryFn: () => getHome({ data: { language } }),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cinely — Watch Movies & TV Free" },
      { name: "description", content: "Stream trending movies and TV shows in HD for free." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery(i18n.language)),
  component: HomePage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
});

function HomePage() {
  const { t, i18n } = useTranslation();
  const { data } = useSuspenseQuery(homeQuery(i18n.language));
  const hero = data.trending.find((t) => t.backdrop) ?? data.trending[0];

  return (
    <main className="pb-20">
      {hero && (
        <section className="relative -mt-[60px] h-[70vh] min-h-[420px] w-full overflow-hidden">
          {hero.backdrop && (
            <img src={hero.backdrop} alt={hero.title} className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="hero-gradient absolute inset-0" />
          <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end gap-4 px-4 pb-12">
            <span className="w-fit rounded-full bg-primary/90 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              {hero.type === "tv" ? t("Trending Series") : t("Trending Movie")}
            </span>
            <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight sm:text-6xl">{hero.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base line-clamp-3">{hero.overview}</p>
            <div className="flex gap-3">
              <Link
                to={hero.type === "movie" ? "/movie/$id" : "/tv/$id"}
                params={{ id: String(hero.id) }}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:scale-105"
              >
                <Play className="h-4 w-4 fill-current" /> {t("Watch Now")}
              </Link>
              <Link
                to={hero.type === "movie" ? "/movie/$id" : "/tv/$id"}
                params={{ id: String(hero.id) }}
                className="inline-flex items-center gap-2 rounded-full bg-card/80 px-6 py-3 text-sm font-semibold ring-1 ring-border backdrop-blur hover:bg-card"
              >
                <Info className="h-4 w-4" /> {t("Details")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl space-y-10 px-4 pt-10">
        <Row title={t("Trending This Week")} items={data.trending} />
        <Row title={t("Popular Movies")} items={data.popularMovies} />
        <Row title={t("Popular TV Series")} items={data.popularTv} />
        <Row title={t("Top Rated Movies")} items={data.topMovies} />
        <Row title={t("Top Rated TV Series")} items={data.topTv} />
      </div>
    </main>
  );
}
