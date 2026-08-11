"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import CustomVideoPlayer from "@/components/days/CustomVideoPlayer";

export interface DayVideo {
  id: string;
  title: string;
  video_type: "youtube" | "vimeo" | "upload";
  video_url: string;
  duration_minutes: number | null;
  description: string | null;
  display_order: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Ask Cloudinary to deliver a format the browser can actually decode.
 *
 *  Cloudinary serves the uploaded container as-is, so a phone-recorded .mov
 *  arrives as `video/quicktime` — which Chrome refuses even when the codec is
 *  H.264 (canPlayType returns ""), leaving the player spinning forever.
 *
 *  Conversion is done by swapping the extension rather than with an `f_auto`
 *  or `f_mp4` transform: the transforms answer 200 with no `accept-ranges`,
 *  so the browser cannot stream and has to buffer the whole file (measured at
 *  ~4-5s before playback), while the extension form answers 206 with byte
 *  ranges. This also fixes already-uploaded videos without a data migration.
 */
const UNPLAYABLE_CONTAINERS = /\.(mov|avi|mkv|m4v|wmv|flv|3gp|mpg|mpeg|ts)$/i;

function playableSrc(url: string): string {
  if (!url.includes("res.cloudinary.com") || !url.includes("/video/upload/")) return url;
  return url.replace(UNPLAYABLE_CONTAINERS, ".mp4");
}

export default function VideoLessons({
  videos,
  watermark,
  bare = false,
  activeIndex,
  onActiveIndexChange,
}: {
  videos: DayVideo[];
  /** Learner's email, stamped over the player so a capture is attributable. */
  watermark?: string;
  /** Drop the Card wrapper. The split view already supplies the surface, and
   *  nesting a bordered card inside a bordered pane reads as clutter. */
  bare?: boolean;
  /** Which part is playing. Controlled by the parent day page so the
   *  Progress-tab playlist and this player always agree on what's current. */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}) {
  const sorted = [...videos].sort((a, b) => a.display_order - b.display_order);
  const active = Math.min(activeIndex, sorted.length - 1);

  if (sorted.length === 0) return null;
  const current = sorted[active];
  // An "upload" is only served by our API when it was stored on local disk.
  // With Cloudinary configured the stored URL is already absolute, and blindly
  // prefixing the API base produced "http://localhost:8000https://res.cloud..."
  // — a broken src that left the player black.
  const src = playableSrc(
    /^https?:\/\//i.test(current.video_url)
      ? current.video_url
      : `${API_BASE}${current.video_url}`
  );

  const Shell = bare
    ? ({ children }: { children: React.ReactNode }) => (
        <div className="flex flex-col h-full">{children}</div>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <Card className="mb-6 !p-0 overflow-hidden">{children}</Card>
      );

  return (
    <Shell>
      {/* Player — black bleeds to the pane edges; a letterboxed video inside a
          white frame inside a border is three boxes for one thing.
          onContextMenu is on this wrapper, not just the <video>, so a right
          -click anywhere in the player area (including any letterbox
          background) is caught, not only clicks that land on the video
          element's own exact pixels. */}
      <div
        className={`bg-black relative ${bare ? "flex-1 min-h-0" : "aspect-video"}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {watermark && (
          <span
            className="absolute top-2 right-3 z-10 text-[11px] font-medium text-white/35 pointer-events-none select-none"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            {watermark}
          </span>
        )}
        {current.video_type === "upload" ? (
          <CustomVideoPlayer src={src} videoKey={current.id} />
        ) : (
          <iframe
            key={current.id}
            src={src}
            title={current.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {/* Current video info */}
      <div className={`px-4 py-3 shrink-0 ${bare ? "border-t border-gray-100" : "border-b border-gray-100"}`}>
        <p className="font-semibold text-brand-navy text-sm">{current.title}</p>
        {current.description && <p className="text-xs text-gray-400 mt-0.5">{current.description}</p>}
      </div>

      {/* Prev / next only — the full list of parts lives in the Progress tab,
          not duplicated here. */}
      {sorted.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          <button
            onClick={() => onActiveIndexChange(Math.max(0, active - 1))}
            disabled={active === 0}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs text-gray-400">
            Part {active + 1} of {sorted.length}
          </span>
          <button
            onClick={() => onActiveIndexChange(Math.min(sorted.length - 1, active + 1))}
            disabled={active === sorted.length - 1}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </Shell>
  );
}
