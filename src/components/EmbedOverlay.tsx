import { useState, useRef, useCallback, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";

const FALLBACK_EMBEDS: Record<string, string[]> = {
  "vidsrc.cc": [
    "vidsrc.to",
    "vidsrc.me",
    "2embed.cc",
    "vidlink.pro",
  ],
};

function getFallbackUrls(src: string): string[] {
  for (const [domain, fallbacks] of Object.entries(FALLBACK_EMBEDS)) {
    if (src.includes(domain)) {
      return fallbacks.map((fb) => src.replace(domain, fb));
    }
  }
  return [];
}

interface EmbedOverlayProps {
  src: string;
  title: string;
  onClose: () => void;
}

const LOAD_TIMEOUT = 8000;

export default function EmbedOverlay({ src, title, onClose }: EmbedOverlayProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fallbacks = getFallbackUrls(src);
  const fallbackIdx = useRef(-1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tryFallback = useCallback(() => {
    const nextIdx = fallbackIdx.current + 1;
    if (nextIdx < fallbacks.length) {
      fallbackIdx.current = nextIdx;
      setCurrentSrc(fallbacks[nextIdx]);
      setFailed(false);
      setErrorMsg(null);
      setLoading(true);
    } else {
      setFailed(true);
      setLoading(false);
      setErrorMsg("Embed service unavailable. Try again later or use another source.");
    }
  }, [fallbacks]);

  const handleLoad = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setLoading(false);
    setFailed(false);
  }, []);

  useEffect(() => {
    if (failed) return;
    timeoutRef.current = setTimeout(() => {
      tryFallback();
    }, LOAD_TIMEOUT);
    return () => clearTimeout(timeoutRef.current);
  }, [currentSrc, failed, tryFallback]);

  const retry = useCallback(() => {
    fallbackIdx.current = -1;
    setCurrentSrc(src);
    setFailed(false);
    setErrorMsg(null);
    setLoading(true);
  }, [src]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-6xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl">
          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
              <span className="text-sm text-red-400">{errorMsg}</span>
              <button
                onClick={retry}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/20 hover:text-white"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
              <iframe
                key={currentSrc}
                src={currentSrc}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                allowFullScreen
                referrerPolicy="no-referrer"
                onLoad={handleLoad}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
