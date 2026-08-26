import { getSiteUrl } from "./site-url";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Sends email via Resend when RESEND_API_KEY is set; otherwise logs the payload
 * so local/Railway deploys still work without SMTP.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<{ ok: boolean; mode: "resend" | "log"; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.NEWSLETTER_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "Paper Trail <onboarding@resend.dev>";

  if (!resendKey) {
    const isProd = process.env.NODE_ENV === "production";
    console.log("[mail:log]", {
      to: input.to,
      subject: input.subject,
      from,
      site: getSiteUrl(),
      // Never print token-bearing HTML in production logs.
      ...(isProd ? { htmlPreview: "[redacted]" } : { htmlPreview: input.html.slice(0, 280) }),
    });
    return { ok: true, mode: "log" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[mail:resend] failed", res.status, err);
      return { ok: false, mode: "resend", error: err.slice(0, 300) };
    }

    return { ok: true, mode: "resend" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("[mail:resend] error", message);
    return { ok: false, mode: "resend", error: message };
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
