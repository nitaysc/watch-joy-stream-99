import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAnimeInfo, getEpisodeSources, type AnimeInfo, type EpisodeSources } from "@/lib/consumet.functions";
import HlsPlayer, { type ServerSource } from "@/components/HlsPlayer";
import EmbedOverlay from "@/components/EmbedOverlay";
import { Play, ChevronDown, Star, Calendar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/anime/$id")({
  component: AnimePage,
  pendingComponent: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
});

function AnimePage() {
  const { id } = Route.useParams();
  const [anime, setAnime] = useState<AnimeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEp, setSelectedEp] = useState<number>(1);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState("application/x-mpegURL");
  const [epSources, setEpSources] = useState<ServerSource[]>([]);
  const [activeEpSourceIdx, setActiveEpSourceIdx] = useState(0);
  const [epLoading, setEpLoading] = useState(false);
  const [embedOpen, setEmbedOpen] = useState<null | { src: string; title: string }>(null);

  // AnimeSaturn watch URL — opens the AnimeSaturn site directly (search by title).
  const animeSaturnUrl = anime
    ? `https://www.animesaturn.cx/animelist?search=${encodeURIComponent(anime.title)}`
    : "";

  useEffect(() => {
    setLoading(true);
    getAnimeInfo({ data: { id } })
      .then((data) => { setAnime(data); if (data.episodes?.length) setSelectedEp(data.episodes[0].number); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const loadEpisode = (epNum: number) => {
    setSelectedEp(epNum);
    if (!anime?.episodes) return;
    const ep = anime.episodes.find((e) => e.number === epNum);
    if (!ep) return;
    setEpLoading(true);
    getEpisodeSources({ data: { id: ep.id } })
      .then((data) => {
        const sorted = [...(data.sources ?? [])].sort((a, b) => {
          const ra = parseInt(a.quality ?? "0", 10) || 0;
          const rb = parseInt(b.quality ?? "0", 10) || 0;
          return rb - ra;
        });
        const mapped: ServerSource[] = sorted.map((s) => ({
          url: s.url,
          quality: s.quality,
          provider: { name: s.isM3U8 ? "HLS" : "MP4" },
        }));
        setEpSources(mapped);
        const best = mapped[0] ?? (data.sources?.[0] ? { url: data.sources[0].url, quality: data.sources[0].quality, provider: { name: "Stream" } } : null);
        if (best) {
          setActiveEpSourceIdx(0);
          setStreamUrl(best.url);
          const isM3U8 = best.url?.includes(".m3u8");
          setStreamType(isM3U8 ? "application/x-mpegURL" : "video/mp4");
        }
      })
      .catch(() => {})
      .finally(() => setEpLoading(false));
  };

  const handleAnimeSourceChange = (idx: number) => {
    setActiveEpSourceIdx(idx);
    setStreamUrl(epSources[idx].url);
    const isM3U8 = epSources[idx].url?.includes(".m3u8");
    setStreamType(isM3U8 ? "application/x-mpegURL" : "video/mp4");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="mb-4 text-sm text-destructive">{error ?? "Anime not found"}</p>
          <Link to="/" className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <main>
      {/* Backdrop */}
      {anime.cover && (
        <div className="fixed inset-0 -z-10">
          <img src={anime.cover} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {/* Player */}
        <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/50">
          {streamUrl ? (
            <div className="aspect-video w-full">
              <HlsPlayer
                key={anime.id}
                src={streamUrl}
                type={streamType}
                poster={anime.image}
                autoplay
                sources={epSources}
                activeSourceIdx={activeEpSourceIdx}
                onSourceChange={handleAnimeSourceChange}
              />
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-white/[0.02] to-white/[0.01]">
              {epLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <span className="text-sm text-white/40">Loading episode...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Play className="h-10 w-10 text-white/20" />
                  <span className="text-sm text-white/30">Select an episode to play</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* AnimeSaturn server fallback */}
        <div className="mt-3 text-center">
          <button
            onClick={() => setEmbedOpen({ src: animeSaturnUrl, title: `AnimeSaturn — ${anime.title}` })}
            className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-4 py-2 text-xs font-medium text-purple-300 ring-1 ring-purple-500/20 transition-all hover:bg-purple-500/20 hover:ring-purple-500/40"
          >
            🌸 AnimeSaturn Server
          </button>
        </div>

        {embedOpen && (
          <EmbedOverlay src={embedOpen.src} title={embedOpen.title} onClose={() => setEmbedOpen(null)} />
        )}

        {/* Info */}
        <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
          {anime.image && (
            <div className="hidden md:block">
              <img src={anime.image} alt={anime.title} className="w-full rounded-xl ring-1 ring-white/10 shadow-card" />
            </div>
          )}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{anime.title}</h1>
            {anime.description && (
              <p className="leading-relaxed text-foreground/80">{anime.description}</p>
            )}
            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/5 px-3 py-1 text-xs ring-1 ring-white/10 backdrop-blur-sm">
                    {g}
                  </span>
                ))}
              </div>
            )}
            {anime.totalEpisodes && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {anime.totalEpisodes} episodes
              </div>
            )}
          </div>
        </div>

        {/* Episodes */}
        {anime.episodes && anime.episodes.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 text-lg font-semibold">Episodes</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {anime.episodes.map((ep) => {
                const active = ep.number === selectedEp;
                return (
                  <button
                    key={ep.number}
                    onClick={() => loadEpisode(ep.number)}
                    className={`group flex items-center gap-3 rounded-xl p-3 text-left ring-1 transition-all duration-300 ${
                      active
                        ? "ring-primary/50 bg-primary/5 shadow-lg shadow-primary/5"
                        : "ring-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:ring-white/20"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      active ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/50"
                    }`}>
                      {ep.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`line-clamp-1 text-sm font-medium ${active ? "text-primary" : "group-hover:text-primary"}`}>
                        {ep.title ?? `Episode ${ep.number}`}
                      </p>
                    </div>
                    {active && (
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
