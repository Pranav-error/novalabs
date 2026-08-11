"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export default function ProgressBar({ value, max = 100, className, showLabel, size = "md" }: ProgressBarProps) {
  // Guard max<=0: (0/0)*100 is NaN, and `width: NaN%` is invalid CSS, which
  // lets the fill default to full width and read as 100% complete.
  const percentage = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm text-brand-navy mb-1">
          <span>{value}/{max}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn("w-full bg-gray-100 rounded-full overflow-hidden", size === "sm" ? "h-1.5" : "h-2.5")}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-primary via-brand-cyan to-brand-teal transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
