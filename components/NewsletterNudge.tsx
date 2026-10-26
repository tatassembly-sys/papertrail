"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CTA_DISMISS_KEY,
  READ_KEY,
  parseSlugList,
  rememberRead,
  shouldShowNewsletterCta,
} from "@/lib/onboarding";

/** Counts distinct notes read on this device; from the 2nd, offers the newsletter (M9.2). */
export default function NewsletterNudge({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const read = rememberRead(parseSlugList(localStorage.getItem(READ_KEY)), slug);
      localStorage.setItem(READ_KEY, JSON.stringify(read));
      setShow(shouldShowNewsletterCta(read, localStorage.getItem(CTA_DISMISS_KEY) === "1"));
    } catch {
      /* storage blocked: no nudge */
    }
  }, [slug]);
  if (!show) return null;
  return (
    <aside className="mt-10 rounded-sm border border-rule bg-surface p-4 text-sm" aria-label="Newsletter">
      <p className="text-ink">
        Enjoying these notes? Get the week&apos;s best in one email.{" "}
        <Link href="/newsletter" className="text-redpen underline underline-offset-2">
          Join the weekly digest
        </Link>
      </p>
      <button
        type="button"
        className="mt-2 text-xs text-ink-soft underline"
        onClick={() => {
          try {
            localStorage.setItem(CTA_DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        No thanks
      </button>
    </aside>
  );
}
