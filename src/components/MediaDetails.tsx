import { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import HlsPlayer, { type ServerSource, type ExternalSubtitle } from "@/components/HlsPlayer";
import { getStreams } from "@/lib/cinepro.functions";
import { searchSubtitles } from "@/lib/opensubtitles.functions";
import EmbedOverlay from "@/components/EmbedOverlay";

interface MediaDetailsProps {
  id: string | number;
  mediaType: string;
  poster?: string;
  season?: string;
  episode?: string;
  episodeInfo?: string;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  title?: string;
}

interface Source {
  url: string;
  type: string;
  quality: string;
  provider?: { name: string };
  audioTracks?: { language: string; label: string }[];
}

interface CacheEntry {
  data: Source[];
  expiresAt: number;
}

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
  } catch { /* quota exceeded */ }
}

// Provider priority (lower = preferred)
const PROVIDER_PRIORITY: Record<string, number> = {
  Icefy: 1,
  VidRock: 2,
  MixDrop: 3,
  UpCloud: 4,
  Filemoon: 5,
  VixSrc: 6,
};

function sortSources(a: Source, b: Source): number {
  const pa = PROVIDER_PRIORITY[a.provider?.name ?? ""] ?? 99;
  const pb = PROVIDER_PRIORITY[b.provider?.name ?? ""] ?? 99;
  if (pa !== pb) return pa - pb;
  const aEng = a.audioTracks?.some((t) => t.language === "eng") ? 1 : 0;
  const bEng = b.audioTracks?.some((t) => t.language === "eng") ? 1 : 0;
  if (aEng !== bEng) return bEng - aEng;
  const qa = parseInt(a.quality, 10);
  const qb = parseInt(b.quality, 10);
  return (isNaN(qb) ? 0 : qb) - (isNaN(qa) ? 0 : qa);
}

export default function MediaDetails({ id, mediaType, poster, season, episode, episodeInfo, onPrevEpisode, onNextEpisode, title }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>("application/x-mpegURL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<ServerSource[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const fetchId = useRef(0);
  const subFetchId = useRef(0);
  const [subtitles, setSubtitles] = useState<ExternalSubtitle[]>([]);
  const [embedOpen, setEmbedOpen] = useState<null | { src: string; title: string }>(null);

  const applySources = (sorted: Source[]) => {
    // Icefy is most reliable
    const icefyIdx = sorted.findIndex((s) => s.provider?.name === "Icefy");
    if (icefyIdx > 0) {
      const [source] = sorted.splice(icefyIdx, 1);
      sorted.unshift(source);
    }
    const mapped: ServerSource[] = sorted.map((s) => ({
      url: s.url,
      type: s.type,
      quality: s.quality,
      provider: s.provider,
    }));
    setSources(mapped);
    if (mapped.length > 0) {
      setActiveIdx(0);
      setStreamUrl(mapped[0].url);
      setStreamType(mapped[0].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
    }
  };

  const fetchStreams = () => {
    const currentId = ++fetchId.current;
    const key = cacheKey(id, mediaType, season, episode);

    const cached = getCache(key);
    if (cached && currentId === fetchId.current) {
      applySources(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStreamUrl(null);

    getStreams({ data: { id, mediaType, season, episode } })
      .then((data) => {
        if (currentId !== fetchId.current) return;
        if (!data.sources?.length) throw new Error("No sources returned");
        const sorted = [...data.sources].sort(sortSources);
        setCache(key, sorted, data.expiresAt);
        applySources(sorted);
      })
      .catch((err) => {
        if (currentId !== fetchId.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (currentId === fetchId.current) setIsLoading(false);
      });
  };

  useEffect(fetchStreams, [id, mediaType, season, episode]);

  // Fetch subtitles independently from streams
  useEffect(() => {
    const fetchSubId = ++subFetchId.current;
    const tmdbId = Number(id);
    if (!tmdbId) return;
    searchSubtitles({ data: {
      tmdbId,
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
    }}).then((subs) => {
      if (fetchSubId !== subFetchId.current) return;
      setSubtitles(subs.map((s) => ({
        file_id: s.file_id,
        language: s.language,
        label: s.language_english_name + (s.hearing_impaired ? " [HI]" : ""),
      })));
    }).catch(() => {});
  }, [id, mediaType, season, episode]);

  // Build Russian dub embed URL (vidsrc.cc provides multi-language audio incl. Russian)
  const russianEmbedUrl =
    mediaType === "tv"
      ? `https://vidsrc.cc/v2/embed/tv/${id}/${season ?? 1}/${episode ?? 1}?autoPlay=true&defaultLanguage=ru`
      : `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true&defaultLanguage=ru`;


  const handleSourceChange = (idx: number) => {
    if (idx < 0 || idx >= sources.length) return;
    setActiveIdx(idx);
    setStreamUrl(sources[idx].url);
    setStreamType(sources[idx].type === "mp4" ? "video/mp4" : "application/x-mpegURL");
  };

  const handlePlaybackError = () => {
    if (sources.length <= 1) return;
    const nextIdx = (activeIdx + 1) % sources.length;
    handleSourceChange(nextIdx);
  };

  const currentProvider = sources[activeIdx]?.provider?.name ?? "";

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

      {/* HDRezka Russian dub notification */}
      {hdrezkaFound && (
        <div className="mb-2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs text-green-400 backdrop-blur-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-[10px]">🎧</span>
            <span className="flex-1">Russian dub found via HDRezka — click <strong>Server</strong> in player to switch</span>
            <button
              onClick={() => setHdrezkaFound(false)}
              className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/40 hover:text-white/70"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Player */}
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/50 transition-all duration-500">
        {streamUrl ? (
          <div className="aspect-video w-full">
            <HlsPlayer
              key={`${mediaType}-${id}`}
              src={streamUrl}
              type={streamType}
              poster={poster}
              autoplay
              sources={sources}
              activeSourceIdx={activeIdx}
              onSourceChange={handleSourceChange}
              onError={handlePlaybackError}
              episodeInfo={episodeInfo}
              onPrevEpisode={onPrevEpisode}
              onNextEpisode={onNextEpisode}
              externalSubtitles={subtitles}
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
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm text-white/30">No streams available</span>
                <button
                  onClick={fetchStreams}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/60"
                >
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
                <span className="text-[10px] text-white/20">or</span>
                <button
                  onClick={() => {
                    setError(null);
                    setHdrezkaFound(false);
                    setHdrezkaRetry((c) => c + 1);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs text-green-400 ring-1 ring-green-500/20 hover:bg-green-500/20"
                >
                  Find Russian Dub (HDRezka)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* HDRezka — try Russian dub (always visible below player) */}
      {streamUrl && (
        <div className="mt-3 text-center">
          <button
            onClick={() => {
              setHdrezkaFound(false);
              setHdrezkaRetry((c) => c + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-4 py-2 text-xs font-medium text-green-400 ring-1 ring-green-500/20 transition-all hover:bg-green-500/20 hover:ring-green-500/40"
          >
            Try Russian Dub (HDRezka)
          </button>
        </div>
      )}
    </div>
  );
}
