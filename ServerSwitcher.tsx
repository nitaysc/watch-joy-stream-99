import { useState } from "react";
import { getProxiedUrl } from "./proxy";
import HlsPlayer from "./HlsPlayer";

interface Source {
  name: string;
  url: string;
}

interface ServerSwitcherProps {
  sources: Source[];
  poster?: string;
  autoplay?: boolean;
  width?: number | string;
  height?: number | string;
}

export default function ServerSwitcher({
  sources,
  poster,
  autoplay,
  width,
  height,
}: ServerSwitcherProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSrc = sources[activeIndex]?.url ?? "";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {sources.map((s, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{
              padding: "6px 16px",
              cursor: "pointer",
              fontWeight: i === activeIndex ? 700 : 400,
              background: i === activeIndex ? "#1976d2" : "#e0e0e0",
              color: i === activeIndex ? "#fff" : "#000",
              border: "none",
              borderRadius: 4,
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      <HlsPlayer
        key={activeIndex}
        src={activeSrc}
        poster={poster}
        autoplay={autoplay}
        controls
        width={width}
        height={height}
      />
    </div>
  );
}
