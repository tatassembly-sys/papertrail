"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function FollowTopic({
  topic,
  nextPath,
}: {
  topic: string;
  nextPath: string;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [cap, setCap] = useState<number | null>(8);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.user) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const list: string[] = d.user.followed_topics || [];
        setTopics(list);
        setFollowing(list.some((t) => t.toLowerCase() === topic.toLowerCase()));
        const limit = d.user.entitlements?.topics;
        setCap(typeof limit === "number" ? limit : null);
      })
      .catch(() => setSignedIn(false));
  }, [topic]);

  async function toggle() {
    if (!signedIn) return;
    setBusy(true);
    setMsg(null);
    const key = topic.toLowerCase();
    let next: string[];
    if (following) {
      next = topics.filter((t) => t.toLowerCase() !== key);
    } else {
      if (cap != null && topics.length >= cap) {
        setMsg(`Free accounts can follow ${cap} topics.`);
        setBusy(false);
        return;
      }
      next = [...topics, topic];
    }
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followed_topics: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error || "Could not update.");
      return;
    }
    const list: string[] = body.user?.followed_topics || next;
    setTopics(list);
    setFollowing(list.some((t) => t.toLowerCase() === key));
  }

  if (signedIn === false) {
    return (
      <p className="mt-3 text-sm text-ink-soft">
        <Link
          href={`/user-login?next=${encodeURIComponent(nextPath)}`}
          className="text-redpen hover:underline"
        >
          Sign in
        </Link>{" "}
        to follow this topic on Home and in the weekly digest.
      </p>
    );
  }

  if (signedIn === null) return null;

  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} disabled={busy} className="pt-btn-ghost">
        {busy ? "Saving…" : following ? "Following ✓" : "Follow this topic"}
      </button>
      {msg && (
        <p className="mt-2 text-sm text-ink-soft">
          {msg}{" "}
          {/follow/i.test(msg) && (
            <Link href="/pricing" className="text-redpen hover:underline">
              See Pro
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
