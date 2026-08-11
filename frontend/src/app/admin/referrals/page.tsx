"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Gift, Save, ToggleLeft, ToggleRight, Users, TrendingUp, Wallet, Percent } from "lucide-react";

interface ReferralRow {
  code: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  is_active: boolean;
  created_at: string;
  attempts: number;
  conversions: number;
  reversed: number;
  credit_earned_paise: number;
  discount_given_paise: number;
}

interface ReferralSettings {
  discount_paise: number;
  credit_paise: number;
  course_price_paise: number;
}

interface Totals {
  codes: number;
  active_codes: number;
  attempts: number;
  conversions: number;
  reversed: number;
  credit_issued_paise: number;
  discount_given_paise: number;
}

const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(
    paise / 100
  );

export default function AdminReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Settings form (rupees in the input, paise on the wire)
  const [discountInput, setDiscountInput] = useState("");
  const [creditInput, setCreditInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/referrals");
      setRows(res.data.referrals || []);
      setSettings(res.data.settings);
      setTotals(res.data.totals);
      setDiscountInput(String(res.data.settings.discount_paise / 100));
      setCreditInput(String(res.data.settings.credit_paise / 100));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveSettings = async () => {
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");
    try {
      await api.patch("/admin/referrals/settings", {
        discount_paise: Math.round(Number(discountInput) * 100),
        credit_paise: Math.round(Number(creditInput) * 100),
      });
      setSaveMsg("Saved — applies to new orders from now on.");
      await fetchAll();
    } catch (err: any) {
      setSaveErr(getErrorMessage(err, "Could not save settings"));
    } finally {
      setSaving(false);
    }
  };

  const toggleCode = async (code: string) => {
    setToggling(code);
    try {
      const res = await api.patch(`/admin/referrals/${code}`);
      setRows((prev) => prev.map((r) => (r.code === code ? { ...r, is_active: res.data.is_active } : r)));
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  const conversionRate =
    totals && totals.attempts > 0 ? Math.round((totals.conversions / totals.attempts) * 1000) / 10 : 0;

  const stats = [
    { label: "Active codes", value: `${totals?.active_codes ?? 0}`, sub: `of ${totals?.codes ?? 0} issued`, icon: Users, color: "#2F67C7" },
    { label: "Conversions", value: `${totals?.conversions ?? 0}`, sub: `${conversionRate}% of ${totals?.attempts ?? 0} attempts`, icon: TrendingUp, color: "#059669" },
    { label: "Credit issued", value: inr(totals?.credit_issued_paise ?? 0), sub: "owed to referrers", icon: Wallet, color: "#7C3AED" },
    { label: "Discount given", value: inr(totals?.discount_given_paise ?? 0), sub: "revenue foregone", icon: Percent, color: "#D97706" },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy flex items-center gap-2">
          <Gift size={22} className="text-brand-primary" /> Referrals
        </h1>
        <p className="text-xs text-gray-400 mt-1">Program performance and reward settings.</p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
              style={{ background: `${s.color}15` }}
            >
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div className="text-xl sm:text-2xl font-bold text-brand-navy leading-tight break-words">{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            <div className="text-[11px] text-gray-400">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Reward economics */}
      <Card className="p-5 sm:p-6 lg:p-7">
        <h2 className="font-display text-lg font-bold text-brand-navy mb-1">Reward settings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Changing these affects new orders only — rewards already granted keep the amount they were
          issued at.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Friend&apos;s discount (₹)
            </label>
            <Input
              type="number"
              min={0}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              {settings
                ? `Taken off ${inr(settings.course_price_paise)} at checkout`
                : ""}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Referrer&apos;s credit (₹)
            </label>
            <Input
              type="number"
              min={0}
              value={creditInput}
              onChange={(e) => setCreditInput(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Added to their platform credit on each conversion</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
          <Button onClick={saveSettings} disabled={saving} className="w-full sm:w-auto">
            <Save size={16} className="mr-2" />
            {saving ? "Saving..." : "Save settings"}
          </Button>
          {saveMsg && <span className="text-sm text-green-600">{saveMsg}</span>}
          {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
        </div>
      </Card>

      {/* Per-code performance */}
      {rows.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16 px-5">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Gift size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No referral codes issued yet.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Attempts</th>
                <th className="px-4 py-3 text-right">Conversions</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Credit earned</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Discount given</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-navy whitespace-nowrap">{r.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-navy whitespace-nowrap">{r.owner_name || "—"}</div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">{r.owner_email}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.attempts}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-navy">
                    {r.conversions}
                    {r.reversed > 0 && (
                      <span className="ml-1 text-xs font-normal text-amber-600">(-{r.reversed})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell whitespace-nowrap">
                    {inr(r.credit_earned_paise)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell text-gray-500 whitespace-nowrap">
                    {inr(r.discount_given_paise)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.is_active ? "success" : "danger"}>
                      {r.is_active ? "active" : "disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleCode(r.code)}
                      disabled={toggling === r.code}
                      title={r.is_active ? "Disable this code" : "Re-enable this code"}
                      className="text-gray-400 hover:text-brand-primary transition-colors disabled:opacity-40"
                    >
                      {r.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
