import React, { useState } from "react";
import HlsPlayer from "./HlsPlayer";

interface MediaDetailsProps {
  id: string | number;
  mediaType: string;
  poster?: string;
}

export default function MediaDetails({ id, mediaType, poster }: MediaDetailsProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const handlePlayClick = async () => {
    setIsLoading(true);
    setErrorToast(null);

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

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: "800px", margin: "0 auto" }}>
      {/* Error Notification Toast */}
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
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {streamUrl ? (
          <HlsPlayer src={streamUrl} poster={poster} autoplay controls width="100%" height="100%" />
        ) : (
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
            }}
          >
            {isLoading ? (
              <>
                <svg
                  style={{ animation: "spin 1s linear infinite", width: 20, height: 20 }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeOpacity="0.25"
                  />
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
        )}
      </div>
    </div>
  );
}
