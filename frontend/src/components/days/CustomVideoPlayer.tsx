"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
} from "lucide-react";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A brand-skinned replacement for the browser's native `<video controls>`.
 *  Native controls are functional but read as generic/default-OS chrome —
 *  this gives the player the same visual language (brand-primary accents,
 *  rounded seek bar, custom speed menu) as the rest of the app. */
export default function CustomVideoPlayer({
  src,
  videoKey,
}: {
  src: string;
  /** Forces the underlying <video> to remount on part-switch, same as the
   *  `key` prop this replaces — state (currentTime, playing) must not leak
   *  from one part to the next. */
  videoKey: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setLoaded(false);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoKey]);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2200);
  }, []);

  const wake = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  };

  const seekToClientX = (clientX: number) => {
    const bar = seekBarRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const handleSeekPointerDown = (e: React.PointerEvent) => {
    setSeeking(true);
    seekToClientX(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleSeekPointerMove = (e: React.PointerEvent) => {
    if (seeking) seekToClientX(e.clientX);
  };
  const handleSeekPointerUp = () => setSeeking(false);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black select-none group/player"
      onContextMenu={(e) => e.preventDefault()}
      onMouseMove={wake}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        key={videoKey}
        src={src}
        className="w-full h-full"
        preload="metadata"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDuration(v.duration);
          v.playbackRate = speed;
          setLoaded(true);
        }}
        onTimeUpdate={(e) => !seeking && setCurrentTime(e.currentTarget.currentTime)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
      />

      {/* Center play/pause affordance — always visible when paused, brief
          pulse-and-fade when toggled while playing */}
      {!playing && loaded && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="w-16 h-16 rounded-full bg-white/95 shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
            <Play size={26} className="text-brand-primary ml-1" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Control bar */}
      <div
        className={`absolute bottom-0 inset-x-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-200 ${
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek bar */}
        <div
          ref={seekBarRef}
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          className="relative h-3 flex items-center cursor-pointer group/seek mb-1"
        >
          <div className="relative w-full h-1 group-hover/seek:h-1.5 transition-all rounded-full bg-white/25">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-primary" style={{ width: `${progressPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-primary shadow opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPct}% - 6px)` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-white/90 hover:text-white transition-colors">
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="text-white/90 hover:text-white transition-colors">
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <span className="text-[11px] font-medium text-white/70 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-white/90 hover:text-white transition-colors"
              >
                <Gauge size={14} />
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 border border-white/10 rounded-lg shadow-xl py-1 min-w-[64px] max-h-52 overflow-y-auto">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        if (videoRef.current) videoRef.current.playbackRate = s;
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        s === speed ? "text-brand-cyan font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFullscreen} aria-label="Fullscreen" className="text-white/90 hover:text-white transition-colors">
              {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
