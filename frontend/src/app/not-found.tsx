import Link from "next/link";

/** Replaces Next.js's default 404 — a black page reading "This page could not
 *  be found", with no branding and no way back. Any mistyped URL or stale link
 *  dropped a learner there with nothing to click. */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-brand-primary/20">404</p>
        <h1 className="text-2xl font-bold text-brand-navy mt-2 mb-2">
          We couldn&apos;t find that page
        </h1>
        <p className="text-gray-500 mb-8">
          The link may be out of date, or the address may have a typo in it.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-brand-primary text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Go to my dashboard
          </Link>
          <Link
            href="/days/1"
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-brand-navy font-semibold hover:bg-gray-100 transition-colors"
          >
            Back to Day 1
          </Link>
        </div>
      </div>
    </div>
  );
}
