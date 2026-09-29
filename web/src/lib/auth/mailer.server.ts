/**
 * Outgoing email (server-only). Used for password-reset links.
 *
 * Production: set `RESEND_API_KEY` (free tier is plenty) and `MAIL_FROM`,
 * e.g. `Kamino <hello@yourdomain.com>` — see README "Email".
 * Local development: with no key set, the message is printed to the terminal so you
 * can click the link without any email account.
 */
export type Mail = { to: string; subject: string; text: string };

export async function sendMail(mail: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production")
      console.error("[mail] RESEND_API_KEY / MAIL_FROM are not set; email was NOT sent.");
    else console.log(`\n[mail] To: ${mail.to}\n[mail] Subject: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) console.error(`[mail] Resend rejected the message (${response.status}).`);
}
