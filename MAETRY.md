# Maetry fork of ZITADEL

Only `apps/login` (Login V2) is customized and deployed from this fork, plus our own
`maetry/notifier` Worker. The ZITADEL backend runs the official image; the login built
here must match its version.

## Branches and versions

- `main` mirrors upstream and is only updated with GitHub "Sync fork".
- `maetry` holds our changes, branched from the release tag used in production.
- Release tags: `<upstream tag>-maetry.<n>`, e.g. `v4.19.4-maetry.1`.

Remotes: `origin` = Maetry/zitadel, `upstream` = zitadel/zitadel (push disabled).

## Updating to a new ZITADEL release

```bash
git fetch upstream --tags
git switch maetry && git switch -c update/vX.Y.Z
git merge --no-ff vX.Y.Z      # merge only, never rebase or squash
```

Resolve conflicts using the list below, rebuild, test the login flows, merge into
`maetry`, tag, and deploy together with the ZITADEL backend image of the same version.

## Changes

Every change is marked with a `MAETRY:` comment in the source.

| File | Change | Why |
|---|---|---|
| `apps/login/src/lib/zitadel.ts` | `createConnectTransport` from `@connectrpc/connect-web` (fetch) instead of `connect-node`, with a `fetch` wrapper that sends `redirect: "manual"` | Cloudflare Workers have `fetch`, not Node's `http`, and reject connect-web's `redirect: "error"`; works on Node too |
| `apps/login/package.json` | `next` and `@next/eslint-plugin-next` 16.2.11 → 16.3.6 | `@opennextjs/cloudflare` supports Node middleware (`proxy.ts`) only with Next ≥ 16.3.x; upstream `main` is already on 16.3.6 |
| `apps/login/tsconfig.build.json`, `next.config.mjs` (`typescript.tsconfigPath`) | taken unchanged from upstream `main` | Next 16.3 type-checks test files during build |
| `apps/login/package.json` | `@connectrpc/connect-web`; dev: `@opennextjs/cloudflare` 1.20.7, `wrangler` | Workers build |
| `apps/login/src/instrumentation.ts` | skip `instrumentation.node` when `NEXT_PUBLIC_MAETRY_CLOUDFLARE=true` | OTEL NodeSDK cannot run on Workers; the flag lets the bundler drop it |
| `apps/login/next.config.mjs` | empty `serverExternalPackages` when `NEXT_PUBLIC_MAETRY_CLOUDFLARE=true` | OpenNext cannot resolve server externals from the pnpm layout |
| `apps/login/open-next.config.ts`, `wrangler.jsonc` | new | Workers build and deployment config |
| `patches/@opennextjs__cloudflare@1.20.7.patch` | always alias `@opentelemetry/api` to Next's compiled copy in the Node middleware bundle | under pnpm only the CJS build is traced; OpenNext skips its alias when the package is installed |
| `apps/login/.env.production` | new: `NEXT_PUBLIC_THEME_*` (roundness, layout, spacing, appearance, background) | Maetry theme; `next build` reads it, so a change needs a rebuild and redeploy. Colors, logo and font come from Branding in the Zitadel console, not from here |
| `apps/login/src/components/system-theme.tsx`, `src/app/(login)/layout.tsx` | new `SystemTheme` instead of `ThemeSwitch`; `LanguageSwitcher` (and the allowed-languages lookup it needed) removed | no light/dark or language switch: the login follows the system light/dark setting (a stored choice is reset, a mode forced in Branding still wins); the apps pass the language as `ui_locales` |
| `apps/login/wrangler.jsonc` | `ZITADEL_UI_LOCALES_OVERRIDE_COOKIE=true` | the apps pass the language as `ui_locales`, which wins over a language picked earlier |
| `apps/login/src/components/button.tsx`, `src/app/(login)/layout.tsx` | solid flat `#0071e3` primary actions, including glass appearance; `#f5f5f7` / black page background | Apple sign-in look; readable enabled buttons without hover; black background in dark mode |
| `apps/login/src/components/card.tsx` | glass card: white / `#1c1c1e` surface with Apple's two-layer shadow (a faint border in dark mode) instead of the translucent fill | Apple sign-in look; the same card as the Website invite pages |
| `apps/login/src/components/idps/sign-in-with-google.tsx` | `h-full w-full` on the logo SVG | WebKit (iOS Safari, ASWebAuthenticationSession) collapses a viewBox-only SVG in a flex box, so the Google logo was invisible |
| `apps/login/src/lib/maetry-name.ts`, `register-form.tsx`, `register-form-idp-incomplete.tsx`, `lib/zitadel.ts` (`addHumanUser`), `locales/{en,ru}.json` (`register.labels.name`, `register.required.name`) | one free-form Name field instead of first and last name; split into given/family name (one word fills both), kept as typed in `displayName` and `nickName` | users write whatever they want to be called; ZITADEL still requires both name parts; the Maetry API addresses users by `nickname` |

