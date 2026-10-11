import { sendGmail } from "./gmail";

/** Sends via Brevo when BREVO_API_KEY is set, otherwise via the Gmail API. Returns the provider used. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string }): Promise<string> {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set");

  if (process.env.BREVO_API_KEY) {
    const m = from.match(/^\s*(.*?)\s*<(.+)>\s*$/);
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: m ? m[2] : from, ...(m && m[1] ? { name: m[1].replace(/^"|"$/g, "") } : {}) },
        to: [{ email: opts.to }],
        subject: opts.subject,
        htmlContent: opts.html,
        textContent: opts.text,
      }),
    });
    if (!res.ok) throw new Error(`Brevo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return "brevo";
  }

  await sendGmail({ from, ...opts });
  return "gmail";
}
