"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import {
  Video,
  ChevronDown,
  Link2,
  Upload,
  Trash2,
  Youtube,
  Film,
  Loader2,
} from "lucide-react";

export interface AdminVideo {
  id: string;
  title: string;
  video_type: string;
  video_url: string;
  duration_minutes: number | null;
  display_order: number;
}

interface Props {
  dayId: string;
  videos: AdminVideo[];
  onChanged: () => void;
}

export default function VideoManager({ dayId, videos, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"url" | "upload" | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setMode(null);
    setTitle("");
    setUrl("");
    setDuration("");
    setUploadPct(null);
  };

  const addByUrl = async () => {
    if (!title.trim() || !url.trim()) {
      toast.error("Title and video link are required");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/days/${dayId}/videos`, {
        title,
        url,
        duration_minutes: duration ? parseInt(duration) : null,
        display_order: videos.length,
      });
      toast.success("Video added");
      reset();
      onChanged();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed to add video"));
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!title.trim() || !file) {
      toast.error("Title and a video file are required");
      return;
    }
    setBusy(true);
    setUploadPct(0);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("file", file);
      if (duration) form.append("duration_minutes", duration);
      form.append("display_order", String(videos.length));
      await api.post(`/admin/days/${dayId}/videos/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success("Video uploaded");
      reset();
      onChanged();
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
      setUploadPct(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this video? Uploaded files are removed from storage.")) return;
    await api.delete(`/admin/videos/${id}`);
    toast.success("Video deleted");
    onChanged();
  };

  const rename = async (v: AdminVideo) => {
    const t = prompt("Video title:", v.title);
    if (t === null || !t.trim()) return;
    await api.patch(`/admin/videos/${v.id}`, { title: t });
    onChanged();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <Video size={14} className="text-brand-primary" />
        </div>
        <span className="text-sm font-semibold text-brand-navy flex-1">
          Class videos ({videos.length})
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 bg-gray-50 space-y-2">
          {videos.length === 0 && mode === null && (
            <p className="text-xs text-gray-400 px-1 py-1">
              No videos yet — add a YouTube/Vimeo link or upload a file below.
            </p>
          )}
          {videos
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((v, i) => (
              <div
                key={v.id}
                className="flex items-center gap-2.5 bg-white rounded-lg border border-gray-100 px-3 py-2"
              >
                {v.video_type === "youtube" ? (
                  <Youtube size={14} className="text-red-500 shrink-0" />
                ) : (
                  <Film size={14} className="text-brand-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-brand-navy truncate">
                    {i + 1}. {v.title}
                  </p>
                  <p className="text-[10px] text-gray-300 truncate">
                    {v.video_type}
                    {v.duration_minutes ? ` · ${v.duration_minutes} min` : ""}
                  </p>
                </div>
                <button onClick={() => rename(v)} className="text-xs text-brand-primary font-semibold shrink-0">
                  Rename
                </button>
                <button onClick={() => remove(v.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

          {mode === null ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button size="sm" variant="outline" onClick={() => setMode("url")} className="w-full sm:w-auto">
                <Link2 size={13} className="mr-1" /> Add YouTube/Vimeo link
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("upload")} className="w-full sm:w-auto">
                <Upload size={13} className="mr-1" /> Upload video file
              </Button>
            </div>
          ) : (
            <div className="space-y-2 bg-white rounded-xl border border-brand-primary/20 p-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Video title (e.g. Class 1 — HTML basics)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              {mode === "url" ? (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube or Vimeo link"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                />
              ) : (
                <input
                  ref={fileRef}
                  type="file"
                  accept=".mp4,.webm,.mov,.m4v,video/*"
                  className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:text-brand-primary file:text-xs file:font-semibold"
                />
              )}
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))}
                placeholder="Duration in minutes (optional)"
                className="w-40 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
              />
              {uploadPct !== null && (
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={mode === "url" ? addByUrl : uploadFile} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 size={13} className="mr-1 animate-spin" />
                      {uploadPct !== null ? `Uploading ${uploadPct}%` : "Saving…"}
                    </>
                  ) : mode === "url" ? (
                    "Add video"
                  ) : (
                    "Upload"
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">
                {mode === "upload"
                  ? "MP4/WebM/MOV up to 500 MB. Stored on Cloudinary when configured, otherwise on the server."
                  : "Any YouTube (watch/short/youtu.be) or Vimeo link works — it's converted to a privacy-friendly embed."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
