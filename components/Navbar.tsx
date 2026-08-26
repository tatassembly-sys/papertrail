import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import NavAuth from "./NavAuth";

export default function Navbar() {
  return (
    <header className="border-b border-rule bg-paper">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Paper Trail
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-stamp sm:inline">
            research, translated
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-medium uppercase tracking-wide text-ink-soft sm:gap-5">
          <Link href="/" className="hover:text-redpen">
            Home
          </Link>
          <Link href="/submit" className="hover:text-redpen">
            Suggest
          </Link>
          <Link href="/newsletter" className="hover:text-redpen">
            Newsletter
          </Link>
          <Link href="/account" className="hover:text-redpen">
            Account
          </Link>
          <Link href="/about" className="hover:text-redpen">
            About
          </Link>
          <NavAuth />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
