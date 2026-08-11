"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import toast from "react-hot-toast";

export default function SignupPage() {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const { signup } = useAuth();
  const router = useRouter();
  useEffect(() => {
    // URL param takes precedence over the ref cookie (set by /r/[code])
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    const fromCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("ref="))
      ?.split("=")[1];
    setReferralCode(fromUrl || fromCookie || null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signup({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        referral_code: referralCode,
      });
      toast.success("Account created! Welcome to NOVA LABS.");
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(getErrorMessage(err, "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-1.5">Create your account</h1>
      <p className="text-gray-500 mb-7 sm:mb-8">Start Day 1 for free — no credit card required</p>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Input label="First name" value={form.first_name} onChange={update("first_name")} required />
          <Input label="Last name" value={form.last_name} onChange={update("last_name")} required />
        </div>
        <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={update("email")} required />
        <Input label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={update("password")} required />
        <Input label="Confirm password" type="password" placeholder="Re-enter password" value={form.confirm} onChange={update("confirm")} required />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Start Free — Day 1"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-primary font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
