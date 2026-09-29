import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Paper Trail</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">
            Academic papers, translated into plain language. Every entry links to
            the source and names what the study cannot claim.
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wide text-ink-soft"
        >
          <Link href="/about" className="hover:text-redpen">
            About
          </Link>
          <Link href="/today" className="hover:text-redpen">
            Today
          </Link>
          <Link href="/topics" className="hover:text-redpen">
            Topics
          </Link>
          <Link href="/authors" className="hover:text-redpen">
            Authors
          </Link>
          <Link href="/library" className="hover:text-redpen">
            Library
          </Link>
          <Link href="/pricing" className="hover:text-redpen">
            Pro
          </Link>
          <Link href="/newsletter" className="hover:text-redpen">
            Newsletter
          </Link>
          <Link href="/submit" className="hover:text-redpen">
            Suggest
          </Link>
          <a href="/feed.xml" className="hover:text-redpen">
            RSS
          </a>
          <Link href="/privacy" className="hover:text-redpen">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-redpen">
            Terms
          </Link>
          <Link href="/login" className="hover:text-redpen">
            Staff
          </Link>
        </nav>
      </div>
      <p className="mx-auto max-w-4xl px-4 pb-8 font-mono text-[10px] uppercase tracking-wide text-stamp sm:px-6">
        © {new Date().getFullYear()} Paper Trail. Editorial notes, not advice.
      </p>
    </footer>
  );
}
