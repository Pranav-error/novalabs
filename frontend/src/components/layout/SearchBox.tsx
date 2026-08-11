"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, BookOpen, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

interface DayHit {
  day_number: number;
  title: string;
  status: string;
}

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [days, setDays] = useState<DayHit[] | null>(null);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Lazy-load the full day list the first time the box is focused
  const ensureDays = async () => {
    if (days) return;
    try {
      const phases = (await api.get("/phases")).data as { id: string }[];
      const details = await Promise.all(
        phases.map((p) => api.get(`/phases/${p.id}`).then((r) => r.data.days as DayHit[]))
      );
      setDays(details.flat().sort((a, b) => a.day_number - b.day_number));
    } catch {
      setDays([]);
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const hits = q && days
    ? days
        .filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            `day ${d.day_number}`.includes(q) ||
            String(d.day_number) === q
        )
        .slice(0, 6)
    : [];

  const go = (dayNumber: number) => {
    setFocused(false);
    setQuery("");
    router.push(`/days/${dayNumber}`);
  };

  return (
    <div className="relative w-full max-w-md" ref={wrapperRef}>
      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-brand-primary/40 transition-shadow">
        <Search size={18} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search days, topics..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            ensureDays();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits.length > 0) go(hits[0].day_number);
            if (e.key === "Escape") setFocused(false);
          }}
          className="bg-transparent outline-none text-sm text-brand-navy placeholder:text-gray-400 w-full"
        />
      </div>

      <AnimatePresence>
        {focused && q && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            {days === null ? (
              <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
            ) : hits.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No days match &ldquo;{query}&rdquo;
              </p>
            ) : (
              hits.map((d) => (
                <button
                  key={d.day_number}
                  onClick={() => go(d.day_number)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <BookOpen size={15} className="text-brand-primary shrink-0" />
                  <span className="text-sm text-brand-navy flex-1 truncate">
                    <span className="font-semibold">Day {d.day_number}</span> — {d.title}
                  </span>
                  {d.status === "completed" && (
                    <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
