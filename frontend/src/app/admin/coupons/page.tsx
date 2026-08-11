"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Plus, Ticket, ToggleLeft, ToggleRight } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  times_used: number;
  total_usage_limit: number | null;
  is_active: boolean;
  description: string;
  created_at: string;
}

interface CouponForm {
  code: string;
  discount_type: string;
  discount_value: string;
  max_discount: string;
  total_usage_limit: string;
  description: string;
}

const emptyForm: CouponForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_discount: "",
  total_usage_limit: "",
  description: "",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/coupons");
      setCoupons(res.data.coupons);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        description: form.description,
      };
      if (form.max_discount) body.max_discount = parseFloat(form.max_discount);
      if (form.total_usage_limit)
        body.total_usage_limit = parseInt(form.total_usage_limit, 10);

      await api.post("/admin/coupons", body);
      setForm(emptyForm);
      setShowCreate(false);
      fetchCoupons();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (coupon: Coupon) => {
    setToggling(coupon.id);
    try {
      await api.patch(`/admin/coupons/${coupon.id}`, {
        is_active: !coupon.is_active,
      });
      setCoupons((prev) =>
        prev.map((c) =>
          c.id === coupon.id ? { ...c, is_active: !c.is_active } : c
        )
      );
    } catch {
      // silently fail
    } finally {
      setToggling(null);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return `₹${(coupon.discount_value / 100).toFixed(0)}`;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
            <Ticket size={18} className="text-brand-primary" />
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy">
            Coupon Management
          </h1>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="p-5 sm:p-6 lg:p-7">
          <h2 className="font-display text-lg font-bold text-brand-navy mb-4">
            New Coupon
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Coupon Code"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="e.g. LAUNCH50"
                required
              />
              <div>
                <label className="block text-sm font-medium text-brand-navy mb-1.5">
                  Discount Type
                </label>
                <select
                  value={form.discount_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, discount_type: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-brand-navy text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                >
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat</option>
                </select>
              </div>
              <Input
                label="Discount Value"
                type="number"
                value={form.discount_value}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discount_value: e.target.value }))
                }
                placeholder={
                  form.discount_type === "percentage"
                    ? "e.g. 20"
                    : "Amount in paise"
                }
                required
              />
              <Input
                label="Max Discount (paise, optional)"
                type="number"
                value={form.max_discount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_discount: e.target.value }))
                }
                placeholder="e.g. 50000"
              />
              <Input
                label="Total Usage Limit (optional)"
                type="number"
                value={form.total_usage_limit}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    total_usage_limit: e.target.value,
                  }))
                }
                placeholder="e.g. 100"
              />
              <Input
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Internal note"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button type="submit" disabled={creating} size="sm" className="w-full sm:w-auto">
                {creating ? "Creating..." : "Create Coupon"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setShowCreate(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Coupons list */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : coupons.length === 0 ? (
        <Card className="max-w-sm mx-auto text-center py-12 sm:py-16">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Ticket size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400">No coupons created yet.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[880px] w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Code</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Discount</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Max Discount</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Usage</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Description</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4">Created</th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon, idx) => (
                  <tr
                    key={coupon.id}
                    className={`border-t border-gray-50 hover:bg-brand-primary/5 transition-colors ${
                      idx % 2 === 1 ? "bg-gray-50/50" : ""
                    }`}
                  >
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 font-mono font-semibold text-brand-navy whitespace-nowrap">
                      {coupon.code}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-brand-navy whitespace-nowrap">
                      {formatDiscount(coupon)}
                      <span className="text-xs text-gray-400 ml-1">
                        ({coupon.discount_type})
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-gray-500 whitespace-nowrap">
                      {coupon.max_discount
                        ? `₹${(coupon.max_discount / 100).toFixed(0)}`
                        : "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-gray-600 whitespace-nowrap">
                      {coupon.times_used}
                      {coupon.total_usage_limit
                        ? ` / ${coupon.total_usage_limit}`
                        : ""}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                      <Badge
                        variant={coupon.is_active ? "success" : "default"}
                      >
                        {coupon.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-gray-500 max-w-[200px] truncate">
                      {coupon.description || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-gray-500 whitespace-nowrap">
                      {new Date(coupon.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                      <button
                        onClick={() => handleToggle(coupon)}
                        disabled={toggling === coupon.id}
                        className="text-gray-400 hover:text-brand-primary transition-colors disabled:opacity-50"
                        title={
                          coupon.is_active ? "Deactivate" : "Activate"
                        }
                        aria-label={
                          coupon.is_active ? "Deactivate coupon" : "Activate coupon"
                        }
                      >
                        {coupon.is_active ? (
                          <ToggleRight className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
