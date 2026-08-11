"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { IndianRupee, ChevronLeft, ChevronRight } from "lucide-react";

interface Payment {
  id: string;
  learner_name: string;
  amount_paise: number;
  status: string;
  razorpay_order_id: string;
  coupon_code: string | null;
  referral_code: string | null;
  created_at?: string;
  paid_at?: string | null;
}

const statusVariant = (s: string): "success" | "warning" | "danger" | "info" =>
  s === "paid" ? "success" : s === "created" ? "warning" : s === "refunded" ? "info" : "danger";

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/payments?page=${page}&limit=20`)
      .then((res) => setPayments(res.data.payments || res.data.items || res.data))
      .finally(() => setLoading(false));
  }, [page]);

  const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(paise / 100);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <IndianRupee size={18} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Razorpay order history for every learner.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <IndianRupee size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No payment orders yet.</p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Learner</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 text-right">Amount</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 hidden md:table-cell">Order ID</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 hidden sm:table-cell">Codes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`border-t border-gray-50 hover:bg-brand-primary/5 transition-colors ${
                      idx % 2 === 1 ? "bg-gray-50/50" : ""
                    }`}
                  >
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 font-semibold text-brand-navy">{p.learner_name}</td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-right font-semibold text-brand-navy whitespace-nowrap">
                      {inr(p.amount_paise)}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 hidden md:table-cell font-mono text-xs text-gray-400 whitespace-nowrap">
                      {p.razorpay_order_id}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 hidden sm:table-cell text-xs text-gray-400 whitespace-nowrap">
                      {[p.coupon_code, p.referral_code].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft size={14} className="mr-1" /> Prev
        </Button>
        <span className="text-xs text-gray-400">Page {page}</span>
        <Button size="sm" variant="outline" disabled={payments.length < 20} onClick={() => setPage((p) => p + 1)}>
          Next <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
