"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Trophy, Award, User, LogOut, Shield, FileText, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/days/1", icon: BookOpen, label: "Curriculum" },
  { href: "/community", icon: Users, label: "Community" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/certificates", icon: Award, label: "Certificates" },
  { href: "/resume", icon: FileText, label: "Resume" },
  { href: "/interviews", icon: Mic, label: "Interviews" },
  { href: "/profile", icon: User, label: "Profile" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-white border-r border-gray-100 fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-cyan flex items-center justify-center">
            <span className="text-white font-bold text-lg">M</span>
          </div>
          <span className="text-xl font-bold text-brand-navy">NOVA LABS</span>
        </Link>
      </div>

      {/* Progress */}
      <div className="px-6 mb-4">
        <ProgressBar value={user?.days_completed || 0} max={30} showLabel />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        {[...navItems, ...(user?.role === "admin" || user?.role === "super_admin" ? [{ href: "/admin", icon: Shield, label: "Admin" }] : [])].map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all duration-200 text-sm font-medium",
                isActive
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "text-gray-500 hover:bg-gray-50 hover:text-brand-navy"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <Avatar name={user ? `${user.first_name} ${user.last_name}` : "U"} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-brand-navy truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-gray-400">{user?.total_xp || 0} XP</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
