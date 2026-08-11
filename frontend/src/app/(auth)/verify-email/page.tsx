"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import toast from "react-hot-toast";
import { MailCheck } from "lucide-react";

export default function VerifyEmailPage() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/verify-email", { otp });
      toast.success("Email verified!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await api.post("/auth/resend-verification");
      toast.success("New OTP sent!");
    } catch {
      toast.error("Failed to resend");
    }
  };

  return (
    <div className="text-center">
      <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-5">
        <MailCheck size={24} className="text-brand-primary" />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-1.5">Verify your email</h1>
      <p className="text-gray-500 mb-7 sm:mb-8">Enter the 6-digit code sent to your email</p>

      <form onSubmit={handleVerify} className="space-y-4 sm:space-y-5">
        <Input
          placeholder="000000"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          maxLength={6}
          className="text-center text-xl sm:text-2xl tracking-[0.4em] sm:tracking-[0.5em] font-mono py-3.5"
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verifying..." : "Verify Email"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Didn&apos;t receive the code?{" "}
        <button onClick={handleResend} className="text-brand-primary font-semibold hover:underline">
          Resend
        </button>
      </p>
    </div>
  );
}
