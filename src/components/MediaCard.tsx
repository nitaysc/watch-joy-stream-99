import { Link } from "@tanstack/react-router";
import type { MediaItem } from "@/lib/tmdb.functions";
import { Star, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

export function MediaCard({ item, index = 0 }: { item: MediaItem; index?: number }) {
  const to = item.type === "movie" ? "/movie/$id" : "/tv/$id";
  const { t } = useTranslation();

  return (
    <Link
      to={to}
      params={{ id: String(item.id) }}
      className="group block w-[160px] shrink-0 sm:w-[180px]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted ring-1 ring-white/5 transition-all duration-500 group-hover:ring-primary/50 group-hover:shadow-glow">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {t("No image")}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/50 transition-transform duration-300 group-hover:scale-110">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>

        {item.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium backdrop-blur-md ring-1 ring-white/10">
            <Star className="h-3 w-3 fill-primary text-primary" />
            {item.rating.toFixed(1)}
          </div>
        )}

        <div className="absolute top-2 left-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
          {item.type === "movie" ? t("Movie") : t("Series")}
        </div>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-medium transition-colors duration-300 group-hover:text-primary">{item.title}</h3>
        {item.date && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{item.date.slice(0, 4)}</p>
        )}
      </div>
    </Link>
  );
}