## Building for Cloudflare Workers

```bash
pnpm install --frozen-lockfile --filter "@zitadel/login..."
cd apps/login
NEXT_PUBLIC_BASE_PATH=/ui/v2/login NEXT_PUBLIC_MAETRY_CLOUDFLARE=true npx opennextjs-cloudflare build
```

Runtime configuration lives in `wrangler.jsonc`; the login client PAT is the Worker
secret `ZITADEL_SERVICE_USER_TOKEN`. The bundle is ~4.7 MB gzip, so it needs Workers Paid.

## Email and SMS: `maetry/notifier`

ZITADEL has no Telnyx provider, so its HTTP email and SMS providers post to the
`zitadel-notifier` Worker, which sends through the Telnyx API. Upstream code is not
touched. The Worker lives outside the pnpm workspace (own npm lockfile) so upstream
merges never conflict on it.

```
ZITADEL ── POST https://notify.maetry.com/zitadel/email ──┐  ZITADEL-Signature
        └─ POST https://notify.maetry.com/zitadel/sms ────┤  (HMAC-SHA256, 5 min)
                                                          ▼
              zitadel-notifier ── /v2/email_messages, /v2/messages ──▶ Telnyx
```

- **Texts** come from ZITADEL (Console → Default settings → Message Texts), already
  translated to the user's language. The Worker only lays out the email (HTML from
  `templateData`, colors and logo from Branding, everything escaped) and sends
  `templateData.text` as the SMS.
- **Retries**: a non-2xx answer makes ZITADEL retry. In its default notification mode
  (`Notifications.LegacyEnabled: true`) a failing event also holds back all later
  notifications until the projection gives up on it, so only transient failures
  (timeout, Telnyx 429/5xx) answer `503`. A Telnyx rejection (invalid number, suppressed
  address, sending policy) is logged as `telnyx_rejected` and answered `200`: a retry
  would be rejected again. Emails carry an `Idempotency-Key` derived from the body, so a
  retry of an accepted email is not delivered twice; SMS has no idempotency, a ZITADEL
  timeout after Telnyx accepted it can duplicate it.
- **Logs** carry the event type, provider id, Telnyx id and a masked recipient, never
  the text or the code.
- **Telnyx**: sender `no-reply@mail.maetry.com` (domain `mail.maetry.com`, DKIM
  `telnyx1`, SPF, DMARC), SMS from the verified toll-free `+1 877 262 3879`
  (Maetry SMS Profile). Open/click tracking and one-click unsubscribe stay off: links
  carry codes, and an unsubscribe would suppress password resets and OTPs.

Configuration is in `maetry/notifier/wrangler.jsonc` (`EMAIL_FROM`, `EMAIL_FROM_NAME`,
`EMAIL_REPLY_TO`, `SMS_FROM`). Secrets:

| Secret | Value |
|---|---|
| `TELNYX_API_KEY` | Telnyx API v2 key |
| `ZITADEL_EMAIL_SIGNING_KEYS` | `signing_key` of the ZITADEL HTTP email provider |
| `ZITADEL_SMS_SIGNING_KEYS` | `signing_key` of the ZITADEL HTTP SMS provider |

Without a signing key every request is rejected with `401`. During a key rotation put
both keys, comma-separated (`new,old`), and drop the old one once ZITADEL uses the new.

```bash
cd maetry/notifier
npm ci
npm run check && npm test
npx wrangler deploy
npx wrangler secret put TELNYX_API_KEY   # and both signing keys
```

Setting up ZITADEL (Default settings). ZITADEL has no test call for HTTP providers,
so the provider is checked live right after activation:

1. Deploy the Worker and set `TELNYX_API_KEY`.
2. The console has no form for HTTP providers (v4.19), only the Admin API. With a
   token that has `iam.write` (IAM_OWNER), run `scripts/add-zitadel-providers.sh`: it
   creates both providers inactive, pointing at `/zitadel/email` and `/zitadel/sms`,
   and pipes each returned signing key into `ZITADEL_EMAIL_SIGNING_KEYS` /
   `ZITADEL_SMS_SIGNING_KEYS` without printing it.
3. Activate both (`scripts/activate-zitadel-provider.sh email|sms <id>`) and immediately trigger an email verification and a phone code on a
   test user. Check `npx wrangler tail zitadel-notifier` and the Telnyx logs.
4. Rollback: deactivate the provider in ZITADEL.

The toll-free sender reaches only US and Canada numbers; other countries need an
alphanumeric sender or a number pool (`messaging_profile_id` instead of `from`).
