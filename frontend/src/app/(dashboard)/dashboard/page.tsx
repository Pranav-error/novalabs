"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import CountUp from "@/components/ui/CountUp";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Flame, ArrowRight, Trophy, Star, Shield, Calendar, Zap, Gift, Copy, Check, Megaphone, Activity } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { PHASES } from "@/lib/constants";

interface StreakData {
  current_streak: number;
  longest_streak: number;
  shield_available: boolean;
}

interface DayProgress {
  day_number: number;
  status: string;
  quiz_score: number | null;
}

interface XPEventItem {
  amount: number;
  reason: string;
  created_at: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string | null;
  urgency: string;
  created_at: string;
}

/** Live referral economics — admin-configurable, so never hardcode the amounts. */
interface ReferralTerms {
  discount_paise: number;
  credit_paise: number;
}

const rupees = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;

const XP_REASON_LABELS: Record<string, string> = {
  quiz_complete: "Completed a quiz",
  quiz_bonus: "Quiz high-score bonus",
  assignment_submit: "Submitted an assignment",
  project_merit: "Project merit bonus",
  community_post: "Posted in the community",
  doubt_reply: "Replied to a doubt",
  official_answer: "Reply marked Official Answer",
  referral_convert: "Referral converted",
  daily_login: "Daily login",
  streak_7: "7-day streak milestone",
  streak_14: "14-day streak milestone",
  streak_30: "30-day streak milestone",
  mock_interview_completed: "Completed a mock interview",
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Parse a phase's day range.
 *
 *  PHASES stores ranges with a plain hyphen ("1-5"), but this used to split on
 *  an en dash ("–"), which never matched: start/end came back NaN, phaseDays
 *  was empty, ProgressBar got max=0 and rendered `width: NaN%` — invalid CSS,
 *  so every phase bar fell back to full width and looked 100% complete. The
 *  character class accepts both so the data can use either.
 */
function parseDayRange(days: string): [number, number] {
  const [start, end] = days.split(/[–-]/).map(Number);
  return [start, end];
}

function getPhaseForDay(day: number): typeof PHASES[number] | undefined {
  return PHASES.find((p) => {
    const [start, end] = parseDayRange(p.days);
    return day >= start && day <= end;
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData>({ current_streak: 0, longest_streak: 0, shield_available: false });
  const [progress, setProgress] = useState<DayProgress[]>([]);
  const [weeklyRank, setWeeklyRank] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<XPEventItem[]>([]);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [cashback, setCashback] = useState(0);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [terms, setTerms] = useState<ReferralTerms | null>(null);
  const [copied, setCopied] = useState(false);

  const currentDay = Math.min((user?.days_completed || 0) + 1, 30);

  useEffect(() => {
    const fetchData = async () => {
      const [streakRes, progressRes, leaderboardRes, xpRes, refRes, annRes, termsRes] =
        await Promise.allSettled([
          api.get("/streaks/me"),
          api.get("/me/progress"),
          api.get("/leaderboard/weekly"),
          api.get("/me/xp"),
          api.get("/me/referral"),
          api.get("/announcements"),
          api.get("/referrals/terms"),
        ]);

      if (streakRes.status === "fulfilled") setStreak(streakRes.value.data);
      if (progressRes.status === "fulfilled") setProgress(progressRes.value.data);
      if (leaderboardRes.status === "fulfilled") {
        const lb = leaderboardRes.value.data;
        if (lb.my_rank) setWeeklyRank(lb.my_rank);
      }
      if (xpRes.status === "fulfilled") setRecentActivity(xpRes.value.data.recent_events?.slice(0, 5) || []);
      if (refRes.status === "fulfilled") {
        setReferralCode(refRes.value.data.code);
        setCashback(refRes.value.data.cashback_balance || 0);
      }
      if (annRes.status === "fulfilled") setAnnouncements(annRes.value.data.announcements?.slice(0, 3) || []);
      if (termsRes.status === "fulfilled") setTerms(termsRes.value.data);
    };
    fetchData();
  }, []);

  const copyReferral = () => {
    if (!referralCode) return;
    const offer = terms ? `${rupees(terms.discount_paise)} off` : "a discount";
    const message = `Hey! I'm doing the 30-Day Full-Stack Challenge and it's been amazing. Use my code ${referralCode.toUpperCase()} at checkout to get ${offer}. Try Day 1 free: ${window.location.origin}/r/${referralCode}`;
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Referral message copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const completedDays = new Set(progress.filter((p) => p.status === "completed").map((p) => p.day_number));
  const inProgressDays = new Set(progress.filter((p) => p.status === "in_progress").map((p) => p.day_number));

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6 lg:space-y-8">
      {/* Zone 1: Welcome & Continue Strip */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-brand-primary via-brand-primary to-brand-deep-blue text-white border-0 p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-brand-cyan/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-brand-purple/20 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mb-1.5">
              {getGreeting()}, {user?.first_name || "Learner"}!
            </h1>
            <p className="text-white/70 text-sm sm:text-base">
              You&apos;re on Day {currentDay} of 30
            </p>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mt-4">
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                <Flame size={16} className="text-brand-cyan" />
                <span className="text-sm font-semibold">
                  {streak.current_streak} day streak
                </span>
              </div>
              {streak.shield_available && (
                <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                  <Shield size={16} className="text-amber-400" />
                  <span className="text-xs text-white/70">Shield active</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                <Star size={16} className="text-brand-cyan" />
                <span className="text-sm font-semibold"><CountUp value={user?.total_xp || 0} /> XP</span>
              </div>
            </div>
          </div>
          <Link href={`/days/${currentDay}`} className="w-full lg:w-auto">
            <Button className="w-full lg:w-auto bg-white text-brand-primary hover:bg-white/90 shadow-none group">
              Continue where you left off
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </Card>

      {streak.current_streak === 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 sm:px-5">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
            <Flame size={18} className="text-amber-500" />
          </div>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Keep your streak alive!</span> Complete a lesson, quiz, or assignment today.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
        {/* Zone 2: Contribution Calendar */}
        <Card className="lg:col-span-2 p-5 sm:p-6 lg:p-7">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="font-display text-lg font-bold text-brand-navy">Your 30-Day Journey</h2>
            <span className="text-sm text-gray-400">{completedDays.size}/30 completed</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-6 xl:grid-cols-10 gap-2 sm:gap-2.5">
            {Array.from({ length: 30 }, (_, i) => {
              const dayNum = i + 1;
              const isCompleted = completedDays.has(dayNum) || dayNum <= (user?.days_completed || 0);
              const isInProgress = inProgressDays.has(dayNum);
              const isCurrent = dayNum === currentDay;
              const phase = getPhaseForDay(dayNum);

              return (
                <Link key={dayNum} href={`/days/${dayNum}`}>
                  <div
                    className={`aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer hover:scale-110 hover:shadow-md ${
                      isCompleted
                        ? "text-white shadow-sm"
                        : isInProgress
                        ? "ring-2 ring-offset-1 text-brand-navy bg-white"
                        : isCurrent
                        ? "ring-2 ring-brand-cyan bg-brand-cyan/10 text-brand-primary"
                        : "bg-gray-100 text-gray-400"
                    } ${dayNum === 1 ? "ring-2 ring-amber-400 shadow-amber-200/50 shadow-md" : ""}`}
                    style={
                      isCompleted
                        ? { background: phase?.color || "#2F67C7" }
                        : isInProgress
                        ? { borderColor: phase?.color || "#2F67C7" }
                        : undefined
                    }
                    title={`Day ${dayNum}${isCompleted ? " ✓" : isInProgress ? " (in progress)" : ""}`}
                  >
                    {dayNum}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-5">
            <ProgressBar value={user?.days_completed || 0} max={30} showLabel />
          </div>
        </Card>

        {/* Zone 3: XP & Gamification Strip */}
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Your Stats</h2>
          <div className="space-y-3">
            <div className="text-center p-5 bg-gradient-to-br from-brand-primary/5 via-brand-cyan/5 to-brand-teal/5 rounded-2xl">
              <div className="text-4xl font-bold text-brand-primary">{user?.total_xp || 0}</div>
              <div className="text-sm text-gray-500 mt-0.5">Total XP</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                  <Trophy size={14} className="text-brand-primary" />
                </div>
                <span className="text-sm text-gray-600">Weekly Rank</span>
              </div>
              <Badge variant="info">
                {weeklyRank ? `#${weeklyRank}` : "—"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Flame size={14} className="text-orange-500" />
                </div>
                <span className="text-sm text-gray-600">Best Streak</span>
              </div>
              <span className="text-sm font-bold text-brand-navy">
                {streak.longest_streak} days
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-cyan/10 flex items-center justify-center flex-shrink-0">
                  <Calendar size={14} className="text-brand-cyan" />
                </div>
                <span className="text-sm text-gray-600">Days Done</span>
              </div>
              <span className="text-sm font-bold text-brand-navy">
                {user?.days_completed || 0}/30
              </span>
            </div>
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm" className="w-full mt-1">
                View Leaderboard <ArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* items-start so a short activity list doesn't stretch into dead space */}
      <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 items-start">
        {/* Zone 4: Recent Activity */}
        <Card className="lg:col-span-2 p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5 flex items-center gap-2">
            <Activity size={18} className="text-brand-primary" /> Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Activity size={18} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">
                No activity yet — complete a quiz or post in the community to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-brand-cyan/10 flex items-center justify-center flex-shrink-0">
                      <Zap size={14} className="text-brand-cyan" />
                    </div>
                    <span className="text-sm text-gray-700">{XP_REASON_LABELS[e.reason] || e.reason}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-brand-primary">+{e.amount} XP</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Referral card */}
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5 flex items-center gap-2">
            <Gift size={18} className="text-brand-primary" /> Refer & Earn
          </h2>
          {referralCode ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                {terms
                  ? `Share your code — your friend gets ${rupees(terms.discount_paise)} off, you get ${rupees(terms.credit_paise)} credit.`
                  : "Share your code — your friend gets a discount, you earn credit."}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2.5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl text-sm font-bold text-brand-primary text-center tracking-wide">
                  {referralCode.toUpperCase()}
                </code>
                <Button size="sm" variant="outline" onClick={copyReferral} className="flex-shrink-0">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
              {cashback > 0 && (
                <p className="text-xs text-green-600 font-semibold">
                  ₹{(cashback / 100).toFixed(0)} credit earned
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Unlock all 30 days to get your personal referral code and start earning
              {terms ? ` ${rupees(terms.credit_paise)} ` : " credit "}
              per friend.
            </p>
          )}
        </Card>
      </div>

      {/* Zone 5: Announcements */}
      {announcements.length > 0 && (
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5 flex items-center gap-2">
            <Megaphone size={18} className="text-brand-primary" /> Announcements
          </h2>
          {/* Divided rows rather than stacked cards — announcements repeat often
              and boxed rows turned the panel into a wall of near-identical blocks. */}
          <div className="divide-y divide-gray-100 -my-2">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2.5">
                <span
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    a.urgency === "critical" ? "bg-red-500" : "bg-brand-cyan"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-0.5 sm:gap-3">
                    <p className="text-sm font-semibold text-brand-navy truncate">{a.title}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {a.body && <p className="text-xs text-gray-500 mt-0.5">{a.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Curriculum Phases */}
      <Card className="p-5 sm:p-6 lg:p-7">
        <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Curriculum Phases</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {PHASES.map((phase) => {
            const [start, end] = parseDayRange(phase.days);
            const phaseDays = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            const phaseCompleted = phaseDays.filter((d) => completedDays.has(d) || d <= (user?.days_completed || 0)).length;

            return (
              <Link key={phase.id} href={`/days/${start}`}>
                <div className="h-full p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-2.5"
                    style={{ background: phase.color }}
                  >
                    {phase.id}
                  </div>
                  <p className="text-xs font-semibold text-brand-navy">{phase.name}</p>
                  <p className="text-xs text-gray-400 mb-2.5">Days {phase.days}</p>
                  <ProgressBar value={phaseCompleted} max={phaseDays.length} size="sm" />
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
