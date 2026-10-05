import TokenActionForm from "@/components/TokenActionForm";

export default function VerifyEmailPage() {
  return (
    <TokenActionForm
      kicker="Account"
      title="Verify your email"
      blurb="Confirm this is your address. Mail apps that prefetch links cannot verify you automatically — click the button below."
      tokenLabel="Verification token"
      submitLabel="Verify email"
      endpoint="/api/auth/verify-email"
      successPath="/account?verified=1"
      backHref="/account"
      backLabel="← Back to account"
      errorFallback="Could not verify email."
    />
  );
}
