import { describe, expect, it } from 'vitest';
import { parseKeys, verifySignature } from '../src/signature';

// Produced by pkg/actions.ComputeSignatureHeader(time.Unix(1792100000, 0), payload, "test-signing-key").
const payload = '{"contextInfo":{"eventType":"user.human.phone.code.added","recipientPhoneNumber":"+15551234567"},"templateData":{"text":"Code 123456"}}';
const header = 't=1792100000,v1=afbcbf7ae5c7c5919380e2a605debd859b563a46bda83ea73f2280185f926bf7';
const signedAt = 1792100000 * 1000;

describe('verifySignature', () => {
  it('accepts a header computed by ZITADEL', async () => {
    expect(await verifySignature(payload, header, ['test-signing-key'], signedAt + 60_000)).toBe(true);
  });
  it('accepts any of the configured keys while rotating', async () => {
    expect(await verifySignature(payload, header, ['new-key', 'test-signing-key'], signedAt)).toBe(true);
  });
  it.each([
    ['wrong key', payload, header, ['other-key'], signedAt],
    ['changed body', payload.replace('123456', '654321'), header, ['test-signing-key'], signedAt],
    ['too old', payload, header, ['test-signing-key'], signedAt + 301_000],
    ['from the future', payload, header, ['test-signing-key'], signedAt - 301_000],
    ['missing header', payload, null, ['test-signing-key'], signedAt],
    ['no keys', payload, header, [], signedAt],
    ['no v1', payload, 't=1792100000', ['test-signing-key'], signedAt],
    ['malformed', payload, 't=1792100000,v1', ['test-signing-key'], signedAt],
  ])('rejects %s', async (_, body, value, keys, now) => {
    expect(await verifySignature(body, value, keys as string[], now)).toBe(false);
  });
});

describe('parseKeys', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseKeys(' a, b ,,')).toEqual(['a', 'b']);
    expect(parseKeys(undefined)).toEqual([]);
  });
});
