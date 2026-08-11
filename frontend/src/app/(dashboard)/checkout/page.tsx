"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import {
  Check,
  Shield,
  CreditCard,
  Tag,
  Gift,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const paidFeatures = [
  "All 30 days unlocked immediately",
  "4 mentor-reviewed projects",
  "AI mock interview sessions",
  "Resume builder & portfolio page",
  "5-tier certificate system",
  "XP, badges & leaderboard",
  "Referral rewards",
];

/** Pricing and referral terms come from the API so this page cannot drift
 *  from COURSE_PRICE_PAISE or the admin-editable referral percentage. */
interface Terms {
  discount_paise: number;
  course_price_paise: number;
  gst_percent: number;
}

const inr = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);

export default function CheckoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [terms, setTerms] = useState<Terms | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (user?.is_paid) {
    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12">
        <Card className="text-center py-12 sm:py-16 px-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-navy mb-2">You're already a Pro member!</h2>
          <p className="text-gray-500 mb-6">All 30 days are unlocked for you.</p>
          <Button onClick={() => router.push("/dashboard")} className="w-full sm:w-auto">
            Go to Dashboard <ArrowRight size={16} className="ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    api
      .get("/referrals/terms")
      .then((res) => setTerms(res.data))
      .catch(() => {});
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/payments/create-order", {
        referral_code: referralCode || null,
        coupon_code: couponCode || null,
      });
      const data = res.data;

      if (!data.key_id) {
        // Test mode — no Razorpay key configured
        setError("Payment gateway not configured. Contact support.");
        setLoading(false);
        return;
      }

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        document.body.appendChild(script);
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
        });
      }

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: data.name,
        description: data.description,
        order_id: data.order_id,
        prefill: data.prefill,
        theme: { color: "#2F67C7" },
        handler: async (response: any) => {
          try {
            await api.post("/payments/verify", {
              payment_id: response.razorpay_payment_id,
              order_id: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
            setSuccess(true);
            setTimeout(() => {
              window.location.href = "/dashboard";
            }, 2000);
          } catch {
            setError("Payment verification failed. Contact support if amount was deducted.");
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(getErrorMessage(err, "Failed to create order"));
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-8 sm:py-12">
        <Card className="text-center py-12 sm:py-16 px-5 bg-green-50 border-green-200">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-500" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-green-800 mb-2">Payment Successful!</h2>
          <p className="text-green-600 mb-4">All 30 days are now unlocked. Redirecting...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 lg:py-8">
      <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-navy mb-5 sm:mb-6">Unlock Pro Mastery</h1>

      <div className="grid lg:grid-cols-5 gap-5 sm:gap-6 lg:gap-8">
        {/* Left: What you get */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-5">
          <Card className="p-5 sm:p-6 lg:p-7">
            <h3 className="font-bold text-brand-navy mb-4 flex items-center gap-2">
              <Check size={18} className="text-brand-primary" />
              What's included
            </h3>
            <ul className="space-y-3">
              {paidFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-6 h-6 rounded-lg bg-brand-cyan/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={14} className="text-brand-cyan" />
                  </div>
                  {f}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5 sm:p-6 lg:p-7">
            <h3 className="font-bold text-brand-navy mb-4 flex items-center gap-2">
              <Tag size={18} className="text-brand-primary" />
              Have a code?
            </h3>
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Referral Code</label>
                <div className="flex items-center gap-2">
                  <Gift size={16} className="text-gray-400 flex-shrink-0" />
                  <Input
                    placeholder="e.g. john-a1b2c3"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {terms ? `Get ${inr(terms.discount_paise)} off with a referral` : "Referral codes give a discount"}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Coupon Code</label>
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-gray-400 flex-shrink-0" />
                  <Input
                    placeholder="e.g. LAUNCH20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Order summary — stacks below the form on mobile/tablet, only
            becomes a sticky side column once there's room for it at lg. */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6 lg:p-7 lg:sticky lg:top-24">
            <h3 className="font-bold text-brand-navy mb-4 flex items-center gap-2">
              <CreditCard size={18} />
              Order Summary
            </h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">Pro Mastery (30 Days)</span>
                <span className="font-semibold text-brand-navy flex-shrink-0">
                  {terms ? inr(Math.round(terms.course_price_paise / (1 + terms.gst_percent / 100))) : "—"}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-gray-500">GST ({terms?.gst_percent ?? 18}%)</span>
                <span className="text-gray-500 flex-shrink-0">
                  {terms
                    ? inr(
                        terms.course_price_paise -
                          Math.round(terms.course_price_paise / (1 + terms.gst_percent / 100))
                      )
                    : "—"}
                </span>
              </div>
              {(referralCode || couponCode) && (
                <div className="flex justify-between gap-3 text-sm text-green-600">
                  <span>Discount</span>
                  <span className="flex-shrink-0">Applied at checkout</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between gap-3">
                <span className="font-bold text-brand-navy">Total</span>
                <span className="font-bold text-brand-navy text-lg flex-shrink-0">
                  {terms ? inr(terms.course_price_paise) : "—"}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <Button
              onClick={handlePayment}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Processing..." : "Pay Now"}
              {!loading && <ArrowRight size={16} className="ml-2" />}
            </Button>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <Shield size={14} className="flex-shrink-0" />
              Secure payment via Razorpay · 7-day refund policy
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
