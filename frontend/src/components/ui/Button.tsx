"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]",
          {
            "bg-brand-primary text-white hover:bg-brand-deep-blue focus:ring-brand-primary shadow-lg shadow-brand-primary/25":
              variant === "primary",
            "bg-gradient-to-r from-brand-purple to-brand-magenta text-white hover:opacity-90 focus:ring-brand-purple shadow-lg shadow-brand-purple/25":
              variant === "secondary",
            "border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white focus:ring-brand-primary":
              variant === "outline",
            "text-brand-navy hover:bg-brand-primary/10 focus:ring-brand-primary":
              variant === "ghost",
          },
          {
            "text-sm px-4 py-2": size === "sm",
            "text-base px-6 py-3": size === "md",
            "text-lg px-8 py-4": size === "lg",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
