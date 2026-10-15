import type { RenderedEmail } from './email/render';

const API = 'https://api.telnyx.com/v2';
// ZITADEL gives up on the provider call after 5s and retries the notification.
const TIMEOUT_MS = 4000;

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; status: number; code: string };

async function post(path: string, apiKey: string, body: unknown, headers: Record<string, string> = {}): Promise<SendResult> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, status: 0, code: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  const json = await response.json().catch(() => null) as
    { data?: { id?: string }; errors?: { code?: string }[] } | null;
  if (response.ok) return { ok: true, id: json?.data?.id ?? null };
  return { ok: false, status: response.status, code: String(json?.errors?.[0]?.code ?? 'unknown') };
}

export function sendSms(apiKey: string, from: string, to: string, text: string): Promise<SendResult> {
  // Delivery receipts are not consumed, so the profile's webhooks are skipped.
  return post('/messages', apiKey, { from, to, text, use_profile_webhooks: false });
}

export interface EmailEnvelope {
  from: string;
  fromName: string;
  replyTo: string;
  to: string;
  tags: string[];
  idempotencyKey: string;
}

export function sendEmail(apiKey: string, envelope: EmailEnvelope, email: RenderedEmail): Promise<SendResult> {
  return post('/email_messages', apiKey, {
    from: { email: envelope.from, name: envelope.fromName },
    to: [envelope.to],
    ...(envelope.replyTo ? { reply_to: envelope.replyTo } : {}),
    subject: email.subject,
    html_body: email.html,
    text_body: email.text,
    tags: envelope.tags,
  }, { 'Idempotency-Key': envelope.idempotencyKey });
}

// ZITADEL retries a failed call with the same body, so a key derived from the body
// lets Telnyx (24h retention) drop the duplicate of an email that was already accepted.
export async function idempotencyKey(body: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
