import { redirect } from "next/navigation";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getUserPublic } from "@/lib/users";
import { getPublishedTagCounts } from "@/lib/articles";
import WelcomeTopics from "@/components/WelcomeTopics";

export const dynamic = "force-dynamic";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const session = await getCurrentUserSession();
  if (!session) redirect("/register");
  const sp = await searchParams;
  const user = await getUserPublic(session.userId);
  const tags = await getPublishedTagCounts(24).catch(() => []);
  const suggested = tags.map((t) => t.tag);
  const verifyNote =
    sp.verify === "sent"
      ? "Check your inbox for a verification link."
      : sp.verify === "pending"
        ? "Your account is ready. Verification email is not being delivered yet, so you can keep using the site."
        : null;

  return (
    <article className="mx-auto max-w-xl">
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Onboarding
      </p>
      <h1 className="font-display text-3xl font-medium text-ink">
        What should we file for you?
      </h1>
      {verifyNote && <p className="mt-3 text-sm font-medium text-redpen">{verifyNote}</p>}
      <p className="mt-3 text-base leading-relaxed text-ink-soft">
        Substack and Medium ask this first so the homepage isn&apos;t a dump of
        everything. Pick a few fields — we&apos;ll put them on Home as{" "}
        <em>For you</em>.
      </p>
      <WelcomeTopics suggested={suggested} initial={user?.followed_topics || []} />
    </article>
  );
}
