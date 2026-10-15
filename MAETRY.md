# Maetry fork of ZITADEL

Only `apps/login` (Login V2) is customized and deployed from this fork. The ZITADEL
backend runs the official image; the login built here must match its version.

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

## Building for Cloudflare Workers

```bash
pnpm install --frozen-lockfile --filter "@zitadel/login..."
cd apps/login
NEXT_PUBLIC_BASE_PATH=/ui/v2/login NEXT_PUBLIC_MAETRY_CLOUDFLARE=true npx opennextjs-cloudflare build
```

Runtime configuration lives in `wrangler.jsonc`; the login client PAT is the Worker
secret `ZITADEL_SERVICE_USER_TOKEN`. The bundle is ~4.7 MB gzip, so it needs Workers Paid.
