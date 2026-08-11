import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "premium" | "danger";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
        {
          "bg-gray-100 text-brand-navy": variant === "default",
          "bg-emerald-100 text-emerald-700": variant === "success",
          "bg-amber-100 text-amber-700": variant === "warning",
          "bg-brand-cyan/20 text-brand-deep-blue": variant === "info",
          "bg-red-100 text-red-700": variant === "danger",
          "bg-gradient-to-r from-brand-purple to-brand-magenta text-white": variant === "premium",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
