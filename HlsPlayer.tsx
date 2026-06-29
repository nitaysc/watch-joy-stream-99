import { useEffect, useRef, useMemo } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

import "videojs-contrib-quality-levels";
import "@videojs/http-streaming";

import "./modern-player.css";
import { getProxiedUrl } from "./proxy";

interface HlsPlayerProps {
  src: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  width?: number | string;
  height?: number | string;
}

export default function HlsPlayer({
  src,
  poster,
  autoplay = false,
  controls = true,
  width = "100%",
  height = "100%",
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

  const proxiedSrc = useMemo(() => getProxiedUrl(src), [src]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const player = videojs(el, {
      autoplay,
      controls,
      preload: "metadata",
      html5: {
        hls: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    player.qualityLevels();
    player.src({ src: proxiedSrc, type: "application/x-mpegURL" });

    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const currentSrc = player.currentSrc();
    if (currentSrc !== proxiedSrc) {
      player.src({ src: proxiedSrc, type: "application/x-mpegURL" });
      player.play();
    }
  }, [proxiedSrc]);

  return (
    <div data-vjs-player style={{ position: "relative", width, height }}>
      <video
        ref={videoRef}
        className="video-js vjs-default-skin vjs-big-play-centered vjs-modern-theme"
        playsInline
        poster={poster}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
