"use client";

import { useState } from "react";
import Link from "next/link";
import NavAuth from "./NavAuth";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/today", label: "Today" },
  { href: "/topics", label: "Topics" },
  { href: "/library", label: "Library" },
  { href: "/pricing", label: "Pro" },
  { href: "/account", label: "Account" },
] as const;

export default function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-rule bg-surface font-mono text-xs uppercase tracking-wide text-ink sm:hidden"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Menu"}
      </button>

      <div
        id="site-nav"
        className={`${
          open ? "flex" : "hidden"
        } absolute left-0 right-0 top-full z-30 flex-col gap-1 border-b border-rule bg-paper px-4 py-3 sm:static sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-5 sm:border-0 sm:bg-transparent sm:p-0`}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-11 items-center hover:text-redpen sm:min-h-0"
            onClick={() => setOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <NavAuth />
        <ThemeToggle />
      </div>
    </div>
  );
}
