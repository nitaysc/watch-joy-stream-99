import { useState } from "react";
import { Monitor, PlayCircle, Subtitles, Settings } from "lucide-react";

type Server = {
  id: string;
  name: string;
  getUrl: (id: string | number, season?: number, episode?: number) => string;
};

// We only use the 3 most reliable, ad-light servers that support subtitles
const MOVIE_SERVERS: Server[] = [
  {
    id: "embedsu",
    name: "Viper (Recommended)",
    getUrl: (id) => `https://embed.su/embed/movie/${id}`,
  },
  {
    id: "vidlink",
    name: "Nova (Subtitles+)",
    getUrl: (id) =>
      `https://vidlink.pro/movie/${id}?primaryColor=e85c5c&autoplay=1`,
  },
  {
    id: "vidsrc",
    name: "Hydra (Fast)",
    getUrl: (id) => `https://vidsrc.in/embed/movie/${id}`,
  },
];

const TV_SERVERS: Server[] = [
  {
    id: "embedsu",
    name: "Viper (Recommended)",
    getUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "vidlink",
    name: "Nova (Subtitles+)",
    getUrl: (id, s, e) =>
      `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e85c5c&autoplay=1&next=1`,
  },
  {
    id: "vidsrc",
    name: "Hydra (Fast)",
    getUrl: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}/${e}`,
  },
];

type CinebyPlayerProps = {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
};

export function CinebyPlayer({
  tmdbId,
  type,
  season,
  episode,
  title,
}: CinebyPlayerProps) {
  const servers = type === "movie" ? MOVIE_SERVERS : TV_SERVERS;
  const [activeServer, setActiveServer] = useState(0);
  const [showServers, setShowServers] = useState(false);

  const src = servers[activeServer].getUrl(tmdbId, season, episode);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/80 flex flex-col">
      {/* ─── Top status bar (Cineby style) ─── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 to-black/0 absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-5 items-center justify-center rounded bg-primary/20 px-2 text-[10px] font-bold tracking-wider text-primary uppercase">
            Playing
          </div>
          <span className="text-sm font-medium text-white/90 truncate drop-shadow-md">
            {title ?? "Stream"}
          </span>
        </div>
      </div>

      {/* ─── Video iframe container ─── */}
      <div className="aspect-video w-full bg-[#050505] relative group">
        {/* Loading placeholder skeleton */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
          <PlayCircle className="h-12 w-12 text-white/10 mb-3" />
          <span className="text-xs text-white/20 font-medium">Loading player...</span>
        </div>
        
        {/* The actual iframe player */}
        <iframe
          key={src} // Forces iframe to reload when server changes
          src={src}
          className="relative z-10 h-full w-full border-none"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; clipboard-read; display-capture"
          allowFullScreen
          // We DO NOT use sandbox or no-referrer, which caused the "sandbox error" and "missing timeline" before!
        />
      </div>

      {/* ─── Bottom Server Control Bar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0a0a0f] border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wider text-white/40 uppercase">
            Sources
          </span>
          <div className="flex gap-2">
            {servers.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveServer(i)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  activeServer === i
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {activeServer === i && (
                  <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                )}
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 text-white/40">
          <div className="flex items-center gap-1.5 hover:text-white/80 cursor-help transition-colors" title="Subtitles available in player">
            <Subtitles className="h-4 w-4" />
            <span className="text-[11px] font-medium uppercase">CC</span>
          </div>
          {type === "tv" && season != null && episode != null && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/5">
              <span className="text-[11px] font-bold text-white/70">
                S{String(season).padStart(2, "0")} E{String(episode).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
