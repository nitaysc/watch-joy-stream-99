import { useState } from "react";
import HlsPlayer from "@/components/HlsPlayer";

interface MediaDetailsProps {
  id: string | number;
  mediaType: string;
  poster?: string;
  season?: string;
  episode?: string;
}

interface OmssSource {
  url: string;
  type?: string;
  label?: string;
}

interface OmssResponse {
  sources?: OmssSource[];
  streams?: OmssSource[];
  [key: string]: unknown;
}

const CINEPRO_BASE = "http://localhost:3000/api/omss";

function buildApiUrl(id: string | number, mediaType: string, season?: string, episode?: string): string {
  const base = `${CINEPRO_BASE}/${mediaType}/${id}`;
  if (mediaType === "tv") {
    return `${base}?season=${season ?? "1"}&episode=${episode ?? "1"}`;
  }
  return base;
}

function parseOmssSources(data: OmssResponse): OmssSource[] {
  const list = data.sources ?? data.streams ?? [];
  if (list.length === 0) {
    const fallback = data["url"] as string | undefined;
    if (fallback) return [{ url: fallback }];
  }
  return list.map((s) => ({
    url: s.url,
    type: s.type ?? "application/x-mpegURL",
    label: s.label ?? "Auto",
  }));
}

export default function MediaDetails({ id, mediaType, poster, season, episode }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [sources, setSources] = useState<OmssSource[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const handlePlayClick = async () => {
    setIsLoading(true);
    setErrorToast(null);

    try {
      const url = buildApiUrl(id, mediaType, season, episode);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CinePro returned ${res.status}`);
      const data: OmssResponse = await res.json();
      const parsed = parseOmssSources(data);

      if (parsed.length === 0) throw new Error("No sources in OMSS response");

      setSources(parsed);
      setStreamUrl(parsed[0].url);
    } catch (err) {
      console.error(err);
      setErrorToast("CinePro unavailable or asset not found.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchSource = (idx: number) => {
    setActiveIdx(idx);
    setStreamUrl(sources[idx].url);
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
              {s.label ?? `Source ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        {streamUrl ? (
          <HlsPlayer
            key={activeIdx}
            src={streamUrl}
            poster={poster}
            autoplay
            controls
            width="100%"
            height="100%"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <button
              onClick={handlePlayClick}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-lg font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </>
              ) : (
                "▶ Play"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
