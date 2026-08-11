"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import {
  FileText,
  ChevronDown,
  Upload,
  Trash2,
  Loader2,
  Presentation,
  FileArchive,
} from "lucide-react";

export interface AdminMaterial {
  id: string;
  title: string;
  file_url: string;
  file_type: string;
  file_size_bytes: number;
  display_order: number;
}

interface Props {
  dayId: string;
  materials: AdminMaterial[];
  onChanged: () => void;
}

const ACCEPT = ".ppt,.pptx,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.zip";

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function iconFor(type: string) {
  if (type === "ppt" || type === "pptx")
    return <Presentation size={14} className="text-orange-500 shrink-0" />;
  if (type === "zip")
    return <FileArchive size={14} className="text-purple-500 shrink-0" />;
  return <FileText size={14} className="text-brand-primary shrink-0" />;
}

export default function MaterialsManager({ dayId, materials, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setAdding(false);
    setTitle("");
    setUploadPct(null);
  };

  const uploadFile = async () => {
    const file = fileRef.current?.files?.[0];
    if (!title.trim() || !file) {
      toast.error("Title and a file are required");
      return;
    }
    setBusy(true);
    setUploadPct(0);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("file", file);
      form.append("display_order", String(materials.length));
      await api.post(`/admin/days/${dayId}/materials/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });
      toast.success("Material uploaded");
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
    if (!confirm("Delete this material? The file is removed from storage.")) return;
    await api.delete(`/admin/materials/${id}`);
    toast.success("Material deleted");
    onChanged();
  };

  const rename = async (m: AdminMaterial) => {
    const t = prompt("Material title:", m.title);
    if (t === null || !t.trim()) return;
    await api.patch(`/admin/materials/${m.id}`, { title: t });
    onChanged();
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-brand-primary" />
        </div>
        <span className="text-sm font-semibold text-brand-navy flex-1">
          Notes & materials ({materials.length})
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="p-3 bg-gray-50 space-y-2">
          {materials.length === 0 && !adding && (
            <p className="text-xs text-gray-400 px-1 py-1">
              No materials yet — upload notes or a slide deck below.
            </p>
          )}
          {materials
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 bg-white rounded-lg border border-gray-100 px-3 py-2"
              >
                {iconFor(m.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-brand-navy truncate">
                    {i + 1}. {m.title}
                  </p>
                  <p className="text-[10px] text-gray-300 truncate uppercase">
                    {m.file_type} · {formatBytes(m.file_size_bytes)}
                  </p>
                </div>
                <button onClick={() => rename(m)} className="text-xs text-brand-primary font-semibold shrink-0">
                  Rename
                </button>
                <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-500 shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

          {!adding ? (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="w-full sm:w-auto">
              <Upload size={13} className="mr-1" /> Upload notes / PPT
            </Button>
          ) : (
            <div className="space-y-2 bg-white rounded-xl border border-brand-primary/20 p-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. Day 1 — HTML basics slides)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              />
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-brand-primary/10 file:text-brand-primary file:text-xs file:font-semibold"
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
                <Button size="sm" onClick={uploadFile} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 size={13} className="mr-1 animate-spin" />
                      {uploadPct !== null ? `Uploading ${uploadPct}%` : "Saving…"}
                    </>
                  ) : (
                    "Upload"
                  )}
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] text-gray-400">
                PPT, PDF, Word, Excel, text, Markdown or ZIP — up to 50 MB. Stored on
                Cloudinary when configured, otherwise on the server.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
