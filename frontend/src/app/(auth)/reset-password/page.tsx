"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import toast from "react-hot-toast";
import { KeyRound, ShieldAlert } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      toast.success("Password reset! Log in with your new password.");
      router.push("/login");
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Reset failed — the link may have expired"));
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert size={24} className="text-red-400" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-3">Invalid link</h1>
        <p className="text-gray-500 mb-8">
          This reset link is missing its token. Request a new one below.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full sm:w-auto">Request new link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center mb-5">
        <KeyRound size={20} className="text-brand-primary" />
      </div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-1.5">Choose a new password</h1>
      <p className="text-gray-500 mb-7 sm:mb-8">Reset links expire after 30 minutes</p>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Repeat the new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/login" className="text-brand-primary font-semibold hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
