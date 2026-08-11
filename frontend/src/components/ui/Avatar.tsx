import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Avatar({ name, size = "md", className }: AvatarProps) {
  const parts = name.split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-brand-primary to-brand-cyan flex items-center justify-center text-white font-bold",
        {
          "w-8 h-8 text-xs": size === "sm",
          "w-10 h-10 text-sm": size === "md",
          "w-14 h-14 text-lg": size === "lg",
        },
        className
      )}
    >
      {initials.toUpperCase()}
    </div>
  );
}
