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
      {/* Hero Section */}
      {hero && (
        <section className="relative -mt-[60px] h-[80vh] min-h-[500px] w-full overflow-hidden">
          {hero.backdrop && (
            <>
              <img
                src={hero.backdrop}
                alt={hero.title}
                className="absolute inset-0 h-full w-full object-cover animate-scale-in"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
              <div className="hero-gradient absolute inset-0" />
            </>
          )}

          <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end gap-5 px-4 pb-16">
            <div className="animate-fade-in-left">
              <span className="inline-block rounded-full bg-primary/90 px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
                {hero.type === "tv" ? t("Trending Series") : t("Trending Movie")}
              </span>
            </div>

            <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl animate-fade-in" style={{ animationDelay: "0.1s" }}>
              {hero.title}
            </h1>

            <p className="max-w-xl text-sm text-foreground/80 sm:text-base line-clamp-3 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              {hero.overview}
            </p>

            <div className="flex gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Link
                to={hero.type === "movie" ? "/movie/$id" : "/tv/$id"}
                params={{ id: String(hero.id) }}
                className="group inline-flex items-center gap-2.5 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-primary/50"
              >
                <Play className="h-4 w-4 fill-current transition-transform duration-300 group-hover:scale-110" /> {t("Watch Now")}
              </Link>
              <Link
                to={hero.type === "movie" ? "/movie/$id" : "/tv/$id"}
                params={{ id: String(hero.id) }}
                className="inline-flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 text-sm font-semibold ring-1 ring-white/10 backdrop-blur-md transition-all duration-300 hover:bg-white/10 hover:ring-white/20"
              >
                <Info className="h-4 w-4" /> {t("Details")}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Content Rows */}
      <div className="mx-auto max-w-7xl space-y-12 px-4 pt-10">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <Row title={t("Trending This Week")} items={data.trending} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <Row title={t("Popular Movies")} items={data.popularMovies} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Row title={t("Popular TV Series")} items={data.popularTv} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Row title={t("Top Rated Movies")} items={data.topMovies} />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          <Row title={t("Top Rated TV Series")} items={data.topTv} />
        </div>
      </div>
    </main>
  );
}
