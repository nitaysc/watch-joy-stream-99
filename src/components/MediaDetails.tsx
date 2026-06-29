import { useState, useEffect, useRef } from "react";
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

interface CacheEntry {
  data: Source[];
  expiresAt: number;
}

const CINEPRO_BASE = import.meta.env.VITE_CINEPRO_URL ?? "https://core-production-ef8a.up.railway.app";

function cacheKey(id: string | number, mediaType: string, season?: string, episode?: string): string {
  return `cinepro:${mediaType}:${id}:${season ?? "1"}:${episode ?? "1"}`;
}

function getCache(key: string): Source[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: Source[], expiresAt: string) {
  try {
    const entry: CacheEntry = { data, expiresAt: new Date(expiresAt).getTime() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch { /* quota exceeded, ignore */ }
}

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

function processSources(data: CineProResponse): Source[] {
  return [...data.sources]
    .map((s) => ({ ...s, url: fixSourceUrl(s.url, CINEPRO_BASE) }))
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
}

export default function MediaDetails({ id, mediaType, poster, season, episode }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>("application/x-mpegURL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const fetchId = useRef(0);

  const applySources = (sorted: Source[]) => {
    setSources(sorted);
    setStreamUrl(sorted[0].url);
    setStreamType(sorted[0].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
  };

  const fetchStreams = () => {
    const currentId = ++fetchId.current;
    const url = toUrl(id, mediaType, season, episode);
    const key = cacheKey(id, mediaType, season, episode);

    // Try cache first — instant load if available
    const cached = getCache(key);
    if (cached && currentId === fetchId.current) {
      applySources(cached);
      setIsLoading(false);
    }

    setIsLoading(true);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`CinePro returned ${r.status}`);
        return r.json() as Promise<CineProResponse>;
      })
      .then((data) => {
        if (currentId !== fetchId.current) return;
        if (!data.sources?.length) throw new Error("No sources returned");
        const sorted = processSources(data);
        setCache(key, sorted, data.expiresAt);
        applySources(sorted);
      })
      .catch((err) => {
        if (currentId !== fetchId.current) return;
        if (!cached) setError(err.message);
      })
      .finally(() => {
        if (currentId === fetchId.current) setIsLoading(false);
      });
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
        <div className="mb-4 animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3.5 text-sm text-red-400 backdrop-blur-sm">
            <span className="flex-1">{error}</span>
            <button
              onClick={fetchStreams}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium transition hover:bg-red-500/30"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Server bar */}
      {streamUrl && sources.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" style={{ animationDelay: "0.1s" }}>
          {sources.map((s, i) => (
            <button
              key={i}
              onClick={() => switchSource(i)}
              className={`group flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all duration-300 ${
                i === activeIdx
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/50"
                  : "bg-white/[0.04] text-white/60 ring-1 ring-white/10 hover:bg-white/10 hover:text-white hover:ring-white/20"
              }`}
            >
              {s.provider?.name ?? "Server"}
              <span className={`${i === activeIdx ? "text-primary-foreground/70" : "text-white/30"} font-normal`}>
                {s.quality}
              </span>
              {i === activeIdx && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary-foreground/60 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Player area */}
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/50 transition-all duration-500">
        {streamUrl ? (
          <div className="aspect-video w-full">
            <HlsPlayer
              key={activeIdx}
              src={streamUrl}
              type={streamType}
              poster={poster}
              autoplay
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-white/[0.02] to-white/[0.01]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <svg className="h-10 w-10 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.15" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute h-3 w-3 rounded-full bg-primary animate-pulse" />
                </div>
                <span className="text-sm text-white/40">Finding streams...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-white/30">No streams available</span>
                <button
                  onClick={fetchStreams}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/60"
                >
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
