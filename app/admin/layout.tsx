import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

/**
 * Admin chrome only — session already verified by middleware.
 * Keeps SignOut out of the public root layout (avoids cookies() on every page).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4 font-mono text-xs uppercase tracking-wide text-ink-soft">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/admin" className="hover:text-redpen">
            Dashboard
          </Link>
          <Link href="/admin/submissions" className="hover:text-redpen">
            Submissions
          </Link>
          <Link href="/admin/manual-input" className="hover:text-redpen">
            Manual input
          </Link>
          <Link href="/admin/status" className="hover:text-redpen">
            Status
          </Link>
        </div>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
