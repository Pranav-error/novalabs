"use client";

import { Download, FileText, Presentation, FileArchive, Eye, Lock } from "lucide-react";
import Card from "@/components/ui/Card";

export interface DayMaterial {
  id: string;
  title: string;
  file_url: string;
  /** Only present for paid learners — signed separately for attachment delivery. */
  download_url?: string;
  file_type: string;
  file_size_bytes: number;
  display_order: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function fullUrl(url: string) {
  return url.startsWith("/") ? `${API_URL}${url}` : url;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function iconFor(type: string) {
  if (type === "ppt" || type === "pptx")
    return <Presentation size={18} className="text-orange-500" />;
  if (type === "zip") return <FileArchive size={18} className="text-purple-500" />;
  return <FileText size={18} className="text-brand-primary" />;
}

export default function DayMaterials({
  materials,
  canDownload = false,
}: {
  materials: DayMaterial[];
  canDownload?: boolean;
}) {
  if (!materials.length) return null;

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Notes &amp; materials
        </h3>
        {!canDownload && (
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Lock size={11} /> Unlock to download
          </span>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {materials
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((m) => {
            // The HTML `download` attribute is ignored cross-origin, so a real
            // save needs the separately signed download_url, which the server
            // only issues to paid learners.
            const href = m.download_url ?? m.file_url;
            return (
              <a
                key={m.id}
                href={fullUrl(href)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-brand-primary/40 transition-colors group"
              >
                {iconFor(m.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-navy truncate">{m.title}</p>
                  <p className="text-xs text-gray-400 uppercase">
                    {m.file_type} · {formatBytes(m.file_size_bytes)}
                  </p>
                </div>
                {m.download_url ? (
                  <Download
                    size={16}
                    className="text-gray-300 group-hover:text-brand-primary transition-colors shrink-0"
                  />
                ) : (
                  <Eye
                    size={16}
                    className="text-gray-300 group-hover:text-brand-primary transition-colors shrink-0"
                  />
                )}
              </a>
            );
          })}
      </div>
    </Card>
  );
}
