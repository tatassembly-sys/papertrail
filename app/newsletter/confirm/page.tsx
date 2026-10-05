import TokenActionForm from "@/components/TokenActionForm";

export default function NewsletterConfirmPage() {
  return (
    <TokenActionForm
      kicker="Newsletter"
      title="Confirm subscription"
      blurb="Click below to join the weekly digest. Prefetched email links cannot subscribe you on their own."
      tokenLabel="Confirmation token"
      submitLabel="Confirm subscription"
      endpoint="/api/newsletter/verify"
      successPath="/newsletter?confirmed=1"
      backHref="/newsletter"
      backLabel="← Back to newsletter"
      errorFallback="Could not confirm subscription."
    />
  );
}
