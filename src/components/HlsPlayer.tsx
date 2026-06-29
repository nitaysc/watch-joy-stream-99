import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import "@videojs/http-streaming";

interface HlsPlayerProps {
  src: string;
  type?: string;
  poster?: string;
  autoplay?: boolean;
  controls?: boolean;
  width?: number | string;
  height?: number | string;
}

export default function HlsPlayer({
  src,
  type = "application/x-mpegURL",
  poster,
  autoplay = false,
  controls = true,
  width = "100%",
  height = "100%",
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);

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
    player.src({ src, type });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.currentSrc() !== src) {
      player.src({ src, type });
      player.play();
    }
  }, [src, type]);

  return (
    <div data-vjs-player className="relative" style={{ width, height }}>
      <video
        ref={videoRef}
        className="video-js vjs-default-skin vjs-big-play-centered h-full w-full"
        playsInline
        poster={poster}
      />
    </div>
  );
}
