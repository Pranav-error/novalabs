"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(getErrorMessage(err, "Login failed"));
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-navy mb-1.5">Welcome back</h1>
      <p className="text-gray-500 mb-7 sm:mb-8">Log in to continue your challenge</p>

      <div className="space-y-4 sm:space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-gray-500">
            <input type="checkbox" className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary/50" />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-brand-primary font-medium hover:underline flex-shrink-0">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          disabled={loading}
          onClick={handleLogin}
        >
          {loading ? "Logging in..." : "Log In"}
        </Button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-gray-400">or</span>
        </div>
      </div>

      <GoogleSignInButton />

      <p className="text-center text-sm text-gray-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-brand-primary font-semibold hover:underline">
          Sign up free
        </Link>
      </p>
    </div>
  );
}
