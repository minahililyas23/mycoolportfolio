/**
 * Hand-authored, dependency-free contact endpoint.
 * This module uses standard Web APIs and Cloudflare's native D1 binding only.
 * It stores submissions; it does not send email.
 */

const MAX_BODY_BYTES = 32_768;
const SUBJECTS = new Set(['placement', 'collaboration', 'general']);
const RATE_WINDOW_SECONDS = 600;
const RATE_LIMIT = 5;

function reply(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

/** Validate values again on the server; browser validation is not trusted. */
export function validateContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: {}, error: 'Please submit the contact form as a JSON object.' };
  }

  const errors = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  const organisation = typeof input.organisation === 'string' ? input.organisation.trim() : '';
  const subject = typeof input.subject === 'string' ? input.subject : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name)) {
    errors.name = 'Please enter your name using 2–100 characters.';
  }
  if (email.length > 254 || !/^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/u.test(email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if ((input.organisation !== undefined && typeof input.organisation !== 'string') || organisation.length > 160 || /[\u0000-\u001f\u007f]/u.test(organisation)) {
    errors.organisation = 'Please use no more than 160 characters for your organisation.';
  }
  if (!SUBJECTS.has(subject)) {
    errors.subject = 'Please choose what you would like to discuss.';
  }
  if (message.length < 10 || message.length > 5000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)) {
    errors.message = 'Please write a message using 10–5,000 characters.';
  }
  if (input.consent !== true) {
    errors.consent = 'Please agree to your details being stored so this enquiry can be answered.';
  }
  if (input.website !== undefined && (typeof input.website !== 'string' || input.website.trim() !== '')) {
    return { ok: false, errors: {}, error: 'This submission could not be accepted. Please use the contact form.' };
  }
  if (Object.keys(errors).length) {
    return { ok: false, errors, error: 'Please check the highlighted fields and try again.' };
  }
  return { ok: true, data: { name, email, organisation, subject, message, consent: true } };
}

/** Enforce the byte limit while streaming, even without Content-Length. */
async function readJson(request) {
  const statedLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(statedLength) && statedLength > MAX_BODY_BYTES) {
    return { status: 413, error: 'Your message is too large. Please keep it within 5,000 characters.' };
  }
  if (!request.body) {
    return { status: 400, error: 'The contact form was empty. Please complete it and try again.' };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let byteCount = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > MAX_BODY_BYTES) {
        await reader.cancel();
        return { status: 413, error: 'Your message is too large. Please keep it within 5,000 characters.' };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { data: JSON.parse(text) };
  } catch {
    return { status: 400, error: 'The form data could not be read. Please try again.' };
  } finally {
    reader.releaseLock();
  }
}

async function takeRateLimitSlot(db, request) {
  const ip = request.headers.get('CF-Connecting-IP');
  // Local development and hosts that do not supply a trusted client IP skip this.
  if (!ip) return { allowed: true };

  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / RATE_WINDOW_SECONDS);
  const expiresAt = (window + 1) * RATE_WINDOW_SECONDS;
  const bytes = new TextEncoder().encode(`${window}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

  // Clean a bounded number of expired counters; neither raw IP nor its digest
  // is attached to a contact message. Counters expire after a ten-minute window.
  await db.prepare(
    'DELETE FROM contact_rate_limits WHERE key IN (SELECT key FROM contact_rate_limits WHERE expires_at <= ? LIMIT 200)'
  ).bind(now).run();
  const result = await db.prepare(
    'INSERT INTO contact_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts'
  ).bind(key, expiresAt).first();

  return { allowed: Number(result?.attempts) <= RATE_LIMIT, retryAfter: Math.max(1, expiresAt - now) };
}

/**
 * POST JSON: {name,email,organisation?,subject,message,consent:true,website?:''}
 * Success is returned only after D1 confirms the insert.
 */
export async function handleContact(request, env) {
  if (request.method !== 'POST') {
    return reply(405, { ok: false, error: 'Please use the contact form to submit a message.' }, { Allow: 'POST' });
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return reply(403, { ok: false, error: 'Please submit your message from this website.' });
  }
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return reply(403, { ok: false, error: 'Please submit your message from this website.' });
  }
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return reply(415, { ok: false, error: 'The contact form must submit JSON data.' });
  }

  const parsed = await readJson(request);
  if (parsed.error) return reply(parsed.status, { ok: false, error: parsed.error });

  const validated = validateContact(parsed.data);
  if (!validated.ok) {
    return reply(422, { ok: false, error: validated.error, errors: validated.errors });
  }
  if (!env?.DB) {
    return reply(503, { ok: false, error: 'The contact service is temporarily unavailable. Your message has not been submitted. Please try again later.' });
  }

  try {
    const rate = await takeRateLimitSlot(env.DB, request);
    if (!rate.allowed) {
      return reply(429, { ok: false, error: 'Several messages have been submitted recently. Please wait a few minutes before trying again.' }, { 'Retry-After': String(rate.retryAfter) });
    }

    const { name, email, organisation, subject, message } = validated.data;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const result = await env.DB.prepare(
      'INSERT INTO contact_messages (id, name, email, organisation, subject, message, consent, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).bind(id, name, email, organisation, subject, message, createdAt).run();

    if (result.success !== true) throw new Error('Contact insert failed');
    return reply(201, { ok: true, id });
  } catch {
    // Do not expose database diagnostics, submitted text, or contact details.
    return reply(503, { ok: false, error: 'Your message could not be submitted. Your text is still here—please try again.' });
  }
}
