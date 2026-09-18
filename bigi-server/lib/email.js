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

// What the admin area shows about email delivery. The API key itself is never
// returned — only whether one is set, and what Resend says about the account.
async function emailStatus() {
  const fromAddress = (EMAIL_FROM.match(/<([^>]+)>/) || [null, EMAIL_FROM])[1].trim().toLowerCase();
  const fromDomain = fromAddress.split('@')[1] || '';
  const status = {
    keySet: Boolean(RESEND_API_KEY),
    from: EMAIL_FROM,
    fromAddress,
    fromDomain,
    isTestSender: fromDomain === 'resend.dev',
    domains: null,
    error: null,
  };
  if (!RESEND_API_KEY) return status;

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      status.error = `Resend ${res.status}: ${body.message || 'unknown error'}`;
      return status;
    }
    status.domains = (body.data || []).map((d) => ({ name: d.name, status: d.status }));
  } catch (err) {
    status.error = err.message;
  }
  return status;
}

module.exports = { sendEmail, emailStatus };
