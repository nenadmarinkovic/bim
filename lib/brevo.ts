const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10000;
const FALLBACK_SENDER_NAME = "Bim";

type Address = { email: string; name?: string };

export type Email = {
  to: Address[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: Address;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY?.trim() &&
      process.env.BREVO_SENDER_EMAIL?.trim() &&
      process.env.CONTACT_RECIPIENT_EMAIL?.trim(),
  );
}

export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!key || !senderEmail) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "api-key": key,
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: process.env.BREVO_SENDER_NAME?.trim() || FALLBACK_SENDER_NAME,
        },
        to: email.to,
        replyTo: email.replyTo,
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[brevo] ${response.status} ${detail.slice(0, 300)}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[brevo] send failed", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
