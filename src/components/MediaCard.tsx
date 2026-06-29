import { Link } from "@tanstack/react-router";
import type { MediaItem } from "@/lib/tmdb.functions";
import { Star } from "lucide-react";

export function MediaCard({ item }: { item: MediaItem }) {
  const to = item.type === "movie" ? "/movie/$id" : "/tv/$id";
  return (
    <Link
      to={to}
      params={{ id: String(item.id) }}
      className="card-hover group block w-[160px] shrink-0 sm:w-[180px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted ring-1 ring-border">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        {item.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium backdrop-blur">
            <Star className="h-3 w-3 fill-primary text-primary" />
            {item.rating.toFixed(1)}
          </div>
        )}
        <div className="absolute top-2 left-2 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          {item.type}
        </div>
      </div>
      <div className="mt-2">
        <h3 className="line-clamp-1 text-sm font-medium group-hover:text-primary">{item.title}</h3>
        {item.date && (
          <p className="text-xs text-muted-foreground">{item.date.slice(0, 4)}</p>
        )}
      </div>
    </Link>
  );
}
