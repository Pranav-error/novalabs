"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import api, { setAccessToken, getAccessToken } from "@/lib/api";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  is_paid: boolean;
  bio: string | null;
  portfolio_slug: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  total_xp: number;
  days_completed: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  signup: (data: { email: string; password: string; first_name: string; last_name: string; referral_code?: string | null }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get("/me");
      setUser(res.data);
      return true;
    } catch {
      setUser(null);
      setAccessToken(null);
      return false;
    }
  };

  useEffect(() => {
    const init = async () => {
      // Try to get a new access token using the httpOnly refresh cookie
      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setAccessToken(res.data.access_token);
        await fetchUser();
      } catch {
        // No valid refresh token — user is not logged in
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.access_token);
    await fetchUser();
  };

  const loginWithGoogle = async (credential: string) => {
    const res = await api.post("/auth/google", { credential });
    setAccessToken(res.data.access_token);
    await fetchUser();
  };

  const signup = async (data: { email: string; password: string; first_name: string; last_name: string; referral_code?: string | null }) => {
    const res = await api.post("/auth/signup", data);
    setAccessToken(res.data.access_token);
    await fetchUser();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch { /* ignore */ }
    setAccessToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, loginWithGoogle, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
