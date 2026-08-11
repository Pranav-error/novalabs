"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  FileText,
  Ticket,
  Megaphone,
  BookOpen,
  Flag,
  IndianRupee,
  Award,
  ScrollText,
  RotateCcw,
  ArrowLeft,
  LogOut,
  Menu,
  Layers,
  Bell,
  Gift,
} from "lucide-react";

const NAV_GROUPS: { title: string; items: { label: string; href: string; icon: any }[] }[] = [
  {
    title: "Insights",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "People",
    items: [{ label: "Users", href: "/admin/users", icon: Users }],
  },
  {
    title: "Learning",
    items: [
      { label: "Modules", href: "/admin/modules", icon: Layers },
      { label: "Topics", href: "/admin/days", icon: BookOpen },
      { label: "Submissions", href: "/admin/submissions", icon: FileText },
      { label: "Certificates", href: "/admin/certificates", icon: Award },
    ],
  },
  {
    title: "Revenue",
    items: [
      { label: "Payments", href: "/admin/payments", icon: IndianRupee },
      { label: "Coupons", href: "/admin/coupons", icon: Ticket },
      { label: "Referrals", href: "/admin/referrals", icon: Gift },
      { label: "Refunds", href: "/admin/refunds", icon: RotateCcw },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Reports", href: "/admin/reports", icon: Flag },
      { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
      { label: "Notifications", href: "/admin/notifications", icon: Bell },
    ],
  },
  {
    title: "System",
    items: [{ label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText }],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || (user.role !== "admin" && user.role !== "super_admin"))) {
      router.push(user ? "/dashboard" : "/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoading || !user || (user.role !== "admin" && user.role !== "super_admin")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-navy">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const sidebar = (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full bg-brand-cyan/10 blur-3xl" />

      {/* Brand */}
      <div className="relative flex items-center gap-2.5 px-5 py-5 border-b border-white/10 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className="font-display font-extrabold text-brand-cyan text-sm">M</span>
        </div>
        <div className="min-w-0">
          <p className="font-display font-extrabold text-white text-base leading-none truncate">NOVA LABS</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-cyan mt-1">
            Admin Console
          </p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive ? "bg-brand-cyan/20 text-brand-cyan" : "text-white/40 group-hover:text-white/70"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer actions */}
      <div className="relative px-3 py-4 border-t border-white/10 space-y-0.5 flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to app
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 bg-brand-navy z-40">
        {sidebar}
      </aside>

      {/* Mobile drawer — always mounted so open/close can transition smoothly */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex transition-opacity duration-200 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <aside
          className={`w-64 max-w-[80vw] bg-brand-navy shadow-2xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </aside>
        <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
      </div>

      {/* Topbar */}
      <header className="fixed top-0 left-0 lg:left-60 right-0 h-14 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="lg:hidden text-brand-navy p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-brand-navy truncate">
            {NAV_GROUPS.flatMap((g) => g.items).find((i) =>
              i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href)
            )?.label || "Admin"}
          </span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
          <span className="hidden sm:block text-xs text-gray-400 truncate max-w-[160px]">{user.email}</span>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-cyan text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {(user.first_name?.[0] || "A").toUpperCase()}
            {(user.last_name?.[0] || "").toUpperCase()}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="lg:ml-60 max-w-7xl mx-auto pt-20 pb-10 sm:pb-12 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
