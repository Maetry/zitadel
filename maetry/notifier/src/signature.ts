// ZITADEL signs the HTTP provider payload like Actions v2 targets (pkg/actions/signing.go):
// `ZITADEL-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(key, "<t>.<body>")>`.
export const SIGNATURE_HEADER = 'ZITADEL-Signature';
const TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

export function parseKeys(value: string | undefined): string[] {
  return (value ?? '').split(',').map(key => key.trim()).filter(Boolean);
}

function parseHeader(header: string): { timestamp: number; signatures: Uint8Array[] } | null {
  let timestamp: number | null = null;
  const signatures: Uint8Array[] = [];
  for (const pair of header.split(',')) {
    const [name, value, extra] = pair.trim().split('=');
    if (value === undefined || extra !== undefined) return null;
    if (name === 't') {
      if (!/^\d+$/.test(value)) return null;
      timestamp = Number(value);
    } else if (name === 'v1' && /^([0-9a-f]{2})+$/i.test(value)) {
      signatures.push(Uint8Array.from(value.match(/../g)!, byte => parseInt(byte, 16)));
    }
  }
  return timestamp === null || signatures.length === 0 ? null : { timestamp, signatures };
}

export async function verifySignature(
  body: string, header: string | null, keys: string[], now = Date.now(),
): Promise<boolean> {
  if (!header || keys.length === 0) return false;
  const parsed = parseHeader(header);
  if (!parsed || Math.abs(now / 1000 - parsed.timestamp) > TOLERANCE_SECONDS) return false;
  const data = encoder.encode(`${parsed.timestamp}.${body}`);
  for (const key of keys) {
    const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    for (const signature of parsed.signatures) {
      // subtle.verify compares in constant time.
      if (await crypto.subtle.verify('HMAC', cryptoKey, signature, data)) return true;
    }
  }
  return false;
}
