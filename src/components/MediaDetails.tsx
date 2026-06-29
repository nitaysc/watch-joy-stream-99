import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
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

const CINEPRO_BASE = import.meta.env.VITE_CINEPRO_URL ?? "https://core-production-ef8a.up.railway.app";

function toUrl(id: string | number, mediaType: string, season?: string, episode?: string): string {
  if (mediaType === "tv") {
    return `${CINEPRO_BASE}/v1/tv/${id}/seasons/${season ?? "1"}/episodes/${episode ?? "1"}`;
  }
  return `${CINEPRO_BASE}/v1/movies/${id}`;
}

function fixSourceUrl(url: string, base: string): string {
  if (url.startsWith("http://localhost:3000")) {
    return url.replace("http://localhost:3000", base);
  }
  return url;
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
        const sorted = [...data.sources]
          .map((s) => ({ ...s, url: fixSourceUrl(s.url, CINEPRO_BASE) }))
          .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
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

  const activeSource = sources[activeIdx];

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Error */}
      {error && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span className="flex-1">{error}</span>
          <button
            onClick={fetchStreams}
            className="flex items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1 text-xs font-medium hover:bg-red-500/30"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Server bar */}
      {streamUrl && sources.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <button
              key={i}
              onClick={() => switchSource(i)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                i === activeIdx
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
              }`}
            >
              {s.provider?.name ?? "Server"} {s.quality}
            </button>
          ))}
        </div>
      )}

      {/* Player area */}
      <div className="overflow-hidden rounded-xl bg-black ring-1 ring-border">
        {streamUrl ? (
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
        ) : (
          <div className="flex aspect-video items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <svg className="h-8 w-8 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-white/60">Loading stream...</span>
              </div>
            ) : (
              <span className="text-sm text-white/40">No streams available</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
