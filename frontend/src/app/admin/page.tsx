"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import {
  Users,
  CreditCard,
  IndianRupee,
  Clock,
  Activity,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface Stats {
  total_users: number;
  paid_users: number;
  free_users: number;
  total_revenue_paise: number;
  total_submissions: number;
  pending_submissions: number;
}

interface SeriesPoint {
  date: string;
  signups: number;
  conversions: number;
  revenue_paise: number;
}

interface Timeseries {
  series: SeriesPoint[];
  funnel: {
    signed_up: number;
    started_day1: number;
    completed_day1: number;
    paid: number;
    completed_all_30: number;
  };
  activity: { active_today: number; active_week: number };
  conversion_rate: number;
}

/** Minimal dependency-free bar chart. */
function BarChart({
  points,
  accessor,
  color,
  format,
}: {
  points: SeriesPoint[];
  accessor: (p: SeriesPoint) => number;
  color: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(...points.map(accessor), 1);
  return (
    <div className="flex items-end gap-[2px] h-24">
      {points.map((p) => {
        const v = accessor(p);
        const h = Math.max((v / max) * 100, v > 0 ? 6 : 2);
        return (
          <div
            key={p.date}
            className="flex-1 rounded-t-sm transition-opacity hover:opacity-70"
            style={{ height: `${h}%`, background: v > 0 ? color : "#E5E7EB" }}
            title={`${p.date}: ${format ? format(v) : v}`}
          />
        );
      })}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ts, setTs] = useState<Timeseries | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([api.get("/admin/stats"), api.get("/admin/stats/timeseries")]).then(
      ([s, t]) => {
        if (s.status === "fulfilled") setStats(s.value.data);
        if (t.status === "fulfilled") setTs(t.value.data);
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(paise / 100);

  const kpis = [
    { label: "Total Users", value: stats?.total_users ?? 0, icon: Users, color: "#2F67C7" },
    { label: "Paid Users", value: stats?.paid_users ?? 0, icon: CreditCard, color: "#059669" },
    {
      label: "Revenue",
      value: inr(stats?.total_revenue_paise ?? 0),
      icon: IndianRupee,
      color: "#7C3AED",
    },
    {
      label: "Conversion",
      value: `${ts?.conversion_rate ?? 0}%`,
      icon: TrendingUp,
      color: "#0891B2",
    },
    {
      label: "Active Today",
      value: ts?.activity.active_today ?? 0,
      icon: Activity,
      color: "#D97706",
    },
    {
      label: "Active (7d)",
      value: ts?.activity.active_week ?? 0,
      icon: Activity,
      color: "#DB2777",
    },
  ];

  const funnel = ts
    ? [
        { label: "Signed up", value: ts.funnel.signed_up },
        { label: "Started Day 1", value: ts.funnel.started_day1 },
        { label: "Completed Day 1", value: ts.funnel.completed_day1 },
        { label: "Paid", value: ts.funnel.paid },
        { label: "All 30 days", value: ts.funnel.completed_all_30 },
      ]
    : [];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display font-bold text-brand-navy text-xl sm:text-2xl">Overview</h1>
        <p className="text-sm text-gray-400 mt-1">Platform health, revenue and learner funnel at a glance.</p>
      </div>

      {/* Alert strip */}
      {(stats?.pending_submissions ?? 0) > 0 && (
        <Link href="/admin/submissions">
          <div className="flex items-start sm:items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-sm text-amber-800 flex-1">
              <span className="font-bold">{stats!.pending_submissions} submissions</span> awaiting
              review
            </p>
            <Clock size={14} className="text-amber-400 flex-shrink-0 hidden sm:block" />
          </div>
        </Link>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="!p-4 sm:!p-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${k.color}15` }}
              >
                <Icon size={15} style={{ color: k.color }} />
              </div>
              <p className="text-xl font-bold text-brand-navy leading-none truncate">{k.value}</p>
              <p className="text-xs text-gray-400 mt-1.5">{k.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      {ts && (
        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4 sm:mb-5">
              <h2 className="font-display text-lg font-bold text-brand-navy">Signups — last 30 days</h2>
              <span className="text-xs text-gray-400">
                {ts.series.reduce((a, p) => a + p.signups, 0)} total
              </span>
            </div>
            <BarChart points={ts.series} accessor={(p) => p.signups} color="#2F67C7" />
          </Card>
          <Card className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4 sm:mb-5">
              <h2 className="font-display text-lg font-bold text-brand-navy">Revenue — last 30 days</h2>
              <span className="text-xs text-gray-400">
                {inr(ts.series.reduce((a, p) => a + p.revenue_paise, 0))}
              </span>
            </div>
            <BarChart
              points={ts.series}
              accessor={(p) => p.revenue_paise}
              color="#059669"
              format={(v) => inr(v)}
            />
          </Card>
        </div>
      )}

      {/* Funnel */}
      {ts && (
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Learner funnel</h2>
          <div className="space-y-2.5">
            {funnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="w-20 sm:w-32 text-xs text-gray-500 shrink-0 truncate">{f.label}</span>
                <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md flex items-center px-2 transition-all"
                    style={{
                      width: `${Math.max((f.value / funnelMax) * 100, 4)}%`,
                      background: `hsl(${215 - i * 18}, 65%, ${50 + i * 4}%)`,
                    }}
                  >
                    <span className="text-[10px] font-bold text-white">{f.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
