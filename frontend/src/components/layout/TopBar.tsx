"use client";

import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/ui/Avatar";
import NotificationsBell from "@/components/layout/NotificationsBell";
import SearchBox from "@/components/layout/SearchBox";

export default function TopBar() {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 inset-x-0 lg:left-64 h-16 z-20 bg-white border-b border-gray-100 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex-1 min-w-0">
        <SearchBox />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <NotificationsBell />
        <Avatar name={user ? `${user.first_name} ${user.last_name}` : "U"} size="sm" />
      </div>
    </header>
  );
}
