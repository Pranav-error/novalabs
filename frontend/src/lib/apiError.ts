/** Turn any API error into a string that is safe to render.
 *
 *  FastAPI's `detail` is a string for HTTPExceptions, but for 422 validation
 *  failures it is an ARRAY of objects ({type, loc, msg, input, ctx}). Rendering
 *  that object as a React child crashes the whole page — "Objects are not
 *  valid as a React child" — which is exactly what a learner saw when they
 *  typed a short password at signup. Every error surface must go through here.
 */

interface ValidationItem {
  loc?: (string | number)[];
  msg?: string;
}

export function apiError(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail)) {
    const parts = (detail as ValidationItem[])
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        // Last loc segment names the field ("body", "email" -> "email").
        const rawField = item.loc?.[item.loc.length - 1];
        const field =
          typeof rawField === "string" && rawField !== "body"
            ? rawField.replace(/_/g, " ")
            : null;
        const msg = typeof item.msg === "string" ? item.msg : null;
        if (!msg) return null;
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join(". ");
  }

  return fallback;
}
