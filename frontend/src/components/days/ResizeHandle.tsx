"use client";

import { PanelResizeHandle } from "react-resizable-panels";

/** The seam between two panes of the day view.
 *
 *  Rendered as a hairline rather than a gap with a floating grip: the panes are
 *  regions of one surface, so a gap read as two detached boxes. The visible rule
 *  stays 1px while an invisible padded strip gives it a comfortable grab area.
 */
export default function ResizeHandle({
  direction = "vertical",
}: {
  /** "vertical" = a vertical seam splitting left/right; "horizontal" = top/bottom. */
  direction?: "vertical" | "horizontal";
}) {
  const isVertical = direction === "vertical";

  return (
    <PanelResizeHandle
      className={`group relative bg-gray-200 transition-colors hover:bg-brand-primary data-[resize-handle-state=drag]:bg-brand-primary ${
        isVertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize"
      }`}
    >
      {/* Hit area only — the rule itself stays a hairline. */}
      <span
        className={`absolute ${isVertical ? "inset-y-0 -left-2 -right-2" : "inset-x-0 -top-2 -bottom-2"}`}
        aria-hidden
      />
    </PanelResizeHandle>
  );
}
