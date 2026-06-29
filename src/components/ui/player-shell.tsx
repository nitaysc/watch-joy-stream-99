import { useState } from "react";
import { Monitor, Subtitles, Maximize2 } from "lucide-react";

type Server = {
  id: string;
  name: string;
  getUrl: (id: string | number, season?: number, episode?: number) => string;
};

const MOVIE_SERVERS: Server[] = [
  {
    id: "embedsu",
    name: "Viper",
    getUrl: (id) => `https://embed.su/embed/movie/${id}`,
  },
  {
    id: "vidlink",
    name: "Nova",
    getUrl: (id) =>
      `https://vidlink.pro/movie/${id}?primaryColor=e85c5c&autoplay=1`,
  },
  {
    id: "vidsrc",
    name: "Hydra",
    getUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
  },
  {
    id: "autoembed",
    name: "Flux",
    getUrl: (id) => `https://player.autoembed.cc/embed/movie/${id}`,
  },
];

const TV_SERVERS: Server[] = [
  {
    id: "embedsu",
    name: "Viper",
    getUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "vidlink",
    name: "Nova",
    getUrl: (id, s, e) =>
      `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=e85c5c&autoplay=1&next=1`,
  },
  {
    id: "vidsrc",
    name: "Hydra",
    getUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: "autoembed",
    name: "Flux",
    getUrl: (id, s, e) =>
      `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`,
  },
];

type PlayerShellProps = {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
};

export function PlayerShell({
  tmdbId,
  type,
  season,
  episode,
  title,
}: PlayerShellProps) {
  const servers = type === "movie" ? MOVIE_SERVERS : TV_SERVERS;
  const [activeServer, setActiveServer] = useState(0);
  const [showServers, setShowServers] = useState(false);

  const src = servers[activeServer].getUrl(tmdbId, season, episode);

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#0a0a0f] ring-1 ring-white/[0.06] shadow-2xl shadow-black/60">
      {/* ─── Top bar ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span className="text-[13px] font-medium text-white/70 truncate">
            {title ?? "Now Playing"}
          </span>
        </div>
        <div className="flex items-center gap-1 text-white/40">
          <Subtitles className="h-3.5 w-3.5" />
          <Maximize2 className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* ─── Video iframe ─── */}
      <div className="aspect-video w-full bg-black">
        <iframe
          key={src}
          src={src}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
          referrerPolicy="no-referrer"
          allowFullScreen
        />
      </div>

      {/* ─── Bottom control bar ─── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0d0d14] border-t border-white/[0.04]">
        {/* Server selector */}
        <div className="relative">
          <button
            onClick={() => setShowServers((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Server:</span>
            <span className="text-primary font-semibold">
              {servers[activeServer].name}
            </span>
          </button>

          {/* Server dropdown */}
          {showServers && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowServers(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 z-30 min-w-[180px] rounded-xl bg-[#161622] ring-1 ring-white/[0.08] shadow-2xl shadow-black/80 p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Select Server
                </div>
                {servers.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveServer(i);
                      setShowServers(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                      activeServer === i
                        ? "bg-primary/15 text-primary font-semibold"
                        : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        activeServer === i
                          ? "bg-primary shadow-sm shadow-primary/50"
                          : "bg-white/20"
                      }`}
                    />
                    {s.name}
                    {activeServer === i && (
                      <span className="ml-auto text-[10px] text-primary/60 uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Episode info for TV */}
        {type === "tv" && season != null && episode != null && (
          <span className="text-xs text-white/30 font-mono">
            S{String(season).padStart(2, "0")} · E
            {String(episode).padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}
