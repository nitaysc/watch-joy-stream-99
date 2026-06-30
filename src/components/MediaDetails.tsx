import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import HlsPlayer, { type ServerSource, type ExternalSubtitle } from "@/components/HlsPlayer";
import { getStreams } from "@/lib/cinepro.functions";
import { searchSubtitles } from "@/lib/opensubtitles.functions";

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
    // Preserve any HDRezka sources that were already added
    setSources((prev) => {
      const hdSources = prev.filter((s) => s.provider?.name?.startsWith("HDRezka"));
      return [...mapped, ...hdSources];
    });
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
    const PROXY = "https://hdrezka-proxy.onrender.com/proxy";

    try {
      // Step 1: Search HDRezka via proxy (client-side fetch)
      const searchUrl = `${PROXY}/search/?do=search&subaction=search&q=${encodeURIComponent(title)}`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok || currentId !== hdrezkaFetchId.current) return;
      const searchHtml = await searchRes.text();

      // Parse search results using regex (browser-safe, no node-html-parser needed)
      const itemRegex = /<div class="b-content__inline_item-link">[\s\S]*?<a href="([^"]+)">(.*?)<\/a>/g;
      let match = itemRegex.exec(searchHtml);
      if (!match) return;
      const videoPageUrl = match[1]; // e.g. https://hdrezka-home.tv/series/drama/1730-pobeg-2005-latest.html

      // Step 2: Fetch the video page via proxy
      const videoProxyUrl = videoPageUrl.replace(/^https?:\/\/[^\/]+/, PROXY);
      const videoRes = await fetch(videoProxyUrl);
      if (!videoRes.ok || currentId !== hdrezkaFetchId.current) return;
      const videoHtml = await videoRes.text();

      // Extract JSON payload using bracket matching
      const lines = videoHtml.split('\n');
      const initLine = lines.find(l => l.includes('initCDNSeriesEvents(') || l.includes('initCDNMoviesEvents('));
      if (!initLine) return;

      const jsonStart = initLine.indexOf('{"id":"cdnplayer"');
      if (jsonStart === -1) return;

      let braceCount = 0;
      let endIdx = -1;
      let inString = false;
      let escapeNext = false;
      
      for (let i = jsonStart; i < initLine.length; i++) {
          const char = initLine[i];
          if (escapeNext) { escapeNext = false; continue; }
          if (char === '\\') { escapeNext = true; continue; }
          if (char === '"') { inString = !inString; continue; }
          if (!inString) {
              if (char === '{') braceCount++;
              else if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                      endIdx = i;
                      break;
                  }
              }
          }
      }
      
      if (endIdx === -1) return;
      const jsnStr = initLine.substring(jsonStart, endIdx + 1);

      let jsn;
      try {
        jsn = JSON.parse(jsnStr);
      } catch { return; }

      const idMatch = initLine.match(/initCDN(?:Series|Movies)Events\(\d+,\s*(\d+),/);
      if (!idMatch) return;
      const defaultTranslatorId = idMatch[1];

      // Find the translator name
      const transRegex = /data-translator_id="([^"]+)"[^>]*title="([^"]*)"/g;
      let translatorName = "Russian Dub";
      let tm;
      while ((tm = transRegex.exec(videoHtml)) !== null) {
        if (tm[1] === defaultTranslatorId) {
          translatorName = tm[2];
          break;
        }
      }
      if (translatorName === "Russian Dub") {
        // Fallback: try another pattern
        const transRegex2 = /data-translator_id="([^"]+)"[^>]*>([^<]+)/g;
        while ((tm = transRegex2.exec(videoHtml)) !== null) {
          if (tm[1] === defaultTranslatorId) {
            translatorName = tm[2].trim();
            break;
          }
        }
      }

      if (!jsn.streams) return;

      // Decode streams (they may be base64 encoded with salt removal)
      let streams = jsn.streams;
      if (!streams.startsWith("[") && !streams.startsWith("http")) {
        // Decode: remove #h prefix, strip known salts from //_// markers, then base64 decode
        const knownSalts = ["IyMjI14hISMjIUBA","QEBAQEAhIyMhXl5e","JCQhIUAkJEBeIUAjJCRA","JCQjISFAIyFAIyM=","Xl5eIUAjIyEhIyM="];
        let url = streams.replace(/^#h/, "");
        for (let i = 0; i < 60 && url.includes("//_//"); i++) {
          const idx = url.indexOf("//_//");
          const after = url.slice(idx + 5);
          let matched = false;
          for (const salt of knownSalts) {
            if (after.startsWith(salt)) {
              url = url.slice(0, idx) + after.slice(salt.length);
              matched = true;
              break;
            }
          }
          if (!matched) {
            url = url.slice(0, idx) + url.slice(Math.min(idx + 5 + 16, url.length));
          }
        }
        try { streams = atob(url); } catch { streams = url; }
      }

      // Parse quality formats from the decoded stream string
      const qualityRegex = /\[([^\]]+)\]/g;
      const qualities: { quality: string; start: number; end: number }[] = [];
      let qm;
      while ((qm = qualityRegex.exec(streams)) !== null) {
        qualities.push({ quality: qm[1], start: qm.index, end: qualityRegex.lastIndex });
      }

      let bestHls = "";
      for (const q of qualities) {
        if (q.quality.includes("prem")) continue; // Skip premium qualities
        const nextStart = qualities.find(x => x.start > q.start)?.start ?? streams.length;
        const urlStr = streams.slice(q.end, nextStart).replace(/,+$/, "").trim();
        const urls = urlStr.split(" or ").map(u => u.trim()).filter(Boolean);
        const hlsUrl = urls.find(u => u.endsWith(":hls:manifest.m3u8"));
        if (hlsUrl && (q.quality === "1080p" || q.quality === "720p" || !bestHls)) {
          bestHls = hlsUrl;
          if (q.quality === "1080p") break; // 1080p is best, stop looking
        }
      }

      if (!bestHls || currentId !== hdrezkaFetchId.current) return;

      const hdSource: ServerSource = {
        url: bestHls,
        type: "application/x-mpegURL",
        quality: "1080p",
        provider: { name: `HDRezka — ${translatorName}` },
      };

      setSources((prev) => {
        if (prev.some((s) => s.provider?.name?.startsWith("HDRezka"))) return prev;
        return [...prev, hdSource];
      });
    } catch (e) {
      console.error("HDRezka client-side search failed:", e);
    } finally {
      if (currentId === hdrezkaFetchId.current) {
        setHdrezkaLoading(false);
      }
    }
  }, [title, season, episode]);

  useEffect(() => {
    doHdrezkaSearch();
  }, [doHdrezkaSearch]);

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
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

