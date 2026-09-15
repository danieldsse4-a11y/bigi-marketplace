// Thin wrapper around the Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
// No SDK dependency needed — Node 18+ has global fetch.
//
// If RESEND_API_KEY isn't set yet, emails are logged to the console instead
// of failing outright, so the whole flow (magic link, notification email)
// can still be exercised locally before Resend is configured.

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Bigi Admin <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  const recipients = Array.isArray(to) ? to : [to];

  if (!RESEND_API_KEY) {
    console.log('\n──────── [DEV] RESEND_API_KEY not set — email NOT actually sent ────────');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    console.log('──────────────────────────────────────────────────────────────────────\n');
    return { ok: true, dev: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: recipients, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend send failed (${res.status}): ${body}`);
  }

  return { ok: true };
}

module.exports = { sendEmail };
