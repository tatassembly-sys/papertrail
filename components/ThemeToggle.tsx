"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("pt-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    setReady(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pt-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex min-h-11 items-center rounded-sm border border-rule bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft hover:border-ink hover:text-ink sm:min-h-0"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      suppressHydrationWarning
    >
      {ready ? (dark ? "Light" : "Dark") : "Theme"}
    </button>
  );
}
