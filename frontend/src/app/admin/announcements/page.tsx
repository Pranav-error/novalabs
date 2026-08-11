"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Trash2, AlertTriangle, Megaphone, X } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  urgency: string;
  status: string;
  created_at: string;
}

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/announcements");
      setAnnouncements(res.data.announcements);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setCreating(true);
    try {
      await api.post("/admin/announcements", { title, body, urgency });
      setTitle("");
      setBody("");
      setUrgency("normal");
      setShowCreate(false);
      fetchAnnouncements();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    setDeleting(id);
    try {
      await api.delete(`/admin/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  };

  const urgencyVariant = (u: string) => {
    return u === "critical" ? ("warning" as const) : ("info" as const);
  };

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
            <Megaphone size={22} className="text-brand-primary" />
            Announcements
          </h1>
          <p className="text-xs text-gray-400 mt-1">Broadcast a message to every learner&apos;s dashboard.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="w-full sm:w-auto">
          {showCreate ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showCreate ? "Cancel" : "New Announcement"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4">
            Create Announcement
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
              required
            />
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Announcement content..."
                rows={4}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Urgency
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full sm:w-48 px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
              >
                <option value="normal">Normal</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={creating} size="sm" className="w-full sm:w-auto">
                {creating ? "Publishing..." : "Publish Announcement"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setShowCreate(false);
                  setTitle("");
                  setBody("");
                  setUrgency("normal");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Megaphone size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No announcements yet.</p>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {announcements.map((a) => (
            <Card key={a.id} className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-brand-navy break-words">
                      {a.title}
                    </h3>
                    <Badge variant={urgencyVariant(a.urgency)}>
                      {a.urgency === "critical" && (
                        <AlertTriangle className="w-3 h-3 mr-1" />
                      )}
                      {a.urgency}
                    </Badge>
                    {a.status && (
                      <Badge variant="default">{a.status}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                    {a.body}
                  </p>
                  <p className="text-xs text-gray-400 mt-3">
                    {new Date(a.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deleting === a.id}
                  className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                  title="Delete announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
