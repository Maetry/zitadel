import { renderEmail } from './email/render';
import { log, maskRecipient } from './log';
import { parseNotification, type Channel } from './payload';
import { parseKeys, SIGNATURE_HEADER, verifySignature } from './signature';
import { idempotencyKey, sendEmail, sendSms, type SendResult } from './telnyx';

const ROUTES: Record<string, Channel> = {
  '/zitadel/email': 'email',
  '/zitadel/sms': 'sms',
};

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

// A non-2xx makes ZITADEL retry. In its default (legacy) notification mode a failing
// event also holds back every later notification until it gives up, so only transient
// failures are reported; a rejection (bad number, suppressed address) is logged and
// acknowledged, a retry would be rejected again.
const isTransient = (result: Extract<SendResult, { ok: false }>) =>
  result.status === 0 || result.status === 429 || result.status >= 500;

export default {
  async fetch(request, env): Promise<Response> {
    const channel = ROUTES[new URL(request.url).pathname];
    if (!channel) return json(404, { error: 'not_found' });
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const body = await request.text();
    const keys = parseKeys(channel === 'email' ? env.ZITADEL_EMAIL_SIGNING_KEYS : env.ZITADEL_SMS_SIGNING_KEYS);
    if (!(await verifySignature(body, request.headers.get(SIGNATURE_HEADER), keys))) {
      log('warn', { event: 'signature_rejected', channel });
      return json(401, { error: 'invalid_signature' });
    }

    const notification = parseNotification(body, channel);
    if (!notification) {
      log('warn', { event: 'payload_rejected', channel });
      return json(400, { error: 'invalid_payload' });
    }
    if (!env.TELNYX_API_KEY) {
      log('error', { event: 'telnyx_not_configured', channel });
      return json(500, { error: 'not_configured' });
    }

    const { eventType, providerId, recipient, templateData } = notification;
    let result: SendResult;
    if (channel === 'sms') {
      const text = templateData.text?.trim();
      if (!text) return json(400, { error: 'empty_message' });
      result = await sendSms(env.TELNYX_API_KEY, env.SMS_FROM, recipient, text);
    } else {
      result = await sendEmail(env.TELNYX_API_KEY, {
        from: env.EMAIL_FROM,
        fromName: env.EMAIL_FROM_NAME,
        replyTo: env.EMAIL_REPLY_TO,
        to: recipient,
        tags: ['zitadel', eventType.replace(/[^\w.-]/g, '_').slice(0, 64)],
        idempotencyKey: await idempotencyKey(body),
      }, renderEmail(templateData));
    }

    const fields = { channel, eventType, providerId, recipient: maskRecipient(recipient) };
    if (result.ok) {
      log('info', { event: 'sent', ...fields, telnyxId: result.id });
      return json(200, { id: result.id });
    }
    const transient = isTransient(result);
    log('error', { event: transient ? 'telnyx_unavailable' : 'telnyx_rejected', ...fields, telnyxStatus: result.status, telnyxCode: result.code });
    return transient
      ? json(503, { error: 'telnyx_unavailable', code: result.code })
      : json(200, { error: 'telnyx_rejected', code: result.code });
  },
} satisfies ExportedHandler<Env>;
