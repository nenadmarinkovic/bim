import { emailConfigured, escapeHtml, sendEmail } from "@/lib/brevo";
import { clientKey, retryAfter } from "@/lib/places/rate-limit";

const MAX_PER_WINDOW = 5;

const MAX_EMAIL = 200;
const MAX_MESSAGE = 2000;
const MIN_MESSAGE = 10;

const clean = (value: unknown, max: number) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

const cleanMessage = (value: unknown) =>
  typeof value === "string"
    ? value
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, MAX_MESSAGE)
    : "";

const looksLikeEmail = (value: string) =>
  /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(value);

export type ContactMessage = {
  email: string;
  message: string;
  locale: string;
  receivedAt: string;
};

export async function POST(request: Request) {
  const wait = retryAfter("contact", clientKey(request), MAX_PER_WINDOW);
  if (wait) {
    return Response.json(
      { error: "rate", retryAfter: wait },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "body" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;

  if (clean(body.website, 200)) {
    return Response.json({ ok: true });
  }

  const contact: ContactMessage = {
    email: clean(body.email, MAX_EMAIL),
    message: cleanMessage(body.message),
    locale: clean(body.locale, 8).toLowerCase() || "en",
    receivedAt: new Date().toISOString(),
  };

  if (!looksLikeEmail(contact.email)) {
    return Response.json({ error: "email" }, { status: 400 });
  }
  if (contact.message.length < MIN_MESSAGE) {
    return Response.json({ error: "message" }, { status: 400 });
  }

  if (!emailConfigured()) {
    console.info(
      `[contact] email not configured — message not sent (${contact.locale}, ${contact.message.length} chars)`,
    );
    return Response.json({ error: "unconfigured" }, { status: 503 });
  }

  const sent = await sendEmail({
    to: [{ email: process.env.CONTACT_RECIPIENT_EMAIL!.trim() }],
    replyTo: { email: contact.email },
    subject: `Bim contact: ${contact.email}`,
    text: `${contact.message}\n\n—\nFrom: ${contact.email}\nLocale: ${contact.locale}\nReceived: ${contact.receivedAt}`,
    html: `<p style="white-space:pre-wrap">${escapeHtml(contact.message)}</p>
<hr />
<p>From: <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a><br />Locale: ${escapeHtml(contact.locale)}<br />Received: ${escapeHtml(contact.receivedAt)}</p>`,
  });

  if (!sent) {
    return Response.json({ error: "send" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
