import Link from "next/link";
import NavMenu from "./NavMenu";
import SearchHotkey from "./SearchHotkey";

export default function Navbar() {
  return (
    <header className="relative border-b border-rule bg-paper">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Paper Trail
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-stamp sm:inline">
            research, translated
          </span>
        </Link>
        <div className="font-mono text-xs font-medium uppercase tracking-wide text-ink-soft">
          <SearchHotkey />
          <NavMenu />
        </div>
      </nav>
    </header>
  );
}
