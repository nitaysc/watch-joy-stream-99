import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Languages, Loader2, Server } from "lucide-react";
import HlsPlayer, { type ServerSource, type ExternalSubtitle } from "@/components/HlsPlayer";
import { getStreams } from "@/lib/cinepro.functions";
import { getExternalIds } from "@/lib/lampa.functions";
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
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [hdrezkaLoading, setHdrezkaLoading] = useState(false);
  const hdrezkaFetchId = useRef(0);
  const [hdrezkaRetry, setHdrezkaRetry] = useState(0);

  const [lampaLoading, setLampaLoading] = useState(false);
  const lampaFetchId = useRef(0);
  const subFetchId = useRef(0);
  const [subtitles, setSubtitles] = useState<ExternalSubtitle[]>([]);
  const [showRussianEmbed, setShowRussianEmbed] = useState(false);

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
      setStreamType(mapped[0].type === "mp4" ? "video/mp4" : mapped[0].type === "iframe" ? "iframe" : "application/x-mpegURL");
    }
  };

  const doHdrezkaSearch = useCallback(() => {
    const currentId = ++hdrezkaFetchId.current;
    const key = cacheKey(id, mediaType, season, episode);

    const cached = getCache(key);
    if (cached && currentId === hdrezkaFetchId.current) {
      applySources(cached);
      setIsLoading(false);
      return;
    }

    setHdrezkaLoading(true);
    setError(null);
    setStreamUrl(null);

    getStreams({ data: { id, mediaType, season, episode } })
      .then((data) => {
        if (currentId !== hdrezkaFetchId.current) return;
        if (!data.sources?.length) throw new Error("No sources returned");
        const sorted = [...data.sources].sort(sortSources);
        setCache(key, sorted, data.expiresAt);
        applySources(sorted);
      })
      .catch((err) => {
        if (currentId !== hdrezkaFetchId.current) return;
        setError(err.message);
      })
      .finally(() => {
        if (currentId === hdrezkaFetchId.current) {
          setHdrezkaLoading(false);
        }
      });
  }, [id, mediaType, season, episode, hdrezkaRetry]);

  const doLampaSearch = useCallback(async () => {
    if (!id || !mediaType) return;
    setLampaLoading(true);
    const currentId = ++lampaFetchId.current;
    
    try {
      const extIds = await getExternalIds({
        data: {
          id,
          mediaType
        }
      });
      
      if (!extIds?.imdb_id) throw new Error("No IMDB ID found");
      
      const kRes = await fetch(`https://kinobox.tv/api/players?imdb=${extIds.imdb_id}`);
      if (!kRes.ok) throw new Error("Kinobox API failed");
      
      const players = await kRes.json();
      
      if (currentId !== lampaFetchId.current) return;
      
      if (players && Array.isArray(players) && players.length > 0) {
        setSources((prev) => {
          const newSources = [...prev];
          for (const p of players) {
            if (p.iframeUrl) {
              let finalUrl = p.iframeUrl.startsWith('//') ? 'https:' + p.iframeUrl : p.iframeUrl;
              if (mediaType === 'tv') {
                finalUrl += `&s=${season ?? 1}&e=${episode ?? 1}`;
              }
              const sUrl = finalUrl;
              if (!newSources.some(x => x.url === sUrl)) {
                newSources.push({
                  url: sUrl,
                  type: "iframe",
                  quality: "auto",
                  provider: { name: `Lampa (${p.source})` }
                });
              }
            }
          }
          return newSources;
        });
      }
    } catch (e: any) {
      console.error("Lampa fetch failed:", e);
      setDebugLogs(prev => [...prev, `Lampa ERROR: ${e.message}`]);
    } finally {
      if (currentId === lampaFetchId.current) {
        setLampaLoading(false);
      }
    }
  }, [id, mediaType, season, episode]);

  useEffect(() => {
    doHdrezkaSearch();
    doLampaSearch();
  }, [doHdrezkaSearch, doLampaSearch]);

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

  // Russian Dub is served via iframe embed (vidsrc.cc with defaultLanguage=ru).
  const russianEmbedUrl =
    mediaType === "tv"
      ? `https://vidsrc.cc/v2/embed/tv/${id}/${season ?? 1}/${episode ?? 1}?autoPlay=true&defaultLanguage=ru`
      : `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true&defaultLanguage=ru`;


  const handleSourceChange = (idx: number) => {
    if (idx < 0 || idx >= sources.length) return;
    setActiveIdx(idx);
    setStreamUrl(sources[idx].url);
    setStreamType(sources[idx].type === "mp4" ? "video/mp4" : sources[idx].type === "iframe" ? "iframe" : "application/x-mpegURL");
  };

  const handlePlaybackError = () => {
    if (sources.length <= 1) return;
    const nextIdx = (activeIdx + 1) % sources.length;
    handleSourceChange(nextIdx);
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Error */}
      {error && !sources.length && (
        <div className="mb-4 animate-fade-in">
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3.5 text-sm text-red-400 backdrop-blur-sm">
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setHdrezkaRetry(prev => prev + 1)}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium transition hover:bg-red-500/30"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Debug Logs Panel */}
      {debugLogs.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-4">
          <div className="rounded-xl bg-black/80 border border-white/10 p-4 font-mono text-xs text-white/70 overflow-hidden break-all">
            <h3 className="text-white font-bold mb-2">Provider Debug Logs</h3>
            {debugLogs.map((log, i) => (
              <div key={i} className={log.includes("ERROR") || log.includes("null") || log.includes("NO HLS") ? "text-red-400" : log.includes("SUCCESS") ? "text-green-400" : ""}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player */}
      <div className="overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl shadow-black/50 transition-all duration-500">
        {streamUrl ? (
          <div className="aspect-video w-full">
            {streamType === "iframe" ? (
              <iframe src={streamUrl} className="w-full h-full border-0" allowFullScreen />
            ) : (
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
            )}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-white/[0.02] to-white/[0.01]">
            {(hdrezkaLoading || lampaLoading) ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  <svg className="h-10 w-10 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.15" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute h-3 w-3 rounded-full bg-primary animate-pulse" />
                </div>
                <span className="text-sm text-white/40">Finding streams...</span>
                <div className="flex items-center gap-2 text-xs text-white/20 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Searching external providers...</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm text-white/30">No streams available</span>
                <button
                  onClick={() => setHdrezkaRetry(prev => prev + 1)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40 ring-1 ring-white/10 hover:bg-white/10 hover:text-white/60"
                >
                  <RefreshCw className="h-3 w-3" /> Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Russian Dub — opens vidsrc.cc embed in overlay */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowRussianEmbed(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600/20 px-4 py-2 text-sm font-medium text-green-300 ring-1 ring-green-500/30 transition hover:bg-green-600/30 hover:text-green-200"
        >
          <Languages className="h-4 w-4" /> Open Russian Dub
        </button>
      </div>

      {showRussianEmbed && (
        <EmbedOverlay
          src={russianEmbedUrl}
          title={`${title ?? "Russian Dub"} — Russian`}
          onClose={() => setShowRussianEmbed(false)}
        />
      )}
    </div>
  );
}


