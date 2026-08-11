"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import { Trophy, Medal, Crown, Star, Flame } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "weekly" | "alltime";

interface LeaderboardEntry {
  rank: number;
  name: string;
  initials?: string;
  xp: number;
}

const MEDAL_COLORS: Record<number, { bg: string; border: string; icon: React.ReactNode }> = {
  1: {
    bg: "bg-gradient-to-r from-yellow-50 to-amber-50",
    border: "border-yellow-300",
    icon: <Crown size={20} className="text-yellow-500" />,
  },
  2: {
    bg: "bg-gradient-to-r from-gray-50 to-slate-100",
    border: "border-gray-300",
    icon: <Medal size={20} className="text-gray-400" />,
  },
  3: {
    bg: "bg-gradient-to-r from-orange-50 to-amber-50",
    border: "border-amber-400",
    icon: <Medal size={20} className="text-amber-600" />,
  },
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const currentUserName = user
    ? `${user.first_name} ${user.last_name}`
    : null;

  const fetchLeaderboard = useCallback(async (tab: Tab) => {
    setIsLoading(true);
    try {
      const endpoint = tab === "weekly" ? "/leaderboard/weekly" : "/leaderboard/alltime";
      const res = await api.get(endpoint);
      setEntries(res.data.leaderboard ?? []);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab, fetchLeaderboard]);

  const handleTabChange = (tab: Tab) => {
    if (tab !== activeTab) setActiveTab(tab);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "weekly", label: "Weekly" },
    { key: "alltime", label: "All-Time" },
  ];

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <Trophy size={18} className="text-brand-primary" />
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Leaderboard</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-brand-primary shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand-cyan/30 border-t-brand-cyan rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-500">Loading leaderboard...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <Card className="max-w-sm mx-auto text-center py-10 px-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Trophy size={24} className="text-gray-300" />
          </div>
          <h3 className="font-display text-lg font-bold text-brand-navy mb-2">
            Leaderboard is empty
          </h3>
          <p className="text-gray-400 text-sm">
            Complete quizzes and assignments to earn XP and climb the ranks!
          </p>
        </Card>
      )}

      {/* Leaderboard list */}
      {!isLoading && entries.length > 0 && (
        <div className="space-y-3">
          {/* Top 3 podium cards */}
          {entries.filter((e) => e.rank <= 3).length > 0 && (
            <div className="space-y-3 mb-2">
              {entries
                .filter((e) => e.rank <= 3)
                .map((entry) => {
                  const medal = MEDAL_COLORS[entry.rank];
                  const isCurrentUser = currentUserName === entry.name;

                  return (
                    <Card
                      key={entry.rank}
                      className={`relative overflow-hidden border-2 p-4 sm:p-5 ${medal.border} ${medal.bg} ${
                        isCurrentUser ? "ring-2 ring-brand-primary ring-offset-2" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Rank + Medal */}
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-[44px] sm:min-w-[60px] flex-shrink-0">
                          <span className="text-xl sm:text-2xl font-extrabold text-brand-navy">
                            #{entry.rank}
                          </span>
                          {medal.icon}
                        </div>

                        {/* Avatar */}
                        <Avatar
                          name={entry.name}
                          size="md"
                          className={`flex-shrink-0 sm:w-14 sm:h-14 sm:text-lg ${
                            entry.rank === 1
                              ? "from-yellow-400 to-amber-500"
                              : entry.rank === 2
                              ? "from-gray-300 to-slate-400"
                              : "from-amber-500 to-orange-600"
                          }`}
                        />

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-brand-navy text-base sm:text-lg truncate">
                            {entry.name}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-brand-primary font-medium">
                              That&apos;s you!
                            </span>
                          )}
                        </div>

                        {/* XP */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          {entry.rank === 1 && (
                            <Flame size={16} className="text-yellow-500 hidden sm:block" />
                          )}
                          <Badge variant="premium" className="text-xs sm:text-sm px-2.5 sm:px-4 py-1 sm:py-1.5 whitespace-nowrap">
                            {entry.xp.toLocaleString()} XP
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}

          {/* Remaining entries */}
          {entries
            .filter((e) => e.rank > 3)
            .map((entry) => {
              const isCurrentUser = currentUserName === entry.name;

              return (
                <Card
                  key={entry.rank}
                  className={`p-4 sm:p-5 transition-colors ${
                    isCurrentUser
                      ? "border-2 border-brand-primary bg-blue-50/50 ring-1 ring-brand-primary/20"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Rank */}
                    <div className="min-w-[32px] sm:min-w-[40px] text-center flex-shrink-0">
                      <span className="text-base sm:text-lg font-bold text-gray-400">
                        #{entry.rank}
                      </span>
                    </div>

                    {/* Avatar */}
                    <Avatar name={entry.name} size="sm" className="flex-shrink-0 sm:w-10 sm:h-10 sm:text-sm" />

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-brand-navy truncate">
                        {entry.name}
                      </p>
                      {isCurrentUser && (
                        <span className="text-xs text-brand-primary font-medium">
                          That&apos;s you!
                        </span>
                      )}
                    </div>

                    {/* XP */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <Star size={14} className="text-brand-cyan hidden sm:block" />
                      <Badge variant="info" className="whitespace-nowrap">
                        {entry.xp.toLocaleString()} XP
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}
