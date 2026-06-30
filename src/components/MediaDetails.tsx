import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Languages, Loader2 } from "lucide-react";
import HlsPlayer, { type ServerSource, type ExternalSubtitle } from "@/components/HlsPlayer";
import { getStreams } from "@/lib/cinepro.functions";
import { searchSubtitles } from "@/lib/opensubtitles.functions";
import { searchHDRezka, getHDRezkaVideo, resolveStreamUrl } from "@/lib/hdrezka.functions";

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
  const [hdrezkaFound, setHdrezkaFound] = useState(false);
  const [hdrezkaLoading, setHdrezkaLoading] = useState(false);
  const hdrezkaFetchId = useRef(0);
  const [hdrezkaRetry, setHdrezkaRetry] = useState(0);

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

  const doHdrezkaSearch = useCallback(async () => {
    if (!title) return;
    setHdrezkaLoading(true);
    const currentId = ++hdrezkaFetchId.current;
    const queries = [title];

    try {
      for (const q of queries) {
        if (currentId !== hdrezkaFetchId.current) return;
        try {
          const results = await searchHDRezka({ data: { query: q } });
          if (currentId !== hdrezkaFetchId.current) return;
          if (results.length === 0) continue;

          const video = await getHDRezkaVideo({ data: { url: results[0].url } });
          if (currentId !== hdrezkaFetchId.current || !video) return;
          if (video.translations.length === 0) continue;

          const translation = video.translations.find((t) => t.isDefault) || video.translations[0];
          const stream = await resolveStreamUrl({
            data: {
              videoId: video.id,
              translatorId: translation.id,
              season: season ? Number(season) : undefined,
              episode: episode ? Number(episode) : undefined,
            },
          });
          if (currentId !== hdrezkaFetchId.current || !stream) return;

          const hlsUrl = stream.hls || stream.mp4;
          if (!hlsUrl) return;

          const hdSource: ServerSource = {
            url: hlsUrl,
            type: stream.hls ? "application/x-mpegURL" : "video/mp4",
            quality: "1080p",
            provider: { name: `HDRezka — ${translation.name}` },
          };

          setHdrezkaFound(true);
          setTimeout(() => setHdrezkaFound(false), 15000);
          
          setSources((prev) => {
            const existsIdx = prev.findIndex((s) => s.provider?.name === hdSource.provider?.name);
            if (existsIdx !== -1) {
              setActiveIdx(existsIdx);
              return prev;
            }
            const newSources = [...prev, hdSource];
            setActiveIdx(newSources.length - 1);
            return newSources;
          });
          
          setStreamUrl(hdSource.url ?? null);
          setStreamType(hdSource.type ?? "application/x-mpegURL");
          return;
        } catch (e) {
          console.error("HDRezka search failed for:", q, e);
        }
      }
    } finally {
      if (currentId === hdrezkaFetchId.current) {
        setHdrezkaLoading(false);
      }
    }
  }, [title, season, episode, streamUrl]);

  useEffect(() => {
    doHdrezkaSearch();
  }, [doHdrezkaSearch]);

  const [activeIframe, setActiveIframe] = useState<string | null>(null);

  const loadVidSrc = () => {
    if (mediaType === "tv") {
      setActiveIframe(`https://vidsrc.net/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`);
    } else {
      setActiveIframe(`https://vidsrc.net/embed/movie?tmdb=${id}`);
    }
  };

  const loadEmbedSu = () => {
    if (mediaType === "tv") {
      setActiveIframe(`https://embed.su/embed/tv/${id}/${season}/${episode}`);
    } else {
      setActiveIframe(`https://embed.su/embed/movie/${id}`);
    }
  };

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

      {/* Player */}
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/50 transition-all duration-500">
        {activeIframe ? (
          <div className="aspect-video w-full">
            <iframe
              src={activeIframe}
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        ) : streamUrl ? (
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* External Player selectors */}
      {(streamUrl || activeIframe) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {hdrezkaLoading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/5 px-4 py-2 text-xs text-green-400/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching Russian dub...
            </span>
          ) : (
            <button
              onClick={() => { setActiveIframe(null); doHdrezkaSearch(); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-4 py-2 text-xs font-medium text-green-400 ring-1 ring-green-500/20 transition-all hover:bg-green-500/20 hover:ring-green-500/40"
            >
              <Languages className="h-3.5 w-3.5" /> Russian Dub
            </button>
          )}

          <button
            onClick={loadVidSrc}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20 transition-all hover:bg-blue-500/20 hover:ring-blue-500/40"
          >
            VidSrc Player
          </button>

          <button
            onClick={loadEmbedSu}
            className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-4 py-2 text-xs font-medium text-purple-400 ring-1 ring-purple-500/20 transition-all hover:bg-purple-500/20 hover:ring-purple-500/40"
          >
            SuperEmbed Player
          </button>
          
          {activeIframe && (
             <button
                onClick={() => setActiveIframe(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-4 py-2 text-xs font-medium text-white/60 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white"
             >
                Return to Default Player
             </button>
          )}
        </div>
      )}
    </div>
  );
}

