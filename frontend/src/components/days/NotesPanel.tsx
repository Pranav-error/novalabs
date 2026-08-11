"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StickyNote, X, Check } from "lucide-react";
import api from "@/lib/api";

function useNotes(dayNumber: number) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    loadedRef.current = false;
    api
      .get(`/days/${dayNumber}/notes`)
      .then((res) => setContent(res.data.content || ""))
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
      });
  }, [dayNumber]);

  const scheduleSave = useCallback(
    (value: string) => {
      if (!loadedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setStatus("saving");
      timerRef.current = setTimeout(async () => {
        try {
          await api.put(`/days/${dayNumber}/notes`, { content: value });
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("idle");
        }
      }, 3000);
    },
    [dayNumber]
  );

  const onChange = (value: string) => {
    setContent(value);
    scheduleSave(value);
  };

  return { content, status, onChange };
}

/** The textarea + save-status chrome, with no positioning of its own — used
 *  both inside the floating slide-in (mobile) and as a grid widget (desktop). */
export function NotesEditor({ dayNumber }: { dayNumber: number }) {
  const { content, status, onChange } = useNotes(dayNumber);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-1 pb-2 flex-shrink-0">
        <span className="text-xs text-gray-400">
          {status === "saving" ? (
            "Saving…"
          ) : status === "saved" ? (
            <span className="inline-flex items-center gap-1 text-green-600">
              <Check size={12} /> Saved
            </span>
          ) : null}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down anything — these notes are private to you and auto-save as you type."
        className="flex-1 w-full p-3 text-sm text-brand-navy resize-none focus:outline-none border border-gray-100 rounded-xl bg-gray-50/50"
      />
    </div>
  );
}

/** Floating toggle + slide-in panel — the mobile/narrow-viewport presentation. */
export default function NotesPanel({ dayNumber }: { dayNumber: number }) {
  const [open, setOpen] = useState(false);
  const { content, status, onChange } = useNotes(dayNumber);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-24 right-4 sm:right-6 lg:bottom-6 z-40 w-12 h-12 rounded-full bg-brand-primary text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        title="My Notes"
      >
        <StickyNote size={20} />
      </button>

      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-brand-primary" />
            <span className="font-bold text-brand-navy text-sm">My Notes — Day {dayNumber}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {status === "saving" ? "Saving…" : status === "saved" ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Check size={12} /> Saved
                </span>
              ) : null}
            </span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Jot down anything — these notes are private to you and auto-save as you type."
          className="flex-1 w-full p-4 text-sm text-brand-navy resize-none focus:outline-none"
        />
      </div>
    </>
  );
}
