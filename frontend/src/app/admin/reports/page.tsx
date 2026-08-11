"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import toast from "react-hot-toast";
import { Flag, CheckCircle2, XCircle, Eye, Trash2 } from "lucide-react";

interface Report {
  id: string;
  reporter_id: string;
  target_id: string;
  target_type: string;
  reason: string;
  status: string;
  created_at: string;
}

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  off_topic: "Off-topic",
  inappropriate: "Inappropriate content",
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [previews, setPreviews] = useState<Record<string, { content: string | null; author?: string; deleted?: boolean }>>({});

  const showContent = async (reportId: string) => {
    if (previews[reportId]) {
      setPreviews((p) => {
        const next = { ...p };
        delete next[reportId];
        return next;
      });
      return;
    }
    const res = await api.get(`/admin/reports/${reportId}/content`);
    setPreviews((p) => ({ ...p, [reportId]: res.data }));
  };

  const deletePost = async (report: Report) => {
    if (!confirm("Remove this post for all users?")) return;
    try {
      await api.delete(`/admin/feed/${report.target_id}`);
      await api.patch(`/admin/reports/${report.id}`, { action: "resolved", resolution_note: "content removed" });
      toast.success("Content removed & report resolved");
      load(filter);
    } catch {
      toast.error("Failed to remove");
    }
  };

  const load = async (status: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/reports?status_filter=${status}`);
      setReports(res.data.reports);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const resolve = async (id: string, action: "resolved" | "dismissed") => {
    try {
      await api.patch(`/admin/reports/${id}`, { action });
      toast.success(action === "resolved" ? "Report resolved" : "Report dismissed");
      load(filter);
    } catch {
      toast.error("Failed to update report");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Flag size={22} className="text-brand-primary" /> Moderation Queue
        </h1>
        <p className="text-xs text-gray-400 mt-1">Reports from the community feed, doubts and comments.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["pending", "resolved", "dismissed"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
              filter === s ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Flag size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No {filter} reports.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="danger">{REASON_LABELS[r.reason] || r.reason}</Badge>
                  <span className="text-xs text-gray-400 capitalize">{r.target_type}</span>
                  <span className="text-xs text-gray-300">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono truncate">target: {r.target_id}</p>
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => showContent(r.id)}>
                    <Eye size={14} className="mr-1" /> {previews[r.id] ? "Hide" : "View"}
                  </Button>
                  {r.target_type === "post" && (
                    <Button size="sm" variant="outline" onClick={() => deletePost(r)}>
                      <Trash2 size={14} className="mr-1 text-red-500" /> Remove
                    </Button>
                  )}
                  <Button size="sm" onClick={() => resolve(r.id, "resolved")}>
                    <CheckCircle2 size={14} className="mr-1" /> Resolve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>
                    <XCircle size={14} className="mr-1" /> Dismiss
                  </Button>
                </div>
              )}
              {previews[r.id] && (
                <div className="w-full sm:basis-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mt-1">
                  {previews[r.id].content === null ? (
                    <p className="text-xs text-gray-400 italic">Content already deleted.</p>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 break-words">&ldquo;{previews[r.id].content}&rdquo;</p>
                      <p className="text-[10px] text-gray-400 mt-1">— {previews[r.id].author}</p>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
