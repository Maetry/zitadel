import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;
const telnyx = vi.fn<typeof fetch>();

async function sign(body: string, key: string, at = Math.floor(Date.now() / 1000)): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${at}.${body}`)));
  return `t=${at},v1=${[...mac].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function call(path: string, body: string, key: string | null, method = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key) headers['ZITADEL-Signature'] = await sign(body, key);
  return worker.fetch(new IncomingRequest(`https://notify.maetry.com${path}`, {
    method, headers, body: method === 'POST' ? body : undefined,
  }), env);
}

const smsBody = JSON.stringify({
  contextInfo: { eventType: 'user.human.otp.sms.code.added', recipientPhoneNumber: '+15551234567', provider: { id: 'sms-1' } },
  templateData: { text: '123456 is your OTP for auth.maetry.com.' },
  args: { otp: '123456' },
});
const emailBody = JSON.stringify({
  contextInfo: { eventType: 'user.human.password.code.added', recipientEmailAddress: 'ada@example.com', provider: { id: 'email-1' } },
  templateData: { subject: 'Reset password', text: 'Code ABC', url: 'https://auth.maetry.com/reset', buttonText: 'Reset' },
  args: { code: 'ABC' },
});

beforeEach(() => {
  telnyx.mockReset();
  telnyx.mockRejectedValue(new Error('Unexpected outbound request'));
  vi.stubGlobal('fetch', telnyx);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('zitadel-notifier', () => {
  it.each(['+12025550100', '+12025550150', '+12025550199', '+1 (202) 555-0100', '12025550199'])('skips fictional SMS recipient %s', async recipient => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const body = smsBody.replace('+15551234567', recipient);
    const response = await call('/zitadel/sms', body, 'sms-new');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skipped: true, reason: 'fictional_number' });
    expect(telnyx).not.toHaveBeenCalled();
    expect(JSON.parse(logged.mock.calls[0][0] as string)).toMatchObject({ event: 'sms_skipped', reason: 'fictional_number' });
    expect(JSON.stringify(logged.mock.calls)).not.toContain('123456');
  });

  it.each(['+12025550099', '+12025550200', '+12035550100', '+120255501000'])('does not suppress numbers outside the range: %s', async recipient => {
    telnyx.mockResolvedValue(Response.json({ data: { id: 'msg-1' } }));
    expect((await call('/zitadel/sms', smsBody.replace('+15551234567', recipient), 'sms-new')).status).toBe(200);
    expect(telnyx).toHaveBeenCalledOnce();
  });

  it('requires a valid signature even for fictional numbers', async () => {
    expect((await call('/zitadel/sms', smsBody.replace('+15551234567', '+12025550100'), null)).status).toBe(401);
    expect(telnyx).not.toHaveBeenCalled();
  });

  it('sends an SMS through Telnyx', async () => {
    telnyx.mockResolvedValue(Response.json({ data: { id: 'msg-1' } }));
    const response = await call('/zitadel/sms', smsBody, 'sms-old');
    expect(response.status).toBe(200);
    const [url, init] = telnyx.mock.calls[0];
    expect(url).toBe('https://api.telnyx.com/v2/messages');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-telnyx-key');
    expect(JSON.parse(init?.body as string)).toEqual({
      from: '+18772623879', to: '+15551234567', text: '123456 is your OTP for auth.maetry.com.', use_profile_webhooks: false,
    });
  });

  it('sends an email with a stable idempotency key', async () => {
    telnyx.mockResolvedValue(Response.json({ data: { id: 'email-1' } }, { status: 202 }));
    expect((await call('/zitadel/email', emailBody, 'email-key')).status).toBe(200);
    expect((await call('/zitadel/email', emailBody, 'email-key')).status).toBe(200);
    const [url, init] = telnyx.mock.calls[0];
    expect(url).toBe('https://api.telnyx.com/v2/email_messages');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      from: { email: 'no-reply@mail.maetry.com', name: 'Maetry' },
      to: ['ada@example.com'],
      reply_to: 'support@maetry.com',
      subject: 'Reset password',
      tags: ['zitadel', 'user.human.password.code.added'],
    });
    expect(body.html_body).toContain('href="https://auth.maetry.com/reset"');
    const key = new Headers(init?.headers).get('Idempotency-Key');
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Headers(telnyx.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe(key);
  });

  it.each([
    ['unsigned', '/zitadel/sms', smsBody, null, 401],
    ['signed with the other channel key', '/zitadel/sms', smsBody, 'email-key', 401],
    ['missing recipient', '/zitadel/email', JSON.stringify({ contextInfo: {} }), 'email-key', 400],
    ['not JSON', '/zitadel/email', 'nope', 'email-key', 400],
    ['empty SMS text', '/zitadel/sms', JSON.stringify({ contextInfo: { recipientPhoneNumber: '+1555' } }), 'sms-new', 400],
    ['unknown path', '/other', smsBody, 'sms-new', 404],
  ])('rejects %s', async (_, path, body, key, status) => {
    expect((await call(path, body, key)).status).toBe(status);
    expect(telnyx).not.toHaveBeenCalled();
  });

  it('rejects other methods', async () => {
    expect((await call('/zitadel/sms', '', null, 'GET')).status).toBe(405);
  });

  it.each([
    [Response.json({ errors: [{ code: '10011' }] }, { status: 429 }), 503],
    [new Response('down', { status: 503 }), 503],
  ])('asks ZITADEL to retry transient Telnyx failures', async (upstream, status) => {
    telnyx.mockResolvedValue(upstream);
    expect((await call('/zitadel/sms', smsBody, 'sms-new')).status).toBe(status);
  });

  it('acknowledges a Telnyx rejection so it does not block later notifications', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    telnyx.mockResolvedValue(Response.json({ errors: [{ code: '40310' }] }, { status: 400 }));
    const response = await call('/zitadel/sms', smsBody, 'sms-new');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ error: 'telnyx_rejected', code: '40310' });
    const logged = JSON.parse(error.mock.calls[0][0] as string);
    expect(logged).toMatchObject({ event: 'telnyx_rejected', recipient: '+1***4567', providerId: 'sms-1' });
    expect(JSON.stringify(logged)).not.toContain('123456');
  });

  it('maps a network error to 503', async () => {
    telnyx.mockRejectedValue(new TypeError('fetch failed'));
    expect((await call('/zitadel/email', emailBody, 'email-key')).status).toBe(503);
  });
});
