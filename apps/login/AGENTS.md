# ZITADEL Login App Guide for AI Agents

## Context
The **Login App** (`apps/login`) provides the user interface for authentication flows (Login, Register, MFA, etc.). It is built with Next.js and React.

## Key Technology
- **Framework**: Next.js (React).
- **Styling**: TailwindCSS, configured via `apps/login/tailwind.config.mjs`.
- **Data Fetching**: Primarily server-side interaction with ZITADEL APIs via `@zitadel/client` or direct gRPC calls where applicable.
- **Language**: TypeScript.

## Architecture & Conventions
- **Routing**: Uses the Next.js App Router (routes are defined under `src/app/`).
- **Composability**: Components should be small and reusable.
- **State**: Critical authentication state is often managed via URL parameters (Auth Requests) and cookies/sessions.
- **Scope Rule**: For shared API typings and client behavior, also read `packages/AGENTS.md` and `proto/AGENTS.md`.

## Base Path & Redirects (critical — read before touching any redirect logic)
- **The login app is served under a non-root base path in production.** ZITADEL Cloud and the official container image are built with `NEXT_PUBLIC_BASE_PATH=/ui/v2/login` (see `apps/login/.env`; the value is inlined at build time by Next.js). Never assume the app lives at the domain root.
- **`constructUrl()` (`src/lib/service-url.ts`) prepends the base path and must ONLY ever receive root-relative paths** (`/loginname`, `/password?...`). Passing an absolute URL glues the base path onto it and produces a broken redirect like `https://<host>/ui/v2/loginhttps://login.microsoftonline.com/...`.
- **Some redirect targets ARE absolute URLs**: IdP authorize URLs returned by `startIdentityProviderFlow`, OIDC callback URLs from `createCallback`, and SAML endpoints from `createResponse`. When handling a redirect value that could be absolute, branch on `isExternalUrl()` first, validate absolute URLs with `isSafeRedirectUri()`, and pass them to `NextResponse.redirect` (server) / `window.location.href` (client) untouched. Canonical pattern: `resolveLoginHint` in `src/lib/server/flow-initiation.ts` and `handleServerActionResponse` in `src/lib/client-utils.ts`.
- **An empty base path masks this whole bug class**: with `NEXT_PUBLIC_BASE_PATH` unset, `new URL("" + absoluteUrl, origin)` still parses the absolute URL correctly, so local setups without the base path won't reproduce base-path bugs. Always test redirect changes with `NEXT_PUBLIC_BASE_PATH=/ui/v2/login` set, and verify the raw `Location` header (e.g. `curl -I`), not just browser behavior.

## Verified Nx Targets
- **Dev Server**: `pnpm nx run @zitadel/login:dev`
- **Build**: `pnpm nx run @zitadel/login:build`
- **Lint**: `pnpm nx run @zitadel/login:lint`
- **Test (all)**: `pnpm nx run @zitadel/login:test`
- **Test (unit)**: `pnpm nx run @zitadel/login:test-unit`
- **Test (integration)**: `pnpm nx run @zitadel/login:test-integration`
- **Pack (Docker)**: `pnpm nx run @zitadel/login:pack` — builds a local Docker image `zitadel/zitadel-login:local`. Requires Docker daemon.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
