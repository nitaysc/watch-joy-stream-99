import React, { useState, useEffect } from "react";
import HlsPlayer from "./HlsPlayer";
import { searchHDRezka, getHDRezkaVideo, resolveStreamUrl } from "@/lib/hdrezka.functions";
import type { HdrezkaSearchItem, HdrezkaTranslation } from "@/lib/hdrezka.types";

interface MediaDetailsProps {
  id: string | number;
  mediaType: string;
  poster?: string;
  season?: string;
  episode?: string;
  title?: string;
}

interface HdrezkaOption {
  title: string;
  translatorName: string;
  translatorId: string;
  videoId: string;
  season?: number;
  episode?: number;
}

export default function MediaDetails({ id, mediaType, poster, season, episode, title }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const [hdrezkaOptions, setHdrezkaOptions] = useState<HdrezkaOption[]>([]);
  const [hdrezkaLoading, setHdrezkaLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<"local" | "hdrezka">("local");

  useEffect(() => {
    setStreamUrl(null);
    setErrorToast(null);
    setHdrezkaOptions([]);
    setActiveSource("local");
  }, [id, mediaType, season, episode]);

  const handlePlayClick = async () => {
    setIsLoading(true);
    setErrorToast(null);
    setActiveSource("local");

    try {
      const response = await fetch(`http://localhost:8080/api/stream?id=${id}&type=${mediaType}`);

      if (!response.ok) {
        throw new Error("Server returned an error");
      }

      const data = await response.json();

      if (data.success && data.stream_url) {
        setStreamUrl(data.stream_url);
      } else {
        throw new Error("Asset not found or invalid response");
      }
    } catch (error) {
      console.error("Failed to fetch stream:", error);
      setErrorToast("Asset not found or server offline.");
    } finally {
      setIsLoading(false);
    }
  };

  const findHdrezkaSources = async () => {
    setHdrezkaLoading(true);
    setErrorToast(null);

    const searchQuery = title || String(id);

    try {
      const searchResults = await searchHDRezka({ data: { query: searchQuery } });
      if (searchResults.length === 0) {
        setErrorToast("No HDRezka sources found for this title.");
        setHdrezkaLoading(false);
        return;
      }

      const video = await getHDRezkaVideo({ data: { url: searchResults[0].url } });
      if (!video || video.translations.length === 0) {
        setErrorToast("No Russian dubs available on HDRezka.");
        setHdrezkaLoading(false);
        return;
      }

      const opts: HdrezkaOption[] = video.translations.map((t) => ({
        title: video.title,
        translatorName: t.name,
        translatorId: t.id,
        videoId: video.id,
        season: season ? parseInt(season, 10) : undefined,
        episode: episode ? parseInt(episode, 10) : undefined,
      }));

      setHdrezkaOptions(opts);
    } catch (err) {
      console.error("HDRezka search failed:", err);
      setErrorToast("HDRezka is currently unavailable.");
    } finally {
      setHdrezkaLoading(false);
    }
  };

  const handleHdrezkaPlay = async (option: HdrezkaOption) => {
    setIsLoading(true);
    setErrorToast(null);
    setActiveSource("hdrezka");

    try {
      const result = await resolveStreamUrl({
        data: {
          videoId: option.videoId,
          translatorId: option.translatorId,
          season: option.season,
          episode: option.episode,
        },
      });

      if (result && result.hls) {
        setStreamUrl(result.hls);
      } else if (result && result.mp4) {
        setStreamUrl(result.mp4);
      } else {
        throw new Error("No stream URL available");
      }
    } catch (error) {
      console.error("Failed to fetch HDRezka stream:", error);
      setErrorToast("Failed to load HDRezka stream.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "800px", margin: "0 auto" }}>
      {errorToast && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 50,
            background: "#ef4444",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <span>{errorToast}</span>
          <button
            onClick={() => setErrorToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          background: "#111",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {streamUrl ? (
          <HlsPlayer src={streamUrl} poster={poster} autoplay controls width="100%" height="100%" />
        ) : (
          <>
            <button
              onClick={handlePlayClick}
              disabled={isLoading}
              style={{
                padding: "12px 32px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: isLoading ? "not-allowed" : "pointer",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background 0.2s",
                marginBottom: 12,
              }}
            >
              {isLoading && activeSource === "local" ? (
                <>
                  <svg
                    style={{ animation: "spin 1s linear infinite", width: 20, height: 20 }}
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Loading...
                </>
              ) : (
                "▶ Play"
              )}
            </button>

            {hdrezkaOptions.length === 0 && !hdrezkaLoading && (
              <button
                onClick={findHdrezkaSources}
                style={{
                  padding: "8px 20px",
                  fontSize: "13px",
                  cursor: "pointer",
                  background: "transparent",
                  color: "#aaa",
                  border: "1px solid #444",
                  borderRadius: "6px",
                }}
              >
                Find Russian Dub (HDRezka)
              </button>
            )}

            {hdrezkaLoading && (
              <span style={{ color: "#888", fontSize: "13px" }}>Searching HDRezka...</span>
            )}

            {hdrezkaOptions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                <span style={{ color: "#888", fontSize: "12px" }}>Russian Dubs:</span>
                {hdrezkaOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleHdrezkaPlay(opt)}
                    disabled={isLoading}
                    style={{
                      padding: "8px 20px",
                      fontSize: "13px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      background: isLoading && activeSource === "hdrezka" ? "#333" : "#2a2a2a",
                      color: "#ddd",
                      border: "1px solid #555",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {isLoading && activeSource === "hdrezka" ? "Loading..." : "▶"}
                    {" "}
                    HDRezka — {opt.translatorName}
                    {mediaType === "tv" && season && episode && ` (S${season}·E${episode})`}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
