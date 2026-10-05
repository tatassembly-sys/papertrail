import TokenActionForm from "@/components/TokenActionForm";

export default function UnsubscribePage() {
  return (
    <TokenActionForm
      kicker="Newsletter"
      title="Unsubscribe"
      blurb="Confirm you want to leave the weekly digest. Prefetched email links will not unsubscribe you on their own."
      tokenLabel="Unsubscribe token"
      submitLabel="Unsubscribe"
      endpoint="/api/newsletter/unsubscribe"
      successPath="/newsletter?unsubscribed=1"
      backHref="/newsletter"
      backLabel="← Back to newsletter"
      errorFallback="Could not unsubscribe."
    />
  );
}
