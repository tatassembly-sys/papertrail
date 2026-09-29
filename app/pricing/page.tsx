import type { Metadata } from "next";
import Link from "next/link";
import CheckoutButtons from "@/components/CheckoutButtons";
import LabInquiryForm from "@/components/LabInquiryForm";
import { billingPublicConfig } from "@/lib/entitlements";
import { getCurrentUserSession } from "@/lib/user-auth";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Paper Trail is free to read. Pro unlocks unlimited paper chat, markdown export, and priority requests.",
};

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    name: "Read every published note",
    free: "Yes",
    pro: "Yes",
  },
  {
    name: "Ask the paper (AI chat)",
    free: "5 questions / day",
    pro: "Unlimited",
  },
  {
    name: "Saved papers & bookmarks",
    free: "20 each",
    pro: "Unlimited",
  },
  {
    name: "Suggest a paper",
    free: "3 / week",
    pro: "Priority queue",
  },
  {
    name: "Markdown export of a note",
    free: "—",
    pro: "Yes",
  },
  {
    name: "Followed topics",
    free: "8",
    pro: "40",
  },
  {
    name: "Reading lists",
    free: "1 list",
    pro: "Unlimited",
  },
  {
    name: "Highlights & notes",
    free: "15",
    pro: "Unlimited",
  },
  {
    name: "Cite (APA, MLA, Chicago, BibTeX)",
    free: "Yes",
    pro: "Yes",
  },
];

export default async function PricingPage() {
  const billing = billingPublicConfig();
  const session = await getCurrentUserSession();
  const site = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Paper Trail Pro",
    description:
      "Unlimited paper chat, markdown export, and priority translation requests.",
    brand: { "@type": "Brand", name: "Paper Trail" },
    url: `${site}/pricing`,
    offers: [
      {
        "@type": "Offer",
        price: String(billing.monthly.amount),
        priceCurrency: billing.currency,
        availability: "https://schema.org/InStock",
        url: `${site}/pricing`,
        name: "Monthly",
      },
      {
        "@type": "Offer",
        price: String(billing.yearly.amount),
        priceCurrency: billing.currency,
        availability: "https://schema.org/InStock",
        url: `${site}/pricing`,
        name: "Yearly",
      },
    ],
  };

  return (
    <article className="mx-auto max-w-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-stamp">
        Pricing
      </p>
      <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
        Reading stays free. Tools are the product.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-ink-soft">
        Every published translation remains public — source link, caveats, and
        all. Pro pays for the expensive parts: unlimited questions about a
        paper, a real library, export, and a place in the editor queue.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="pt-card p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-stamp">
            Free
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-ink">£0</p>
          <p className="mt-1 text-sm text-ink-soft">
            For curious readers. No card.
          </p>
          <Link href="/register" className="pt-btn-ghost mt-6 w-full">
            Create a free account
          </Link>
        </section>
        <section className="border border-ink bg-surface p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-redpen">
            Pro
          </p>
          <p className="mt-2 font-display text-3xl font-medium text-ink">
            {billing.monthly.label}
            <span className="text-base font-sans font-normal text-ink-soft">
              /month
            </span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            or {billing.yearly.label}/year (two months free). Cancel anytime.
          </p>
          <CheckoutButtons
            configured={billing.configured}
            monthlyLabel={billing.monthly.label}
            yearlyLabel={billing.yearly.label}
            signedIn={Boolean(session)}
          />
        </section>
      </div>

      <table className="mt-10 w-full text-left text-sm">
        <caption className="sr-only">Free vs Pro features</caption>
        <thead>
          <tr className="border-b border-rule font-mono text-xs uppercase tracking-wide text-stamp">
            <th className="py-2 pr-3 font-medium">Included</th>
            <th className="py-2 pr-3 font-medium">Free</th>
            <th className="py-2 font-medium">Pro</th>
          </tr>
        </thead>
        <tbody>
          {FEATURES.map((row) => (
            <tr key={row.name} className="border-b border-rule/70">
              <th className="py-3 pr-3 font-medium text-ink">{row.name}</th>
              <td className="py-3 pr-3 text-ink-soft">{row.free}</td>
              <td className="py-3 text-ink">{row.pro}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-12 border-t border-rule pt-8">
        <h2 className="font-display text-2xl font-medium text-ink">
          Labs and universities
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Shared seats, a named invoice, and a queue for the papers your group
          actually needs translated. Tell us the size of the lab — we&apos;ll
          quote, not auto-charge.
        </p>
        <LabInquiryForm />
      </section>

      <p className="mt-10 text-sm text-ink-soft">
        Paid plans are billed by Stripe. See{" "}
        <Link href="/terms" className="text-redpen hover:underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-redpen hover:underline">
          privacy
        </Link>
        . Editorial notes are not advice.
      </p>
    </article>
  );
}
