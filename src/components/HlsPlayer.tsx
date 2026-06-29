import { useEffect, useRef, useState, useCallback } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import "@videojs/http-streaming";
import { Play, Pause, Maximize, Minimize, SkipBack, SkipForward, Loader2, Subtitles, Languages } from "lucide-react";
import "./modern-player.css";

interface HlsPlayerProps {
  src: string;
  type?: string;
  poster?: string;
  autoplay?: boolean;
}

function formatTime(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function volumeIcon(vol: number, muted: boolean) {
  if (muted || vol === 0) return <Loader2 className="h-4 w-4" />; /* placeholder — handled below */
  if (vol < 0.33) return "low";
  if (vol < 0.66) return "mid";
  return "high";
}

export default function HlsPlayer({ src, type = "application/x-mpegURL", poster, autoplay = false }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [quality, setQuality] = useState("Auto");
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [tracks, setTracks] = useState<{ kind: string; label: string; language: string; mode: string }[]>([]);
  const [audioTracks, setAudioTracks] = useState<{ label: string; language: string; enabled: boolean }[]>([]);
  const [showCcm, setShowCcm] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    setShowCcm(false);
    setShowAudioMenu(false);
    setShowQualityMenu(false);
    if (playing) {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  const handleProgressClick = (e: React.MouseEvent) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !playerRef.current) return;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playerRef.current.currentTime(frac * duration);
  };

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.paused()) { p.play(); setPlaying(true); }
    else { p.pause(); setPlaying(false); }
  };

  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    p.muted(!p.muted());
    setMuted(!muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    const p = playerRef.current;
    if (p) { p.volume(v); p.muted(v === 0); }
    setVolume(v);
    setMuted(v === 0);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    } else {
      el.requestFullscreen();
      setFullscreen(true);
    }
  };

  // Track updates from Video.js
  const updateTracks = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const tt = p.textTracks?.();
    if (tt) {
      const list: { kind: string; label: string; language: string; mode: string }[] = [];
      for (let i = 0; i < tt.length; i++) {
        const t = tt[i];
        list.push({ kind: t.kind, label: t.label || t.language || `Track ${i + 1}`, language: t.language, mode: t.mode });
      }
      setTracks(list);
    }
    const at = p.audioTracks?.();
    if (at) {
      const list: { label: string; language: string; enabled: boolean }[] = [];
      for (let i = 0; i < at.length; i++) {
        const t = at[i];
        list.push({ label: t.label || t.language || `Audio ${i + 1}`, language: t.language, enabled: t.enabled });
      }
      setAudioTracks(list);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = playerRef.current;
      if (!p) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "m":
          toggleMute();
          break;
        case "ArrowLeft":
          p.currentTime(Math.max(0, (p.currentTime() ?? 0) - 10));
          break;
        case "ArrowRight":
          p.currentTime(Math.min(duration || Infinity, (p.currentTime() ?? 0) + 10));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const player = videojs(el, {
      autoplay,
      controls: false,
      preload: "metadata",
      width: "100%",
      height: "100%",
      html5: {
        hls: { overrideNative: true, enableLowInitialPlaylist: true, smoothQualityChange: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
    });

    player.el().style.setProperty("width", "100%", "important");
    player.el().style.setProperty("height", "100%", "important");

    player.qualityLevels();
    player.src({ src, type });

    player.on("play", () => setPlaying(true));
    player.on("pause", () => setPlaying(false));
    player.on("waiting", () => setLoading(true));
    player.on("canplay", () => { setLoading(false); updateTracks(); });
    player.on("playing", () => setLoading(false));
    player.on("error", () => setError(true));
    player.on("loadedmetadata", () => { setDuration(player.duration() ?? 0); updateTracks(); });
    player.on("timeupdate", () => {
      setCurrentTime(player.currentTime() ?? 0);
      setDuration(player.duration() ?? 0);
    });
    player.on("progress", () => {
      const b = player.buffered();
      if (b.length > 0) setBuffered(b.end(b.length - 1));
    });
    player.on("qualitylevelschange", () => {
      const ql = player.qualityLevels();
      const idx = ql.selectedIndex;
      if (idx >= 0 && ql[idx]) setQuality(`${ql[idx].height}p`);
    });

    // Track changes
    player.textTracks()?.addEventListener("change", updateTracks);
    player.audioTracks()?.addEventListener("change", updateTracks);

    playerRef.current = player;
    return () => { player.dispose(); playerRef.current = null; };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.currentSrc() !== src) {
      setError(false);
      setLoading(true);
      player.src({ src, type });
      if (autoplay) player.play();
    }
  }, [src, type]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const progressFrac = duration > 0 ? currentTime / duration : 0;
  const bufferedFrac = duration > 0 ? buffered / duration : 0;
  const volIcon = muted || volume === 0 ? "mute" : volume < 0.33 ? "low" : volume < 0.66 ? "mid" : "high";
  const subtitleTracks = tracks.filter((t) => t.kind === "subtitles" || t.kind === "captions");
  const hasSubtitles = subtitleTracks.length > 0;
  const hasAudioTracks = audioTracks.length > 0;

  return (
    <div
      ref={containerRef}
      className="group relative h-full w-full cursor-pointer overflow-hidden bg-black select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
      onClick={togglePlay}
    >
      {/* Ambient glow */}
      {poster && (
        <div className="pointer-events-none absolute inset-0 opacity-20 transition-opacity duration-700">
          <img src={poster} alt="" className="h-full w-full scale-150 object-cover blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>
      )}

      {/* Video.js wrapper */}
      <div data-vjs-player className="h-full w-full">
        <video
          ref={videoRef}
          className="video-js vjs-modern-theme h-full w-full"
          playsInline
          poster={poster}
        />
      </div>

      {/* Loading */}
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="rounded-full bg-white/5 p-4 ring-1 ring-white/10">
            <Loader2 className="h-6 w-6 text-white/40" />
          </div>
          <span className="text-sm text-white/40">Playback error</span>
        </div>
      )}

      {/* Big play */}
      {!playing && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/90 backdrop-blur-md shadow-2xl shadow-primary/30 ring-1 ring-white/20 transition-all duration-300 hover:scale-110 hover:bg-primary hover:shadow-primary/50">
            <Play className="ml-1 h-8 w-8 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Bottom overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-500 ${
          showControls ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div
          className="mx-3 h-1.5 cursor-pointer rounded-full bg-white/10 transition-all duration-200 hover:h-2.5"
          onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}
          ref={progressRef}
        >
          <div className="relative h-full">
            <div className="h-full rounded-full bg-white/15" style={{ width: `${bufferedFrac * 100}%` }} />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-orange-500 shadow-lg shadow-primary/30"
              style={{ width: `${progressFrac * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-lg shadow-primary/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:!opacity-100" />
            </div>
          </div>
        </div>

        {/* Control bar */}
        <div className="mx-3 mb-3 mt-1.5">
          <div className="flex items-center gap-0.5 rounded-2xl bg-black/70 px-2 py-1.5 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl">
            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>

            {/* Skip back */}
            <button
              onClick={(e) => { e.stopPropagation(); playerRef.current?.currentTime(Math.max(0, (playerRef.current?.currentTime() ?? 0) - 10)); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            {/* Skip forward */}
            <button
              onClick={(e) => { e.stopPropagation(); playerRef.current?.currentTime(Math.min(duration || Infinity, (playerRef.current?.currentTime() ?? 0) + 10)); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            {/* Time */}
            <span className="ml-1 text-xs font-medium tabular-nums text-white/50 min-w-[80px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume — inline slider */}
            <div className="group/vol ml-1 flex items-center gap-1 rounded-xl px-1 transition-all duration-200 hover:bg-white/5">
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-all duration-200 hover:text-white"
              >
                {volIcon === "mute" ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : volIcon === "low" ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
              </button>
              <div className="w-0 overflow-hidden transition-all duration-200 group-hover/vol:w-20">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  className="h-1 w-full appearance-none rounded-full bg-white/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/30"
                  style={{
                    background: `linear-gradient(to right, #e85c5c ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(muted ? 0 : volume) * 100}%)`,
                  }}
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* Subtitles / CC */}
            {hasSubtitles && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCcm(!showCcm); setShowAudioMenu(false); setShowQualityMenu(false); }}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/10 ${
                    subtitleTracks.some((t) => t.mode === "showing") ? "text-primary" : "text-white/40 hover:text-white"
                  }`}
                >
                  <Subtitles className="h-4 w-4" />
                </button>
                {showCcm && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-xl bg-black/90 p-1.5 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const p = playerRef.current;
                        if (!p) return;
                        const tt = p.textTracks();
                        for (let i = 0; i < tt.length; i++) { tt[i].mode = "disabled"; }
                        setShowCcm(false);
                        updateTracks();
                      }}
                      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-all ${
                        subtitleTracks.every((t) => t.mode === "disabled") ? "bg-primary/20 text-primary font-medium" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      Off
                    </button>
                    {subtitleTracks.map((t, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          const p = playerRef.current;
                          if (!p) return;
                          const tt = p.textTracks();
                          for (let j = 0; j < tt.length; j++) { tt[j].mode = j === i ? "showing" : "disabled"; }
                          setShowCcm(false);
                          updateTracks();
                        }}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-all ${
                          t.mode === "showing" ? "bg-primary/20 text-primary font-medium" : "text-white/50 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audio tracks */}
            {hasAudioTracks && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAudioMenu(!showAudioMenu); setShowCcm(false); setShowQualityMenu(false); }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
                >
                  <Languages className="h-4 w-4" />
                </button>
                {showAudioMenu && (
                  <div className="absolute bottom-full right-0 mb-2 min-w-[140px] rounded-xl bg-black/90 p-1.5 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl">
                    {audioTracks.map((t, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          const p = playerRef.current;
                          if (!p) return;
                          const at = p.audioTracks();
                          for (let j = 0; j < at.length; j++) { at[j].enabled = j === i; }
                          setShowAudioMenu(false);
                          updateTracks();
                        }}
                        className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-all ${
                          t.enabled ? "bg-primary/20 text-primary font-medium" : "text-white/50 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); setShowCcm(false); setShowAudioMenu(false); }}
                className="flex h-7 items-center rounded-lg bg-white/5 px-2 text-[10px] font-semibold tracking-wider text-white/50 uppercase transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                {quality}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 min-w-[110px] rounded-xl bg-black/90 p-1.5 backdrop-blur-2xl ring-1 ring-white/10 shadow-2xl">
                  {["Auto", "2160p", "1080p", "720p", "480p", "360p"].map((q) => (
                    <button
                      key={q}
                      onClick={(e) => { e.stopPropagation(); setQuality(q); setShowQualityMenu(false); }}
                      className={`w-full rounded-lg px-3 py-1.5 text-left text-xs transition-all ${
                        quality === q ? "bg-primary/20 text-primary font-medium" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
