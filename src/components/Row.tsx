import { useRef, useState, useEffect } from "react";
import type { MediaItem } from "@/lib/tmdb.functions";
import { MediaCard } from "./MediaCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Row({ title, items }: { title: string; items: MediaItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  if (!items?.length) return null;

  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener("scroll", updateScroll, { passive: true });
    return () => el.removeEventListener("scroll", updateScroll);
  }, [items]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amt = el.clientWidth * 0.75;
    el.scrollBy({ left: dir === "left" ? -amt : amt, behavior: "smooth" });
  };

  return (
    <section className="group/row space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold sm:text-xl relative">
          {title}
          <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-full bg-primary transition-all duration-500 group-hover/row:w-full" />
        </h2>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 z-10 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-background to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md ring-1 ring-white/10 hover:bg-black/80">
              <ChevronLeft className="h-4 w-4" />
            </div>
          </button>
        )}

        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-3 overflow-x-auto pb-4"
          onScroll={updateScroll}
        >
          {items.map((it, i) => (
            <MediaCard key={`${it.type}-${it.id}`} item={it} index={i} />
          ))}
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 z-10 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md ring-1 ring-white/10 hover:bg-black/80">
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        )}
      </div>
    </section>
  );
}
