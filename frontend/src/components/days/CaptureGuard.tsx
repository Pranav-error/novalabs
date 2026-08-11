"use client";

import { useEffect, useState } from "react";
import { EyeOff } from "lucide-react";

/** Deterrents against casually copying paid lesson content.
 *
 *  Be clear about the ceiling: a browser cannot detect or block a screenshot,
 *  and it cannot stop an OS-level screen recorder or a phone pointed at the
 *  monitor. Anything claiming otherwise is theatre. What this does is remove
 *  the effortless routes and make a deliberate capture obvious and
 *  attributable:
 *
 *   - blanks protected content while the tab is hidden or unfocused, which is
 *     when screen-recording software is typically started from another window
 *   - blanks on PrintScreen, so the reflexive key press captures nothing
 *     (the key cannot be intercepted before the OS acts on every platform, so
 *     this is a deterrent, not a guarantee)
 *   - blocks right-click "Save image as" and drag-to-desktop
 *   - suppresses text selection and copy of lesson prose
 *   - hides content from print / "Save as PDF"
 *
 *  The real protection is elsewhere and already in place: signed, expiring,
 *  per-learner media URLs (media_signing.py) and the learner's email
 *  watermarked over the player, so any leak traces back to an account.
 */
export default function CaptureGuard({ children }: { children: React.ReactNode }) {
  const [obscured, setObscured] = useState(false);

  useEffect(() => {
    const hide = () => setObscured(true);
    const show = () => setObscured(false);

    const onVisibility = () => (document.hidden ? hide() : show());
    const onKeyDown = (e: KeyboardEvent) => {
      // PrintScreen, plus the macOS screenshot chords (Cmd+Shift+3/4/5).
      const isPrintScreen = e.key === "PrintScreen";
      const isMacShot = e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key);
      if (isPrintScreen || isMacShot) {
        hide();
        // Restore shortly after; the capture itself happens within this window.
        setTimeout(show, 1200);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      className="capture-guard relative"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
    >
      {children}

      {obscured && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-md rounded-xl">
          <div className="text-center px-6">
            <EyeOff size={28} className="mx-auto mb-3 text-gray-400" />
            <p className="font-semibold text-brand-navy">Content hidden</p>
            <p className="text-sm text-gray-500 mt-1">
              Return to this tab to continue. Course material is licensed to your
              account and must not be recorded or shared.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
