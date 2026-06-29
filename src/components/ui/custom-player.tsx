import React, { useState, useEffect } from "react";
import ReactPlayer from "react-player";
import { AlertCircle, Loader2 } from "lucide-react";

export function CustomPlayer({ tmdbId, type }: { tmdbId: number; type: "movie" | "tv" }) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStream() {
      try {
        setLoading(true);
        setError(null);
        
        // Attempt to fetch raw m3u8 from Consumet API
        const res = await fetch(`https://api.consumet.org/meta/tmdb/info/${tmdbId}?type=${type}`);
        
        if (!res.ok) {
          throw new Error("Failed to fetch raw stream from Consumet API (CORS or Server Offline)");
        }
        
        const data = await res.json();
        const sources = data.sources || [];
        const hlsSource = sources.find((s: any) => s.quality === "auto" || s.quality === "1080p")?.url;
        
        if (hlsSource) {
          setStreamUrl(hlsSource);
        } else {
          throw new Error("No raw M3U8 stream found for this TMDB ID");
        }
      } catch (err: any) {
        setError(err.message || "Network Error: Browser blocked raw stream due to CORS policy.");
      } finally {
        setLoading(false);
      }
    }

    fetchStream();
  }, [tmdbId, type]);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black text-muted-foreground p-8">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
        <p className="text-sm font-medium">Attempting to bypass CORS and scrape raw .m3u8 stream...</p>
        <p className="text-xs text-muted-foreground mt-2 max-w-sm text-center">This is how Cineby works, but without a backend proxy server, the browser usually blocks this step.</p>
      </div>
    );
  }

  if (error || !streamUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black/90 text-destructive p-8 border border-destructive/20 rounded-xl">
        <AlertCircle className="h-12 w-12 mb-4 opacity-80" />
        <h3 className="text-lg font-bold mb-2">Backend Scraper Failed</h3>
        <p className="text-sm text-destructive/80 max-w-md text-center">{error}</p>
        <div className="mt-6 p-4 bg-black/50 rounded-lg border border-border text-left w-full max-w-lg">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-white">Why did this happen?</strong><br/>
            Cineby uses a hidden Node.js backend server to secretly steal raw streaming links. Because we are trying to do this from the browser (Frontend), internet security rules (CORS) block the connection. <br/><br/>
            Without a backend proxy, it is impossible to steal raw `.m3u8` links. We MUST use `iframes` (VidKing/EmbedSU) if we don't have a backend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black relative group">
      <ReactPlayer
        url={streamUrl}
        width="100%"
        height="100%"
        controls={true}
        playing={true}
        config={{
          file: {
            forceHLS: true,
            hlsOptions: {
              enableWorker: true,
              lowLatencyMode: true,
            }
          }
        }}
      />
    </div>
  );
}
