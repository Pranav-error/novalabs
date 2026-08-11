"use client";

import { useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";
import { Bell, Send, Info } from "lucide-react";

type Audience = "all" | "paid" | "unpaid" | "user";

const AUDIENCES: { value: Audience; label: string; hint: string }[] = [
  { value: "all", label: "Everyone", hint: "All active learners" },
  { value: "paid", label: "Paid learners", hint: "Anyone who has unlocked the course" },
  { value: "unpaid", label: "Unpaid learners", hint: "Signed up but not yet paid" },
  { value: "user", label: "One learner", hint: "By user ID" },
];

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [userId, setUserId] = useState("");
  const [alsoAnnounce, setAlsoAnnounce] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const send = async () => {
    if (!title.trim()) {
      toast.error("A title is required");
      return;
    }
    if (audience === "user" && !userId.trim()) {
      toast.error("A user ID is required for a single learner");
      return;
    }
    const who = AUDIENCES.find((a) => a.value === audience)?.label ?? audience;
    if (!confirm(`Send "${title}" to ${who}? Learners see it immediately in their bell.`)) {
      return;
    }

    setSending(true);
    try {
      const res = await api.post("/admin/notifications", {
        title,
        body: body || null,
        audience,
        user_id: audience === "user" ? userId : null,
        also_announce: alsoAnnounce,
      });
      toast.success(res.data.message);
      setLastResult(res.data.message);
      setTitle("");
      setBody("");
      setUserId("");
      setAlsoAnnounce(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Bell size={22} className="text-brand-primary" /> Send notification
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Push a message straight to a learner&apos;s notification bell.
        </p>
      </div>

      <Card className="p-5 sm:p-6 lg:p-7">
        <div className="space-y-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New module published: Advanced TypeScript"
          />

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">
              Message (optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Details learners will see under the title"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 text-sm resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-navy mb-1.5">
              Audience
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  onClick={() => setAudience(a.value)}
                  className={`text-left px-3.5 py-3 rounded-xl border transition-colors ${
                    audience === a.value
                      ? "border-brand-primary bg-brand-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-brand-navy">{a.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {audience === "user" && (
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID (copy it from the Users page)"
              className="font-mono"
            />
          )}

          <label className="flex items-start gap-2.5 text-sm text-gray-600 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <input
              type="checkbox"
              checked={alsoAnnounce}
              onChange={(e) => setAlsoAnnounce(e.target.checked)}
              className="mt-0.5 flex-shrink-0"
            />
            <span>
              Also post as a dashboard announcement
              <span className="block text-xs text-gray-400 mt-0.5">
                Announcements alone don&apos;t reach the notification bell — tick this to
                do both at once.
              </span>
            </span>
          </label>

          <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 flex gap-2.5">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              This is an <strong>in-app</strong> notification: it appears in the bell next
              time the learner loads the site (polled every 60s). It does not send an email
              or a phone push notification.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Button onClick={send} disabled={sending} className="w-full sm:w-auto">
              <Send size={14} className="mr-1.5" />
              {sending ? "Sending…" : "Send notification"}
            </Button>
            {lastResult && <span className="text-xs text-green-600">{lastResult}</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}
