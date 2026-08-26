"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type AuthState = { user: boolean; admin: boolean };

export default function NavAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setAuth({ user: Boolean(d?.user), admin: Boolean(d?.admin) });
        }
      })
      .catch(() => {
        if (!cancelled) setAuth({ user: false, admin: false });
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function signOut() {
    await Promise.all([
      fetch("/api/auth/user-logout", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {}),
      fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {}),
    ]);
    setAuth({ user: false, admin: false });
    router.push("/");
    router.refresh();
  }

  if (auth === null) {
    return <span className="inline-block min-w-14" aria-hidden />;
  }

  if (auth.user || auth.admin) {
    return (
      <span className="inline-flex items-center gap-3">
        {auth.admin ? (
          <Link href="/admin" className="hover:text-redpen">
            Admin
          </Link>
        ) : null}
        <button type="button" onClick={signOut} className="hover:text-redpen">
          Sign out
        </button>
      </span>
    );
  }

  return (
    <Link href="/user-login" className="hover:text-redpen">
      Sign in
    </Link>
  );
}
