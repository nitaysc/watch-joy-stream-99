import { useState, useEffect } from "react";
import { RefreshCw, AlertCircle, Layers, Server } from "lucide-react";
import HlsPlayer from "@/components/HlsPlayer";

interface MediaDetailsProps {
  id: string | number;
  mediaType: string;
  poster?: string;
  season?: string;
  episode?: string;
}

interface Source {
  url: string;
  type: string;
  quality: string;
  provider?: { name: string };
}

interface CineProResponse {
  responseId: string;
  expiresAt: string;
  sources: Source[];
}

// Set VITE_CINEPRO_URL in your Lovable project settings (Settings → Environment Variables)
// or create a .env file locally with: VITE_CINEPRO_URL=http://192.168.x.x:3000
// Default: localhost works on PC browser, but NOT from phone
const CINEPRO_BASE = import.meta.env.VITE_CINEPRO_URL ?? "http://localhost:3000";

function toUrl(id: string | number, mediaType: string, season?: string, episode?: string): string {
  if (mediaType === "tv") {
    return `${CINEPRO_BASE}/v1/tv/${id}/seasons/${season ?? "1"}/episodes/${episode ?? "1"}`;
  }
  return `${CINEPRO_BASE}/v1/movies/${id}`;
}

function qualityRank(q: string): number {
  const n = parseInt(q, 10);
  return isNaN(n) ? 0 : n;
}

export default function MediaDetails({ id, mediaType, poster, season, episode }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>("application/x-mpegURL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const fetchStreams = () => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setStreamUrl(null);

    const url = toUrl(id, mediaType, season, episode);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`CinePro returned ${r.status}`);
        return r.json() as Promise<CineProResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.sources?.length) throw new Error("No sources returned");
        const sorted = [...data.sources].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
        setSources(sorted);
        setStreamUrl(sorted[0].url);
        setStreamType(sorted[0].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  };

  useEffect(fetchStreams, [id, mediaType, season, episode]);

  const switchSource = (idx: number) => {
    setActiveIdx(idx);
    setStreamUrl(sources[idx].url);
    setStreamType(sources[idx].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
  };

  const grouped = sources.reduce<Record<string, Source[]>>((acc, s) => {
    const key = s.provider?.name ?? "Unknown";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* Error banner */}
      {error && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 backdrop-blur">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={fetchStreams}
            className="flex items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1 text-xs font-medium transition hover:bg-red-500/30"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Stream area */}
      <div className="overflow-hidden rounded-xl bg-black ring-1 ring-border">
        {streamUrl ? (
          <>
            {/* Server bar */}
            {sources.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 bg-white/5 px-3 py-2">
                <Server className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                {Object.entries(grouped).map(([provider, quals]) => {
                  const idx = sources.indexOf(quals[0]);
                  const isActive = idx === activeIdx;
                  return (
                    <div key={provider} className="relative">
                      <button
                        onClick={() => switchSource(idx)}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                        }`}
                      >
                        {provider}
                        {quals.length > 1 && (
                          <span className="opacity-60">+{quals.length - 1}</span>
                        )}
                      </button>
                      {isActive && quals.length > 1 && (
                        <div className="absolute left-0 top-full z-20 mt-1 flex flex-col gap-0.5 rounded-lg border border-border bg-card p-1 shadow-xl">
                          {quals.map((q, qi) => {
                            const realIdx = sources.indexOf(q);
                            return (
                              <button
                                key={qi}
                                onClick={() => switchSource(realIdx)}
                                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-left text-xs font-medium transition ${
                                  realIdx === activeIdx
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                }`}
                              >
                                {q.quality}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {sources.length > 0 && (
                  <span className="ml-auto text-[11px] text-muted-foreground/50">
                    <Layers className="mr-1 inline h-3 w-3" />
                    {sources[activeIdx].quality}
                  </span>
                )}
              </div>
            )}
            <div className="aspect-video w-full">
              <HlsPlayer
                key={activeIdx}
                src={streamUrl}
                type={streamType}
                poster={poster}
                autoplay
                controls
                width="100%"
                height="100%"
              />
            </div>
          </>
        ) : (
          <div className="flex aspect-video items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                  <svg className="relative h-12 w-12 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground/80">Finding available streams...</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Searching across providers</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">No streams available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
