"use client";

import { useEffect, useMemo, useState } from "react";
import { ReactGridLayout as GridLayout, WidthProvider, type Layout } from "react-grid-layout/legacy";
import { GripVertical, RotateCcw } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const GridLayoutWithWidth = WidthProvider(GridLayout);

export interface DayWidget {
  id: string;
  title: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  defaultLayout: { x: number; y: number; w: number; h: number };
  minW?: number;
  minH?: number;
}

const ROW_HEIGHT = 24;
const STORAGE_KEY = "novalab-day-grid-layout-v1";

function loadLayout(widgets: DayWidget[]): Layout {
  const defaults: Layout = widgets.map((w) => ({
    i: w.id,
    x: w.defaultLayout.x,
    y: w.defaultLayout.y,
    w: w.defaultLayout.w,
    h: w.defaultLayout.h,
    minW: w.minW ?? 3,
    minH: w.minH ?? 4,
  }));

  if (typeof window === "undefined") return defaults;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Layout | null;
    if (!saved || !Array.isArray(saved)) return defaults;
    // Only trust the saved layout if it covers exactly the widgets we have —
    // a stale save from before a widget was added/removed would otherwise
    // silently drop or orphan panels.
    const savedIds = new Set(saved.map((s) => s.i));
    const widgetIds = new Set(widgets.map((w) => w.id));
    const sameSet =
      savedIds.size === widgetIds.size && [...widgetIds].every((id) => savedIds.has(id));
    return sameSet ? saved : defaults;
  } catch {
    return defaults;
  }
}

/** A fully rearrangeable, resizable dashboard of the day's panels — video,
 *  lesson, quiz, assignment, doubts, notes. Drag by a panel's header, resize
 *  from its bottom-right corner; the arrangement is remembered per-browser
 *  and shared across every day, so a learner sets it up once. */
export default function DayGridLayout({ widgets }: { widgets: DayWidget[] }) {
  const [layout, setLayout] = useState<Layout>(() => loadLayout(widgets));

  // Widgets differ per day (e.g. only some days have a video) — resync
  // whenever the set of widget ids actually changes, instead of keeping
  // whatever the previous day's set produced.
  const widgetIds = useMemo(() => widgets.map((w) => w.id).join(","), [widgets]);
  useEffect(() => {
    setLayout(loadLayout(widgets));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetIds]);

  const handleLayoutChange = (next: Layout) => {
    setLayout(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const resetLayout = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setLayout(loadLayout(widgets));
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-brand-primary transition-colors"
        >
          <RotateCcw size={12} /> Reset layout
        </button>
      </div>

      <GridLayoutWithWidth
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={ROW_HEIGHT}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        preventCollision={false}
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map((w) => (
          <div key={w.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="widget-drag-handle flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80 cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical size={14} className="text-gray-300 shrink-0" />
              {w.icon}
              <span className="text-xs font-semibold text-brand-navy truncate">{w.title}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">{w.content}</div>
            {/* Purely decorative — the library's own (functionally proven)
                resize handle sits invisibly in this same corner and still
                receives the actual drag; this just makes it discoverable. */}
            <span className="pointer-events-none absolute bottom-1 right-1 w-3.5 h-3.5 rounded-tl-md rounded-br-sm border-b-2 border-r-2 border-gray-300" />
          </div>
        ))}
      </GridLayoutWithWidth>
    </div>
  );
}
