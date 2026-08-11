import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  /** Subtle lift + shadow on hover — use on clickable cards */
  hover?: boolean;
}

export default function Card({ className, glass, hover, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6",
        glass
          ? "bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl"
          : "bg-white border border-gray-100 shadow-sm",
        hover &&
          "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
