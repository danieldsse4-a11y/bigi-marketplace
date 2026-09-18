// Thin wrapper around the Resend REST API (https://resend.com/docs/api-reference/emails/send-email).
// No SDK dependency needed — Node 18+ has global fetch.
//
// If RESEND_API_KEY isn't set yet, emails are logged to the console instead
// of failing outright, so the whole flow (magic link, notification email)
// can still be exercised locally before Resend is configured.

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const TEST_SENDER = 'onboarding@resend.dev';
const EMAIL_FROM = process.env.EMAIL_FROM || `Bigi Admin <${TEST_SENDER}>`;

const displayName = (from) => (from.match(/^\s*([^<]+?)\s*</) || [null, ''])[1];

function post(from, recipients, subject, html) {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: recipients, subject, html }),
  });
}

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

  const res = await post(EMAIL_FROM, recipients, subject, html);
  if (res.ok) return { ok: true };

  const body = await res.text().catch(() => '');

  // A sender on a domain Resend can't verify (someone puts their gmail address
  // in EMAIL_FROM) otherwise kills every email the site sends. Rather than lose
  // the message, send it from Resend's own address, keeping the display name.
  // It is logged loudly, and the admin "מיילים" page reports the real setting.
  const senderRejected = res.status === 403 && /not verified/i.test(body);
  if (senderRejected && !EMAIL_FROM.includes(TEST_SENDER)) {
    const from = `${displayName(EMAIL_FROM) || 'ביגי ספקים'} <${TEST_SENDER}>`;
    console.warn(`⚠️  EMAIL_FROM (${EMAIL_FROM}) was refused by Resend: ${body}\n    Sending from ${from} instead — set EMAIL_FROM to an address on a domain verified in Resend.`);
    const retry = await post(from, recipients, subject, html);
    if (retry.ok) return { ok: true, fellBack: true };
    throw new Error(`Resend send failed (${retry.status}): ${await retry.text().catch(() => '')}`);
  }

  throw new Error(`Resend send failed (${res.status}): ${body}`);
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
