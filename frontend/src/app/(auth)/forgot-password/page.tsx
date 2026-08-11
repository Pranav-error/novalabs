"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Reset link sent if account exists");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-5">
          <Mail size={24} className="text-brand-primary" />
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-3">Check your email</h1>
        <p className="text-gray-500 mb-8">
          If an account exists for <span className="font-medium text-brand-navy">{email}</span>, we sent a password reset link.
        </p>
        <Link href="/login">
          <Button variant="outline" className="w-full sm:w-auto">Back to login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-1.5">Reset password</h1>
      <p className="text-gray-500 mb-7 sm:mb-8">Enter your email and we&apos;ll send a reset link</p>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
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
