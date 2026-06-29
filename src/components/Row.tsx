import type { MediaItem } from "@/lib/tmdb.functions";
import { MediaCard } from "./MediaCard";

export function Row({ title, items }: { title: string; items: MediaItem[] }) {
  if (!items?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
      <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
        {items.map((it) => (
          <MediaCard key={`${it.type}-${it.id}`} item={it} />
        ))}
      </div>
    </section>
  );
}
