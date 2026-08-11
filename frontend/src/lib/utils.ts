import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * FastAPI returns `detail` as a plain string for most errors, but as an array
 * of {type, loc, msg, ...} objects for 422 validation errors. Rendering that
 * array directly as a React child crashes ("Objects are not valid as a React
 * child"), so every call site needs to go through this instead of reading
 * `err.response.data.detail` directly.
 */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const detail = (err as any)?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const joined = detail
      .map((item) => (typeof item === "string" ? item : item?.msg))
      .filter(Boolean)
      .join("; ");
    if (joined) return joined;
  }
  const message = (err as any)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}
