"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import toast from "react-hot-toast";
import { RotateCcw, Check, X } from "lucide-react";

interface Refund {
  id: string;
  learner_name: string;
  learner_email: string;
  reason_category: string;
  reason_text: string | null;
  status: string;
  requested_at: string;
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = async (status: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/refunds?status_filter=${status}`);
      setRefunds(res.data.refunds);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const decide = async (id: string, action: "approved" | "rejected") => {
    const note = prompt(
      action === "approved"
        ? "Approving revokes the learner's access and reverses any referral cashback. Optional note:"
        : "Optional rejection note (sent to learner):"
    );
    if (note === null) return;
    try {
      await api.patch(`/admin/refunds/${id}`, { action, admin_note: note || null });
      toast.success(`Refund ${action}`);
      load(filter);
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Failed"));
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
          <RotateCcw size={18} className="text-brand-primary" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">Refund Requests</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            7-day money-back guarantee queue. Approving revokes access immediately and reverses
            referral cashback. The actual money transfer runs through the Razorpay dashboard.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
              filter === s ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : refunds.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <RotateCcw size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No {filter} refund requests.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {refunds.map((r) => (
            <Card key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="font-semibold text-brand-navy text-sm">{r.learner_name}</span>
                  <span className="text-xs text-gray-400 truncate">{r.learner_email}</span>
                  <Badge variant="warning">{r.reason_category}</Badge>
                </div>
                {r.reason_text && (
                  <p className="text-sm text-gray-500 break-words">&ldquo;{r.reason_text}&rdquo;</p>
                )}
                <p className="text-[11px] text-gray-300 mt-1.5">
                  Requested {new Date(r.requested_at).toLocaleString()}
                </p>
              </div>
              {r.status === "pending" ? (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" className="flex-1 sm:flex-initial" onClick={() => decide(r.id, "approved")}>
                    <Check size={14} className="mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 sm:flex-initial"
                    onClick={() => decide(r.id, "rejected")}
                  >
                    <X size={14} className="mr-1" /> Reject
                  </Button>
                </div>
              ) : (
                <Badge variant={r.status === "approved" ? "success" : "danger"} className="self-start sm:self-center">
                  {r.status}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
