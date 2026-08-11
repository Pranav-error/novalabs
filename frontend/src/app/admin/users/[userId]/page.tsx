"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Zap, Award, Gift } from "lucide-react";

interface Detail {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_paid: boolean;
    is_suspended: boolean;
    suspension_reason: string | null;
    platform_credit_balance: number;
    referred_by_code: string | null;
    created_at: string;
  };
  stats: { total_xp: number; days_completed: number; badges: number };
  progress: { day_number: number; status: string; best_quiz_score: number | null }[];
  submissions: { id: string; day_number: number; status: string; score: number | null; submitted_at: string }[];
  payments: { id: string; amount_paise: number; status: string; razorpay_order_id: string; created_at: string }[];
  xp_log: { amount: number; reason: string; created_at: string }[];
  badges: { badge_slug: string; earned_at: string }[];
  certificates: { id: string; tier: number; status: string }[];
  referral: { code: string | null; converted: number };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .get(`/admin/users/${userId}/detail`)
      .then((res) => setD(res.data))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const modify = async (body: Record<string, unknown>, label: string) => {
    try {
      await api.patch(`/admin/users/${userId}`, body);
      toast.success(label);
      load();
    } catch {
      toast.error("Action failed");
    }
  };

  if (loading || !d) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  const inr = (paise: number) => `₹${(paise / 100).toFixed(0)}`;
  const u = d.user;
  const completedSet = new Set(d.progress.filter((p) => p.status === "completed").map((p) => p.day_number));

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:underline">
        <ArrowLeft size={14} /> All users
      </Link>

      {/* Header */}
      <Card className="flex flex-col md:flex-row md:items-center gap-4 p-5 sm:p-6 lg:p-7">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-primary to-brand-cyan text-white text-lg font-bold flex items-center justify-center shrink-0">
          {u.first_name[0]}
          {u.last_name?.[0] || ""}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl font-bold text-brand-navy">
              {u.first_name} {u.last_name}
            </h1>
            <Badge variant={u.role === "admin" ? "premium" : "default"}>{u.role}</Badge>
            <Badge variant={u.is_paid ? "success" : "warning"}>{u.is_paid ? "Paid" : "Free"}</Badge>
            {u.is_suspended && <Badge variant="danger">Suspended</Badge>}
          </div>
          <p className="text-sm text-gray-400">{u.email}</p>
          <p className="text-xs text-gray-300 mt-0.5">
            Joined {new Date(u.created_at).toLocaleDateString()}
            {u.referred_by_code && <> · referred via <code>{u.referred_by_code}</code></>}
            {u.platform_credit_balance > 0 && <> · {inr(u.platform_credit_balance)} credit</>}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {u.is_suspended ? (
            <Button size="sm" variant="outline" onClick={() => modify({ is_suspended: false }, "Reactivated")}>
              <CheckCircle2 size={13} className="mr-1 text-green-600" /> Unsuspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const reason = prompt("Suspension reason:");
                if (reason !== null) modify({ is_suspended: true, suspension_reason: reason }, "Suspended");
              }}
            >
              <Ban size={13} className="mr-1 text-red-500" /> Suspend
            </Button>
          )}
          {u.is_paid ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => confirm("Revoke paid access?") && modify({ paid_at: "revoke" }, "Access revoked")}
            >
              <CreditCard size={13} className="mr-1 text-red-500" /> Revoke
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => modify({ paid_at: "grant" }, "Access granted")}>
              <CreditCard size={13} className="mr-1 text-green-600" /> Grant access
            </Button>
          )}
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: "Total XP", value: d.stats.total_xp, icon: Zap },
          { label: "Days completed", value: `${d.stats.days_completed}/30`, icon: CheckCircle2 },
          { label: "Badges", value: d.stats.badges, icon: Award },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="!p-4 sm:!p-5 text-center">
              <Icon size={16} className="mx-auto mb-1 text-brand-primary" />
              <p className="text-lg font-bold text-brand-navy">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Progress grid */}
      <Card className="p-5 sm:p-6 lg:p-7">
        <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">30-day progress</h2>
        <div className="grid grid-cols-10 gap-1.5 max-w-2xl">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
            const p = d.progress.find((x) => x.day_number === n);
            return (
              <div
                key={n}
                title={`Day ${n}: ${p?.status || "not started"}${p?.best_quiz_score != null ? ` · quiz ${p.best_quiz_score}/10` : ""}`}
                className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-bold ${
                  completedSet.has(n)
                    ? "bg-brand-primary text-white"
                    : p?.status === "in_progress"
                    ? "bg-brand-primary/15 text-brand-primary"
                    : "bg-gray-100 text-gray-300"
                }`}
              >
                {n}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8">
        {/* Payments */}
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Payments</h2>
          {d.payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payment orders.</p>
          ) : (
            <div className="space-y-2">
              {d.payments.map((p) => (
                <div key={p.id} className="flex items-center flex-wrap justify-between gap-2 text-sm p-3 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
                  <span className="font-semibold text-brand-navy">{inr(p.amount_paise)}</span>
                  <Badge variant={p.status === "paid" ? "success" : p.status === "refunded" ? "info" : "warning"}>
                    {p.status}
                  </Badge>
                  <span className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
          {d.referral.code && (
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
              <Gift size={12} /> Referral code <code className="font-bold">{d.referral.code}</code> ·{" "}
              {d.referral.converted} converted
            </p>
          )}
        </Card>

        {/* XP log */}
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Recent XP activity</h2>
          {d.xp_log.length === 0 ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {d.xp_log.slice(0, 15).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-gray-600 capitalize">{e.reason.replace(/_/g, " ")}</span>
                  <span className="font-bold text-brand-primary flex-shrink-0">+{e.amount}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Submissions */}
      <Card className="p-5 sm:p-6 lg:p-7">
        <h2 className="font-display text-lg font-bold text-brand-navy mb-4 sm:mb-5">Submissions</h2>
        {d.submissions.length === 0 ? (
          <p className="text-sm text-gray-400">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                  <th className="py-3 px-4">Day</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {d.submissions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 px-4 font-semibold text-brand-navy whitespace-nowrap">Day {s.day_number}</td>
                    <td className="py-3 px-4">
                      <Badge variant={s.status === "scored" ? "success" : "warning"}>{s.status}</Badge>
                    </td>
                    <td className="py-3 px-4">{s.score ?? "—"}</td>
                    <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">{new Date(s.submitted_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
