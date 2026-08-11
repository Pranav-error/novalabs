"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpCircle, Send, MessageCircle, ChevronDown } from "lucide-react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface DoubtPost {
  id: string;
  author_name: string;
  author_initials: string;
  content: string;
  replies_count: number;
  created_at: string;
}

interface DoubtReply {
  id: string;
  author_name: string;
  author_initials: string;
  content: string;
  created_at: string;
}

export default function DoubtsThread({ dayNumber }: { dayNumber: number }) {
  const [posts, setPosts] = useState<DoubtPost[]>([]);
  const [newDoubt, setNewDoubt] = useState("");
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, DoubtReply[]>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/feed?category=doubt&day=${dayNumber}`);
      setPosts(res.data.posts || []);
    } catch {
      /* silent */
    }
  }, [dayNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const postDoubt = async () => {
    if (!newDoubt.trim()) return;
    setPosting(true);
    try {
      await api.post("/feed", { content: newDoubt.trim(), category: "doubt", day_number: dayNumber });
      setNewDoubt("");
      await load();
    } finally {
      setPosting(false);
    }
  };

  const toggleReplies = async (postId: string) => {
    if (expanded === postId) {
      setExpanded(null);
      return;
    }
    setExpanded(postId);
    if (!replies[postId]) {
      try {
        const res = await api.get(`/feed/${postId}`);
        setReplies((r) => ({ ...r, [postId]: res.data.post.replies || [] }));
      } catch {
        /* silent */
      }
    }
  };

  const sendReply = async (postId: string) => {
    const text = (replyText[postId] || "").trim();
    if (!text) return;
    try {
      await api.post(`/feed/${postId}/replies`, { content: text });
      setReplyText((r) => ({ ...r, [postId]: "" }));
      const res = await api.get(`/feed/${postId}`);
      setReplies((r) => ({ ...r, [postId]: res.data.post.replies || [] }));
      await load();
    } catch {
      /* silent */
    }
  };

  return (
    <Card className="mt-8">
      <h2 className="text-lg font-bold text-brand-navy mb-1 flex items-center gap-2">
        <HelpCircle size={18} className="text-brand-primary" /> Doubts — Day {dayNumber}
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Stuck on something in this lesson? Ask here — other learners and mentors can help.
      </p>

      <div className="flex gap-2 mb-5">
        <input
          value={newDoubt}
          onChange={(e) => setNewDoubt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && postDoubt()}
          placeholder="Ask a question about this day…"
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
        />
        <Button size="sm" onClick={postDoubt} disabled={posting || !newDoubt.trim()}>
          <Send size={14} />
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No doubts yet — be the first to ask.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {p.author_initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-brand-navy">{p.author_name}</p>
                  <p className="text-sm text-gray-700 mt-0.5">{p.content}</p>
                  <button
                    onClick={() => toggleReplies(p.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand-primary font-semibold"
                  >
                    <MessageCircle size={12} />
                    {p.replies_count} {p.replies_count === 1 ? "reply" : "replies"}
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${expanded === p.id ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {expanded === p.id && (
                <div className="mt-3 pl-11 space-y-2">
                  {(replies[p.id] || []).map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-brand-navy">{r.author_name}</p>
                      <p className="text-xs text-gray-600">{r.content}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={replyText[p.id] || ""}
                      onChange={(e) => setReplyText((r) => ({ ...r, [p.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && sendReply(p.id)}
                      placeholder="Write a reply…"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-primary/50"
                    />
                    <Button size="sm" variant="outline" onClick={() => sendReply(p.id)}>
                      <Send size={12} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
