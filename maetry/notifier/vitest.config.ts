import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: { bindings: {
      TELNYX_API_KEY: 'test-telnyx-key',
      ZITADEL_EMAIL_SIGNING_KEYS: 'email-key',
      ZITADEL_SMS_SIGNING_KEYS: 'sms-new, sms-old',
      EMAIL_REPLY_TO: 'support@maetry.com',
    } },
  })],
});
