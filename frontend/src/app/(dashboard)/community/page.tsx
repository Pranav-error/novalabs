"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Heart,
  Send,
  ChevronDown,
  Loader2,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Post {
  id: string;
  content: string;
  category: string;
  author_name: string;
  author_initials: string;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  created_at: string;
}

interface Reply {
  id: string;
  content: string;
  author_name: string;
  author_initials: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CATEGORIES = ["general", "progress", "project", "doubt"] as const;
type Category = (typeof CATEGORIES)[number];

const FILTER_OPTIONS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Progress", value: "progress" },
  { label: "Projects", value: "project" },
  { label: "Doubts", value: "doubt" },
];

const CATEGORY_STYLE: Record<string, { variant: "default" | "success" | "warning" | "info" | "premium"; label: string }> = {
  general: { variant: "default", label: "General" },
  progress: { variant: "success", label: "Progress" },
  project: { variant: "info", label: "Project" },
  doubt: { variant: "warning", label: "Doubt" },
};

const PAGE_SIZE = 20;
const MAX_CHARS = 2000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CommunityPage() {
  const { user } = useAuth();

  // Feed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New post state
  const [showNewPost, setShowNewPost] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("general");
  const [submitting, setSubmitting] = useState(false);

  // Expanded post state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  /* ---- Fetch posts ---- */

  const fetchPosts = useCallback(
    async (offsetVal: number, append: boolean) => {
      try {
        if (!append) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        const params: Record<string, string | number> = {
          limit: PAGE_SIZE,
          offset: offsetVal,
        };
        if (activeFilter) params.category = activeFilter;

        const res = await api.get("/feed", { params });
        const data = res.data;

        setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
        setTotal(data.total);
        setHasMore(data.has_more);
        setOffset(offsetVal + data.posts.length);
      } catch {
        setError("Failed to load posts. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFilter]
  );

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    fetchPosts(0, false);
  }, [fetchPosts]);

  /* ---- Create post ---- */

  const handleCreatePost = async () => {
    if (!newContent.trim() || submitting) return;
    try {
      setSubmitting(true);
      await api.post("/feed", { content: newContent.trim(), category: newCategory });
      setNewContent("");
      setNewCategory("general");
      setShowNewPost(false);
      // Refresh feed from the top
      setPosts([]);
      setOffset(0);
      await fetchPosts(0, false);
    } catch {
      setError("Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Like / Unlike ---- */

  const handleLike = async (postId: string) => {
    try {
      const res = await api.post(`/feed/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, is_liked: res.data.liked, likes_count: res.data.likes_count }
            : p
        )
      );
    } catch {
      // Silently ignore
    }
  };

  /* ---- Expand / Replies ---- */

  const toggleExpand = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setReplyContent("");
      return;
    }
    setExpandedPostId(postId);
    setReplyContent("");
    if (!replies[postId]) {
      try {
        setLoadingReplies(postId);
        const res = await api.get(`/feed/${postId}`);
        setReplies((prev) => ({ ...prev, [postId]: res.data.post.replies ?? [] }));
      } catch {
        // Silently ignore
      } finally {
        setLoadingReplies(null);
      }
    }
  };

  const handleReply = async (postId: string) => {
    if (!replyContent.trim() || submittingReply) return;
    try {
      setSubmittingReply(true);
      await api.post(`/feed/${postId}/replies`, { content: replyContent.trim() });
      setReplyContent("");
      // Re-fetch replies
      const res = await api.get(`/feed/${postId}`);
      setReplies((prev) => ({ ...prev, [postId]: res.data.post.replies ?? [] }));
      // Update reply count in list
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, replies_count: p.replies_count + 1 } : p
        )
      );
    } catch {
      setError("Failed to send reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  /* ---- Delete ---- */

  const handleDelete = async (postId: string) => {
    try {
      await api.delete(`/feed/${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch {
      setError("Failed to delete post.");
    }
  };

  /* ---- Render helpers ---- */

  const categoryBadge = (cat: string) => {
    const style = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE.general;
    return <Badge variant={style.variant}>{style.label}</Badge>;
  };

  /* ================================================================ */
  /*  JSX                                                              */
  /* ================================================================ */

  return (
    <div className="py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Community</h1>
          {total > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {total} {total === 1 ? "post" : "posts"}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewPost((v) => !v)}
          className="gap-1.5 flex-shrink-0"
        >
          {showNewPost ? <X size={16} /> : <Plus size={16} />}
          {showNewPost ? "Cancel" : "New Post"}
        </Button>
      </div>

      {/* ---- New Post Form ---- */}
      {showNewPost && (
        <Card className="mb-5 sm:mb-6 p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              name={
                user ? `${user.first_name} ${user.last_name}` : "User"
              }
              size="sm"
            />
            <span className="text-sm font-semibold text-brand-navy">
              {user ? `${user.first_name} ${user.last_name}` : "You"}
            </span>
          </div>

          <textarea
            value={newContent}
            onChange={(e) => {
              if (e.target.value.length <= MAX_CHARS) setNewContent(e.target.value);
            }}
            placeholder="Share your progress, ask a doubt, or show off a project..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary resize-none text-sm"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
            {/* Category pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNewCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    newCategory === cat
                      ? "bg-brand-primary text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <span
                className={`text-xs flex-shrink-0 ${
                  newContent.length > MAX_CHARS * 0.9
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                {newContent.length}/{MAX_CHARS}
              </span>
              <Button
                size="sm"
                onClick={handleCreatePost}
                disabled={!newContent.trim() || submitting}
                className="gap-1.5 flex-shrink-0"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Post
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ---- Category Filters ---- */}
      <div className="flex items-center gap-2 mb-5 sm:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeFilter === opt.value
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto flex-shrink-0 text-red-400 hover:text-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ---- Loading ---- */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-brand-primary mb-3" />
          <p className="text-sm text-gray-500">Loading posts...</p>
        </div>
      )}

      {/* ---- Empty State ---- */}
      {!loading && !error && posts.length === 0 && (
        <Card className="max-w-sm mx-auto text-center py-10 px-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare size={24} className="text-gray-300" />
          </div>
          <h3 className="font-display text-lg font-bold text-brand-navy mb-2">
            No posts yet
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Be the first to share your progress!
          </p>
          <Button size="sm" onClick={() => setShowNewPost(true)} className="w-full sm:w-auto">
            Create Post
          </Button>
        </Card>
      )}

      {/* ---- Post List ---- */}
      {!loading && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => {
            const isExpanded = expandedPostId === post.id;
            const postReplies = replies[post.id] ?? [];
            const isOwner =
              user &&
              post.author_name ===
                `${user.first_name} ${user.last_name}`;

            return (
              <Card key={post.id} className="p-5 sm:p-6">
                {/* Post header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={post.author_name} size="sm" className="flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-navy truncate">
                        {post.author_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {relativeTime(post.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {categoryBadge(post.category)}
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Delete post"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post content */}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words mb-4">
                  {post.content}
                </p>

                {/* Action bar */}
                <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                      post.is_liked
                        ? "text-red-500"
                        : "text-gray-400 hover:text-red-500"
                    }`}
                  >
                    <Heart
                      size={16}
                      className={post.is_liked ? "fill-current" : ""}
                    />
                    {post.likes_count > 0 && (
                      <span>{post.likes_count}</span>
                    )}
                  </button>

                  <button
                    onClick={() => toggleExpand(post.id)}
                    className={`flex items-center gap-1.5 text-sm transition-colors ${
                      isExpanded
                        ? "text-brand-primary"
                        : "text-gray-400 hover:text-brand-primary"
                    }`}
                  >
                    <MessageSquare size={16} />
                    {post.replies_count > 0 && (
                      <span>{post.replies_count}</span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Expanded replies section */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {/* Loading replies */}
                    {loadingReplies === post.id && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2
                          size={18}
                          className="animate-spin text-gray-400"
                        />
                      </div>
                    )}

                    {/* Reply list */}
                    {loadingReplies !== post.id && postReplies.length > 0 && (
                      <div className="space-y-3 mb-4">
                        {postReplies.map((reply) => (
                          <div
                            key={reply.id}
                            className="flex gap-3 bg-gray-50 rounded-xl p-3"
                          >
                            <Avatar name={reply.author_name} size="sm" className="flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-brand-navy truncate">
                                  {reply.author_name}
                                </span>
                                <span className="text-xs text-gray-400 flex-shrink-0">
                                  {relativeTime(reply.created_at)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                                {reply.content}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No replies yet */}
                    {loadingReplies !== post.id &&
                      postReplies.length === 0 && (
                        <p className="text-xs text-gray-400 mb-3">
                          No replies yet. Be the first to respond!
                        </p>
                      )}

                    {/* Reply input */}
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={
                          user
                            ? `${user.first_name} ${user.last_name}`
                            : "User"
                        }
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleReply(post.id);
                            }
                          }}
                          placeholder="Write a reply..."
                          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-brand-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
                        />
                        <button
                          onClick={() => handleReply(post.id)}
                          disabled={!replyContent.trim() || submittingReply}
                          className="p-2 rounded-xl bg-brand-primary text-white disabled:opacity-50 hover:bg-brand-deep-blue transition-colors flex-shrink-0"
                        >
                          {submittingReply ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPosts(offset, true)}
                disabled={loadingMore}
                className="gap-1.5"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ChevronDown size={14} />
                )}
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
