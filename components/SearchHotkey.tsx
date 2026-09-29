"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Linear-style: `/` focuses search, or jumps home to the search box. */
export default function SearchHotkey() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) {
        return;
      }
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>("[data-search-input]");
      if (input) {
        input.focus();
        input.select();
        return;
      }
      router.push("/#search");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
