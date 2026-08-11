"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import PushToggle from "@/components/settings/PushToggle";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  Save,
  CheckCircle2,
  Github,
  Linkedin,
  Zap,
  CalendarDays,
  Flame,
  Globe,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

interface XpEvent {
  amount: number;
  reason: string;
  created_at: string;
}

interface XpData {
  total_xp: number;
  recent_events: XpEvent[];
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    bio: "",
    github_url: "",
    linkedin_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [xpData, setXpData] = useState<XpData | null>(null);

  const [slug, setSlug] = useState("");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [copied, setCopied] = useState(false);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        bio: user.bio || "",
        github_url: user.github_url || "",
        linkedin_url: user.linkedin_url || "",
      });
      setSlug(user.portfolio_slug || "");
      setSavedSlug(user.portfolio_slug || null);
    }
  }, [user]);

  // Fetch XP data
  useEffect(() => {
    api
      .get("/me/xp")
      .then((res) => setXpData(res.data))
      .catch(() => setXpData(null));
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/me", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlug = async () => {
    setSlugSaving(true);
    setSlugError("");
    setSlugSaved(false);
    try {
      const res = await api.patch("/portfolio", { portfolio_slug: slug });
      setSavedSlug(res.data.portfolio_slug);
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosErr.response?.status === 409) {
        setSlugError("This slug is already taken. Try another one.");
      } else if (axiosErr.response?.status === 422) {
        setSlugError("Slug must be 3-50 characters: lowercase letters, numbers, and hyphens only.");
      } else {
        setSlugError("Failed to save. Please try again.");
      }
    } finally {
      setSlugSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!savedSlug) return;
    try {
      await navigator.clipboard.writeText(`http://localhost:3000/p/${savedSlug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const totalXp = xpData?.total_xp ?? user?.total_xp ?? 0;
  const daysCompleted = user?.days_completed ?? 0;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8">
      <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Profile</h1>

      <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 items-start">
        {/* Sidebar: identity, stats, notification settings */}
        <div className="lg:col-span-1 space-y-5 sm:space-y-6">
          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center gap-4 mb-5 sm:mb-6">
              <Avatar
                name={user ? `${user.first_name} ${user.last_name}` : "U"}
                size="lg"
                className="flex-shrink-0"
              />
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-brand-navy truncate">
                  {user?.first_name} {user?.last_name}
                </h2>
                <p className="text-gray-500 text-sm truncate">{user?.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {user?.is_paid ? (
                    <Badge variant="premium">Paid</Badge>
                  ) : (
                    <Badge>Free</Badge>
                  )}
                  {user?.email_verified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <Badge variant="warning">Unverified</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-brand-primary/5 p-3 sm:p-4 text-center">
                <Zap size={18} className="mx-auto text-brand-primary mb-1" />
                <p className="text-lg sm:text-2xl font-bold text-brand-navy">{totalXp}</p>
                <p className="text-[11px] sm:text-xs text-gray-500">Total XP</p>
              </div>
              <div className="rounded-xl bg-brand-primary/5 p-3 sm:p-4 text-center">
                <CalendarDays size={18} className="mx-auto text-brand-primary mb-1" />
                <p className="text-lg sm:text-2xl font-bold text-brand-navy">
                  {daysCompleted}
                  <span className="text-xs sm:text-sm font-normal text-gray-400">/30</span>
                </p>
                <p className="text-[11px] sm:text-xs text-gray-500">Days Done</p>
              </div>
              <div className="rounded-xl bg-brand-primary/5 p-3 sm:p-4 text-center">
                <Flame size={18} className="mx-auto text-brand-primary mb-1" />
                <p className="text-lg sm:text-2xl font-bold text-brand-navy">
                  {daysCompleted > 0 ? daysCompleted : 0}
                </p>
                <p className="text-[11px] sm:text-xs text-gray-500">Day Streak</p>
              </div>
            </div>
          </Card>

          <PushToggle />
        </div>

        {/* Main column: editable details */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">
          {/* Edit form */}
          <Card className="p-5 sm:p-6 lg:p-7">
            <h3 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">
              Edit Profile
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="First name"
                value={form.first_name}
                onChange={(e) => handleChange("first_name", e.target.value)}
              />
              <Input
                label="Last name"
                value={form.last_name}
                onChange={(e) => handleChange("last_name", e.target.value)}
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-brand-navy mb-1.5">
                Bio
              </label>
              <textarea
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy placeholder:text-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary resize-none"
                rows={3}
                value={form.bio}
                placeholder="Tell us about yourself..."
                onChange={(e) => handleChange("bio", e.target.value)}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div className="relative">
                <Input
                  label="GitHub URL"
                  value={form.github_url}
                  placeholder="https://github.com/username"
                  onChange={(e) => handleChange("github_url", e.target.value)}
                  className="pr-10"
                />
                <Github
                  size={16}
                  className="absolute right-3 bottom-3 text-gray-400 pointer-events-none"
                />
              </div>
              <div className="relative">
                <Input
                  label="LinkedIn URL"
                  value={form.linkedin_url}
                  placeholder="https://linkedin.com/in/username"
                  onChange={(e) => handleChange("linkedin_url", e.target.value)}
                  className="pr-10"
                />
                <Linkedin
                  size={16}
                  className="absolute right-3 bottom-3 text-gray-400 pointer-events-none"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? (
                  "Saving..."
                ) : saved ? (
                  <>
                    <CheckCircle2 size={16} className="mr-1.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-1.5" />
                    Save Changes
                  </>
                )}
              </Button>

              {saved && (
                <span className="text-sm text-emerald-600 font-medium">
                  Profile updated successfully!
                </span>
              )}
              {error && (
                <span className="text-sm text-red-500 font-medium">{error}</span>
              )}
            </div>
          </Card>

          {/* Public Portfolio */}
          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                <Globe size={14} className="text-brand-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-brand-navy">
                Public Portfolio
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Choose a unique slug to share your public portfolio page with
              recruiters and friends.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <Input
                  label="Portfolio slug"
                  value={slug}
                  placeholder="your-name"
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugSaved(false);
                    setSlugError("");
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Lowercase letters, numbers, and hyphens only (3-50 characters).
                </p>
              </div>
              <Button
                onClick={handleSaveSlug}
                disabled={slugSaving || !slug}
                className="w-full sm:w-auto sm:mb-6"
              >
                {slugSaving ? (
                  "Saving..."
                ) : slugSaved ? (
                  <>
                    <CheckCircle2 size={16} className="mr-1.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-1.5" />
                    Save
                  </>
                )}
              </Button>
            </div>

            {slugError && (
              <p className="text-sm text-red-500 font-medium mt-2">{slugError}</p>
            )}

            {savedSlug && (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-brand-primary/5 px-4 py-3">
                <span className="text-sm text-brand-navy font-medium break-all min-w-0">
                  http://localhost:3000/p/{savedSlug}
                </span>
                <div className="flex items-center gap-3 sm:ml-auto flex-shrink-0">
                  <a
                    href={`http://localhost:3000/p/${savedSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
                  >
                    <ExternalLink size={14} />
                    View
                  </a>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
                    type="button"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Recent XP Activity */}
          {xpData && xpData.recent_events.length > 0 && (
            <Card className="p-5 sm:p-6 lg:p-7">
              <h3 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">
                Recent XP Activity
              </h3>
              <div className="space-y-2">
                {xpData.recent_events.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-brand-navy truncate">
                        {event.reason}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(event.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-brand-primary flex-shrink-0">
                      +{event.amount} XP
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
