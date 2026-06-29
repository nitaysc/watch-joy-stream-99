import { useState, useEffect } from "react";
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

const CINEPRO_BASE = "http://localhost:3000";

function toUrl(id: string | number, mediaType: string, season?: string, episode?: string): string {
  if (mediaType === "tv") {
    return `${CINEPRO_BASE}/v1/tv/${id}/seasons/${season ?? "1"}/episodes/${episode ?? "1"}`;
  }
  return `${CINEPRO_BASE}/v1/movies/${id}`;
}

export default function MediaDetails({ id, mediaType, poster, season, episode }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>("application/x-mpegURL");
  const [isLoading, setIsLoading] = useState(true);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setErrorToast(null);

    const url = toUrl(id, mediaType, season, episode);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`CinePro returned ${r.status}`);
        return r.json() as Promise<CineProResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.sources?.length) throw new Error("No sources returned");
        setSources(data.sources);
        setStreamUrl(data.sources[0].url);
        setStreamType(data.sources[0].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setErrorToast("CinePro unavailable or asset not found.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, mediaType, season, episode]);

  const switchSource = (idx: number) => {
    setActiveIdx(idx);
    setStreamUrl(sources[idx].url);
    setStreamType(sources[idx].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {errorToast && (
        <div className="absolute right-4 top-4 z-50 flex items-center gap-3 rounded-md bg-red-500 px-5 py-3 text-white shadow-lg">
          <span>{errorToast}</span>
          <button className="cursor-pointer bg-transparent font-bold text-white" onClick={() => setErrorToast(null)}>
            ✕
          </button>
        </div>
      )}

      {sources.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {sources.map((s, i) => (
            <button
              key={i}
              onClick={() => switchSource(i)}
              className={`rounded px-4 py-1.5 text-sm font-medium transition ${
                i === activeIdx
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s.quality ?? s.provider?.name ?? `Source ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        {streamUrl ? (
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
        ) : (
          <div className="flex h-full items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <svg className="h-10 w-10 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-muted-foreground">Loading stream...</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No stream available</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
